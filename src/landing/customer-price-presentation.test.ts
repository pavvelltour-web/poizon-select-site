import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { publicCatalogProducts } from "../catalog/catalog"
import { catalogAvailabilityLabel, parseCatalogAvailability } from "./catalog-availability"
import { getPublishedSizeOffer, parseCheckoutCatalog } from "./cart"
import { getDisplayPrice } from "./landing-data"

const product = publicCatalogProducts.find((item) => item.slug === "nike-gt-cut-academy")!

function catalogPayload(priceStatus: "current" | "historical" = "current") {
  const observedAt = new Date(Date.now() - 60_000).toISOString()
  const expiresAt = new Date(Date.now() + 60_000).toISOString()
  return {
    version: "customer-price-presentation-v1",
    catalog_mode: "curated_live_poizon",
    snapshot_hours: 12,
    order_creation_enabled: true,
    online_payment_enabled: true,
    items: [{
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      product_kind: "footwear",
      sizes: ["42", "43"],
      price_rub: 24_500,
      price_status: priceStatus,
      fulfillment_mode: "made_to_order",
      availability: "supplier_verified",
      live_provider_verified: true,
      display_price_verified: true,
      checkout_ready: true,
      observed_at: observedAt,
      expires_at: expiresAt,
      size_offers: [24_500, 26_700].map((price, index) => ({
        sku_id: `verified-size-${42 + index}`,
        size_eu: String(42 + index),
        price_rub: price,
        price_cny: 1_000 + index * 100,
        price_status: priceStatus,
        source_updated_at: observedAt,
        source_expires_at: expiresAt,
        available: true,
        checkout_confirmed: true,
        live_provider_verified: true,
      })),
    }],
  }
}

describe("customer price and availability presentation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-08T09:00:00Z"))
  })

  afterEach(() => vi.useRealTimers())

  it("shows the server's current minimum without source timestamps or snapshot details", () => {
    const snapshot = parseCheckoutCatalog(catalogPayload())!
    const item = snapshot.items[product.slug]
    expect(getDisplayPrice(product, snapshot.lookup, item)).toEqual({
      label: "Цена от",
      value: "от 24 500 ₽",
      detail: "Минимум по размерам. СДЭК рассчитывается отдельно",
    })
    expect(item.sizeOffers.map((offer) => offer.priceRub)).toEqual([24_500, 26_700])
    expect(getPublishedSizeOffer(item, "43")?.priceRub).toBe(26_700)
    expect(item.checkoutReady).toBe(true)
  })

  it("hides historical amounts while keeping historical offers unable to authorize checkout", () => {
    const snapshot = parseCheckoutCatalog(catalogPayload("historical"))!
    const item = snapshot.items[product.slug]
    const display = getDisplayPrice(product, snapshot.lookup, item)
    expect(display.value).toBe("Цена уточняется")
    expect(JSON.stringify(display)).not.toMatch(/24.?500|26.?700|Последн|историч|2026|час|сним/iu)
    expect(item.priceStatus).toBe("historical")
    expect(snapshot.lookup).toEqual({})
    expect(snapshot.orderCreationEnabled).toBe(false)
    expect(item.checkoutReady).toBe(false)
    expect(item.sizeOffers.every((offer) => !offer.checkoutConfirmed && offer.available === null)).toBe(true)
    expect(getPublishedSizeOffer(item, "42")).toBeNull()
    expect(catalogAvailabilityLabel(item, undefined, "ready")).toBe("Наличие уточняется")
  })

  it("does not display an old numeric lookup over an explicitly historical item", () => {
    const snapshot = parseCheckoutCatalog(catalogPayload("historical"))!
    expect(getDisplayPrice(product, { [product.slug]: 24_500 }, snapshot.items[product.slug]).value)
      .toBe("Цена уточняется")
  })

  it("hides expired item prices even before a retained numeric lookup is cleared", () => {
    const snapshot = parseCheckoutCatalog(catalogPayload())!
    const item = snapshot.items[product.slug]
    vi.advanceTimersByTime(60_001)
    expect(getDisplayPrice(product, snapshot.lookup, item).value).toBe("Цена уточняется")
    expect(getPublishedSizeOffer(item, "42")).toBeNull()
    expect(catalogAvailabilityLabel(item, undefined, "ready")).toBe("Наличие уточняется")
  })

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not invent a customer amount from an invalid lookup: %s", (price) => {
      expect(getDisplayPrice(product, price === undefined ? null : { [product.slug]: price }).value)
        .toBe("Цена уточняется")
    },
  )

  it.each(["stock_unknown", "not_matched", "not_found", "stale", "unverified"])(
    "does not claim in-stock or no-stock from %s evidence", (status) => {
      const states = parseCatalogAvailability({ [product.slug]: {
        status,
        checked_at: new Date(Date.now() - 60_000).toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        source: "poizon",
      } })
      expect(catalogAvailabilityLabel(null, states[product.slug], "ready")).toBe("Наличие уточняется")
    },
  )

  it("keeps explicit no-stock scope and withdraws that message at expiry", () => {
    const states = parseCatalogAvailability({ [product.slug]: {
      status: "out_of_stock",
      checked_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      source: "poizon",
    } })
    expect(catalogAvailabilityLabel(null, states[product.slug], "ready"))
      .toBe("Проверенных размеров нет в наличии")
    vi.advanceTimersByTime(60_001)
    expect(catalogAvailabilityLabel(null, states[product.slug], "ready")).toBe("Наличие уточняется")
  })

  it("shows request state without exposing refresh ages or inventing successful freshness", () => {
    expect(catalogAvailabilityLabel(null, null, "loading")).toBe("Проверяем наличие")
    expect(catalogAvailabilityLabel(null, null, "failed")).toBe("Не удалось проверить наличие")
  })
})
