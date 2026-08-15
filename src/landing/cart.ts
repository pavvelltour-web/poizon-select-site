import {
  CATALOG_PRICE_VERSION,
  type CatalogProduct,
} from "../catalog/catalog"

export interface CartLine {
  id: string
  product: CatalogProduct
  size: string
  quantity: number
  validation: "pending" | "valid" | "invalid"
}

export interface CheckoutCustomer {
  fullName: string
  phone: string
  email: string
}

export interface CheckoutConsents {
  offerAccepted: boolean
  personalDataAccepted: boolean
}

export interface CheckoutDelivery {
  method: "cdek_pvz" | "cdek_courier"
  city: string
  postalCode: string
  address: string
  pvzCode: string
}

export interface PublishedCatalogItem {
  slug: string
  name: string
  brand: string
  productKind: "footwear" | "apparel" | "accessory"
  sizes: string[]
  priceRub: number
  imageUrl: string | null
  fulfillmentMode: "made_to_order" | "in_stock"
  availability: string
  etaMinDays: number | null
  etaMaxDays: number | null
  liveProviderVerified: boolean
  displayPriceVerified: boolean
  checkoutReady: boolean
  observedAt: string
  expiresAt: string
  sizeOffers: readonly PublishedSizeOffer[]
}

export interface PublishedSizeOffer {
  skuId: string
  sizeEu: string
  sizeRu: string | null
  sizeUs: string | null
  sizeCn: string | null
  priceCny: number
  priceRub: number
  available: boolean | null
  checkoutConfirmed: boolean
  liveProviderVerified: boolean
  observedAt: string | null
  expiresAt: string | null
}

export type CatalogPriceMap = Record<string, number>
export type PublishedCatalogMap = Record<string, PublishedCatalogItem>

export type CatalogSearchStatus = "catalog" | "ready" | "clarification" | "unavailable"

export interface CatalogSearchOffer {
  // Browser-only key. Supplier SKU IDs stay on the server because a live
  // search quote does not grant checkout authority.
  offerRef: string
  size: string
  sizeEu: string | null
  sizeRu: string | null
  sizeUs: string | null
  sizeCn: string | null
  available: boolean | null
  priceCny: number
  // Final amount for this exact size. It includes the fixed RF delivery and
  // is the only live RUB amount the storefront may display to a customer.
  totalRub: number
}

export interface ProductSizeOffer {
  skuId: string | null
  sizeEu: string
  sizeRu: string | null
  sizeUs: string | null
  sizeCn: string | null
  priceCny: number | null
  priceRub: number | null
  stockStatus: boolean | null
  available: boolean
  checkoutConfirmed: boolean
}

export interface CatalogSearchResult {
  // Opaque public API reference. It lets React key a result without exposing
  // a supplier product ID or URL.
  productRef: string
  brand: string | null
  name: string
  model: string
  article: string | null
  color: string | null
  inStock: boolean | null
  sizeContext: string | null
  sizeChart: string | null
  sizeImage: string | null
  kind: CatalogProduct["kind"]
  description: string | null
  images: readonly string[]
  observedAt: string
  expiresAt: string
  offers: readonly CatalogSearchOffer[]
}

export interface CatalogSearchFallback {
  source: "catalog"
  slug: string
  name: string
  brand: string | null
  image: string
  navigationUrl: string
  availability: "unverified"
}

export interface CatalogSearchClarificationOption {
  label: string
  query: string
}

export interface CatalogSearchResponse {
  status: CatalogSearchStatus
  normalizedQuery: string
  clarification: string | null
  clarificationOptions: readonly CatalogSearchClarificationOption[]
  results: readonly CatalogSearchResult[]
  fallback: readonly CatalogSearchFallback[]
}

export interface CheckoutCatalogSnapshot {
  items: PublishedCatalogMap
  lookup: CatalogPriceMap
  version: string
  catalogMode: "curated_live_poizon"
  snapshotHours: 12
  personalDataConsentVersion: string | null
  orderCreationEnabled: boolean
  onlinePaymentEnabled: boolean
}

export interface CheckoutAmounts {
  merchandiseRub: number
  payableNowRub: number
  deliveryDueLaterRub: number
  currency: string
}

export interface CheckoutDeliveryQuote {
  method: CheckoutDelivery["method"]
  provider: string
  city: string
  postalCode: string
  address: string | null
  pvzCode: string | null
  amountRub: number
  quoteStatus: "estimated" | "live"
  minDays: number | null
  maxDays: number | null
  paymentTiming: "separate_after_arrival"
}

