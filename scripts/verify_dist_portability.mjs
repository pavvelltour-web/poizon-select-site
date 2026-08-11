import { access, readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distRoot = path.join(siteRoot, "dist")
const expectedCatalogFiles = 100
const expectedGalleryFiles = expectedCatalogFiles * 4

function fail(message) {
  throw new Error(`Built-site verification failed: ${message}`)
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(directory, entry.name)
        return entry.isDirectory() ? filesBelow(target) : [target]
      }),
    )
  ).flat()
}

const indexHtml = await readFile(path.join(distRoot, "index.html"), "utf8")
const thirdPartyNotice = await readFile(
  path.join(distRoot, "THIRD_PARTY_NOTICES.md"),
  "utf8",
)
if (
  !thirdPartyNotice.includes(
    "No third-party UI components are bundled in the current site source.",
  )
) {
  fail("dist is missing the current third-party notice")
}
const htmlReferences = [
  ...indexHtml.matchAll(/\b(?:href|src)="([^"]+)"/g),
].map((match) => match[1])
if (htmlReferences.length < 3) fail("index.html has too few asset references")

for (const reference of htmlReferences) {
  if (
    reference.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(reference)
  ) {
    fail(`index.html contains an external asset reference: ${reference}`)
  }
  const mounted = new URL(reference, "https://example.test/")
  const relative = decodeURIComponent(mounted.pathname.slice(1))
  if (!relative || relative.includes("..")) {
    fail(`asset has an invalid root path: ${reference}`)
  }
  await access(path.join(distRoot, relative))
}

const executableReferences = htmlReferences.filter((reference) =>
  /\.(?:css|js)(?:\?|$)/i.test(reference),
)
if (
  executableReferences.length < 2 ||
  executableReferences.some((reference) => !reference.startsWith("/assets/"))
) {
  fail("entry CSS/JS must use root-relative /assets paths for product deep links")
}

const files = await filesBelow(distRoot)
if (files.some((file) => file.endsWith(".map"))) {
  fail("public dist must not contain source maps")
}

const auditedTextExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
])
const forbiddenSecretMaterial = [
  /(?:^|[\s"'`])(?:BOT_TOKEN|TELEGRAM_BOT_TOKEN|DATABASE_URL|DB_PASSWORD|JWT_SECRET|SESSION_SECRET|PRIVATE_KEY|API_KEY|(?:VITE_|REACT_APP_|NEXT_PUBLIC_)[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL|API_KEY)[A-Z0-9_]*)\s*[:=]\s*["']?(?!\s*(?:$|\.\.\.|<|example\b|replace\b|change\b))[^\s"'<>]{8,}/im,
  /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^/\s:@]+:[^@\s/]+@[^\s/]+/i,
  /\b\d{6,15}:[A-Za-z0-9_-]{30,}\b/,
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
]
for (const file of files) {
  if (!auditedTextExtensions.has(path.extname(file).toLowerCase())) continue
  const source = await readFile(file, "utf8")
  if (forbiddenSecretMaterial.some((pattern) => pattern.test(source))) {
    fail(`${path.relative(distRoot, file)} contains secret-like material`)
  }
}

const catalogFiles = files.filter(
  (file) =>
    path.dirname(file) === path.join(distRoot, "catalog") &&
    file.endsWith(".webp"),
)
if (catalogFiles.length !== expectedCatalogFiles) {
  fail(`dist must contain exactly ${expectedCatalogFiles} local catalog WebP files`)
}
const galleryFiles = files.filter(
  (file) =>
    path.dirname(file) === path.join(distRoot, "catalog", "gallery") &&
    file.endsWith(".webp"),
)
if (galleryFiles.length !== expectedGalleryFiles) {
  fail(`dist must contain exactly ${expectedGalleryFiles} local catalog gallery WebP files`)
}

const javascript = (
  await Promise.all(
    files
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFile(file, "utf8")),
  )
).join("\n")
if (/["'`]\/catalog\//.test(javascript)) {
  fail("bundle contains a root-absolute catalog URL")
}
if (!javascript.includes("catalog/") || !javascript.includes(".webp")) {
  fail("bundle is missing the relative catalog URL builder")
}
for (const file of catalogFiles) {
  const name = path.basename(file)
  const slug = name.slice(0, -".webp".length)
  if (!javascript.includes(slug)) {
    fail(`bundle does not contain product slug ${slug}`)
  }
}

console.log(
  `Built site verified: root-safe deep-link assets, ${expectedCatalogFiles} local catalog images, ${expectedGalleryFiles} gallery images, third-party notice, no source maps`,
)
