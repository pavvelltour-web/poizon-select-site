import { describe, expect, it } from "vitest"

import { publicCatalogProducts } from "../catalog/catalog"
import { parseCheckoutCatalog } from "./cart"
import { getDisplayPrice } from "./landing-data"

const observedAt = new Date(Date.now() - 60_000).toISOString()
const expiresAt = new Date(Date.now() + 11 * 60 * 60_000).toISOString()
const sourceExpiresAt = new Date(Date.now() + 10 * 60 * 60_000).toISOString()

function currentItem(index: number) {
  const size = String(36 + (index % 20) * 0.5)
  const priceRub = 15_000 + index * 100
  return {
    slug: `catalog-200-${index}`,
    name: `Poizon basketball ${index}`,
    brand: "Nike",
    product_kind: "footwear",
    sizes: [size],
    price_rub: priceRub,
    price_status: "current",
    image_url: `https://cdn.poizon.com/catalog-200-${index}.webp`,
    fulfillment_mode: "made_to_order",
    availability: "supplier_verified",
    eta_min_days: 10,
    eta_max_days: 18,
    live_provider_verified: true,
    display_price_verified: true,
    checkout_ready: true,
    observed_at: observedAt,
    expires_at: expiresAt,
    size_offers: [{
      sku_id: `sku-${index}-${size}`,
      size_eu: size,
      size_ru: String(Number(size) - 1),
      price_rub: priceRub,
      price_cny: 600 + index,
      price_status: "current",
      source_updated_at: observedAt,
      source_expires_at: sourceExpiresAt,
      available: true,
      checkout_confirmed: true,
      live_provider_verified: true,
    }],
  }
}

describe("200-card PoisonBank price presentation", () => {
  it("keeps all 200 fresh card minima and exact size prices orderable", () => {
    const items = Array.from({ length: 200 }, (_, index) => currentItem(index))
    const parsed = parseCheckoutCatalog({
      version: "2026-08-02-v3",
      catalog_mode: "curated_live_poizon",
      snapshot_hours: 12,
      order_creation_enabled: true,
      online_payment_enabled: false,
      items,
    })!

    expect(Object.keys(parsed.items)).toHaveLength(200)
    expect(Object.keys(parsed.lookup)).toHaveLength(200)
    expect(parsed.items["catalog-200-199"].sizeOffers[0]).toMatchObject({
      skuId: "sku-199-45.5",
      sizeEu: "45.5",
      priceRub: 34_900,
      checkoutConfirmed: true,
    })
  })

  it("renders current, historical and unavailable prices as three distinct states", () => {
    const current = currentItem(1)
    const historical = { ...currentItem(2), price_status: "historical" }
    const unavailable = {
      ...currentItem(3),
      price_rub: null,
      display_price_verified: false,
      checkout_ready: false,
      size_offers: [],
    }
    const parsed = parseCheckoutCatalog({
      version: "2026-08-02-v3",
      catalog_mode: "curated_live_poizon",
      snapshot_hours: 12,
      order_creation_enabled: true,
      online_payment_enabled: false,
      items: [current, historical, unavailable],
    })!
    const base = publicCatalogProducts[0]

    expect(getDisplayPrice({ ...base, slug: current.slug }, parsed.lookup, parsed.items[current.slug]))
      .toMatchObject({ label: "Цена от", value: "от 15 100 ₽" })
    expect(getDisplayPrice({ ...base, slug: historical.slug }, parsed.lookup, parsed.items[historical.slug]))
      .toMatchObject({ label: "Последняя известная цена", value: "Последняя цена: от 15 200 ₽" })
    expect(getDisplayPrice({ ...base, slug: unavailable.slug }, parsed.lookup, parsed.items[unavailable.slug]))
      .toMatchObject({ label: "Цена", value: "По запросу" })
    expect(parsed.items[historical.slug].checkoutReady).toBe(false)
    expect(parsed.items[unavailable.slug]).toBeUndefined()
    expect(parsed.lookup[unavailable.slug]).toBeUndefined()
  })
})
