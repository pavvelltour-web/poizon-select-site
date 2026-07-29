import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import ts from "typescript"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const catalogSourcePath = resolve(repoRoot, "src", "catalog", "catalog.ts")
const manifestPath = resolve(repoRoot, "public", "catalog", "sources.json")
const queuePath = resolve(repoRoot, "catalog-media", "regeneration-queue.json")
const outputPath = resolve(
  repoRoot,
  "catalog-media",
  "product-image-regeneration-prompts.json",
)

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

function stablePromptId(product, viewId) {
  return createHash("sha256")
    .update(`${product.slug}:${viewId}:${product.brand}:${product.name}`)
    .digest("hex")
    .slice(0, 16)
}

const viewLibrary = {
  "front-pair": "paired product front view, both pieces visible, centered with generous padding",
  "side-profile": "side profile with the full product visible and no cropped edges",
  "rear-profile": "rear/back profile showing back construction and seams",
  "top-down": "top-down catalog view, product centered and not cropped",
  "material-detail": "close ecommerce detail of material and texture while preserving product identity",
  "scale-pair": "paired product view showing scale, thickness and silhouette without props",
  "front-logo": "front product view with logo and panel layout visible",
  "side-panel": "side panel view showing geometry and seam layout",
  "rear-panel": "rear panel view with pattern continuity visible",
  "texture-detail": "close detail of surface texture, channels or pattern",
  "seam-detail": "close detail of seams, edges or panel junctions",
  "front-set": "front view of the set arranged neatly as a real product bundle",
  "side-set": "side view of the set with thickness and material profile visible",
  "stacked-view": "stacked set view, tidy ecommerce composition, one product bundle only",
  "color-range": "color range view arranged flat, no props or packaging",
  "front-loop": "front loop view with complete band shape visible",
  "side-loop": "side loop view showing band thickness and edge quality",
  "folded-view": "folded product view with clean textile/rubber structure",
  "front-end": "front end view showing cylinder or roll end details",
  "rear-end": "rear end view showing opposite end details",
  "control-detail": "close detail of controls, end cap or hardware construction",
  "scale-view": "plain scale-reading product view with full silhouette and thickness visible, no props",
  "front-roll": "front roll view with complete roll silhouette visible",
  "side-roll": "side roll view showing roll depth and edge",
  "strip-view": "single strip view laid flat, full product visible",
  "edge-detail": "close detail of product edge, thickness or cut",
  "front-profile": "front profile view, product upright or laid flat as appropriate",
  "fastener-detail": "close detail of fastening, strap or closure construction",
  "knit-detail": "close detail of knit/compression texture and stitching",
  "shape-detail": "close detail of anatomical shaping and edge construction",
  "cap-detail": "close detail of cap, lid or nozzle construction",
  "print-detail": "close detail of printed markings without adding extra text overlays",
  "logo-detail": "close detail of real visible branding implied by the product name",
  "front-three-quarter": "front three-quarter angle, slightly elevated camera, full product visible",
  "rear-three-quarter": "rear three-quarter angle showing back details, full product visible",
  "lateral-profile": "lateral side profile of the slide or shoe, full product visible",
  "medial-profile": "medial side profile of the slide or shoe, full product visible",
  "top-down-footbed": "top-down footbed view, complete upper opening and footbed shape visible",
  "outsole-view": "outsole view showing tread, sole geometry and molded details",
  "zipper-detail": "close detail of zipper, puller and seam construction",
  "handle-detail": "close detail of handle and fabric attachment",
  "strap-detail": "close detail of strap construction and attachment",
  "front-pack": "front view of the pack or pair arrangement, clean studio composition",
  "side-pack": "side view of the pack arrangement showing thickness and textile depth",
  "pair-view": "paired product view with natural ecommerce arrangement",
  "cuff-detail": "close detail of cuff, ribbing or sleeve edge",
  "fabric-detail": "close detail of textile weave, compression fabric or soft material texture",
  "side-pair": "side paired view with both pieces visible",
  "embroidery-detail": "close detail of embroidery texture and raised stitching",
  "brim-detail": "close detail of brim, stitching and crown junction",
}