export interface CheckoutResult {
  status: "idle" | "submitting" | "created" | "failed"
  message: string
  orderNumber: string | null
  orderIds: number[]
  paymentUrl: string | null
  amounts: CheckoutAmounts | null
  delivery: CheckoutDeliveryQuote | null
}

interface CheckoutResponseBody {
  checkout_id: string
  order_number: string
  order_ids: number[]
  amounts: {
    merchandise_rub: number
    payable_now_rub: number
    delivery_due_later_rub: number
    currency: string
  }
  delivery: {
    method: CheckoutDelivery["method"]
    provider: string
    city: string
    postal_code: string
    address: string | null
    pvz_code: string | null
    amount_rub: number
    quote_status: "estimated" | "live"
    min_days: number | null
    max_days: number | null
    payment_timing: "separate_after_arrival"
  }
  status: "payment_ready" | "payment_unavailable" | "payment_failed"
  payment_url: string | null
  message: string
}

export interface CheckoutResponse {
  checkoutId: string
  orderNumber: string
  orderIds: number[]
  amounts: CheckoutAmounts
  delivery: CheckoutDeliveryQuote
  status: CheckoutResponseBody["status"]
  paymentUrl: string | null
  message: string
}

export interface CheckoutApiError extends Error {
  status: number
  detail?: string | null
}

interface CheckoutFailureBody {
  detail?: string
  message?: string
}

export function isCheckoutApiError(error: unknown): error is CheckoutApiError {
  return (
    !!error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  )
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function finitePositiveNumber(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= maximum
    ? value
    : null
}

// External search data is untrusted until its URL and quote metadata are validated.
function safeHttpsUrl(value: unknown): string | null {
  const url = optionalString(value)
  if (!url) return null

  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port
      ? parsed.toString()
      : null
  } catch {
    return null
  }
}

const quoteClockSkewMs = 5 * 60 * 1000
const liveQuoteStalenessMs = 5 * 60 * 1000
const catalogSnapshotWindowMs = 12 * 60 * 60 * 1000
const maxPriceRub = 10_000_000
const maxPriceCny = 100_000
const catalogSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const skuIdPattern = /^[A-Za-z0-9_.:-]{1,160}$/u

function parseQuoteTimestamp(value: unknown): number | null {
  const timestamp = optionalString(value)
  if (!timestamp || !/^\d{4}-\d{2}-\d{2}T/u.test(timestamp)) return null

  const milliseconds = Date.parse(timestamp)
  return Number.isFinite(milliseconds) ? milliseconds : null
}

function safeCatalogNavigationUrl(value: unknown): string | null {
  const url = optionalString(value)
  if (url && /^\/product\/[a-z0-9][a-z0-9-]*\/?$/iu.test(url)) return url
  if (!url) return null

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "kicksbase.ru" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      !parsed.search &&
      !parsed.hash &&
      /^\/product\/[a-z0-9][a-z0-9-]*\/?$/iu.test(pathname)
    ) ? pathname : null
  } catch {
    return null
  }
}

