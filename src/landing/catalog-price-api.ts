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

function parseVerifiedPrice(value: unknown, nowMs: number): VerifiedCatalogPrice | null {
  if (!value || typeof value !== "object") return null
  const item = value as Record<string, unknown>
  const {
    slug,
    price_rub: totalRub,
    observed_at: observedAt,
    expires_at: expiresAt,
    live_provider_verified: isProviderVerified,
  } = item
  if (
    typeof slug !== "string" ||
    !slug.trim() ||
    !CATALOG_SLUG_PATTERN.test(slug.trim()) ||
    isProviderVerified !== true ||
    typeof totalRub !== "number" ||
    !Number.isFinite(totalRub) ||
    totalRub <= 0 ||
    totalRub >= MAX_PRICE_RUB ||
    !validTimestamp(observedAt) ||
    !validTimestamp(expiresAt)
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

  return {
    slug: slug.trim(),
    totalRub: Math.round(totalRub),
    observedAt,
    expiresAt,
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
