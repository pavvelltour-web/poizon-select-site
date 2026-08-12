import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const allowedBrowserEnv = new Set(["VITE_API_BASE_URL", "VITE_BOT_USERNAME"])
const auditedTextExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".webmanifest",
  ".xml",
])

function fail(message) {
  throw new Error(`Site boundary verification failed: ${message}`)
}

async function text(relativePath) {
  return readFile(path.join(siteRoot, relativePath), "utf8")
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(directory, entry.name)
      return entry.isDirectory() ? sourceFiles(fullPath) : [fullPath]
    }),
  )
  return nested.flat()
}

const envExample = await text(".env.example")
const envKeys = envExample
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split("=", 1)[0])
if (
  envKeys.length !== 2 ||
  envKeys[0] !== "VITE_BOT_USERNAME" ||
  envKeys[1] !== "VITE_API_BASE_URL"
) {
  fail(".env.example may contain only VITE_BOT_USERNAME and VITE_API_BASE_URL")
}

const dockerIgnore = await text(".dockerignore")
const dockerIgnoreLines = dockerIgnore.split(/\r?\n/)
for (const required of [
  ".env*",
  ".git/",
  ".venv/",
  "__pycache__/",
  "*.py[cod]",
  ".playwright-cli/",
]) {
  if (!dockerIgnoreLines.includes(required)) {
    fail(`Docker context must exclude ${required}`)
  }
}
if (!dockerIgnoreLines.includes("!.env.example")) {
  fail("Docker context must retain the public .env.example used by build checks")
}

const packageManifest = JSON.parse(await text("package.json"))
if (
  packageManifest.scripts?.["verify:release-rights"] !==
  "node scripts/verify_release_rights.mjs"
) {
  fail("package.json must expose the fail-closed verify:release-rights command")
}
if (
  packageManifest.scripts?.["verify:release"] !==
  "npm run verify:assets && npm run verify:card-thumbnails && npm run verify:release-rights && npm run media:storefront:qa && npm run media:unified:qa"
) {
  fail("verify:release must include assets, card thumbnails, release rights, approved media and unified catalog QA")
}

const dockerfile = await text("Dockerfile")
for (const required of [
  "npm ci --ignore-scripts",
  'ARG VITE_BOT_USERNAME=""',
  'ARG VITE_API_BASE_URL=""',
  "npm run build:production",
  "USER nginx",
  "EXPOSE 8080",
]) {
  if (!dockerfile.includes(required)) fail(`Dockerfile is missing ${required}`)
}
if (/\bBOT_TOKEN\b/.test(dockerfile)) {
  fail("Dockerfile must not accept a Telegram token")
}
for (const image of ["node:24-alpine", "nginx:1.29-alpine"]) {
  const escaped = image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  if (!new RegExp(`${escaped}@sha256:[a-f0-9]{64}`).test(dockerfile)) {
    fail(`${image} must be pinned to an immutable digest`)
  }
}

const nginx = await text("nginx.conf")
for (const required of [
  "default-src 'self'",
  "connect-src 'self' https://api.kicksbase.ru",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "Cross-Origin-Opener-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "USER nginx",
]) {
  const target = required === "USER nginx" ? dockerfile : nginx
  if (!target.includes(required)) fail(`deployment policy is missing ${required}`)
}
const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1]
const imageDirective = csp?.match(/(?:^|;\s*)img-src\s+([^;]+)/)?.[1]
if (!imageDirective) fail("nginx must define an img-src directive")
const imageSources = new Set(imageDirective.trim().split(/\s+/))
const expectedImageSources = new Set([
  "'self'",
  "data:",
  "https://cdn.poizon.com",
  "https://cdn-img.thepoizon.ru",
  "https://oversea-shanghai-enhance.oss-cn-shanghai.aliyuncs.com",
])
for (const trustedSource of expectedImageSources) {
  if (!imageSources.has(trustedSource)) {
    fail(`img-src must permit trusted live image host ${trustedSource}`)
  }
}
if (
  imageSources.size !== expectedImageSources.size ||
  [...imageSources].some((source) => !expectedImageSources.has(source))
) {
  fail("img-src must contain only the explicit trusted image hosts")
}
for (const route of ["location = /catalog {", "location = /catalog/ {"]) {
  if (!nginx.includes(route)) fail(`nginx must serve the SPA route with ${route}`)
}
if (nginx.includes("try_files $uri $uri/")) {
  fail("nginx directory fallback can redirect SPA routes to the internal port")
}

