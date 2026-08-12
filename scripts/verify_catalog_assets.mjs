import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalogDir = path.join(siteRoot, "public", "catalog")
const galleryDir = path.join(catalogDir, "gallery")
const manifestPath = path.join(catalogDir, "sources.json")
const expectedRootAssets = 100
const expectedGalleryAssets = expectedRootAssets * 4

function fail(message) {
  throw new Error(`Catalog verification failed: ${message}`)
}

function readNormalizedWebpDimensions(bytes) {
  if (
    bytes.length < 30 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    fail("a catalog file is not a RIFF WebP image")
  }

  const declaredLength = bytes.readUInt32LE(4) + 8
  if (declaredLength !== bytes.length) {
    fail("a WebP RIFF length does not exactly match the file")
  }

  const chunks = []
  let offset = 12
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      fail("a WebP has a truncated chunk header")
    }
    const name = bytes.toString("ascii", offset, offset + 4)
    const length = bytes.readUInt32LE(offset + 4)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const paddedEnd = dataEnd + (length % 2)
    if (dataEnd > bytes.length || paddedEnd > bytes.length) {
      fail(`a WebP ${JSON.stringify(name)} chunk exceeds the RIFF boundary`)
    }
    if (length % 2 === 1 && bytes[dataEnd] !== 0) {
      fail(`a WebP ${JSON.stringify(name)} chunk has non-zero padding`)
    }
    chunks.push({ name, dataStart, length })
    offset = paddedEnd
  }
  if (offset !== bytes.length) fail("a WebP has trailing bytes")
  if (
    chunks.length !== 1 ||
    !["VP8 ", "VP8L"].includes(chunks[0].name)
  ) {
    fail(
      "normalized catalog WebP may contain only one VP8/VP8L image chunk (no metadata or animation)",
    )
  }

  const { name, dataStart, length } = chunks[0]
  if (name === "VP8 ") {
    if (
      length < 10 ||
      bytes[dataStart + 3] !== 0x9d ||
      bytes[dataStart + 4] !== 0x01 ||
      bytes[dataStart + 5] !== 0x2a
    ) {
      fail("a VP8 image has an invalid key-frame signature")
    }
    return [
      bytes.readUInt16LE(dataStart + 6) & 0x3fff,
      bytes.readUInt16LE(dataStart + 8) & 0x3fff,
    ]
  }

  if (name === "VP8L") {
    if (length < 5 || bytes[dataStart] !== 0x2f) {
      fail("a VP8L image has an invalid signature")
    }
    const packed = bytes.readUInt32LE(dataStart + 1)
    return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1]
  }
}

function requireUtcTimestamp(value, field) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+00:00)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(`${field} must be an ISO-8601 UTC timestamp`)
  }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
if (manifest.schema_version !== 2) fail("unexpected manifest schema")
if (!Array.isArray(manifest.items) || manifest.items.length !== expectedRootAssets) {
  fail(`manifest must contain exactly ${expectedRootAssets} items`)
}
if (
  typeof manifest.notice !== "string" ||
  !manifest.notice.includes("project-generated originals") ||
  !manifest.notice.includes("Poizon product-page originals") ||
  !manifest.notice.includes("not proof of an exact product match") ||
  !manifest.notice.includes("server-published SKU")
) {
  fail("manifest must retain the generated and Poizon-reference caveats")
}
requireUtcTimestamp(manifest.generated_at, "generated_at")

const diskFiles = (await readdir(catalogDir))
  .filter((file) => file.endsWith(".webp"))
  .sort()
const manifestFiles = manifest.items.map((item) => item.file).sort()

if (
  diskFiles.length !== expectedRootAssets ||
  JSON.stringify(diskFiles) !== JSON.stringify(manifestFiles)
) {
  fail(`the ${expectedRootAssets} manifest files must exactly match the WebP files on disk`)
}

const manifestSlugs = manifest.items.map((item) => item.slug)
if (
  manifestSlugs.length !== expectedRootAssets ||
  new Set(manifestSlugs).size !== expectedRootAssets
) {
  fail(`image-provenance slugs must remain a unique ${expectedRootAssets}-file fallback set`)
}

const galleryFiles = (await readdir(galleryDir))
  .filter((file) => file.endsWith(".webp"))
  .sort()
if (galleryFiles.length !== expectedGalleryAssets) {
  fail(`gallery must contain exactly ${expectedGalleryAssets} local WebP files`)
}
for (const slug of manifestSlugs) {
  for (let index = 2; index <= 5; index += 1) {
    if (!galleryFiles.includes(`${slug}-${index}.webp`)) {
      fail(`${slug} is missing gallery view ${index}`)
    }
  }
}

const slugs = new Set()
const hashes = new Set()
const generatedUsage =
  "original visual reference; exact product, colour, size, availability and price must pass server-side catalog validation before order"
const poizonUsage =
  "Poizon product-page visual reference; exact product, colour, size, availability and price must pass server-side catalog validation before order"
const supplierUsage =
  "Official product-image visual reference; exact product, colour, size, availability and price must pass server-side catalog validation before order"
