import { createHash } from "node:crypto"
import { readFile, readdir, realpath } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readNormalizedWebpDimensions } from "./catalog_webp.mjs"

export const REQUIRED_ANGLES = ["lateral", "medial", "three-quarter", "rear", "outsole"]
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const HASH = /^[a-f0-9]{64}$/u
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const fail = (message) => { throw new Error(`Supplier catalog media verification failed: ${message}`) }

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim() || /[\p{Cc}]/u.test(value)) fail(`${field} must be nonempty text`)
}

function requireTimestamp(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+00:00)$/u.test(value)) {
    fail(`${field} must be an ISO-8601 UTC timestamp`)
  }
  const normalized = value.replace("+00:00", "Z")
  const parsed = Date.parse(normalized)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().replace(".000Z", "Z") !== normalized) {
    fail(`${field} must be a real UTC date and time`)
  }
}

function requireHttps(value, field) {
  requireText(value, field)
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname) throw new Error()
  } catch { fail(`${field} must be an HTTPS URL without credentials or a nonstandard port`) }
}

function requireHash(value, field) {
  if (typeof value !== "string" || !HASH.test(value)) fail(`${field} must be a lowercase SHA-256`)
}

function requireRelativePath(value, field, prefix) {
  requireText(value, field)
  if (value.includes("\\") || value.includes(":") || value.startsWith("/") || value.split("/").some((part) => !part || part === "." || part === "..") ||
    (prefix && !value.startsWith(prefix))) fail(`${field} must be a safe project-relative path${prefix ? ` under ${prefix}` : ""}`)
}

