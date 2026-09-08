import type { CatalogProduct } from "../catalog/catalog"
import type { CatalogAvailabilityMap } from "./catalog-availability"
import type { PublishedCatalogItem, PublishedCatalogMap } from "./cart"

export interface CatalogColorwayVariant {
  slug: string
  productRef: string
  colorLabel: string
}

export interface CatalogColorwayGroup {
  familyId: string
  modelName: string
  colorLabel: string
  productRef: string
  variants: readonly CatalogColorwayVariant[]
}

export type CatalogColorwayMap = Record<string, CatalogColorwayGroup>

export interface AvailableCatalogColorway {
  product: CatalogProduct
  colorLabel: string
  productRef: string
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const refPattern = /^[a-f0-9]{64}$/u
const clockSkewMs = 5 * 60_000
const snapshotWindowMs = 12 * 60 * 60_000
const sourceWindowMs = 48 * 60 * 60_000

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function label(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.trim() && value.length <= maximum && !/[\p{Cc}<>]/u.test(value)
    ? value.trim() : null
}

/** Parse only the additive catalog_colorways field, never infer families from titles. */
export function parseCatalogColorways(value: unknown): CatalogColorwayMap {
  const input = record(value)
  if (!input) return {}
  const groups: CatalogColorwayMap = {}
  for (const [slug, raw] of Object.entries(input)) {
    const row = record(raw)
    if (!row || slug.length > 160 || !slugPattern.test(slug)) continue
    const familyId = label(row.family_id, 160)
    const modelName = label(row.model_name, 512)
    const colorLabel = label(row.color_label, 128)
    const productRef = label(row.product_ref, 64)
    if (!familyId || !modelName || !colorLabel || !productRef || !refPattern.test(productRef) ||
      !Array.isArray(row.variants) || row.variants.length === 0) continue
    const variants: CatalogColorwayVariant[] = []
    const seenSlugs = new Set<string>()
    const seenRefs = new Set<string>()
    for (const rawVariant of row.variants) {
      const variant = record(rawVariant)
      const variantSlug = label(variant?.slug, 160)
      const variantRef = label(variant?.product_ref, 64)
      const variantColor = label(variant?.color_label, 128)
      if (!variantSlug || !slugPattern.test(variantSlug) || !variantRef || !refPattern.test(variantRef) ||
        !variantColor || seenSlugs.has(variantSlug) || seenRefs.has(variantRef)) break
      seenSlugs.add(variantSlug)
      seenRefs.add(variantRef)
      // Media is resolved through the canonical product, not this unchecked API image_url.
      variants.push({ slug: variantSlug, productRef: variantRef, colorLabel: variantColor })
    }
    if (variants.length !== row.variants.length || !variants.some((variant) =>
      variant.slug === slug && variant.productRef === productRef && variant.colorLabel === colorLabel)) continue
    groups[slug] = { familyId, modelName, colorLabel, productRef, variants }
  }
  return groups
}

function currentWindow(start: string | null, end: string | null, maximum: number, now: number): boolean {
  const from = Date.parse(start ?? "")
  const until = Date.parse(end ?? "")
  return Number.isFinite(from) && Number.isFinite(until) && from <= now + clockSkewMs &&
    until > now && until > from && until - from <= maximum
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function currentAvailableItem(item: PublishedCatalogItem | undefined, now: number): boolean {
  return !!item && item.priceStatus === "current" && item.availability === "supplier_verified" &&
    item.liveProviderVerified && item.displayPriceVerified && positive(item.priceRub) &&
    currentWindow(item.observedAt, item.expiresAt, snapshotWindowMs, now) &&
    item.sizeOffers.some((offer) => offer.available === true && offer.priceStatus === "current" &&
      offer.liveProviderVerified && positive(offer.priceRub) && positive(offer.priceCny) &&
      currentWindow(offer.observedAt, offer.expiresAt, snapshotWindowMs, now) &&
      currentWindow(offer.sourceUpdatedAt, offer.sourceExpiresAt, sourceWindowMs, now))
}

/** Re-check evidence during rendering so an open tab cannot retain expired colour options. */
export function getAvailableColorways(
  product: CatalogProduct,
  groups: CatalogColorwayMap,
  products: readonly CatalogProduct[],
  items: PublishedCatalogMap,
  catalogStatuses: CatalogAvailabilityMap,
  now = Date.now(),
): AvailableCatalogColorway[] {
  const group = Object.hasOwn(groups, product.slug) ? groups[product.slug] : undefined
  if (!group || !Number.isFinite(now) ||
    (product.supplierProductRef && product.supplierProductRef !== group.productRef)) return []
  const options = group.variants.flatMap((variant): AvailableCatalogColorway[] => {
    const canonicalMatches = products.filter((candidate) => candidate.slug === variant.slug)
    const canonical = canonicalMatches[0]
    const sibling = Object.hasOwn(groups, variant.slug) ? groups[variant.slug] : undefined
    // Original static products have no supplierProductRef. Their exact identity comes
    // from reciprocal, explicitly reviewed backend entries, never a name comparison.
    if (canonicalMatches.length !== 1 || !canonical || !sibling || sibling.familyId !== group.familyId ||
      sibling.modelName !== group.modelName || sibling.productRef !== variant.productRef ||
      sibling.colorLabel !== variant.colorLabel ||
      !sibling.variants.some((member) => member.slug === product.slug && member.productRef === group.productRef) ||
      (canonical.supplierProductRef && canonical.supplierProductRef !== variant.productRef) ||
      products.some((candidate) => candidate.slug !== variant.slug && candidate.supplierProductRef === variant.productRef)) return []
    const item = Object.hasOwn(items, variant.slug) ? items[variant.slug] : undefined
    const status = Object.hasOwn(catalogStatuses, variant.slug) ? catalogStatuses[variant.slug] : undefined
    if (item?.slug !== variant.slug || !currentAvailableItem(item, now) || status?.source !== "poizon" ||
      status.status !== "in_stock" || !currentWindow(status.checkedAt, status.expiresAt, snapshotWindowMs, now)) return []
    return [{ product: canonical, colorLabel: variant.colorLabel, productRef: variant.productRef }]
  })
  return options.length > 1 ? options : []
}