function parseCatalogSearchResult(value: unknown): CatalogSearchResult | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const productRef = optionalString(source.product_ref)
  const name = optionalString(source.name)
  const kind = optionalString(source.kind)
  // Batch Sync may place a chart image in `size_chart` instead of
  // `size_image`. Treat it as a media URL only after the same HTTPS safety
  // check used for the product image; otherwise retain it as readable chart
  // text. This prevents a long raw URL from being rendered in the card.
  const sizeChartImage = safeHttpsUrl(source.size_chart)
  const observedAt = optionalString(source.observed_at)
  const expiresAt = optionalString(source.expires_at)
  const observedAtMs = parseQuoteTimestamp(source.observed_at)
  const expiresAtMs = parseQuoteTimestamp(source.expires_at)
  const now = Date.now()
  const images = Array.isArray(source.images)
    ? source.images
      .map(safeHttpsUrl)
      .filter((image): image is string => !!image)
      .slice(0, 5)
    : []
  const offers = Array.isArray(source.offers)
    ? source.offers.flatMap((rawOffer): CatalogSearchOffer[] => {
      if (!rawOffer || typeof rawOffer !== "object") return []
      const offer = rawOffer as Record<string, unknown>
      const size = optionalString(offer.size) ?? optionalString(offer.eu)
      const offerRef = optionalString(offer.offer_ref)
      const totalRub = finitePositiveNumber(offer.total_rub, maxPriceRub)
      const sourcePrice = finitePositiveNumber(offer.price_cny, maxPriceCny)
      if (
        !offerRef ||
        !size ||
        !totalRub ||
        !sourcePrice
      ) {
        return []
      }
      return [{
        offerRef,
        size,
        sizeEu: optionalString(offer.eu),
        sizeRu: optionalString(offer.ru),
        sizeUs: optionalString(offer.us),
        sizeCn: optionalString(offer.cn),
        available: typeof offer.available === "boolean" ? offer.available : null,
        priceCny: sourcePrice,
        totalRub,
      }]
    })
    : []

  if (
    !productRef ||
    !name ||
    !observedAt ||
    !expiresAt ||
    !observedAtMs ||
    !expiresAtMs ||
    observedAtMs > now + quoteClockSkewMs ||
    observedAtMs < now - liveQuoteStalenessMs ||
    expiresAtMs <= now ||
    expiresAtMs <= observedAtMs ||
    expiresAtMs - observedAtMs > catalogSnapshotWindowMs ||
    !["footwear", "apparel", "accessory"].includes(kind || "") ||
    images.length === 0 ||
    offers.length === 0
  ) {
    return null
  }

  return {
    productRef,
    brand: optionalString(source.brand),
    name,
    model: optionalString(source.model) ?? name,
    article: optionalString(source.article),
    color: optionalString(source.color),
    inStock: typeof source.in_stock === "boolean" ? source.in_stock : null,
    sizeContext: optionalString(source.size_context),
    sizeChart: sizeChartImage ? null : optionalString(source.size_chart),
    sizeImage: safeHttpsUrl(source.size_image) ?? sizeChartImage,
    kind: kind as CatalogProduct["kind"],
    description: optionalString(source.description),
    images,
    observedAt,
    expiresAt,
    offers,
  }
}

function parseCatalogSearchFallback(value: unknown): CatalogSearchFallback | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const slug = optionalString(source.slug)
  const name = optionalString(source.name)
  const image = optionalString(source.image)
  const navigationUrl = safeCatalogNavigationUrl(source.navigation_url)
  if (
    source.source !== "catalog" ||
    source.availability !== "unverified" ||
    !slug ||
    !name ||
    !image ||
    !navigationUrl
  ) {
    return null
  }

  return {
    source: "catalog",
    slug,
    name,
    brand: optionalString(source.brand),
    image,
    navigationUrl,
    availability: "unverified",
  }
}

function parseClarificationOption(value: unknown): CatalogSearchClarificationOption | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const label = optionalString(source.label)
  const query = optionalString(source.query)
  if (!label || !query || label.length > 80 || query.length > 160) return null
  return { label, query }
}

export function parseCatalogSearch(payload: unknown): CatalogSearchResponse | null {
  if (!payload || typeof payload !== "object") return null
  const source = payload as Record<string, unknown>
  const status = optionalString(source.status)
  const normalizedQuery = optionalString(source.normalized_query)
  if (
    !normalizedQuery ||
    !["catalog", "ready", "clarification", "unavailable"].includes(status || "") ||
    !Array.isArray(source.results)
  ) {
    return null
  }

  return {
    status: status as CatalogSearchStatus,
    normalizedQuery,
    clarification: optionalString(source.clarification),
    clarificationOptions: Array.isArray(source.clarification_options)
      ? source.clarification_options
        .map(parseClarificationOption)
        .filter((option): option is CatalogSearchClarificationOption => !!option)
        .slice(0, 4)
      : [],
    results: source.results
      .map(parseCatalogSearchResult)
      .filter((result): result is CatalogSearchResult => !!result),
    fallback: Array.isArray(source.fallback)
      ? source.fallback
        .map(parseCatalogSearchFallback)
        .filter((item): item is CatalogSearchFallback => !!item)
      : [],
  }
}

function normalizedIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function identityWithoutBrand(value: string, brand: string): string {
  const normalizedValue = normalizedIdentity(value)
  const normalizedBrand = normalizedIdentity(brand)
  return normalizedBrand && normalizedValue.startsWith(`${normalizedBrand} `)
    ? normalizedValue.slice(normalizedBrand.length + 1)
    : normalizedValue
}

