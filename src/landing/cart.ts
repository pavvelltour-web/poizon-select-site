import {
  CATALOG_PRICE_VERSION,
  getCatalogPriceRub,
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
  imageUrl: string
  fulfillmentMode: "made_to_order" | "in_stock"
  availability: string
  etaMinDays: number | null
  etaMaxDays: number | null
  liveProviderVerified: boolean
}

export type CatalogPriceMap = Record<string, number>
export type PublishedCatalogMap = Record<string, PublishedCatalogItem>

export interface CheckoutCatalogSnapshot {
  items: PublishedCatalogMap
  lookup: CatalogPriceMap
  version: string
  personalDataConsentVersion: string | null
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

function finitePositiveNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function parseCheckoutCatalog(payload: unknown): CheckoutCatalogSnapshot | null {
  if (!payload || typeof payload !== "object") return null
  const source = payload as Record<string, unknown>
  const version = optionalString(source.version)
  if (!version || !Array.isArray(source.items)) return null

  const items: PublishedCatalogMap = {}
  const lookup: CatalogPriceMap = {}
  for (const rawItem of source.items) {
    if (!rawItem || typeof rawItem !== "object") continue
    const item = rawItem as Record<string, unknown>
    const slug = optionalString(item.slug)
    const name = optionalString(item.name)
    const brand = optionalString(item.brand)
    const imageUrl = optionalString(item.image_url)
    const priceRub = finitePositiveNumber(item.price_rub)
    const productKind = optionalString(item.product_kind)
    const fulfillmentMode = optionalString(item.fulfillment_mode)
    const availability = optionalString(item.availability)
    const sizes = Array.isArray(item.sizes)
      ? [...new Set(item.sizes.map(optionalString).filter((size): size is string => !!size))]
      : []
    if (
      !slug ||
      !name ||
      !brand ||
      !imageUrl ||
      !priceRub ||
      !availability ||
      sizes.length === 0 ||
      !["footwear", "apparel", "accessory"].includes(productKind || "") ||
      !["made_to_order", "in_stock"].includes(fulfillmentMode || "")
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
      imageUrl,
      fulfillmentMode: fulfillmentMode as PublishedCatalogItem["fulfillmentMode"],
      availability,
      etaMinDays: finitePositiveNumber(item.eta_min_days),
      etaMaxDays: finitePositiveNumber(item.eta_max_days),
      liveProviderVerified: item.live_provider_verified === true,
    }
    items[slug] = normalized
    lookup[slug] = priceRub
  }

  if (Object.keys(items).length === 0) return null
  return {
    items,
    lookup,
    version,
    personalDataConsentVersion: optionalString(source.personal_data_consent_version),
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

export async function fetchCatalogRecommendations(
  apiBaseUrl: string,
  query: string,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/catalog/recommendations`
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 4 }),
    signal,
  })
  if (!response.ok) return []
  const payload = (await response.json().catch(() => null)) as { items?: unknown } | null
  return payload && Array.isArray(payload.items) ? payload.items.slice(0, 4) : []
}

export function getEffectiveLinePrice(
  product: CatalogProduct,
  catalogPrices: CatalogPriceMap | null,
): number {
  if (!catalogPrices) return getCatalogPriceRub(product)
  const override = catalogPrices[product.slug]
  if (!Number.isFinite(override) || override <= 0) return getCatalogPriceRub(product)
  return override
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
): number {
  return lines.reduce(
    (sum, line) => sum + getEffectiveLinePrice(line.product, catalogPrices) * line.quantity,
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
    validation: catalogItems[line.product.slug]?.availability === "catalog_listed" &&
      catalogItems[line.product.slug]?.sizes.includes(line.size)
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
    if (
      !offer ||
      offer.availability !== "catalog_listed" ||
      !offer.sizes.includes(line.size) ||
      line.validation !== "valid"
    ) {
      throw new Error("В заказе есть товар или размер без подтверждения сервера.")
    }
    return {
      product_slug: offer.slug,
      product_name: offer.name,
      brand: offer.brand,
      product_kind: offer.productKind,
      size_eu: line.size,
      price_rub: offer.priceRub,
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
