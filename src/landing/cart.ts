import type { CatalogProduct } from "../catalog/catalog"

export interface CartLine {
  id: string
  product: CatalogProduct
  size: string
  quantity: number
}

export interface CheckoutCustomer {
  fullName: string
  phone: string
  email: string
}

export interface CheckoutResult {
  status: "idle" | "submitting" | "created" | "failed"
  message: string
  orderIds: number[]
  paymentUrl: string | null
}

export interface CheckoutResponse {
  checkout_id: string
  order_ids: number[]
  status: "manual_review" | "payment_ready" | "payment_failed"
  payment_url: string | null
  message: string
}

export const cartStorageKey = "kicksbase-cart-v1"

export function cartLineId(productSlug: string, size: string): string {
  return `${productSlug}:${size}`
}

export function addOrIncrementCartLine(
  lines: readonly CartLine[],
  product: CatalogProduct,
  size: string,
): CartLine[] {
  const id = cartLineId(product.slug, size)
  const existing = lines.find((line) => line.id === id)
  if (existing) {
    return lines.map((line) =>
      line.id === id
        ? { ...line, quantity: Math.min(line.quantity + 1, 4) }
        : line,
    )
  }
  return [...lines, { id, product, size, quantity: 1 }]
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

export function cartTotalRub(lines: readonly CartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + (line.product.orderQuote?.totalRub ?? 0) * line.quantity,
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
      return [{ id: cartLineId(product.slug, size), product, size, quantity }]
    })
  } catch {
    return []
  }
}

export function buildCheckoutPayload(
  lines: readonly CartLine[],
  customer: CheckoutCustomer,
) {
  return {
    customer: {
      full_name: customer.fullName,
      phone: customer.phone,
      email: customer.email || null,
    },
    consents: {
      offer_accepted: true,
      personal_data_accepted: true,
    },
    items: lines.map((line) => ({
      product_slug: line.product.slug,
      product_name: line.product.name,
      brand: line.product.brand,
      product_kind: line.product.kind,
      size_eu: line.size,
      price_rub: line.product.orderQuote?.totalRub ?? 0,
      quantity: line.quantity,
      image_url: line.product.image,
    })),
  }
}

export async function submitCheckout(
  apiBaseUrl: string,
  lines: readonly CartLine[],
  customer: CheckoutCustomer,
): Promise<CheckoutResponse> {
  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/api/checkout/orders`
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(buildCheckoutPayload(lines, customer)),
  })
  const body = (await response.json().catch(() => null)) as CheckoutResponse | null
  if (!response.ok || body === null) {
    throw new Error(body?.message || "Не удалось создать заказ")
  }
  return body
}