function compactIdentity(value: string): string {
  return normalizedIdentity(value).replace(/\s/gu, "")
}

export function isCatalogSearchResultForProduct(
  product: CatalogProduct,
  result: CatalogSearchResult,
): boolean {
  const expectedBrand = normalizedIdentity(product.brand)
  const resultBrand = result.brand ? normalizedIdentity(result.brand) : ""
  const expectedName = identityWithoutBrand(product.name, product.brand)
  const resultName = identityWithoutBrand(result.name, result.brand ?? product.brand)
  const resultModel = identityWithoutBrand(result.model, result.brand ?? product.brand)
  const article = result.article ? normalizedIdentity(result.article) : ""
  const compactArticle = compactIdentity(result.article ?? "")
  const compactExpectedName = compactIdentity(expectedName)
  const compactQuery = compactIdentity(product.query)

  return Boolean(
    expectedBrand &&
    expectedBrand === resultBrand &&
    product.kind === result.kind &&
    expectedName &&
    expectedName === resultName &&
    expectedName === resultModel &&
    article &&
    (compactArticle === compactExpectedName || compactQuery.includes(compactArticle)),
  )
}

export function parseCheckoutCatalog(payload: unknown): CheckoutCatalogSnapshot | null {
  if (!payload || typeof payload !== "object") return null
  const source = payload as Record<string, unknown>
  const version = optionalString(source.version)
  if (
    !version ||
    source.catalog_mode !== "curated_live_poizon" ||
    source.snapshot_hours !== 12 ||
    !Array.isArray(source.items)
  ) return null

  const items: PublishedCatalogMap = {}
  const lookup: CatalogPriceMap = {}
  const ambiguousSlugs = new Set<string>()
  for (const rawItem of source.items) {
    if (!rawItem || typeof rawItem !== "object") continue
    const item = rawItem as Record<string, unknown>
    const slug = optionalString(item.slug)
    const name = optionalString(item.name)
    const brand = optionalString(item.brand)
    const imageUrl = optionalString(item.image_url)
    const priceRub = finitePositiveNumber(item.price_rub, maxPriceRub)
    const productKind = optionalString(item.product_kind)
    const fulfillmentMode = optionalString(item.fulfillment_mode)
    const availability = optionalString(item.availability)
    const observedAt = optionalString(item.observed_at)
    const expiresAt = optionalString(item.expires_at)
    const observedAtMs = parseQuoteTimestamp(item.observed_at)
    const expiresAtMs = parseQuoteTimestamp(item.expires_at)
    const now = Date.now()
    const displayPriceVerified = item.display_price_verified === true
    const checkoutReady = item.checkout_ready === true
    const sizes = Array.isArray(item.sizes)
      ? [...new Set(item.sizes.map(optionalString).filter((size): size is string => !!size))]
      : []
    if (
      !slug ||
      !catalogSlugPattern.test(slug) ||
      ambiguousSlugs.has(slug) ||
      !name ||
      !brand ||
      !priceRub ||
      item.live_provider_verified !== true ||
      !displayPriceVerified ||
      typeof item.checkout_ready !== "boolean" ||
      !observedAt ||
      !expiresAt ||
      !observedAtMs ||
      !expiresAtMs ||
      observedAtMs > now + quoteClockSkewMs ||
      expiresAtMs <= now ||
      expiresAtMs <= observedAtMs ||
      expiresAtMs - observedAtMs > catalogSnapshotWindowMs ||
      !availability ||
      sizes.length === 0 ||
      !["footwear", "apparel", "accessory"].includes(productKind || "") ||
      !["made_to_order", "in_stock"].includes(fulfillmentMode || "") ||
      !["supplier_verified", "supplier_stock_unknown", "supplier_unavailable"].includes(
        availability,
      )
    ) {
      continue
    }

    const parsedSizeOffers = Array.isArray(item.size_offers)
      ? item.size_offers.flatMap((rawOffer): PublishedSizeOffer[] => {
        if (!rawOffer || typeof rawOffer !== "object") return []
        const offer = rawOffer as Record<string, unknown>
        const skuId = optionalString(offer.sku_id)
        const sizeEu = optionalString(offer.size_eu) ?? optionalString(offer.size)
        const priceCny = finitePositiveNumber(offer.price_cny, maxPriceCny)
        const price = finitePositiveNumber(offer.price_rub, maxPriceRub)
        const offerAvailable = typeof offer.available === "boolean"
          ? offer.available
          : offer.available === null
            ? null
            : undefined
        const checkoutConfirmed = offer.checkout_confirmed
        if (
          !skuId ||
          !skuIdPattern.test(skuId) ||
          !sizeEu ||
          sizeEu.length > 32 ||
          !priceCny ||
          !price ||
          offerAvailable === undefined ||
          typeof checkoutConfirmed !== "boolean" ||
          (checkoutConfirmed && offerAvailable !== true) ||
          offer.live_provider_verified !== true ||
          !sizes.includes(sizeEu)
        ) return []
        return [{
          skuId,
          sizeEu,
          sizeRu: optionalString(offer.size_ru) ?? optionalString(offer.ru),
          sizeUs: optionalString(offer.size_us) ?? optionalString(offer.us),
          sizeCn: optionalString(offer.size_cn) ?? optionalString(offer.cn),
          priceCny,
          priceRub: price,
          available: offerAvailable,
          checkoutConfirmed,
          liveProviderVerified: true,
          observedAt,
          expiresAt,
        }]
      })
      : []
    const skuCounts = new Map<string, number>()
    const sizeCounts = new Map<string, number>()
    for (const offer of parsedSizeOffers) {
      skuCounts.set(offer.skuId, (skuCounts.get(offer.skuId) ?? 0) + 1)
      sizeCounts.set(offer.sizeEu, (sizeCounts.get(offer.sizeEu) ?? 0) + 1)
    }
    const sizeOffers = parsedSizeOffers.filter(
      (offer) => skuCounts.get(offer.skuId) === 1 && sizeCounts.get(offer.sizeEu) === 1,
    )
    if (sizeOffers.length === 0) continue

    const orderableOffers = sizeOffers.filter(
      (offer) => offer.available === true && offer.checkoutConfirmed,
    )
    const confirmedStockOffers = sizeOffers.filter((offer) => offer.available === true)
    const unknownStockOffers = sizeOffers.filter((offer) => offer.available === null)
    const unavailableOffers = sizeOffers.filter((offer) => offer.available === false)
    if (
      checkoutReady !== (orderableOffers.length > 0) ||
      (availability === "supplier_verified" && confirmedStockOffers.length === 0) ||
      (availability === "supplier_stock_unknown" &&
        (confirmedStockOffers.length > 0 || unknownStockOffers.length === 0)) ||
      (availability === "supplier_unavailable" &&
        (confirmedStockOffers.length > 0 ||
          unknownStockOffers.length > 0 ||
          unavailableOffers.length === 0))
    ) continue

    const floorOffers = confirmedStockOffers.length > 0
      ? confirmedStockOffers
      : unknownStockOffers.length > 0
        ? unknownStockOffers
        : unavailableOffers
    if (priceRub !== Math.min(...floorOffers.map((offer) => offer.priceRub))) continue

    const normalized: PublishedCatalogItem = {
      slug,
      name,
      brand,
      productKind: productKind as PublishedCatalogItem["productKind"],
      sizes,
      priceRub,
      imageUrl,
      fulfillmentMode: fulfillmentMode as PublishedCatalogItem["fulfillmentMode"],
      availability,
      etaMinDays: finitePositiveNumber(item.eta_min_days),
      etaMaxDays: finitePositiveNumber(item.eta_max_days),
      liveProviderVerified: true,
      displayPriceVerified,
      checkoutReady,
      observedAt,
      expiresAt,
      sizeOffers,
    }
    if (items[slug]) {
      delete items[slug]
      delete lookup[slug]
      ambiguousSlugs.add(slug)
      continue
    }
    items[slug] = normalized
    lookup[slug] = priceRub
  }

  const orderCreationEnabled = source.order_creation_enabled === true &&
    Object.values(items).some((item) => item.checkoutReady)
  return {
    items,
    lookup,
    version,
    catalogMode: "curated_live_poizon",
    snapshotHours: 12,
    personalDataConsentVersion: optionalString(source.personal_data_consent_version),
    orderCreationEnabled,
    onlinePaymentEnabled:
      orderCreationEnabled && source.online_payment_enabled === true,
  }
}

