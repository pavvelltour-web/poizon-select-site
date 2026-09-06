import { describe, expect, it } from "vitest"

import { parseCatalogSearch, parseCheckoutCatalog } from "./cart"
import { buildLiveOrderRequest } from "./order-request"

const observedAt = new Date(Date.now() - 60_000).toISOString()
const expiresAt = new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString()

function liveResult(
  productRef: string,
  name: string,
  offerCount: number,
  available: boolean | null,
) {
  return {
    product_ref: productRef,
    brand: "Nike",
    name,
    model: name,
    article: productRef.toUpperCase(),
    color: "White",
    in_stock: available,
    kind: "footwear",
    images: [`https://cdn.poizon.com/${productRef}.webp`],
    observed_at: observedAt,
    expires_at: expiresAt,
    offers: Array.from({ length: offerCount }, (_, index) => ({
      offer_ref: `${productRef}-${index + 1}`,
      size: String(35 + index * 0.5),
      eu: String(35 + index * 0.5),
      available,
      price_cny: 600 + index * 10,
      total_rub: 15_000 + index * 200,
    })),
  }
}

describe("observed production catalogue payloads", () => {
  it("keeps all 17 confirmed offers from the exact CW2288-111 scenario orderable", () => {
    const parsed = parseCatalogSearch({
      status: "ready",
      normalized_query: "CW2288-111",
      results: [liveResult("cw2288-111", "Air Force 1 Low", 17, true)],
    })

    expect(parsed?.results).toHaveLength(1)
    expect(parsed?.results[0]?.offers).toHaveLength(17)
    expect(parsed?.results[0]?.offers.every((offer) => offer.available === true)).toBe(true)
    expect(
      buildLiveOrderRequest(parsed!.results[0]!, parsed!.results[0]!.offers[0]!),
    ).toContain("Размер:")
  })

  it("keeps all 46 broad Nike Air Force 1 prices informational and non-orderable", () => {
    const counts = [12, 12, 11, 11]
    const parsed = parseCatalogSearch({
      status: "ready",
      normalized_query: "Nike Air Force 1",
      results: counts.map((count, index) =>
        liveResult(`nike-air-force-1-${index + 1}`, `Air Force 1 ${index + 1}`, count, null),
      ),
    })
    const offers = parsed?.results.flatMap((result) => result.offers) ?? []

    expect(parsed?.results).toHaveLength(4)
    expect(offers).toHaveLength(46)
    expect(offers.every((offer) => offer.available === null)).toBe(true)
    expect(() => buildLiveOrderRequest(parsed!.results[0]!, offers[0]!)).toThrow(
      /без подтверждённого наличия/,
    )
  })

  it("retains legacy endpoint prices as historical references when source freshness is missing", () => {
    const parsed = parseCheckoutCatalog({
      version: "poizon-live-v1",
      catalog_mode: "curated_live_poizon",
      snapshot_hours: 12,
      order_creation_enabled: false,
      online_payment_enabled: false,
      items: [{
        slug: "nike-air-force-1-07-white",
        name: "Nike Air Force 1 '07 White",
        brand: "Nike",
        product_kind: "footwear",
        sizes: ["42"],
        price_rub: 16_700,
        image_url: null,
        fulfillment_mode: "made_to_order",
        availability: "supplier_stock_unknown",
        checkout_ready: false,
        display_price_verified: true,
        live_provider_verified: true,
        observed_at: observedAt,
        expires_at: expiresAt,
        size_offers: [{
          sku_id: "af1-42",
          size_eu: "42",
          price_cny: 699,
          price_rub: 16_700,
          available: null,
          checkout_confirmed: false,
          live_provider_verified: true,
        }],
      }],
    })

    const item = parsed?.items["nike-air-force-1-07-white"]
    expect(parsed?.lookup["nike-air-force-1-07-white"]).toBeUndefined()
    expect(item?.priceRub).toBe(16_700)
    expect(item?.priceStatus).toBe("historical")
    expect(item?.sizeOffers[0]).toMatchObject({
      skuId: "af1-42",
      available: null,
      checkoutConfirmed: false,
    })
    expect(item?.checkoutReady).toBe(false)
    expect(item?.imageUrl).toBeNull()
  })

  it("rejects a wrong endpoint mode or snapshot duration before publishing any price", () => {
    expect(parseCheckoutCatalog({
      version: "poizon-live-v1",
      catalog_mode: "legacy_prices",
      snapshot_hours: 12,
      items: [],
    })).toBeNull()
    expect(parseCheckoutCatalog({
      version: "poizon-live-v1",
      catalog_mode: "curated_live_poizon",
      snapshot_hours: 24,
      items: [],
    })).toBeNull()
  })
})
