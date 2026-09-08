import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildProductSizeOffers, expireCatalogItem, getPublishedSizeOffer, parseCheckoutCatalog } from "./cart"

const start = Date.parse("2026-09-08T12:00:00Z")
const firstExpiry = Date.parse("2026-09-08T12:30:00Z")
const lastExpiry = Date.parse("2026-09-08T14:00:00Z")
const quoteExpiry = "2026-09-08T16:00:00Z"
const slug = "verified-mixed-size-model"

function fixture() {
  return {
    version: "per-sku-expiry-test", catalog_mode: "curated_live_poizon", snapshot_hours: 12,
    order_creation_enabled: true, online_payment_enabled: true,
    items: [{
      slug, name: "Verified Model", brand: "Nike", product_kind: "footwear", sizes: ["42", "43", "44"],
      price_rub: 18_000, price_status: "current", fulfillment_mode: "made_to_order", availability: "supplier_verified",
      live_provider_verified: true, display_price_verified: true, checkout_ready: true,
      observed_at: "2026-09-08T11:59:00Z", expires_at: quoteExpiry,
      size_offers: [
        { sku_id: "sku-42", size_eu: "42", price_rub: 18_000, price_cny: 500, price_status: "current",
          available: true as boolean | null, checkout_confirmed: true, live_provider_verified: true,
          source_updated_at: "2026-09-07T12:00:00Z", source_expires_at: new Date(firstExpiry).toISOString() },
        { sku_id: "sku-43", size_eu: "43", price_rub: 21_000, price_cny: 700, price_status: "current",
          available: true as boolean | null, checkout_confirmed: true, live_provider_verified: true,
          source_updated_at: "2026-09-07T12:00:00Z", source_expires_at: new Date(lastExpiry).toISOString() },
        { sku_id: "sku-44", size_eu: "44", price_rub: 9_000, price_cny: 200, price_status: "historical",
          available: null as boolean | null, checkout_confirmed: false, live_provider_verified: true,
          source_updated_at: "2026-08-30T12:00:00Z", source_expires_at: "2026-09-01T12:00:00Z" },
      ],
    }],
  }
}