export async function fetchCheckoutCatalog(
  apiBaseUrl: string,
  signal?: AbortSignal,
): Promise<CheckoutCatalogSnapshot> {
  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/checkout/orders?mode=catalog`
  const response = await fetch(endpoint, { credentials: "include", signal })
  const payload = await response.json().catch(() => null)
  const parsed = response.ok ? parseCheckoutCatalog(payload) : null
  if (!parsed) throw new Error("Не удалось получить подтверждённый каталог для заказа.")
  return parsed
}

export async function fetchCatalogSearch(
  apiBaseUrl: string,
  query: string,
  signal?: AbortSignal,
): Promise<CatalogSearchResponse> {
  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/catalog/search`
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 4 }),
    signal,
  })
  const payload = await response.json().catch(() => null)
  const parsed = response.ok ? parseCatalogSearch(payload) : null
  if (!parsed) throw new Error("Поиск по каталогу временно недоступен.")
  return parsed
}

export function getEffectiveLinePrice(
  product: CatalogProduct,
  catalogPrices: CatalogPriceMap | null,
  catalogItems: PublishedCatalogMap | null = null,
  size: string | null = null,
): number {
  if (catalogItems && size) {
    const sizeOffer = getPublishedSizeOffer(catalogItems[product.slug], size)
    return sizeOffer?.priceRub ?? 0
  }
  if (!catalogPrices) return 0
  const override = catalogPrices[product.slug]
  if (!Number.isFinite(override) || override <= 0) return 0
  return override
}