const browserFiles = await sourceFiles(path.join(siteRoot, "src"))
const publicRoot = path.join(siteRoot, "public")
const publicFiles = await sourceFiles(publicRoot)
const publicEntries = await readdir(publicRoot, { withFileTypes: true })
const allowedRootBinaryEntries = new Set([
  "apple-touch-icon.png",
  "favicon.ico",
  "kicksbase-icon-64.webp",
])
const allowedPublicEntries = new Set([
  "THIRD_PARTY_NOTICES.md",
  ...allowedRootBinaryEntries,
  "brand",
  "catalog",
  "favicon.svg",
  "storefront-media",
])
for (const entry of publicEntries) {
  if (!allowedPublicEntries.has(entry.name)) {
    fail(`public contains an unexpected release artifact: ${entry.name}`)
  }
}
const catalogManifest = JSON.parse(
  await readFile(path.join(publicRoot, "catalog", "sources.json"), "utf8"),
)
if (!Array.isArray(catalogManifest.items)) {
  fail("catalog source manifest has no item list")
}
const allowedCatalogEntries = new Set([
  "SOURCES.md",
  "sources.json",
  "gallery",
  "thumbs",
  ...catalogManifest.items.map((item) => item.file),
])
const allowedBrandEntries = new Set([
  "kicksbase-court-base-hero.webp",
  "kicksbase-culture-hero.webp",
  "kicksbase-hero-court-v2.webp",
  "kicksbase-hero.webp",
  "kicksbase-logo.webp",
])
for (const file of publicFiles) {
  const relative = path.relative(publicRoot, file)
  const extension = path.extname(file).toLowerCase()
  if (
    relative.startsWith(`catalog${path.sep}`) &&
    !(
      relative.startsWith(`catalog${path.sep}gallery${path.sep}`) &&
      /^[a-z0-9-]+-[2-5]\.webp$/.test(path.basename(file))
    ) &&
    !(
      relative.startsWith(`catalog${path.sep}thumbs${path.sep}`) &&
       (/^[a-z0-9-]+-[1-3]-(?:640|960|1280)\.webp$/.test(path.basename(file)) || path.basename(file) === "manifest.json")
    ) &&
    !allowedCatalogEntries.has(path.basename(file))
  ) {
    fail(`public/catalog contains an unexpected release artifact: ${relative}`)
  }
  if (
    relative.startsWith(`brand${path.sep}`) &&
    !allowedBrandEntries.has(path.basename(file))
  ) {
    fail(`public/brand contains an unexpected release artifact: ${relative}`)
  }
  if (
    !auditedTextExtensions.has(extension) &&
    !(
      allowedRootBinaryEntries.has(relative) &&
      [".ico", ".png", ".webp"].includes(extension)
    ) &&
    !(relative.startsWith(`catalog${path.sep}`) && extension === ".webp") &&
    !(relative.startsWith(`brand${path.sep}`) && extension === ".webp") &&
    !(
      relative.startsWith(`storefront-media${path.sep}approved${path.sep}`) &&
      [".png", ".webp"].includes(extension)
    )
  ) {
    fail(`public contains an unaudited file type: ${relative}`)
  }
}
const auditedConfigFiles = [
  "index.html",
  "vite.config.ts",
  "Dockerfile",
  "nginx.conf",
  "package.json",
  ".env.example",
].map((file) => path.join(siteRoot, file))

