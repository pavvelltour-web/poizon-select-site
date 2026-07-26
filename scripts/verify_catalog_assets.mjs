import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalogDir = path.join(siteRoot, "public", "catalog")
const manifestPath = path.join(catalogDir, "sources.json")

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
if (!Array.isArray(manifest.items) || manifest.items.length !== 60) {
  fail("manifest must contain exactly 60 items")
}
if (
  typeof manifest.notice !== "string" ||
  !manifest.notice.includes("project-generated originals") ||
  !manifest.notice.includes("not official manufacturer photography") ||
  !manifest.notice.includes("confirm the exact SKU")
) {
  fail("manifest must retain the generated-reference caveat")
}
requireUtcTimestamp(manifest.generated_at, "generated_at")

const diskFiles = (await readdir(catalogDir))
  .filter((file) => file.endsWith(".webp"))
  .sort()
const manifestFiles = manifest.items.map((item) => item.file).sort()

if (
  diskFiles.length !== 60 ||
  JSON.stringify(diskFiles) !== JSON.stringify(manifestFiles)
) {
  fail("the 60 manifest files must exactly match the WebP files on disk")
}

const catalogSource = await readFile(
  path.join(siteRoot, "src", "catalog", "catalog.ts"),
  "utf8",
)
const appSlugs = [
  ...catalogSource.matchAll(/\bslug:\s*"([a-z0-9-]+)"/g),
].map((match) => match[1])
const manifestSlugs = manifest.items.map((item) => item.slug)
if (
  appSlugs.length !== 60 ||
  new Set(appSlugs).size !== 60 ||
  JSON.stringify([...appSlugs].sort()) !==
    JSON.stringify([...manifestSlugs].sort())
) {
  fail("application products and image-provenance slugs must match exactly")
}

const slugs = new Set()
const hashes = new Set()
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
  if (
    !provenance ||
    !["ai-generated-original", "project-generated-original"].includes(
      provenance.kind,
    ) ||
    typeof provenance.generator !== "string" ||
    provenance.generator.length < 16 ||
    provenance.official_product_photo !== false
  ) {
    fail(`${item.slug} has incomplete generated-art provenance`)
  }
  requireUtcTimestamp(provenance.generated_at, `${item.slug}.generated_at`)
  if (provenance.generated_at !== manifest.generated_at) {
    fail(`${item.slug} timestamp does not match the manifest generation`)
  }
  if (
    item.usage !==
    "original visual reference; exact product, colour, size, availability and price must be confirmed before order"
  ) {
    fail(`${item.slug} must retain the generated-reference usage marker`)
  }

  const bytes = await readFile(path.join(catalogDir, item.file))
  const digest = createHash("sha256").update(bytes).digest("hex")
  if (digest !== item.output_sha256 || bytes.length !== item.output_bytes) {
    fail(`${item.file} does not match its recorded hash and size`)
  }
  if (hashes.has(digest)) fail(`${item.file} duplicates another product image`)
  hashes.add(digest)

  const dimensions = readNormalizedWebpDimensions(bytes)
  if (
    dimensions[0] !== 1200 ||
    dimensions[1] !== 900 ||
    JSON.stringify(dimensions) !== JSON.stringify(item.output_dimensions)
  ) {
    fail(`${item.file} is not the recorded 1200×900 image`)
  }
}

console.log("Catalog assets verified: 60 unique local 1200×900 WebP files")
