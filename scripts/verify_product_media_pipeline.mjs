import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import ts from "typescript"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const catalogSourcePath = resolve(repoRoot, "src", "catalog", "catalog.ts")
const manifestPath = resolve(repoRoot, "public", "catalog", "sources.json")
const queuePath = resolve(repoRoot, "catalog-media", "regeneration-queue.json")
const promptsPath = resolve(
  repoRoot,
  "catalog-media",
  "product-image-regeneration-prompts.json",
)

function fail(message) {
  throw new Error(`Product media pipeline verification failed: ${message}`)
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

function assertText(value, field, minLength = 12) {
  if (typeof value !== "string" || value.trim().length < minLength) {
    fail(`${field} must be a descriptive string`)
  }
}

const [catalogSource, manifest, queue, promptExport] = await Promise.all([
  readFile(catalogSourcePath, "utf8"),
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(queuePath, "utf8").then(JSON.parse),
  readFile(promptsPath, "utf8").then(JSON.parse),
])

const products = loadCatalogProducts(catalogSource)
if (!Array.isArray(products) || products.length !== 100) {
  fail("catalogProducts must contain exactly 100 products")
}
const productSlugs = new Set(products.map((product) => product.slug))
const manifestSlugs = new Set(manifest.items?.map((item) => item.slug))
for (const slug of productSlugs) {
  if (!manifestSlugs.has(slug)) fail(`${slug} is missing from catalog manifest`)
}

if (queue.schema_version !== 1) fail("queue schema_version must be 1")
if (queue.model_policy !== "gpt-image-2-or-newer") {
  fail("queue model_policy must require GPT Image 2.0 or newer")
}
if (!Array.isArray(queue.items) || queue.items.length < 20) {
  fail("queue must contain at least 20 weak product assets")
}

const queuedSlugs = new Set()
let priorityOneCount = 0
let requestedViewCount = 0
for (const item of queue.items) {
  assertText(item.slug, "item.slug", 4)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) {
    fail(`${item.slug} is not a valid slug`)
  }
  if (queuedSlugs.has(item.slug)) fail(`duplicate queued slug ${item.slug}`)
  queuedSlugs.add(item.slug)
  if (!productSlugs.has(item.slug)) fail(`${item.slug} is not in catalogProducts`)
  if (item.replacement_required !== true) {
    fail(`${item.slug} must be marked replacement_required`)
  }
  if (![1, 2, 3].includes(item.priority)) {
    fail(`${item.slug} must have priority 1, 2 or 3`)
  }
  if (item.priority === 1) priorityOneCount += 1
  assertText(item.quality_issue, `${item.slug}.quality_issue`, 24)
  assertText(item.review_basis, `${item.slug}.review_basis`, 24)
  if (!Array.isArray(item.research_queries) || item.research_queries.length === 0) {
    fail(`${item.slug} must include research queries`)
  }
  for (const query of item.research_queries) {
    assertText(query, `${item.slug}.research_query`, 16)
  }
  if (!Array.isArray(item.requested_views)) {
    fail(`${item.slug} must include requested_views`)
  }
  if (item.requested_views.length < 4 || item.requested_views.length > 7) {
    fail(`${item.slug} must request 4-7 views`)
  }
  if (new Set(item.requested_views).size !== item.requested_views.length) {
    fail(`${item.slug} has duplicate requested views`)
  }
  requestedViewCount += item.requested_views.length
}
if (priorityOneCount < 15) {
  fail("queue must prioritize at least 15 high-impact weak assets")
}

if (promptExport.schema_version !== 2) fail("prompt export schema_version must be 2")
if (promptExport.source_queue !== "catalog-media/regeneration-queue.json") {
  fail("prompt export must reference the regeneration queue")
}
if (promptExport.product_count !== queue.items.length) {
  fail("prompt export product_count does not match queue")
}
if (promptExport.prompt_count !== requestedViewCount) {
  fail("prompt export prompt_count does not match requested views")
}
if (!Array.isArray(promptExport.products) || !Array.isArray(promptExport.prompts)) {
  fail("prompt export must contain products and prompts arrays")
}

const promptsBySlug = new Map()
for (const prompt of promptExport.prompts) {
  if (!queuedSlugs.has(prompt.product_slug)) {
    fail(`${prompt.product_slug} prompt is not in the queue`)
  }
  if (prompt.model_policy !== "gpt-image-2-or-newer") {
    fail(`${prompt.product_slug} prompt must require GPT Image 2.0+`)
  }
  if (prompt.clean_parse_required !== true) {
    fail(`${prompt.product_slug} prompt must require clean parsing`)
  }
  assertText(prompt.prompt, `${prompt.product_slug}.prompt`, 500)
  const requiredPhrases = [
    "clean-parse",
    "pure white studio background",
    "realistic studio product photograph",
    "not vector art",
    "not illustration",
    "one product only",
    "no watermark",
    "Verification after generation",
  ]
  for (const phrase of requiredPhrases) {
    if (!prompt.prompt.includes(phrase)) {
      fail(`${prompt.product_slug} prompt is missing required phrase: ${phrase}`)
    }
  }
  if (prompt.prompt.includes("decorative blobs") === false) {
    fail(`${prompt.product_slug} prompt must ban decorative blobs`)
  }
  const list = promptsBySlug.get(prompt.product_slug) ?? []
  list.push(prompt)
  promptsBySlug.set(prompt.product_slug, list)
}

for (const item of queue.items) {
  const prompts = promptsBySlug.get(item.slug) ?? []
  if (prompts.length !== item.requested_views.length) {
    fail(`${item.slug} prompt count does not match requested views`)
  }
  const promptViews = prompts.map((prompt) => prompt.view)
  if (JSON.stringify(promptViews) !== JSON.stringify(item.requested_views)) {
    fail(`${item.slug} prompt views are not in queue order`)
  }
  for (const [index, prompt] of prompts.entries()) {
    const expectedPublicFile =
      index === 0
        ? `public/catalog/${item.slug}.webp`
        : index < 5
          ? `public/catalog/gallery/${item.slug}-${index + 1}.webp`
          : null
    if (prompt.public_output_file !== expectedPublicFile) {
      fail(`${item.slug} public output file is incorrect for view ${index}`)
    }
    assertText(prompt.review_output_file, `${item.slug}.review_output_file`, 10)
  }
}

console.log(
  `Product media pipeline verified: ${queue.items.length} queued products, ${promptExport.prompts.length} GPT Image prompts`,
)
