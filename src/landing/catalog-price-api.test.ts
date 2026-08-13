import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchVerifiedCatalogPrices,
  parseVerifiedCatalogPrices,
  storefrontPricesEndpoint,
} from "./catalog-price-api"

const now = Date.parse("2026-08-14T09:00:00.000Z")

function verifiedItem(overrides: Record<string, unknown> = {}) {
  return {
    slug: "nike-air-force-1-07",
    price_rub: 12_500.4,
    live_provider_verified: true,
    observed_at: "2026-08-14T08:00:00.000Z",
    expires_at: "2026-08-14T20:00:00.000Z",
    size_offers: [verifiedSizeOffer()],
    ...overrides,
  }
}

function verifiedSizeOffer(overrides: Record<string, unknown> = {}) {
  return {
    sku_id: "af1-42",
    size_eu: "42",
    price_rub: 12_500.4,
    available: true,
    checkout_confirmed: true,
    live_provider_verified: true,
    ...overrides,
  }
}

function verifiedPayload(items: unknown[]) {
  return {
    catalog_mode: "curated_live_poizon",
    snapshot_hours: 12,
    items,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("verified catalogue price reader", () => {
  it("accepts only a current, exact provider-verified 12-hour row", () => {
    expect(parseVerifiedCatalogPrices(verifiedPayload([verifiedItem()]), now)).toEqual({
      "nike-air-force-1-07": {
        slug: "nike-air-force-1-07",
        totalRub: 12_500.4,
        observedAt: "2026-08-14T08:00:00.000Z",
        expiresAt: "2026-08-14T20:00:00.000Z",
        sizeOffers: {
          "42": {
            skuId: "af1-42",
            size: "42",
            totalRub: 12_500.4,
            observedAt: "2026-08-14T08:00:00.000Z",
            expiresAt: "2026-08-14T20:00:00.000Z",
          },
        },
      },
    })
  })

  it("fails closed for a wrong catalogue mode or snapshot duration", () => {
    expect(
      parseVerifiedCatalogPrices(
        { ...verifiedPayload([verifiedItem()]), catalog_mode: "approved_catalog_snapshot" },
        now,
      ),
    ).toEqual({})
    expect(
      parseVerifiedCatalogPrices(
        { ...verifiedPayload([verifiedItem()]), snapshot_hours: 24 },
        now,
      ),
    ).toEqual({})
  })

  it("rejects unverified, expired, future, malformed, and ambiguous rows", () => {
    const prices = parseVerifiedCatalogPrices(
      verifiedPayload([
        verifiedItem({ slug: "not a slug" }),
        verifiedItem({ slug: "not-verified", live_provider_verified: false }),
        verifiedItem({ slug: "expired", expires_at: "2026-08-14T08:59:59.999Z" }),
        verifiedItem({
          slug: "future",
          observed_at: "2026-08-14T09:06:00.000Z",
          expires_at: "2026-08-14T21:06:00.000Z",
        }),
        verifiedItem({ slug: "ambiguous-product" }),
        verifiedItem({
          slug: "ambiguous-product",
          price_rub: 13_000,
          size_offers: [verifiedSizeOffer({ price_rub: 13_000 })],
        }),
      ]),
      now,
    )

    expect(prices).toEqual({})
  })

  it("uses only exact, available checkout-confirmed size offers and rejects bad card floors", () => {
    const prices = parseVerifiedCatalogPrices(
      verifiedPayload([
        verifiedItem({
          slug: "valid-size-offers",
          price_rub: 12_300,
          size_offers: [
            verifiedSizeOffer({ sku_id: "size-42", size_eu: " 42 ", price_rub: 12_500 }),
            verifiedSizeOffer({ sku_id: "size-42-5", size_eu: "42.5", price_rub: 12_300 }),
            verifiedSizeOffer({
              sku_id: "size-43-unavailable",
              size_eu: "43",
              price_rub: 11_000,
              available: false,
            }),
            verifiedSizeOffer({
              sku_id: "size-44-unconfirmed",
              size_eu: "44",
              checkout_confirmed: false,
            }),
            verifiedSizeOffer({
              sku_id: "not a valid sku",
              size_eu: "45",
              price_rub: 11_000,
            }),
            verifiedSizeOffer({
              sku_id: "size-46-not-verified",
              size_eu: "46",
              price_rub: 11_000,
              live_provider_verified: false,
            }),
          ],
        }),
        verifiedItem({
          slug: "duplicate-size",
          price_rub: 13_000,
          size_offers: [
            verifiedSizeOffer({ sku_id: "one", size_eu: "42", price_rub: 13_000 }),
            verifiedSizeOffer({ sku_id: "two", size_eu: "42", price_rub: 13_000 }),
            verifiedSizeOffer({ sku_id: "three", size_eu: "43", price_rub: 13_000 }),
          ],
        }),
        verifiedItem({
          slug: "mismatched-floor",
          price_rub: 10_000,
          size_offers: [verifiedSizeOffer({ price_rub: 12_500 })],
        }),
        verifiedItem({
          slug: "no-eligible-size",
          size_offers: [verifiedSizeOffer({ available: false })],
        }),
        verifiedItem({
          slug: "duplicate-sku",
          price_rub: 13_000,
          size_offers: [
            verifiedSizeOffer({ sku_id: "same-sku", size_eu: "42", price_rub: 13_000 }),
            verifiedSizeOffer({ sku_id: "same-sku", size_eu: "43", price_rub: 13_000 }),
            verifiedSizeOffer({ sku_id: "independent-sku", size_eu: "44", price_rub: 13_000 }),
          ],
        }),
      ]),
      now,
    )

    expect(prices["valid-size-offers"]?.sizeOffers).toMatchObject({
      "42": { skuId: "size-42", totalRub: 12_500 },
      "42.5": { skuId: "size-42-5", totalRub: 12_300 },
    })
    expect(prices["valid-size-offers"]?.sizeOffers["43"]).toBeUndefined()
    expect(prices["valid-size-offers"]?.sizeOffers["45"]).toBeUndefined()
    expect(prices["valid-size-offers"]?.sizeOffers["46"]).toBeUndefined()
    expect(prices["duplicate-size"]?.sizeOffers).toMatchObject({
      "43": { skuId: "three", totalRub: 13_000 },
    })
    expect(prices["duplicate-size"]?.sizeOffers["42"]).toBeUndefined()
    expect(prices["mismatched-floor"]).toBeUndefined()
    expect(prices["no-eligible-size"]).toBeUndefined()
    expect(prices["duplicate-sku"]?.sizeOffers).toMatchObject({
      "44": { skuId: "independent-sku", totalRub: 13_000 },
    })
    expect(prices["duplicate-sku"]?.sizeOffers["42"]).toBeUndefined()
    expect(prices["duplicate-sku"]?.sizeOffers["43"]).toBeUndefined()
  })

  it("uses the same-origin checkout catalogue and returns no price on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchVerifiedCatalogPrices()).resolves.toEqual({})
    expect(storefrontPricesEndpoint()).toBe("/api/checkout/orders?mode=catalog")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checkout/orders?mode=catalog",
      expect.objectContaining({ credentials: "omit" }),
    )
  })
})