function canonicalSize(value: string): string {
  return value.trim().replace(",", ".").toUpperCase()
}

function numericSize(value: string): number | null {
  const parsed = Number(canonicalSize(value))
  return Number.isFinite(parsed) ? parsed : null
}

function formatSize(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",")
}

function nikeRuFallback(brand: string, sizeEu: string): string | null {
  if (brand.trim().toLowerCase() !== "nike") return null
  const eu = numericSize(sizeEu)
  return eu === null ? null : formatSize(eu - 1)
}

function displayRuSize(value: string | null): string | null {
  if (!value) return null
  return numericSize(value) === null ? value.trim() : canonicalSize(value).replace(".", ",")
}

function sortSizeLabels(values: readonly string[]): string[] {
  return [...values].sort((left, right) => {
    const leftNumber = numericSize(left)
    const rightNumber = numericSize(right)
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber
    if (leftNumber !== null) return -1
    if (rightNumber !== null) return 1
    return left.localeCompare(right, "ru")
  })
}

export function getPublishedSizeOffer(
  item: PublishedCatalogItem | undefined,
  sizeEu: string,
): PublishedSizeOffer | null {
  if (!item) return null
  const matchingOffers = item.sizeOffers.filter(
    (offer) =>
      offer.available === true &&
      offer.checkoutConfirmed &&
      offer.sizeEu === sizeEu,
  )
  return matchingOffers.length === 1 ? matchingOffers[0] ?? null : null
}

