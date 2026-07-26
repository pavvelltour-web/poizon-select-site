import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const manifest = JSON.parse(
  await readFile(
    path.join(siteRoot, "public", "catalog", "sources.json"),
    "utf8",
  ),
)

function fail(message) {
  throw new Error(`Public release blocked: ${message}`)
}

if (!Array.isArray(manifest.items) || manifest.items.length !== 60) {
  fail("catalog manifest must contain exactly 60 items")
}

const acceptedStatuses = new Set(["licensed", "owned", "supplier-api"])
const missing = []
for (const item of manifest.items) {
  const rights = item.rights
  if (
    !rights ||
    typeof rights !== "object" ||
    !acceptedStatuses.has(rights.status) ||
    typeof rights.license_reference !== "string" ||
    rights.license_reference.trim().length < 8 ||
    typeof rights.verified_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+00:00)$/.test(
      rights.verified_at,
    ) ||
    !Number.isFinite(Date.parse(rights.verified_at))
  ) {
    missing.push(item.slug ?? "<unknown>")
  }
}

if (missing.length > 0) {
  fail(
    `${missing.length}/60 item(s) lack confirmed rights metadata ` +
      `(rights.status, rights.license_reference, rights.verified_at): ` +
      missing.join(", "),
  )
}

console.log("Public release rights verified for all 60 catalog images")