function within(root, target) {
  const relative = path.relative(root, target)
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

async function readContainedFile(projectRoot, relative, field, prefix) {
  requireRelativePath(relative, field, prefix)
  const root = await realpath(projectRoot)
  const location = path.resolve(root, relative)
  const actual = await realpath(location).catch(() => fail(`${field} is missing: ${relative}`))
  if (!within(root, actual)) fail(`${field} resolves outside the project`)
  if (prefix) {
    const allowed = await realpath(path.resolve(root, prefix))
    if (!within(allowed, actual)) fail(`${field} resolves outside ${prefix}`)
  }
  return readFile(actual)
}

async function verifySource(source, projectRoot, field) {
  if (!source || typeof source !== "object") fail(`${field} must identify its downloaded source`)
  requireHttps(source.source_url, `${field}.source_url`)
  requireHash(source.source_sha256, `${field}.source_sha256`)
  const bytes = await readContainedFile(projectRoot, source.source_download_path, `${field}.source_download_path`, "catalog-media/intake/")
  if (sha256(bytes) !== source.source_sha256) fail(`${field} downloaded source hash mismatch`)
}

async function verifyProvenance(provenance, projectRoot, field) {
  if (!provenance || !["supplier-normalized", "official-original", "generated-reference"].includes(provenance.kind)) {
    fail(`${field} has an unsupported or missing provenance kind`)
  }
  if (provenance.kind === "generated-reference") {
    if (provenance.official_product_photo !== false) fail(`${field} generated reference must not claim official photography`)
    if (provenance.generator !== "built-in image_gen") fail(`${field} must identify the actual built-in image_gen generator`)
    requireTimestamp(provenance.generated_at, `${field}.generated_at`)
    requireHash(provenance.prompt_sha256, `${field}.prompt_sha256`)
    const prompt = await readContainedFile(projectRoot, provenance.prompt_path, `${field}.prompt_path`)
    // Prompt hashes use LF-normalized UTF-8 so Windows checkout conversion cannot invalidate evidence.
    if (!prompt.toString("utf8").trim() || sha256(prompt.toString("utf8").replace(/\r\n?/gu, "\n")) !== provenance.prompt_sha256) {
      fail(`${field} generation prompt hash mismatch`)
    }
    if (!Array.isArray(provenance.references) || provenance.references.length === 0) fail(`${field} needs exact model/colour reference sources`)
    const referenceHashes = new Set()
    for (const [index, reference] of provenance.references.entries()) {
      await verifySource(reference, projectRoot, `${field}.references[${index}]`)
      if (referenceHashes.has(reference.source_sha256)) fail(`${field} repeats a generation reference`)
      referenceHashes.add(reference.source_sha256)
    }
    return
  }
  if (provenance.generator && /image[_ -]?gen|gpt[ -]?image|generative/iu.test(provenance.generator)) {
    fail(`${field} generated pixels must use generated-reference provenance`)
  }
  await verifySource(provenance, projectRoot, field)
  if (provenance.kind === "supplier-normalized") {
    if (provenance.official_product_photo !== false) fail(`${field} supplier CDN discovery is not proof of official photography`)
    if (provenance.rights && provenance.rights.status !== "unverified") {
      fail(`${field} supplier-normalized provenance must not claim verified reuse rights`)
    }
  } else {
    if (provenance.official_product_photo !== true) fail(`${field} official-original must identify an actual official photo`)
    requireText(provenance.source_provider, `${field}.source_provider`)
    requireHttps(provenance.product_url, `${field}.product_url`)
    if (!provenance.rights || !["owner-authorized", "licensed"].includes(provenance.rights.status)) fail(`${field} official source needs explicit reuse evidence`)
    requireText(provenance.rights.evidence, `${field}.rights.evidence`)
  }
}

async function listAssetFiles(directory, prefix = "") {
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
    if (error.code === "ENOENT") return []
    throw error
  }
  const files = []
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`
    if (entry.isSymbolicLink()) fail(`supplier asset tree must not contain symlinks: ${relative}`)
    if (entry.isDirectory()) files.push(...await listAssetFiles(path.join(directory, entry.name), `${relative}/`))
    else if (entry.isFile()) files.push(`/catalog/supplier/${relative}`)
    else fail(`unsupported supplier asset entry: ${relative}`)
  }
  return files.sort()
}

export async function verifySupplierCatalogMedia({
  projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  manifestPath = "catalog-media/supplier-catalog-media.json",
  requireComplete = false,
  requireActivatedComplete = false,
  catalogMetadataPath,
} = {}) {
  const manifest = JSON.parse(await readContainedFile(projectRoot, manifestPath, "manifestPath", "catalog-media/"))
  if (manifest.schema_version !== 1) fail("unexpected manifest schema")
  requireTimestamp(manifest.generated_at, "generated_at")
  if (!same(manifest.standard?.dimensions, [1600, 1200]) || !same(manifest.standard?.background_rgb, [242, 243, 243]) ||
    manifest.standard?.safe_margin_ratio !== 0.08 || !same(manifest.standard?.required_angles, REQUIRED_ANGLES)) {
    fail("standard must preserve the LeBron 1600×1200 cold-gray, 8% margin and ordered five-angle contract")
  }
  if (!Array.isArray(manifest.expected_product_slugs) || manifest.expected_product_slugs.length === 0 ||
    manifest.expected_product_slugs.some((slug) => typeof slug !== "string" || !SLUG.test(slug)) ||
    new Set(manifest.expected_product_slugs).size !== manifest.expected_product_slugs.length) {
    fail("expected_product_slugs must be a nonempty unique supplier-footwear inventory")
  }
  if (!Array.isArray(manifest.products)) fail("products must be an array")
  const expected = [...manifest.expected_product_slugs].sort()
  if (!same(manifest.products.map((product) => product?.slug).sort(), expected)) fail("products must exactly cover expected_product_slugs")
  let metadataBySlug
  if (catalogMetadataPath) {
    const metadata = JSON.parse(await readFile(catalogMetadataPath, "utf8"))
    if (!Array.isArray(metadata)) fail("catalog metadata must be an array")
    const footwear = metadata.filter((product) => product.kind === "footwear")
    if (!same(footwear.map((product) => product.slug).sort(), expected)) fail("expected_product_slugs do not match the independent supplier footwear metadata")
    const references = new Map(footwear.map((product) => [product.slug, product.product_ref]))
    if (manifest.products.some((product) => product.product_ref !== references.get(product.slug))) fail("product_ref differs from independent supplier metadata")
    metadataBySlug = new Map(footwear.map((product) => [product.slug, product]))
  }

  const files = new Set()
  const outputHashes = new Set()
  const productRefs = new Set()
  const incomplete = []
  const incompleteActivated = []
  const kinds = { "supplier-normalized": 0, "official-original": 0, "generated-reference": 0 }
  let approvedFrames = 0
  for (const product of manifest.products) {
    const label = product.slug
    requireHash(product.product_ref, `${label}.product_ref`)
    if (productRefs.has(product.product_ref)) fail(`${label} duplicates a product_ref`)
    productRefs.add(product.product_ref)
    if (!Array.isArray(product.frames) || product.frames.length > 5) fail(`${label} must record 0–5 active frames`)
    const knownAngles = new Set()
    const pendingPositions = []
    for (const [index, frame] of product.frames.entries()) {
      const field = `${label}.frames[${index}]`
      if (!frame || frame.position !== index + 1) fail(`${field} positions must be consecutive from 1`)
      if (frame.angle !== "unknown" && !REQUIRED_ANGLES.includes(frame.angle)) fail(`${field} has an unsupported angle`)
      if (frame.angle !== "unknown") {
        if (knownAngles.has(frame.angle)) fail(`${field} repeats a canonical angle`)
        knownAngles.add(frame.angle)
      }
      if (typeof frame.file !== "string" || !frame.file.startsWith("/catalog/supplier/") || !frame.file.endsWith(".webp")) fail(`${field} must use a local /catalog/supplier/ WebP`)
      if (frame.file !== `/catalog/supplier/${product.slug}-${frame.position}.webp`) {
        fail(`${field}.file must match the exact product slug and frame position`)
      }
      const output = await readContainedFile(projectRoot, `public${frame.file}`, `${field}.file`, "public/catalog/supplier/")
      if (files.has(frame.file)) fail(`${field} duplicates an active image path`)
      files.add(frame.file)
      requireHash(frame.output_sha256, `${field}.output_sha256`)
      const hash = sha256(output)
      if (hash !== frame.output_sha256 || output.length !== frame.output_bytes) fail(`${field} output hash or byte size mismatch`)
      if (outputHashes.has(hash)) fail(`${field} duplicates another active image's pixels`)
      outputHashes.add(hash)
      let dimensions
      try { dimensions = readNormalizedWebpDimensions(output) } catch (error) { fail(`${field}: ${error.message}`) }
      if (!same(dimensions, [1600, 1200]) || !same(frame.output_dimensions, dimensions)) fail(`${field} is not the recorded normalized 1600×1200 image`)
      await verifyProvenance(frame.provenance, projectRoot, `${field}.provenance`)
      if (metadataBySlug && frame.provenance.kind === "supplier-normalized") {
        const sourceImages = metadataBySlug.get(product.slug).images
        if (!Array.isArray(sourceImages) || !sourceImages.includes(frame.provenance.source_url)) {
          fail(`${field} supplier source URL is not among this exact product's metadata images`)
        }
      }
      kinds[frame.provenance.kind] += 1
      if (!frame.visual_review || !["approved", "pending"].includes(frame.visual_review.status)) fail(`${field} must explicitly record visual review status`)
      if (frame.visual_review.status === "approved") {
        if (frame.visual_review.output_sha256 !== hash) fail(`${field} visual approval is stale or not bound to these pixels`)
        requireTimestamp(frame.visual_review.reviewed_at, `${field}.visual_review.reviewed_at`)
        requireText(frame.visual_review.evidence, `${field}.visual_review.evidence`)
        approvedFrames += 1
      } else pendingPositions.push(frame.position)
    }
    const missing = REQUIRED_ANGLES.filter((angle) => !knownAngles.has(angle))
    if (!same(product.missing_angles, missing)) fail(`${label}.missing_angles must truthfully list absent canonical angles in standard order`)
    const orderMismatch = product.frames.some((frame, index) => frame.angle !== REQUIRED_ANGLES[index])
    if (missing.length || pendingPositions.length || orderMismatch) {
      const record = { slug: label, missing_angles: missing, pending_review_positions: pendingPositions, order_mismatch: orderMismatch }
      incomplete.push(record)
      if (product.frames.length > 0) incompleteActivated.push(record)
    }
  }
  const diskFiles = await listAssetFiles(path.join(projectRoot, "public/catalog/supplier"))
  if (!same(diskFiles, [...files].sort())) fail("supplier manifest files must exactly match all files in public/catalog/supplier (no untracked or missing assets)")
  const report = {
    product_count: manifest.products.length,
    frame_count: files.size,
    approved_frame_count: approvedFrames,
    complete_product_count: manifest.products.length - incomplete.length,
    standardized: incomplete.length === 0,
    activated_product_count: manifest.products.filter((product) => product.frames.length > 0).length,
    activated_complete: incompleteActivated.length === 0,
    incomplete_activated: incompleteActivated,
    provenance_counts: kinds,
    incomplete,
    note: "File integrity and declared evidence were checked. This does not independently prove pixel composition, model/colour identity, source ownership, or reuse rights.",
  }
  if (requireComplete && !report.standardized) fail(`standardization incomplete for ${incomplete.length}/${report.product_count} products; first ${Math.min(5, incomplete.length)}: ${JSON.stringify(incomplete.slice(0, 5))}`)
  if (requireActivatedComplete && report.activated_product_count === 0) fail("no supplier galleries are activated")
  if (requireActivatedComplete && !report.activated_complete) {
    fail(`activated gallery standardization incomplete for ${incompleteActivated.length}/${report.activated_product_count} products; first ${Math.min(5, incompleteActivated.length)}: ${JSON.stringify(incompleteActivated.slice(0, 5))}`)
  }
  return report
}

