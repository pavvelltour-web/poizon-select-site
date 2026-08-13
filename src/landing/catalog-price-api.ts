/**
 * Public, fail-closed catalogue price reader.
 *
 * Catalogue images and copy are editorial. A RUB amount is different: it is
 * shown only when the CRM has a still-valid, provider-backed 12-hour snapshot
 * for the exact catalogue slug. This browser never calls the supplier API.
 */

export interface VerifiedCatalogPrice {
  slug: string
  totalRub: number
  observedAt: string
  expiresAt: string
  sizeOffers: Readonly<Record<string, VerifiedCatalogSizeOffer>>
}

export interface VerifiedCatalogSizeOffer {
  skuId: string
  size: string
  totalRub: number
  observedAt: string
  expiresAt: string
}

interface StorefrontPricesResponse {
  catalog_mode?: unknown
  snapshot_hours?: unknown
  items?: unknown
}

const REQUEST_TIMEOUT_MS = 8_000
const MAX_PRICE_RUB = 10_000_000
const SNAPSHOT_WINDOW_MS = 12 * 60 * 60 * 1000
const MAX_FUTURE_OBSERVED_SKEW_MS = 5 * 60 * 1000
const CATALOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKU_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,160}$/

function crmApiBase(): string | null {
  const configured = (import.meta.env.VITE_CRM_API_BASE_URL || "/api").trim()
  if (!configured.startsWith("/") || configured.startsWith("//")) return null
  return configured.replace(/\/+$/, "") || "/api"
}

export function storefrontPricesEndpoint(): string | null {
  const base = crmApiBase()
  return base ? `${base}/checkout/orders?mode=catalog` : null
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function validRubPrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value < MAX_PRICE_RUB
  )
}

function toExactRubPrice(value: number): number {
  return Math.round(value * 100) / 100
}

function parseVerifiedSizeOffer(
  value: unknown,
  observedAt: string,
  expiresAt: string,
): VerifiedCatalogSizeOffer | null {
  if (!value || typeof value !== "object") return null
  const offer = value as Record<string, unknown>
  const skuId = typeof offer.sku_id === "string" ? offer.sku_id.trim() : ""
  // `size_eu` is the contract's display size. Trim only the outer whitespace:
  // e.g. 42.5 and values with meaningful internal punctuation stay exact.
  const size = typeof offer.size_eu === "string" ? offer.size_eu.trim() : ""
  if (
    !skuId ||
    !SKU_ID_PATTERN.test(skuId) ||
    !size ||
    size.length > 32 ||
    offer.available !== true ||
    offer.checkout_confirmed !== true ||
    offer.live_provider_verified !== true ||
    !validRubPrice(offer.price_rub)
  ) {
    return null
  }
  return {
    skuId,
    size,
    totalRub: toExactRubPrice(offer.price_rub),
    observedAt,
    expiresAt,
  }
}

function parseVerifiedPrice(value: unknown, nowMs: number): VerifiedCatalogPrice | null {
  if (!value || typeof value !== "object") return null
  const item = value as Record<string, unknown>
  const {
    slug,
    price_rub: totalRub,
    observed_at: observedAt,
    expires_at: expiresAt,
    live_provider_verified: isProviderVerified,
    size_offers: rawSizeOffers,
  } = item
  if (
    typeof slug !== "string" ||
    !slug.trim() ||
    !CATALOG_SLUG_PATTERN.test(slug.trim()) ||
    isProviderVerified !== true ||
    !validRubPrice(totalRub) ||
    !validTimestamp(observedAt) ||
    !validTimestamp(expiresAt) ||
    !Array.isArray(rawSizeOffers)
  ) {
    return null
  }

  const observedMs = Date.parse(observedAt)
  const expiresMs = Date.parse(expiresAt)
  if (
    observedMs > expiresMs ||
    observedMs > nowMs + MAX_FUTURE_OBSERVED_SKEW_MS ||
    expiresMs <= nowMs ||
    expiresMs - observedMs > SNAPSHOT_WINDOW_MS
  ) {
    return null
  }

  const sizeOffers: Record<string, VerifiedCatalogSizeOffer> = {}
  const ambiguousSizes = new Set<string>()
  for (const rawOffer of rawSizeOffers) {
    const offer = parseVerifiedSizeOffer(rawOffer, observedAt, expiresAt)
    if (!offer || ambiguousSizes.has(offer.size)) continue
    if (sizeOffers[offer.size]) {
      delete sizeOffers[offer.size]
      ambiguousSizes.add(offer.size)
      continue
    }
    sizeOffers[offer.size] = offer
  }
  const validSizeOffers = Object.values(sizeOffers)
  if (validSizeOffers.length === 0) return null

  const minimumOfferRub = Math.min(...validSizeOffers.map((offer) => offer.totalRub))
  // The card's server price must be the same floor as its valid checkout
  // offers. Do not display an item floor derived from an unavailable SKU.
  if (toExactRubPrice(totalRub) !== minimumOfferRub) return null

  return {
    slug: slug.trim(),
    totalRub: toExactRubPrice(totalRub),
    observedAt,
    expiresAt,
    sizeOffers,
  }
}

/** Parse a response defensively; malformed and stale rows are never displayed. */
export function parseVerifiedCatalogPrices(
  payload: unknown,
  nowMs = Date.now(),
): Readonly<Record<string, VerifiedCatalogPrice>> {
  if (!payload || typeof payload !== "object") return {}
  const response = payload as StorefrontPricesResponse
  if (
    response.catalog_mode !== "curated_live_poizon" ||
    response.snapshot_hours !== 12 ||
    !Array.isArray(response.items)
  ) {
    return {}
  }

  const prices: Record<string, VerifiedCatalogPrice> = {}
  const ambiguousSlugs = new Set<string>()
  for (const item of response.items) {
    const price = parseVerifiedPrice(item, nowMs)
    // A duplicate slug means the server has no unambiguous exact match.
    if (!price || ambiguousSlugs.has(price.slug)) continue
    if (prices[price.slug]) {
      delete prices[price.slug]
      ambiguousSlugs.add(price.slug)
      continue
    }
    prices[price.slug] = price
  }
  return prices
}

export async function fetchVerifiedCatalogPrices(
  signal?: AbortSignal,
): Promise<Readonly<Record<string, VerifiedCatalogPrice>>> {
  const endpoint = storefrontPricesEndpoint()
  if (!endpoint) return {}

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener("abort", abortFromCaller, { once: true })

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controller.signal,
    })
    if (!response.ok) return {}
    return parseVerifiedCatalogPrices(await response.json())
  } catch {
    return {}
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener("abort", abortFromCaller)
  }
}
