import { CATALOG_PRICE_VERSION, type CatalogProduct } from "../catalog/catalog"

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
  priceVersion: string
  imageUrl: string
  images: readonly string[]
  fulfillmentMode: "made_to_order" | "in_stock"
  availability: string
  etaMinDays: number | null
  etaMaxDays: number | null
  liveProviderVerified: boolean
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
  priceRub: number
  priceVersion: string
  available: boolean
  checkoutConfirmed: boolean
  liveProviderVerified: boolean
  observedAt: string | null
  expiresAt: string | null
}

export type CatalogPriceMap = Record<string, number>
export type PublishedCatalogMap = Record<string, PublishedCatalogItem>

export type CatalogSearchStatus = "catalog" | "ready" | "clarification" | "unavailable"

/**
 * Public search DTO.  Supplier identifiers and CNY amounts deliberately do
 * not cross the CRM → browser boundary.
 */
export interface CatalogSearchPriceBreakdown {
  purchaseRub: number
  conversionFee: number
  firstSixPercentFee: number
  serviceMarkup: number
  finalSixPercentFee: number
  deliveryRub: number
  totalRub: number
  markupTier: string
}

export interface CatalogSearchOffer {
  size: string
  /** Source-provided size labels. They are never converted or inferred in the UI. */
  eu: string | null
  ru: string | null
  us: string | null
  cn: string | null
  /** `null` means the supplier did not report stock for this size. */
  available: boolean | null
  quoteRub: number
  rfDelivery: number
  totalRub: number
  priceBreakdown: CatalogSearchPriceBreakdown | null
}

export interface ProductSizeOffer {
  skuId: string | null
  sizeEu: string
  sizeRu: string | null
  sizeUs: string | null
  sizeCn: string | null
  priceRub: number | null
  available: boolean
  checkoutConfirmed: boolean
}