export function formatSupplierMediaReport(report) {
  return `Supplier catalog file integrity verified: ${report.product_count} products, ${report.frame_count} local 1600×1200 WebP frames; ` +
    `${report.approved_frame_count} frames have hash-bound visual review; ${report.complete_product_count}/${report.product_count} complete five-angle sets; ` +
    `${report.activated_product_count} galleries activated and ${report.activated_complete ? "all activated galleries are complete" : `${report.incomplete_activated.length} activated galleries are incomplete`}. ` +
    (report.standardized ? "All declared angle/review records are complete." :
      `STANDARDIZATION INCOMPLETE: ${report.incomplete.length} products; first ${Math.min(5, report.incomplete.length)}: ${JSON.stringify(report.incomplete.slice(0, 5))}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--require-complete") options.requireComplete = true
    else if (argument === "--require-activated-complete") options.requireActivatedComplete = true
    else if (["--project-root", "--manifest", "--catalog-metadata"].includes(argument) && args[index + 1] && !args[index + 1].startsWith("--")) {
      const key = { "--project-root": "projectRoot", "--manifest": "manifestPath", "--catalog-metadata": "catalogMetadataPath" }[argument]
      options[key] = args[++index]
    } else fail(`unknown or incomplete argument: ${argument}`)
  }
  console.log(formatSupplierMediaReport(await verifySupplierCatalogMedia(options)))
}