export function buildProductSizeOffers(
  sizeUniverse: readonly string[],
  brand: string,
  liveResult: CatalogSearchResult | null,
  checkoutItem: PublishedCatalogItem | undefined,
): ProductSizeOffer[] {
  const sizeLabels = new Map<string, string>()
  for (const size of sizeUniverse) {
    const normalized = canonicalSize(size)
    if (normalized) sizeLabels.set(normalized, size.trim())
  }

  const liveByExactSize = new Map<string, CatalogSearchOffer[]>()
  for (const offer of liveResult?.offers ?? []) {
    const normalized = canonicalSize(offer.size)
    if (!normalized) continue
    sizeLabels.set(normalized, offer.size.trim())
    const liveOffers = liveByExactSize.get(offer.size) ?? []
    liveOffers.push(offer)
    liveByExactSize.set(offer.size, liveOffers)
  }
  for (const offer of checkoutItem?.sizeOffers ?? []) {
    sizeLabels.set(canonicalSize(offer.sizeEu), offer.sizeEu)
  }

  return sortSizeLabels([...sizeLabels.values()]).map((sizeEu) => {
    const publishedOffers = checkoutItem?.sizeOffers.filter(
      (offer) => offer.sizeEu === sizeEu,
    ) ?? []
    const publishedOffer = publishedOffers.length === 1 ? publishedOffers[0] ?? null : null
    const checkoutOffer = publishedOffer?.available === true && publishedOffer.checkoutConfirmed
      ? publishedOffer
      : null
    const matchingLiveOffer = checkoutOffer
      ? (liveByExactSize.get(checkoutOffer.sizeEu) ?? []).find(
        (liveOffer) =>
          liveOffer.size === checkoutOffer.sizeEu &&
          liveOffer.totalRub === checkoutOffer.priceRub,
      ) ?? null
      : null

    if (checkoutOffer && matchingLiveOffer) {
      return {
        // Checkout continues to use the server-owned catalog SKU.  A live
        // search response intentionally has no supplier SKU in the browser.
        skuId: checkoutOffer.skuId,
        sizeEu: checkoutOffer.sizeEu,
        sizeRu: displayRuSize(matchingLiveOffer.sizeRu) ??
          nikeRuFallback(brand, matchingLiveOffer.size),
        sizeUs: matchingLiveOffer.sizeUs,
        sizeCn: matchingLiveOffer.sizeCn,
        priceCny: matchingLiveOffer.priceCny,
        priceRub: matchingLiveOffer.totalRub,
        stockStatus: true,
        available: true,
        checkoutConfirmed: true,
      }
    }

    if (checkoutOffer) {
      return {
        skuId: checkoutOffer.skuId,
        sizeEu: checkoutOffer.sizeEu,
        sizeRu: displayRuSize(checkoutOffer.sizeRu) ??
          nikeRuFallback(brand, checkoutOffer.sizeEu),
        sizeUs: null,
        sizeCn: null,
        priceCny: checkoutOffer.priceCny,
        priceRub: checkoutOffer.priceRub,
        stockStatus: true,
        available: true,
        checkoutConfirmed: true,
      }
    }

    if (publishedOffer) return {
      skuId: null,
      sizeEu: publishedOffer.sizeEu,
      sizeRu: displayRuSize(publishedOffer.sizeRu) ??
        nikeRuFallback(brand, publishedOffer.sizeEu),
      sizeUs: publishedOffer.sizeUs,
      sizeCn: publishedOffer.sizeCn,
      priceCny: publishedOffer.priceCny,
      priceRub: publishedOffer.priceRub,
      stockStatus: publishedOffer.available,
      available: false,
      checkoutConfirmed: false,
    }

    return {
      skuId: null,
      sizeEu,
      sizeRu: nikeRuFallback(brand, sizeEu),
      sizeUs: null,
      sizeCn: null,
      priceCny: null,
      priceRub: null,
      stockStatus: null,
      available: false,
      checkoutConfirmed: false,
    }
  })
}

export const cartStorageKey = "kicksbase-cart-v1"

export function cartLineId(productSlug: string, size: string): string {
  return `${productSlug}:${size}`
}

export function addOrIncrementCartLine(
  lines: readonly CartLine[],
  product: CatalogProduct,
  size: string,
  validation: CartLine["validation"] = "pending",
): CartLine[] {
  const id = cartLineId(product.slug, size)
  const existing = lines.find((line) => line.id === id)
  if (existing) {
    return lines.map((line) =>
      line.id === id
        ? { ...line, quantity: Math.min(line.quantity + 1, 4), validation }
        : line,
    )
  }
  return [...lines, { id, product, size, quantity: 1, validation }]
}

export function updateCartQuantity(
  lines: readonly CartLine[],
  id: string,
  quantity: number,
): CartLine[] {
  const nextQuantity = Math.max(0, Math.min(Math.trunc(quantity), 4))
  if (nextQuantity === 0) return lines.filter((line) => line.id !== id)
  return lines.map((line) =>
    line.id === id ? { ...line, quantity: nextQuantity } : line,
  )
}

export function cartTotalRub(
  lines: readonly CartLine[],
  catalogPrices: CatalogPriceMap | null = null,
  catalogItems: PublishedCatalogMap | null = null,
): number {
  return lines.reduce(
    (sum, line) => sum + getEffectiveLinePrice(
      line.product,
      catalogPrices,
      catalogItems,
      line.size,
    ) * line.quantity,
    0,
  )
}

export function saveCart(lines: readonly CartLine[]): void {
  if (typeof window === "undefined") return
  const payload = lines.map((line) => ({
    slug: line.product.slug,
    size: line.size,
    quantity: line.quantity,
  }))
  localStorage.setItem(cartStorageKey, JSON.stringify(payload))
}

export function loadCart(products: readonly CatalogProduct[]): CartLine[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(localStorage.getItem(cartStorageKey) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): CartLine[] => {
      const product = products.find((candidate) => candidate.slug === item.slug)
      const size = String(item.size || "").trim()
      const quantity = Math.max(1, Math.min(Number(item.quantity) || 1, 4))
      if (!product || !size) return []
      return [{
        id: cartLineId(product.slug, size),
        product,
        size,
        quantity,
        validation: "pending",
      }]
    })
  } catch {
    return []
  }
}