export interface CatalogSearchResult {
  productRef: string
  brand: string | null
  name: string
  article: string | null
  color: string | null
  kind: CatalogProduct["kind"]
  description: string | null
  images: readonly string[]
  /** Availability reported by the supplier for the product as a whole. */
  inStock: boolean | null
  /** Supplier-provided explanation for the listed size values. */
  sizeContext: string | null
  /** Supplier-provided size-chart text. */
  sizeChart: string | null
  /** Validated HTTPS size-chart image. */
  sizeImage: string | null
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

export interface CatalogSearchResponse {
  status: CatalogSearchStatus
  normalizedQuery: string
  clarification: string | null
  results: readonly CatalogSearchResult[]
  fallback: readonly CatalogSearchFallback[]
}

export interface CheckoutCatalogSnapshot {
  items: PublishedCatalogMap
  lookup: CatalogPriceMap
  version: string
  snapshotHours: 12 | null
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

function sameOriginApiEndpoint(path: string): string {
  // The storefront must never receive a supplier or CRM hostname from a public
  // environment variable. Nginx owns the only route out of the browser.
  return `/api/${path.replace(/^\/+/, "")}`
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

function finitePositiveNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

// External search data is untrusted until its URL and quote metadata are validated.
export function safeHttpsUrl(value: unknown): string | null {
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

function parseCatalogSearchPriceBreakdown(
  value: unknown,
): CatalogSearchPriceBreakdown | null {
  if (!value || typeof value !== "object") return null
  const breakdown = value as Record<string, unknown>
  const purchaseRub = finitePositiveNumber(breakdown.purchase_rub)
  const conversionFee = finitePositiveNumber(breakdown.conversion_fee)
  const firstSixPercentFee = finitePositiveNumber(breakdown.first_six_percent_fee)
  const serviceMarkup = finitePositiveNumber(breakdown.service_markup)
  const finalSixPercentFee = finitePositiveNumber(breakdown.final_six_percent_fee)
  const deliveryRub = finitePositiveNumber(breakdown.delivery_rub)
  const totalRub = finitePositiveNumber(breakdown.total_rub)
  const markupTier = optionalString(breakdown.markup_tier)

  if (
    !purchaseRub ||
    !conversionFee ||
    !firstSixPercentFee ||
    !serviceMarkup ||
    !finalSixPercentFee ||
    !deliveryRub ||
    !totalRub ||
    !markupTier
  ) {
    return null
  }

  return {
    purchaseRub,
    conversionFee,
    firstSixPercentFee,
    serviceMarkup,
    finalSixPercentFee,
    deliveryRub,
    totalRub,
    markupTier,
  }
}

function parseCatalogSearchResult(value: unknown): CatalogSearchResult | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  const productRef = optionalString(source.product_ref)
  const name = optionalString(source.name)
  const kind = optionalString(source.kind)
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
      const available = typeof offer.available === "boolean" ? offer.available : null
      const quoteRub = finitePositiveNumber(offer.quote_rub)
      const rfDelivery = finitePositiveNumber(offer.rf_delivery)
      const totalRub = finitePositiveNumber(offer.total_rub)
      const priceBreakdown = offer.price_breakdown === null
        ? null
        : parseCatalogSearchPriceBreakdown(offer.price_breakdown)
      if (
        !size ||
        !quoteRub ||
        !rfDelivery ||
        !totalRub ||
        available === false ||
        (offer.price_breakdown !== null && !priceBreakdown)
      ) {
        return []
      }
      return [{
        size,
        eu: optionalString(offer.eu),
        ru: optionalString(offer.ru),
        us: optionalString(offer.us),
        cn: optionalString(offer.cn),
        available,
        quoteRub,
        rfDelivery,
        totalRub,
        priceBreakdown,
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
    expiresAtMs <= now ||
    expiresAtMs <= observedAtMs ||
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
    article: optionalString(source.article),
    color: optionalString(source.color),
    kind: kind as CatalogProduct["kind"],
    description: optionalString(source.description),
    images,
    inStock: typeof source.in_stock === "boolean" ? source.in_stock : null,
    sizeContext: optionalString(source.size_context),
    sizeChart: optionalString(source.size_chart),
    sizeImage: safeHttpsUrl(source.size_image),
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

export function parseCheckoutCatalog(payload: unknown): CheckoutCatalogSnapshot | null {
  if (!payload || typeof payload !== "object") return null
  const source = payload as Record<string, unknown>
  const version = optionalString(source.version)
  if (!version || !Array.isArray(source.items)) return null

  // The server deliberately disables the legacy static checkout while live
  // Poizon cards are ordered through Telegram.  Treat this as a valid, ready
  // empty catalogue: a network success must never fall back to bundled prices.
  if (source.catalog_mode === "live_poizon_only") {
    if (
      source.order_creation_enabled !== false ||
      source.online_payment_enabled === true ||
      source.items.length !== 0
    ) {
      return null
    }
    return {
      items: {},
      lookup: {},
      version,
      snapshotHours: null,
      personalDataConsentVersion: optionalString(source.personal_data_consent_version),
      orderCreationEnabled: false,
      onlinePaymentEnabled: false,
    }
  }

  // Static cards are published only from the CRM's curated Poizon snapshot.
  // A response without this exact contract is not allowed to revive the old
  // bundled catalogue prices or sizes in the browser.
  if (
    version !== "poizon-live-v1" ||
    source.catalog_mode !== "curated_live_poizon" ||
    source.snapshot_hours !== 12
  ) {
    return null
  }

  const items: PublishedCatalogMap = {}
  const lookup: CatalogPriceMap = {}
  for (const rawItem of source.items) {
    if (!rawItem || typeof rawItem !== "object") continue
    const item = rawItem as Record<string, unknown>
    const slug = optionalString(item.slug)
    const name = optionalString(item.name)
    const brand = optionalString(item.brand)
    const priceRub = finitePositiveNumber(item.price_rub)
    const priceVersion = optionalString(item.price_version)
    const productKind = optionalString(item.product_kind)
    const fulfillmentMode = optionalString(item.fulfillment_mode)
    const availability = optionalString(item.availability)
    const observedAt = optionalString(item.observed_at)
    const expiresAt = optionalString(item.expires_at)
    const observedAtMs = parseQuoteTimestamp(item.observed_at)
    const expiresAtMs = parseQuoteTimestamp(item.expires_at)
    const images = Array.isArray(item.images)
      ? item.images
        .map(safeHttpsUrl)
        .filter((image): image is string => !!image)
        .slice(0, 5)
      : []
    const imageUrl = safeHttpsUrl(item.image_url) ?? images[0] ?? null
    const declaredSizes = Array.isArray(item.sizes)
      ? [...new Set(item.sizes.map(optionalString).filter((size): size is string => !!size))]
      : []
    if (
      !slug ||
      !name ||
      !brand ||
      !imageUrl ||
      !priceRub ||
      !priceVersion ||
      priceVersion !== version ||
      !availability ||
      images.length === 0 ||
      !observedAt ||
      !expiresAt ||
      !observedAtMs ||
      !expiresAtMs ||
      observedAtMs > Date.now() + quoteClockSkewMs ||
      expiresAtMs <= Date.now() ||
      expiresAtMs <= observedAtMs ||
      Math.abs(expiresAtMs - observedAtMs - 12 * 60 * 60 * 1000) > quoteClockSkewMs ||
      item.catalog_source !== "poizon_curated_snapshot" ||
      item.live_provider_verified !== true ||
      availability !== "supplier_verified" ||
      !["footwear", "apparel", "accessory"].includes(productKind || "") ||
      !["made_to_order", "in_stock"].includes(fulfillmentMode || "")
    ) {
      continue
    }

    const sizeOffers = Array.isArray(item.size_offers)
      ? item.size_offers.flatMap((rawOffer): PublishedSizeOffer[] => {
        if (!rawOffer || typeof rawOffer !== "object") return []
        const offer = rawOffer as Record<string, unknown>
        const skuId = optionalString(offer.sku_id)
        const sizeEu = optionalString(offer.size_eu) ?? optionalString(offer.size)
        const price = finitePositiveNumber(offer.price_rub)
        const offerAvailable = offer.available === true
        const offerPriceVersion = optionalString(offer.price_version)
        if (
          !skuId ||
          !sizeEu ||
          !price ||
          !offerAvailable ||
          offer.checkout_confirmed !== true ||
          offer.live_provider_verified !== true ||
          offerPriceVersion !== priceVersion
        ) {
          return []
        }
        return [{
          skuId,
          sizeEu,
          sizeRu: optionalString(offer.size_ru) ?? optionalString(offer.ru),
          sizeUs: optionalString(offer.size_us) ?? optionalString(offer.us),
          sizeCn: optionalString(offer.size_cn) ?? optionalString(offer.cn),
          priceRub: price,
          priceVersion: offerPriceVersion,
          available: true,
          checkoutConfirmed: true,
          liveProviderVerified: true,
          observedAt: optionalString(offer.observed_at),
          expiresAt: optionalString(offer.expires_at),
        }]
      })
      : []
    const sizes = declaredSizes.length > 0
      ? declaredSizes.filter((size) => sizeOffers.some((offer) => offer.sizeEu === size))
      : [...new Set(sizeOffers.map((offer) => offer.sizeEu))]
    if (
      sizes.length === 0 ||
      sizeOffers.length === 0 ||
      new Set(sizeOffers.map((offer) => offer.sizeEu)).size !== sizeOffers.length
    ) {
      continue
    }
    const normalized: PublishedCatalogItem = {
      slug,
      name,
      brand,
      productKind: productKind as PublishedCatalogItem["productKind"],
      sizes,
      priceRub,
      priceVersion,
      imageUrl,
      images,
      fulfillmentMode: fulfillmentMode as PublishedCatalogItem["fulfillmentMode"],
      availability,
      etaMinDays: finitePositiveNumber(item.eta_min_days),
      etaMaxDays: finitePositiveNumber(item.eta_max_days),
      liveProviderVerified: true,
      observedAt,
      expiresAt,
      sizeOffers,
    }
    items[slug] = normalized
    lookup[slug] = Math.min(...sizeOffers.map((offer) => offer.priceRub))
  }

  const orderCreationEnabled = source.order_creation_enabled === true
  return {
    items,
    lookup,
    version,
    snapshotHours: 12,
    personalDataConsentVersion: optionalString(source.personal_data_consent_version),
    orderCreationEnabled,
    onlinePaymentEnabled:
      orderCreationEnabled && source.online_payment_enabled === true,
  }
}

export async function fetchCheckoutCatalog(
  signal?: AbortSignal,
): Promise<CheckoutCatalogSnapshot> {
  const endpoint = `${sameOriginApiEndpoint("checkout/orders")}?mode=catalog`
  const response = await fetch(endpoint, { credentials: "same-origin", signal })
  const payload = await response.json().catch(() => null)
  const parsed = response.ok ? parseCheckoutCatalog(payload) : null
  if (!parsed) throw new Error("Не удалось получить подтверждённый каталог для заказа.")
  return parsed
}

export async function fetchCatalogSearch(
  query: string,
  signal?: AbortSignal,
): Promise<CatalogSearchResponse> {
  const endpoint = sameOriginApiEndpoint("catalog/search")
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
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
  _catalogPrices: CatalogPriceMap | null,
  catalogItems: PublishedCatalogMap | null = null,
  size: string | null = null,
): number | null {
  if (!catalogItems || !size) return null
  const sizeOffer = getPublishedSizeOffer(catalogItems[product.slug], size)
  return sizeOffer?.priceRub ?? null
}

function numericSize(value: string): number | null {
  const parsed = Number(value.trim().replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
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
  if (!item?.liveProviderVerified) return null
  const matchingOffers = item.sizeOffers.filter(
    (offer) =>
      offer.available &&
      offer.checkoutConfirmed &&
      offer.liveProviderVerified &&
      offer.sizeEu === sizeEu,
  )
  return matchingOffers.length === 1 ? matchingOffers[0] ?? null : null
}

export function buildProductSizeOffers(
  _sizeUniverse: readonly string[],
  _brand: string,
  checkoutItem: PublishedCatalogItem | undefined,
): ProductSizeOffer[] {
  // Size labels are source data, not an editorial size chart. In particular,
  // do not infer RU values from EU values or add bundled sizes the snapshot
  // did not explicitly approve for checkout.
  const sizeLabels = [...new Set(
    (checkoutItem?.sizeOffers ?? [])
      .filter((offer) =>
        offer.available && offer.checkoutConfirmed && offer.liveProviderVerified,
      )
      .map((offer) => offer.sizeEu),
  )]

  return sortSizeLabels(sizeLabels).flatMap((sizeEu): ProductSizeOffer[] => {
    const checkoutOffer = getPublishedSizeOffer(checkoutItem, sizeEu)
    if (!checkoutOffer) return []
    return [{
      skuId: checkoutOffer.skuId,
      sizeEu: checkoutOffer.sizeEu,
      sizeRu: checkoutOffer.sizeRu,
      sizeUs: checkoutOffer.sizeUs,
      sizeCn: checkoutOffer.sizeCn,
      priceRub: checkoutOffer.priceRub,
      available: true,
      checkoutConfirmed: true,
    }]
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
  return lines.reduce((sum, line) => {
    const price = getEffectiveLinePrice(
      line.product,
      catalogPrices,
      catalogItems,
      line.size,
    )
    return sum + (price ?? 0) * line.quantity
  }, 0)
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
  _priceVersion: string = CATALOG_PRICE_VERSION,
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
      // The order carries the exact version paired with this source SKU, not
      // the release-wide catalogue version or an editorial fallback price.
      price_version: sizeOffer.priceVersion,
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
  const endpoint = sameOriginApiEndpoint("checkout/orders")
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    credentials: "same-origin",
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
