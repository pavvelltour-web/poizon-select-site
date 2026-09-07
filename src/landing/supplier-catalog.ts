import type { CatalogProduct, ProductCategory, ProductKind } from "../catalog/catalog"

export interface SupplierCatalogProduct {
  slug: string
  brand: string
  name: string
  article: string | null
  kind: ProductKind
  category: ProductCategory
  images: readonly string[]
  productRef: string
}

const categoryLabels: Record<ProductCategory, string> = {
  volleyball: "Волейбол", basketball: "Баскетбол", training: "Тренировки",
  recovery: "Восстановление", lifestyle: "Кроссовки и кеды", apparel: "Одежда",
  protection: "Защита", balls: "Мячи", bags: "Сумки и аксессуары",
}

// These are the supplier image origins already allowed by the storefront CSP.
const imageHosts = new Set([
  "cdn.poizon.com", "cdn-img.thepoizon.ru", "oversea-shanghai-enhance.oss-cn-shanghai.aliyuncs.com",
])

function text(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.trim() && value.length <= maximum && !/[\p{Cc}<>]/u.test(value)
    ? value.trim() : null
}

function supplierImage(value: unknown): string | null {
  const input = text(value, 2_000)
  if (!input) return null
  try {
    const url = new URL(input)
    return url.protocol === "https:" && !url.username && !url.password && !url.port && imageHosts.has(url.hostname)
      ? url.toString() : null
  } catch { return null }
}

export function parseSupplierCatalog(value: unknown): SupplierCatalogProduct[] {
  if (!Array.isArray(value)) return []
  const slugCounts = new Map<string, number>()
  const refCounts = new Map<string, number>()
  for (const row of value) {
    if (!row || typeof row !== "object") continue
    for (const [key, counts] of [["slug", slugCounts], ["product_ref", refCounts]] as const) {
      const identifier = text((row as Record<string, unknown>)[key], 160)
      if (identifier) counts.set(identifier, (counts.get(identifier) ?? 0) + 1)
    }
  }
  return value.flatMap((raw): SupplierCatalogProduct[] => {
    if (!raw || typeof raw !== "object") return []
    const row = raw as Record<string, unknown>
    const slug = text(row.slug, 160)
    const productRef = text(row.product_ref, 64)
    const brand = text(row.brand, 128)
    const name = text(row.name, 512)
    const article = row.article === null ? null : text(row.article, 128)
    const kind = text(row.kind, 16)
    const category = text(row.category, 32)
    const images = Array.isArray(row.images) ? row.images.map(supplierImage) : []
    if (row.source !== "poizon" || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) ||
      !productRef || !/^[a-f0-9]{64}$/u.test(productRef) || slugCounts.get(slug) !== 1 || refCounts.get(productRef) !== 1 ||
      !brand || !name || (row.article !== null && !article) ||
      !kind || !["footwear", "apparel", "accessory"].includes(kind) ||
      !category || !Object.hasOwn(categoryLabels, category) || images.length === 0 || images.some((image) => !image)) return []
    return [{ slug, productRef, brand, name, article, kind: kind as ProductKind, category: category as ProductCategory,
      images: [...new Set(images as string[])].slice(0, 5) }]
  })
}

export function mergeSupplierCatalog(
  originals: readonly CatalogProduct[],
  additions: readonly SupplierCatalogProduct[],
): readonly CatalogProduct[] {
  if (additions.length === 0) return originals
  const originalSlugs = new Set(originals.map((product) => product.slug))
  const newProducts = additions.filter((product) => !originalSlugs.has(product.slug)).map((product): CatalogProduct => {
    const brandPrefix = product.brand.split(/[\s-]+/u)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s-]*")
    const name = product.name.replace(new RegExp(`^${brandPrefix}\\s+`, "iu"), "")
    return {
      slug: product.slug, brand: product.brand, name,
      category: product.category, categoryLabel: categoryLabels[product.category], kind: product.kind,
      supplierProductRef: product.productRef,
      sportPriority: ["volleyball", "basketball"].includes(product.category),
      query: [product.brand, name, product.article].filter(Boolean).join(" "),
      note: "Модель из каталога Poizon",
      image: product.images[0], fallbackImage: product.images[0],
      gallery: product.images.map((src, index) => ({ src, alt: `${product.brand} ${name}, фото ${index + 1}` })),
    }
  })
  return [...originals, ...newProducts]
}

export function filterAuthoritativeOriginals(
  originals: readonly CatalogProduct[],
  catalogStatuses: Readonly<Record<string, unknown>>,
  catalogReady: boolean,
): readonly CatalogProduct[] {
  if (!catalogReady || Object.keys(catalogStatuses).length !== 200) return originals
  return originals.filter((product) => Object.hasOwn(catalogStatuses, product.slug))
}

export function resolveStorefrontCatalog(
  originals: readonly CatalogProduct[],
  additions: readonly SupplierCatalogProduct[],
  catalogStatuses: Readonly<Record<string, unknown>>,
  catalogReady: boolean,
): readonly CatalogProduct[] {
  const authoritativeOriginals = filterAuthoritativeOriginals(
    originals,
    catalogStatuses,
    catalogReady,
  )
  if (authoritativeOriginals === originals) return originals

  const merged = mergeSupplierCatalog(authoritativeOriginals, additions)
  const statusSlugs = new Set(Object.keys(catalogStatuses))
  return merged.length === 200 && merged.every((product) => statusSlugs.has(product.slug))
    ? merged
    : originals
}