export function reconcileCartLines(
  lines: readonly CartLine[],
  catalogItems: PublishedCatalogMap,
): CartLine[] {
  return lines.map((line) => ({
    ...line,
    validation: catalogItems[line.product.slug]?.availability === "supplier_verified" &&
      Boolean(getPublishedSizeOffer(catalogItems[line.product.slug], line.size))
      ? "valid"
      : "invalid",
  }))
}

export function buildCheckoutPayload(
  lines: readonly CartLine[],
  customer: CheckoutCustomer,
  consents: CheckoutConsents,
  delivery: CheckoutDelivery,
  catalogItems: PublishedCatalogMap,
  priceVersion: string = CATALOG_PRICE_VERSION,
) {
  const items = lines.map((line) => {
    const offer = catalogItems[line.product.slug]
    const sizeOffer = getPublishedSizeOffer(offer, line.size)
    if (
      !offer ||
      offer.availability !== "supplier_verified" ||
      !sizeOffer ||
      line.validation !== "valid"
    ) {
      throw new Error("В заказе есть товар или размер без подтверждения сервера.")
    }
    return {
      product_slug: offer.slug,
      product_name: offer.name,
      brand: offer.brand,
      product_kind: offer.productKind,
      size_eu: sizeOffer.sizeEu,
      sku_id: sizeOffer.skuId,
      price_rub: sizeOffer.priceRub,
      price_version: priceVersion || CATALOG_PRICE_VERSION,
      quantity: line.quantity,
      image_url: offer.imageUrl,
    }
  })

  return {
    customer: {
      full_name: customer.fullName,
      phone: customer.phone,
      email: customer.email || null,
    },
    consents: {
      offer_accepted: consents.offerAccepted,
      personal_data_accepted: consents.personalDataAccepted,
    },
    delivery: {
      method: delivery.method,
      city: delivery.city.trim(),
      postal_code: delivery.postalCode.trim(),
      address: delivery.method === "cdek_courier" ? delivery.address.trim() : null,
      pvz_code: delivery.method === "cdek_pvz" ? delivery.pvzCode.trim() : null,
    },
    items,
  }
}

export async function submitCheckout(
  apiBaseUrl: string,
  lines: readonly CartLine[],
  customer: CheckoutCustomer,
  consents: CheckoutConsents,
  delivery: CheckoutDelivery,
  idempotencyKey: string,
  catalogItems: PublishedCatalogMap,
  priceVersion: string = CATALOG_PRICE_VERSION,
): Promise<CheckoutResponse> {
  if (!/^[\x21-\x7e]{8,80}$/.test(idempotencyKey)) {
    throw new Error("Некорректный ключ безопасного повтора заказа")
  }
  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/checkout/orders`
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    credentials: "include",
    body: JSON.stringify(
      buildCheckoutPayload(
        lines,
        customer,
        consents,
        delivery,
        catalogItems,
        priceVersion,
      ),
    ),
  })
  const body = (await response.json().catch(() => null)) as
    | (CheckoutResponseBody & CheckoutFailureBody)
    | null
  if (!response.ok || body === null) {
    const message = body?.detail || body?.message || "Не удалось создать заказ"
    const error = new Error(message) as CheckoutApiError
    error.status = response.status
    error.detail = body?.detail || body?.message
    throw error
  }
  return {
    checkoutId: body.checkout_id,
    orderNumber: body.order_number,
    orderIds: body.order_ids,
    amounts: {
      merchandiseRub: body.amounts.merchandise_rub,
      payableNowRub: body.amounts.payable_now_rub,
      deliveryDueLaterRub: body.amounts.delivery_due_later_rub,
      currency: body.amounts.currency,
    },
    delivery: {
      method: body.delivery.method,
      provider: body.delivery.provider,
      city: body.delivery.city,
      postalCode: body.delivery.postal_code,
      address: body.delivery.address,
      pvzCode: body.delivery.pvz_code,
      amountRub: body.delivery.amount_rub,
      quoteStatus: body.delivery.quote_status,
      minDays: body.delivery.min_days,
      maxDays: body.delivery.max_days,
      paymentTiming: body.delivery.payment_timing,
    },
    status: body.status,
    paymentUrl: body.payment_url,
    message: body.message,
  }
}
