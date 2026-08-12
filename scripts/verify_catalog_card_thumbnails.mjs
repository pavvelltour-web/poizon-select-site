import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const unifiedPath = path.join(root, "catalog-media", "unified-catalog-media.json")
const thumbnailDir = path.join(root, "public", "catalog", "thumbs")
const thumbnailManifestPath = path.join(thumbnailDir, "manifest.json")
const runtimeManifestPath = path.join(root, "src", "catalog", "card-thumbnail-versions.ts")
const widths = [640, 960, 1280]

function fail(message) {
  throw new Error(`Card thumbnail verification failed: ${message}`)
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
}

function webpDimensions(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    fail("thumbnail is not a RIFF WebP file")
  }

  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const chunk = buffer.toString("ascii", offset, offset + 4)
    const length = buffer.readUInt32LE(offset + 4)
    const payload = offset + 8
    if (payload + length > buffer.length) fail("thumbnail WebP chunk exceeds file length")

    if (chunk === "VP8X" && length >= 10) {
      return {
        width: readUint24LE(buffer, payload + 4) + 1,
        height: readUint24LE(buffer, payload + 7) + 1,
      }
    }
    if (chunk === "VP8 " && length >= 10) {
      if (buffer[payload + 3] !== 0x9d || buffer[payload + 4] !== 0x01 || buffer[payload + 5] !== 0x2a) {
        fail("thumbnail VP8 frame header is invalid")
      }
      return {
        width: buffer.readUInt16LE(payload + 6) & 0x3fff,
        height: buffer.readUInt16LE(payload + 8) & 0x3fff,
      }
    }
    if (chunk === "VP8L" && length >= 5) {
      if (buffer[payload] !== 0x2f) fail("thumbnail VP8L frame header is invalid")
      return {
        width: 1 + ((buffer[payload + 1] | (buffer[payload + 2] << 8)) & 0x3fff),
        height: 1 + (((buffer[payload + 2] >> 6) | (buffer[payload + 3] << 2) | (buffer[payload + 4] << 10)) & 0x3fff),
      }
    }
    offset = payload + length + (length % 2)
  }
  fail("thumbnail WebP is missing a supported image chunk")
}

const unified = JSON.parse(await readFile(unifiedPath, "utf8"))
const thumbnailManifest = JSON.parse(await readFile(thumbnailManifestPath, "utf8"))
if (
  thumbnailManifest.schema_version !== 1 ||
  JSON.stringify(thumbnailManifest.widths) !== JSON.stringify(widths) ||
  thumbnailManifest.aspect_ratio !== "4:3"
) {
  fail("manifest must declare the 640/960/1280 responsive 4:3 thumbnail contract")
}

const expected = []
for (const product of unified.products) {
  // The card renders frame 3 for footwear and frame 2 for every other kind.
  // Unified media intentionally has no product-kind field, so the responsive
  // pack must include both hover candidates for every product.
  for (const position of [1, 2, 3]) {
    const frame = product.frames.find((candidate) => candidate.position === position)
    if (!frame) fail(`${product.slug} is missing unified frame ${position}`)
    for (const width of widths) {
      expected.push({
        slug: product.slug,
        position,
        source: frame.file,
        file: `public/catalog/thumbs/${product.slug}-${position}-${width}.webp`,
        width,
        height: Math.round(width * 3 / 4),
      })
    }
  }
}

if (thumbnailManifest.entries.length !== expected.length) {
  fail(`expected ${expected.length} entries, found ${thumbnailManifest.entries.length}`)
}

const byFile = new Map(thumbnailManifest.entries.map((entry) => [entry.file, entry]))
for (const item of expected) {
  const entry = byFile.get(item.file)
  if (!entry || entry.slug !== item.slug || entry.position !== item.position || entry.source !== item.source) {
    fail(`missing or inconsistent mapping for ${item.file}`)
  }
  if (entry.width !== item.width || entry.height !== item.height) {
    fail(`${item.file} has incorrect dimensions in manifest`)
  }
  const [sourceBytes, thumbnailBytes] = await Promise.all([
    readFile(path.join(root, item.source)),
    readFile(path.join(root, item.file)),
  ])
  if (hash(sourceBytes) !== entry.source_sha256) fail(`${item.source} source hash drifted`)
  if (hash(thumbnailBytes) !== entry.sha256) fail(`${item.file} thumbnail hash drifted`)
  const dimensions = webpDimensions(thumbnailBytes)
  if (dimensions.width !== item.width || dimensions.height !== item.height) {
    fail(`${item.file} decoded dimensions are ${dimensions.width}x${dimensions.height}, expected ${item.width}x${item.height}`)
  }
}

const diskFiles = (await readdir(thumbnailDir)).filter((file) => file.endsWith(".webp")).sort()
const manifestFiles = thumbnailManifest.entries.map((entry) => path.basename(entry.file)).sort()
if (JSON.stringify(diskFiles) !== JSON.stringify(manifestFiles)) fail("thumb directory must contain only manifest-declared WebP files")

const runtimeManifest = await readFile(runtimeManifestPath, "utf8")
if (!runtimeManifest.includes("export function getCardThumbnailUrl")) {
  fail("runtime thumbnail URL helper is missing")
}
const runtimeVersions = new Map(
  [...runtimeManifest.matchAll(/^  "([^"]+)": "([a-f0-9]{16})",$/gmu)].map((match) => [match[1], match[2]]),
)
if (runtimeVersions.size !== thumbnailManifest.entries.length) {
  fail("runtime thumbnail versions have missing or duplicate entries")
}
for (const entry of thumbnailManifest.entries) {
  const key = `${entry.slug}-${entry.position}-${entry.width}`
  if (runtimeVersions.get(key) !== entry.sha256.slice(0, 16)) {
    fail(`runtime thumbnail version drifted for ${entry.file}`)
  }
}

console.log(`Card thumbnails verified: ${expected.length} exact responsive derivatives with decoded dimensions`)