for (const file of browserFiles) {
  const source = await readFile(file, "utf8")
  if (/from\s+["'][^"']*crm/i.test(source)) {
    fail(`${path.relative(siteRoot, file)} imports CRM code`)
  }
  if (
    /dangerouslySetInnerHTML|\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write(?:ln)?\s*\(|\beval\s*\(|new\s+Function\s*\(/.test(
      source,
    )
  ) {
    fail(`${path.relative(siteRoot, file)} contains a dangerous browser sink`)
  }
  if (
    /\bXMLHttpRequest\b|\bWebSocket\s*\(|\bEventSource\s*\(|\bnavigator\s*\.\s*sendBeacon\s*\(/.test(
      source,
    )
  ) {
    fail(
      `${path.relative(siteRoot, file)} contains a forbidden runtime network call`,
    )
  }
  if (
    /\bfetch\s*\(/.test(source) &&
    !source.includes("/api/checkout/orders") &&
    !(
      source.includes("/api/auth/sms/request") &&
      source.includes("/api/auth/sms/verify")
    )
  ) {
    fail(`${path.relative(siteRoot, file)} contains a non-checkout fetch call`)
  }

  const envAccesses = [
    ...source.matchAll(
      /import\.meta\.env(?:\.([A-Z][A-Z0-9_]*)|\s*\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\])/g,
    ),
  ]
  const rawEnvAccesses = [...source.matchAll(/import\.meta\.env/g)]
  if (envAccesses.length !== rawEnvAccesses.length) {
    fail(`${path.relative(siteRoot, file)} uses dynamic import.meta.env access`)
  }
  for (const access of envAccesses) {
    const name = access[1] ?? access[2]
    if (!allowedBrowserEnv.has(name)) {
      fail(`${path.relative(siteRoot, file)} exposes disallowed browser env ${name}`)
    }
  }

  const importPatterns = [
    /(?:\bfrom\s+|\brequire\s*\(\s*|\bimport\s*\(\s*)["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
  ]
  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) continue
      const resolved = path.resolve(path.dirname(file), specifier)
      if (
        resolved !== siteRoot &&
        !resolved.startsWith(`${siteRoot}${path.sep}`)
      ) {
        fail(
          `${path.relative(siteRoot, file)} imports outside the standalone site`,
        )
      }
    }
  }
}

const forbiddenSecretAssignment =
  /\b(?:const|let|var|ARG|ENV)\s+(?:(?:VITE_|REACT_APP_|NEXT_PUBLIC_)[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL|API_KEY)[A-Z0-9_]*|BOT_TOKEN|TELEGRAM_BOT_TOKEN|DATABASE_URL|DB_PASSWORD|JWT_SECRET|SESSION_SECRET)\s*(?:=|\s)/
const forbiddenServerEnvAccess =
  /\bprocess\.env\.(?:BOT_TOKEN|TELEGRAM_BOT_TOKEN|DATABASE_URL|DB_PASSWORD|JWT_SECRET|SESSION_SECRET)\b/
const forbiddenBareSecretAssignment =
  /(?:^|[\s"'`])(?:BOT_TOKEN|TELEGRAM_BOT_TOKEN|DATABASE_URL|DB_PASSWORD|JWT_SECRET|SESSION_SECRET|PRIVATE_KEY|API_KEY|(?:VITE_|REACT_APP_|NEXT_PUBLIC_)[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL|API_KEY)[A-Z0-9_]*)\s*[:=]\s*["']?(?!\s*(?:$|\.\.\.|<|example\b|replace\b|change\b))[^\s"'<>]{8,}/im
const forbiddenCredentialUrl =
  /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^/\s:@]+:[^@\s/]+@[^\s/]+/i
const forbiddenTelegramToken = /\b\d{6,15}:[A-Za-z0-9_-]{30,}\b/
const forbiddenPrivateKey = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/
const auditedPublicTextFiles = publicFiles.filter((file) =>
  auditedTextExtensions.has(path.extname(file).toLowerCase()),
)
for (const file of [
  ...browserFiles,
  ...auditedConfigFiles,
  ...auditedPublicTextFiles,
]) {
  const source = await readFile(file, "utf8")
  if (
    forbiddenSecretAssignment.test(source) ||
    forbiddenServerEnvAccess.test(source) ||
    forbiddenBareSecretAssignment.test(source) ||
    forbiddenCredentialUrl.test(source) ||
    forbiddenTelegramToken.test(source) ||
    forbiddenPrivateKey.test(source)
  ) {
    fail(`${path.relative(siteRoot, file)} contains secret-like material`)
  }
}

console.log("Site boundaries verified: public-only env, isolated source, hardened deployment")
