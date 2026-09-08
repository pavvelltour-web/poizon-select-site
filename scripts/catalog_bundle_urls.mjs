const SUPPLIER_PREFIX = "/catalog/supplier/"
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

// Keep the general root-absolute catalog guard. Supplier output is an explicit
// manifest contract; the bare prefix is also emitted by its runtime validator.
export function verifyCatalogBundleUrls(javascript, manifest, builtFiles) {
  if (!Array.isArray(manifest?.products)) throw new Error("supplier media manifest must list products")
  const declared = new Set()
  for (const product of manifest.products) {
    if (typeof product?.slug !== "string" || !SLUG.test(product.slug) || !Array.isArray(product.frames)) {
      throw new Error("supplier media manifest must identify exact product slugs and frames")
    }
    for (const frame of product.frames) {
      if (!Number.isInteger(frame?.position) || frame.position < 1 || frame.position > 5 ||
        frame.file !== `${SUPPLIER_PREFIX}${product.slug}-${frame.position}.webp`) {
        throw new Error("supplier media frame must match its exact product slug and position")
      }
      declared.add(frame.file)
    }
  }

  const present = new Set(builtFiles)
  const referenced = new Set()
  // Start with every match of the original guard, including malformed literals;
  // only an exact, closed string can qualify for the narrow supplier exception.
  for (const match of javascript.matchAll(/(["'`])\/catalog\//gu)) {
    const start = match.index + 1
    const end = javascript.indexOf(match[1], start)
    const reference = end < 0 ? javascript.slice(start) : javascript.slice(start, end)
    if (end >= 0 && reference === SUPPLIER_PREFIX) continue
    if (end < 0 || !declared.has(reference)) {
      throw new Error(`bundle contains a root-absolute catalog URL: ${reference}`)
    }
    if (!present.has(reference)) throw new Error(`bundle references a missing supplier catalog file: ${reference}`)
    referenced.add(reference)
  }
  return [...referenced]
}
