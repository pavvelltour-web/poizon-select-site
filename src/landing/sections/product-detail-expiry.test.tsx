import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { publicCatalogProducts } from "../../catalog/catalog"
import { buildProductSizeOffers, expireCatalogItem, parseCheckoutCatalog, type PublishedCatalogItem } from "../cart"
import type { StorefrontState } from "../landing-types"
import { ProductDetailPage } from "./product-detail-page"

const product = publicCatalogProducts.find((candidate) => candidate.slug === "nike-gt-cut-academy")!
const now = Date.parse("2026-09-08T12:00:00Z")
const firstExpiry = Date.parse("2026-09-08T12:30:00Z")

function fixture(checkoutConfirmed = true) {
  const snapshot = parseCheckoutCatalog({
    version: "pdp-selection-expiry", catalog_mode: "curated_live_poizon", snapshot_hours: 12,
    order_creation_enabled: true, online_payment_enabled: true,
    items: [{
      slug: product.slug, name: product.name, brand: product.brand, product_kind: "footwear", sizes: ["40", "41"],
      price_rub: 10_000, price_status: "current", availability: "supplier_verified", fulfillment_mode: "made_to_order",
      live_provider_verified: true, display_price_verified: true, checkout_ready: checkoutConfirmed,
      observed_at: "2026-09-08T11:59:00Z", expires_at: "2026-09-08T16:00:00Z",
      size_offers: [40, 41].map((size, index) => ({
        sku_id: `verified-${size}`, size_eu: String(size), price_cny: 500 + 100 * index,
        price_rub: 10_000 + 1_000 * index, price_status: "current", available: true,
        checkout_confirmed: checkoutConfirmed, live_provider_verified: true,
        source_updated_at: "2026-09-07T12:00:00Z",
        source_expires_at: index === 0 ? new Date(firstExpiry).toISOString() : "2026-09-08T14:00:00Z",
      })),
    }],
  })!
  const item = snapshot.items[product.slug]
  const addProductToCart = vi.fn()
  const state = (currentItem: PublishedCatalogItem = item): StorefrontState => ({
    products: [product], selectedProduct: product, botUrl: null, addProductToCart,
    selectedSizeOffers: buildProductSizeOffers([], product.brand, null, currentItem),
    catalogPriceState: {
      ...snapshot, status: "ready", error: null,
      items: { [product.slug]: currentItem },
      lookup: currentItem.priceStatus === "current" ? { [product.slug]: currentItem.priceRub } : {},
    },
  } satisfies Pick<StorefrontState, "products" | "selectedProduct" | "botUrl" | "addProductToCart" | "selectedSizeOffers" | "catalogPriceState">) as unknown as StorefrontState
  return { item, state, addProductToCart }
}

describe("product page selected-size expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })
  afterEach(() => vi.useRealTimers())

  it("clears an expired selected size while preserving the surviving size's current 11,000-ruble floor", () => {
    const { item, state, addProductToCart } = fixture()
    const { rerender, container } = render(<ProductDetailPage product={product} storefront={state()} />)
    fireEvent.click(screen.getByRole("button", { name: /^40,/u }))
    expect(screen.getByRole("button", { name: /^40,/u })).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector("#pdp-price")).toHaveTextContent("10 000 ₽")

    vi.setSystemTime(firstExpiry)
    rerender(<ProductDetailPage product={product} storefront={state(expireCatalogItem(item)!)} />)
    expect(screen.getByRole("button", { name: /^40,/u })).toBeDisabled()
    expect(screen.getByRole("button", { name: /^40,/u })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: /^41,/u })).toBeEnabled()
    expect(container.querySelector("#pdp-selection-status")).toHaveTextContent("Размер не выбран")
    expect(container.querySelector("#pdp-selection-status")).not.toHaveTextContent("Выбран размер 40")
    expect(container.querySelector("#pdp-price")).toHaveTextContent("от 11 000 ₽")
    expect(container.querySelector("#pdp-price")).not.toHaveTextContent("10 000")
    expect(container.querySelector(".pdp-buybox__cta")).toBeDisabled()
    expect(addProductToCart).not.toHaveBeenCalled()
  })

  it("keeps an available current size selected for price browsing without granting checkout", () => {
    const { state, addProductToCart } = fixture(false)
    const { rerender, container } = render(<ProductDetailPage product={product} storefront={state()} />)
    fireEvent.click(screen.getByRole("button", { name: /^40,/u }))
    rerender(<ProductDetailPage product={product} storefront={state()} />)
    expect(screen.getByRole("button", { name: /^40,/u })).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector("#pdp-price")).toHaveTextContent("Цена размера10 000 ₽")
    expect(container.querySelector(".pdp-buybox__cta")).toBeDisabled()
    expect(addProductToCart).not.toHaveBeenCalled()
  })

  it("keeps hook order safe when the route product disappears and becomes available again", () => {
    const { state } = fixture()
    const { rerender, container } = render(<ProductDetailPage product={null} storefront={{ ...state(), selectedProduct: null }} />)
    rerender(<ProductDetailPage product={product} storefront={state()} />)
    fireEvent.click(screen.getByRole("button", { name: /^40,/u }))
    rerender(<ProductDetailPage product={null} storefront={{ ...state(), selectedProduct: null }} />)
    expect(screen.getByText("Товар не найден")).toBeInTheDocument()
    rerender(<ProductDetailPage product={product} storefront={state()} />)
    expect(screen.getByRole("button", { name: /^40,/u })).toHaveAttribute("aria-pressed", "false")
    expect(container.querySelector("#pdp-selection-status")).toHaveTextContent("Размер не выбран")
  })
})