describe("independent source expiry for exact catalogue sizes", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(start)
  })
  afterEach(() => vi.useRealTimers())

  it("preserves the server quote TTL and gives each current SKU its own earlier source deadline", () => {
    const payload = fixture()
    const item = parseCheckoutCatalog(payload)!.items[slug]
    expect(item.expiresAt).toBe(quoteExpiry)
    expect(item.sizeOffers.slice(0, 2).map((offer) => offer.expiresAt))
      .toEqual([new Date(firstExpiry).toISOString(), new Date(lastExpiry).toISOString()])
    item.sizeOffers.forEach((offer, index) => {
      expect(offer.sourceUpdatedAt).toBe(payload.items[0].size_offers[index].source_updated_at)
      expect(offer.sourceExpiresAt).toBe(payload.items[0].size_offers[index].source_expires_at)
    })
    expect(item.priceRub).toBe(18_000)
    expect(item.checkoutReady).toBe(true)
  })

  it("expires the cheaper size at its exact boundary while keeping the other current offer and its price", () => {
    const item = parseCheckoutCatalog(fixture())!.items[slug]
    const before = expireCatalogItem(item, firstExpiry - 1)!
    expect(before.priceRub).toBe(18_000)
    const after = expireCatalogItem(item, firstExpiry)!
    expect(after.priceStatus).toBe("current")
    expect(after.priceRub).toBe(21_000)
    expect(after.availability).toBe("supplier_verified")
    expect(after.checkoutReady).toBe(true)
    expect(after.expiresAt).toBe(quoteExpiry)
    expect(after.sizeOffers[0]).toMatchObject({ priceRub: 18_000, priceStatus: "historical", available: null, checkoutConfirmed: false })
    expect(after.sizeOffers[1]).toMatchObject({ priceRub: 21_000, priceStatus: "current", available: true, checkoutConfirmed: true })
    expect(item.sizeOffers[0].priceStatus).toBe("current")
  })

  it("accepts the original server floor after its cheapest size expires and publishes only the surviving current floor", () => {
    vi.setSystemTime(firstExpiry)
    const snapshot = parseCheckoutCatalog(fixture())!
    expect(snapshot.items[slug].priceStatus).toBe("current")
    expect(snapshot.items[slug].priceRub).toBe(21_000)
    expect(snapshot.lookup).toEqual({ [slug]: 21_000 })
    expect(snapshot.orderCreationEnabled).toBe(true)
  })

  it("withdraws the current amount and checkout only when the final current source expires", () => {
    const item = parseCheckoutCatalog(fixture())!.items[slug]
    const afterFirst = expireCatalogItem(item, firstExpiry)!
    expect(expireCatalogItem(afterFirst, lastExpiry - 1)!.priceRub).toBe(21_000)
    const afterLast = expireCatalogItem(afterFirst, lastExpiry)!
    expect(afterLast.priceStatus).toBe("historical")
    expect(afterLast.priceRub).toBe(21_000)
    expect(afterLast.checkoutReady).toBe(false)
    expect(afterLast.availability).toBe("supplier_stock_unknown")
    expect(afterLast.sizeOffers.every((offer) => offer.available === null && !offer.checkoutConfirmed)).toBe(true)
    vi.setSystemTime(lastExpiry)
    const snapshot = parseCheckoutCatalog(fixture())!
    expect(snapshot.lookup).toEqual({})
    expect(snapshot.orderCreationEnabled).toBe(false)
    expect(snapshot.onlinePaymentEnabled).toBe(false)
  })

  it("never extends quote validity even when a SKU source remains valid longer", () => {
    const payload = fixture()
    payload.items[0].expires_at = "2026-09-08T12:15:00Z"
    const item = parseCheckoutCatalog(payload)!.items[slug]
    expect(item.expiresAt).toBe(payload.items[0].expires_at)
    expect(item.sizeOffers.slice(0, 2).every((offer) => Date.parse(offer.expiresAt!) === Date.parse(item.expiresAt))).toBe(true)
    expect(expireCatalogItem(item, Date.parse(item.expiresAt))).toBeNull()
  })

  it("checks the exact selected SKU at action time even before the UI expiry timer runs", () => {
    const item = parseCheckoutCatalog(fixture())!.items[slug]
    vi.setSystemTime(firstExpiry - 1)
    expect(getPublishedSizeOffer(item, "42")?.priceRub).toBe(18_000)
    vi.setSystemTime(firstExpiry)
    expect(getPublishedSizeOffer(item, "42")).toBeNull()
    expect(getPublishedSizeOffer(item, "43")?.priceRub).toBe(21_000)
    const displayed = buildProductSizeOffers([], "Nike", null, item)
    expect(displayed.find((offer) => offer.sizeEu === "42"))
      .toMatchObject({ priceStatus: "historical", stockStatus: null, available: false, checkoutConfirmed: false })
    vi.setSystemTime(lastExpiry)
    expect(getPublishedSizeOffer(item, "43")).toBeNull()
  })

  it("keeps source expiry separate from the local quote and explicit offer deadline", () => {
    const item = parseCheckoutCatalog(fixture())!.items[slug]
    item.sizeOffers[1].expiresAt = new Date(firstExpiry).toISOString()
    expect(expireCatalogItem(item, firstExpiry)!.priceStatus).toBe("historical")
  })

  it("keeps an unknown-stock current price separate from confirmed availability or checkout", () => {
    const payload = fixture()
    payload.items[0].size_offers[1].available = null
    payload.items[0].size_offers[1].checkout_confirmed = false
    const item = parseCheckoutCatalog(payload)!.items[slug]
    const after = expireCatalogItem(item, firstExpiry)!
    expect(after).toMatchObject({ priceRub: 21_000, priceStatus: "current", availability: "supplier_stock_unknown", checkoutReady: false })
    vi.setSystemTime(firstExpiry)
    expect(getPublishedSizeOffer(item, "43")).toBeNull()
  })

  it("does not let an unavailable cheap size undercut the remaining available size", () => {
    const payload = fixture()
    payload.items[0].size_offers[2] = {
      ...payload.items[0].size_offers[1], sku_id: "sku-44", size_eu: "44", price_rub: 9_000,
      available: false, checkout_confirmed: false,
    }
    const item = parseCheckoutCatalog(payload)!.items[slug]
    expect(expireCatalogItem(item, firstExpiry)!.priceRub).toBe(21_000)
  })

  it("continues rejecting a forged original SPU floor rather than accepting a plausible remaining amount", () => {
    const payload = fixture()
    payload.items[0].price_rub = 21_000
    vi.setSystemTime(firstExpiry)
    expect(parseCheckoutCatalog(payload)!.items).toEqual({})
  })

  it.each([
    { price_rub: 0 }, { price_rub: Number.NaN }, { price_cny: 0 }, { live_provider_verified: false },
    { sku_id: "bad id" }, { size_eu: "unknown" },
  ])("never turns malformed SKU input into the surviving current offer: %j", (change) => {
    const payload = fixture()
    Object.assign(payload.items[0].size_offers[1], change)
    vi.setSystemTime(firstExpiry)
    const snapshot = parseCheckoutCatalog(payload)!
    expect(snapshot.lookup).toEqual({})
    expect(snapshot.orderCreationEnabled).toBe(false)
    expect(snapshot.items[slug]?.sizeOffers.some((offer) => offer.priceStatus === "current")).not.toBe(true)
  })

  it.each([
    { source_updated_at: null }, { source_expires_at: "invalid" },
    { source_updated_at: "2026-09-08T15:00:00Z" },
    { source_updated_at: "2026-09-01T12:00:00Z" },
  ])("preserves source clock policy when the remaining SKU has invalid freshness: %j", (change) => {
    const payload = fixture()
    Object.assign(payload.items[0].size_offers[1], change)
    vi.setSystemTime(firstExpiry)
    expect(parseCheckoutCatalog(payload)!.lookup).toEqual({})
  })
})
