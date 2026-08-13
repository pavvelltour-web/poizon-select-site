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
        totalRub: 12_500,
        observedAt: "2026-08-14T08:00:00.000Z",
        expiresAt: "2026-08-14T20:00:00.000Z",
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
        verifiedItem({ slug: "ambiguous-product", price_rub: 13_000 }),
      ]),
      now,
    )

    expect(prices).toEqual({})
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