for (const item of manifest.items) {
  if (
    typeof item.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
  ) {
    fail("a slug is invalid")
  }
  if (slugs.has(item.slug)) fail(`duplicate slug ${item.slug}`)
  slugs.add(item.slug)

  if (item.file !== `${item.slug}.webp`) {
    fail(`${item.slug} has an unexpected filename`)
  }
  const provenance = item.provenance
  const isGeneratedOriginal =
    provenance && ["ai-generated-original", "project-generated-original"].includes(provenance.kind)
  const isGeneratedDerivative = provenance?.kind === "project-generated-derivative"
  const isPoizonOriginal = provenance?.kind === "poizon-original"
  const isSupplierOriginal = provenance?.kind === "supplier-original"
  if (
    !provenance ||
    typeof provenance.generator !== "string" ||
    provenance.generator.length < 16 ||
    (!isGeneratedOriginal && !isGeneratedDerivative && !isPoizonOriginal && !isSupplierOriginal)
  ) {
    fail(`${item.slug} has incomplete media provenance`)
  }
  if (isGeneratedOriginal) {
    if (provenance.official_product_photo !== false) {
      fail(`${item.slug} generated reference must not be marked as an official photo`)
    }
    requireUtcTimestamp(provenance.generated_at, `${item.slug}.generated_at`)
    if (provenance.generated_at !== manifest.generated_at) {
      fail(`${item.slug} timestamp does not match the manifest generation`)
    }
    if (item.usage !== generatedUsage) {
      fail(`${item.slug} must retain the generated-reference usage marker`)
    }
  }
  if (isGeneratedDerivative) {
    if (
      provenance.official_product_photo !== false ||
      typeof provenance.origin_reference !== "string" ||
      !provenance.origin_reference.startsWith("catalog-media/generated-reference/") ||
      !/^[a-f0-9]{64}$/.test(provenance.origin_sha256 ?? "") ||
      typeof provenance.normalized_from !== "string"
    ) {
      fail(`${item.slug} has incomplete generated-derivative provenance`)
    }

    const isSupplierBackedDerivative =
      typeof provenance.source_provider === "string" &&
      provenance.source_provider.length >= 8 &&
      typeof provenance.source_url === "string" &&
      provenance.source_url.startsWith("https://")
    if (isSupplierBackedDerivative) {
      if (item.usage !== supplierUsage || item.rights?.status !== "licensed") {
        fail(`${item.slug} must retain licensed supplier-derivative provenance`)
      }
    } else {
      requireUtcTimestamp(provenance.generated_at, `${item.slug}.generated_at`)
      if (provenance.generated_at !== manifest.generated_at) {
        fail(`${item.slug} timestamp does not match the manifest generation`)
      }
      if (item.usage !== generatedUsage || item.rights?.status !== "owned") {
        fail(`${item.slug} must retain owned generated-derivative provenance`)
      }
    }
  }
  if (isPoizonOriginal) {
    if (
      provenance.official_product_photo !== true ||
      typeof provenance.origin_reference !== "string" ||
      !provenance.origin_reference.startsWith("catalog-media/intake/") ||
      !/^[a-f0-9]{64}$/.test(provenance.origin_sha256 ?? "") ||
      typeof provenance.normalized_from !== "string"
    ) {
      fail(`${item.slug} has incomplete Poizon source provenance`)
    }
    if (item.usage !== poizonUsage) {
      fail(`${item.slug} must retain the Poizon-reference usage marker`)
    }
  }
  if (isSupplierOriginal) {
    if (
      provenance.official_product_photo !== true ||
      typeof provenance.source_provider !== "string" ||
      provenance.source_provider.length < 8 ||
      typeof provenance.source_url !== "string" ||
      !provenance.source_url.startsWith("https://") ||
      typeof provenance.origin_reference !== "string" ||
      !provenance.origin_reference.startsWith("catalog-media/intake/official-brand/") ||
      !/^[a-f0-9]{64}$/.test(provenance.origin_sha256 ?? "") ||
      typeof provenance.normalized_from !== "string"
    ) {
      fail(`${item.slug} has incomplete official supplier provenance`)
    }
    if (item.usage !== supplierUsage) {
      fail(`${item.slug} must retain the official supplier usage marker`)
    }
  }
  if (
    !item.rights ||
    typeof item.rights.license_reference !== "string" ||
    item.rights.license_reference.length < 12 ||
    (isGeneratedOriginal && item.rights.status !== "owned") ||
    ((isPoizonOriginal || isSupplierOriginal) && item.rights.status !== "licensed")
  ) {
    fail(`${item.slug} has incomplete media rights provenance`)
  }
  requireUtcTimestamp(item.rights.verified_at, `${item.slug}.rights.verified_at`)

  const bytes = await readFile(path.join(catalogDir, item.file))
  const digest = createHash("sha256").update(bytes).digest("hex")
  if (digest !== item.output_sha256 || bytes.length !== item.output_bytes) {
    fail(`${item.file} does not match its recorded hash and size`)
  }
  if (hashes.has(digest)) fail(`${item.file} duplicates another product image`)
  hashes.add(digest)

  const dimensions = readNormalizedWebpDimensions(bytes)
  if (
    dimensions[0] !== 1600 ||
    dimensions[1] !== 1200 ||
    JSON.stringify(dimensions) !== JSON.stringify(item.output_dimensions)
  ) {
    fail(`${item.file} is not the recorded 1600×1200 image`)
  }
}

console.log(
  `Catalog assets verified: ${expectedRootAssets} unique local 1600×1200 WebP files and ${expectedGalleryAssets} gallery files`,
)