const catalogSource = await readFile(catalogSourcePath, "utf8")
const products = loadCatalogProducts(catalogSource)
if (!Array.isArray(products) || products.length !== 100) {
  fail("catalogProducts must evaluate to exactly 100 products")
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const manifestSlugs = new Set(manifest.items?.map((item) => item.slug))
const productMap = new Map(products.map((product) => [product.slug, product]))
if (manifestSlugs.size !== productMap.size) {
  fail("manifest and catalog product counts differ")
}
for (const slug of productMap.keys()) {
  if (!manifestSlugs.has(slug)) fail(`${slug} is missing from catalog image manifest`)
}

const queue = JSON.parse(await readFile(queuePath, "utf8"))
if (queue.schema_version !== 1 || !Array.isArray(queue.items)) {
  fail("regeneration queue must use schema_version 1 and contain items")
}

const prompts = []
const productPayloads = []
for (const item of queue.items) {
  const product = productMap.get(item.slug)
  if (!product) fail(`${item.slug} is not present in catalogProducts`)
  if (item.replacement_required !== true) {
    fail(`${item.slug} must be marked replacement_required`)
  }
  if (!Array.isArray(item.requested_views) || item.requested_views.length < 4) {
    fail(`${item.slug} must request at least 4 views`)
  }
  if (item.requested_views.length > 7) {
    fail(`${item.slug} must request at most 7 views`)
  }
  if (!Array.isArray(item.research_queries) || item.research_queries.length === 0) {
    fail(`${item.slug} must contain research queries`)
  }

  const productPrompts = item.requested_views.map((viewId, index) => {
    const framing = viewLibrary[viewId]
    if (!framing) fail(`${item.slug} uses unknown view ${viewId}`)
    const publicOutputFile =
      index === 0
        ? `public/catalog/${product.slug}.webp`
        : index < 5
          ? `public/catalog/gallery/${product.slug}-${index + 1}.webp`
          : null
    const reviewOutputFile =
      publicOutputFile ?? `catalog-media/review-renders/${product.slug}-${index + 1}.webp`
    const prompt = [
      "Use case: ecommerce catalog product-shot regeneration.",
      "Model policy: use GPT Image 2.0 or newer.",
      "Research requirement before generation: clean-parse the exact target product from reliable public product pages; use the product name, category, silhouette, material cues, visible branding and color family from that research.",
      `Research queries to run first: ${item.research_queries.join(" | ")}.`,
      `Asset target: ${product.slug}.`,
      `Primary request: create a realistic studio product photograph of ${product.brand} ${product.name}.`,
      "Scene/backdrop: seamless pure white studio background with soft natural floor contact shadow.",
      `Subject constraints: preserve the original product type (${product.kind}), category (${product.category}), silhouette, proportions, colour family, materials, construction cues and visible product branding implied by the exact product name.`,
      `Known current issue to avoid: ${item.quality_issue}.`,
      "Style/medium: premium raster ecommerce photography, crisp product detail, not vector art, not illustration, not a 3D-looking mockup.",
      `Composition/framing: ${framing}.`,
      "Lighting/mood: clean diffused studio light, accurate shape readability, no dramatic colour cast.",
      "Hard constraints: one product only; no model, no hands, no extra props, no packaging unless the product itself is a retail pack; no text overlay; no watermark; no UI chrome; keep the complete product inside frame except explicit detail views.",
      "Negative prompt: abstract shapes, decorative blobs, fake labels, distorted logos, melted seams, cropped edges, duplicate products, generated-looking rubber/plastic, unreadable panel geometry.",
      "Verification after generation: compare against parsed source facts and reject if shape, pattern, material, logo placement or color family is materially wrong.",
    ].join("\n")

    return {
      id: stablePromptId(product, viewId),
      product_slug: product.slug,
      view: viewId,
      view_index: index,
      public_output_file: publicOutputFile,
      review_output_file: reviewOutputFile,
      model_policy: queue.model_policy,
      clean_parse_required: true,
      prompt,
      source_context: {
        brand: product.brand,
        name: product.name,
        query: product.query,
        category: product.category,
        kind: product.kind,
        priority: item.priority,
        quality_issue: item.quality_issue,
        research_queries: item.research_queries,
      },
    }
  })

  prompts.push(...productPrompts)
  productPayloads.push({
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    priority: item.priority,
    replacement_required: true,
    quality_issue: item.quality_issue,
    research_queries: item.research_queries,
    angle_set: item.requested_views,
    prompts: productPrompts.map((entry) => entry.prompt),
  })
}

const payload = {
  schema_version: 2,
  generated_at: new Date().toISOString(),
  generator: "scripts/export_gpt_image_prompts.mjs",
  source_queue: "catalog-media/regeneration-queue.json",
  image_model_policy:
    "Use GPT Image 2.0 or newer; import accepted first 5 views into public/catalog paths, keep extra views in catalog-media/review-renders, then update public/catalog/sources.json hashes.",
  product_count: productPayloads.length,
  prompt_count: prompts.length,
  view_count_range: {
    min: Math.min(...productPayloads.map((product) => product.angle_set.length)),
    max: Math.max(...productPayloads.map((product) => product.angle_set.length)),
  },
  products: productPayloads,
  prompts,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
console.log(
  `Exported ${prompts.length} GPT Image regeneration prompts for ${productPayloads.length} queued products`,
)
