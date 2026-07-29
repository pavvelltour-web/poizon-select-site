import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import ts from "typescript"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const catalogSourcePath = resolve(repoRoot, "src", "catalog", "catalog.ts")
const manifestPath = resolve(repoRoot, "public", "catalog", "sources.json")
const outputPath = resolve(repoRoot, "generated", "product-image-prompts.json")

function fail(message) {
  throw new Error(`GPT image prompt export failed: ${message}`)
}

function loadCatalogProducts(source) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      verbatimModuleSyntax: false,
    },
  }).outputText

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(specifier) {
      fail(`unexpected runtime import while loading catalog.ts: ${specifier}`)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, {
    filename: catalogSourcePath,
    timeout: 5000,
  })
  return sandbox.module.exports.catalogProducts
}

function stablePromptId(product, view) {
  return createHash("sha256")
    .update(`${product.slug}:${view.id}:${product.brand}:${product.name}`)
    .digest("hex")
    .slice(0, 16)
}

const views = [
  {
    id: "side-left",
    label: "left side profile",
    framing: "full product, left-facing side profile, centered with generous padding",
  },
  {
    id: "front-three-quarter",
    label: "front three-quarter",
    framing: "front three-quarter angle, slightly elevated camera, full product visible",
  },
  {
    id: "rear-three-quarter",
    label: "rear three-quarter",
    framing: "rear three-quarter angle showing heel/back details, full product visible",
  },
  {
    id: "top-down",
    label: "top-down",
    framing: "top-down catalog view, product centered and not cropped",
  },
  {
    id: "detail-material",
    label: "material detail",
    framing: "close catalog detail of material, texture and construction while keeping the product identity clear",
  },
]

const catalogSource = await readFile(catalogSourcePath, "utf8")
const products = loadCatalogProducts(catalogSource)
if (!Array.isArray(products) || products.length !== 100) {
  fail("catalogProducts must evaluate to exactly 100 products")
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const manifestSlugs = new Set(manifest.items?.map((item) => item.slug))
const productSlugs = new Set(products.map((product) => product.slug))
if (manifestSlugs.size !== productSlugs.size) {
  fail("manifest and catalog product counts differ")
}
for (const slug of productSlugs) {
  if (!manifestSlugs.has(slug)) fail(`${slug} is missing from catalog image manifest`)
}

const prompts = products.flatMap((product) =>
  views.map((view, index) => ({
    id: stablePromptId(product, view),
    product_slug: product.slug,
    output_file:
      index === 0
        ? `public/catalog/${product.slug}.webp`
        : `public/catalog/gallery/${product.slug}-${index + 1}.webp`,
    view: view.id,
    model_policy: "gpt-image-2-or-newer",
    prompt: [
      "Use case: product-mockup",
      `Asset type: ecommerce catalog product shot for ${product.slug}`,
      `Primary request: create a studio product photograph of ${product.brand} ${product.name}.`,
      "Scene/backdrop: seamless pure white studio background with soft natural floor contact shadow.",
      `Subject: ${product.brand} ${product.name}; preserve the original product type, silhouette, proportions, colour family, materials and visible construction cues implied by the exact product name.`,
      "Style/medium: realistic premium ecommerce product photography, crisp raster image, not vector art, not illustration.",
      `Composition/framing: ${view.framing}.`,
      "Lighting/mood: clean diffused studio light, accurate shape readability, no dramatic colour cast.",
      "Constraints: one product only; no model, no hands, no extra props, no packaging, no text overlay, no watermark; keep the entire product inside frame; white background; high product fidelity.",
      "Avoid: abstract shapes, vector rendering, fake UI chrome, decorative blobs, extra logos beyond the product's real visible branding, distorted soles, unreadable construction, cropped edges.",
    ].join("\n"),
    source_context: {
      brand: product.brand,
      name: product.name,
      query: product.query,
      category: product.category,
      kind: product.kind,
      expected_gallery_size: 5,
      manifest_file: `${product.slug}.webp`,
    },
  })),
)

const payload = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  generator: "scripts/export_gpt_image_prompts.mjs",
  image_model_policy: "Use built-in imagegen/GPT Image 2.0 or newer; import selected outputs into the listed WebP paths and update public/catalog/sources.json hashes.",
  product_count: products.length,
  prompt_count: prompts.length,
  views: views.map(({ id, label }) => ({ id, label })),
  prompts,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
console.log(`Exported ${prompts.length} GPT Image prompts for ${products.length} products`)
