import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useLandingStorefront } from "./use-landing-storefront"

const now = Date.parse("2026-09-08T12:00:00Z")
const slug = "nike-kd-18"
const iso = (offset: number) => new Date(now + offset).toISOString()

function payload() {
  return {
    version: "test-independent-size-expiry", catalog_mode: "curated_live_poizon", snapshot_hours: 12,
    catalog_count: 1, order_creation_enabled: false, online_payment_enabled: false,
    catalog_statuses: { [slug]: { source: "poizon", status: "in_stock", checked_at: iso(-60_000), expires_at: iso(3_600_000) } },
    items: [{
      slug, name: "KD 18", brand: "Nike", product_kind: "footwear", sizes: ["40", "41"],
      price_rub: 10_000, price_status: "current", fulfillment_mode: "made_to_order",
      availability: "supplier_verified", live_provider_verified: true, display_price_verified: true,
      checkout_ready: true, observed_at: iso(-60_000), expires_at: iso(3_600_000),
      size_offers: [2_000, 5_000].map((expiry, index) => ({
        sku_id: `test-kd18-${40 + index}`, size_eu: String(40 + index), price_cny: 500 + index * 50,
        price_rub: 10_000 + index * 1_000, price_status: "current", available: true,
        checkout_confirmed: true, live_provider_verified: true,
        source_updated_at: iso(-3_600_000), source_expires_at: iso(expiry),
      })),
    }],
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("per-size expiry in an open storefront", () => {
  it("keeps surviving prices and removes an expired selection while the refresh hangs", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => payload() })
      .mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal("fetch", fetch)
    window.history.replaceState(null, "", `/product/${slug}`)
    const { result } = renderHook(() => useLandingStorefront(null))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.catalogPriceState.lookup?.[slug]).toBe(10_000)
    expect(result.current.selectedSizeOffers.filter((offer) => offer.available)).toHaveLength(2)
    act(() => result.current.setSelectedSize("40"))
    expect(result.current.selectedProductPrice?.value).toBe("10 000 ₽")
    await act(async () => { await vi.advanceTimersByTimeAsync(1_999) })
    expect(result.current.catalogPriceState.lookup?.[slug]).toBe(10_000)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.current.catalogPriceState.lookup?.[slug]).toBe(11_000)
    expect(result.current.catalogPriceState.items[slug].expiresAt).toBe(iso(3_600_000))
    expect(result.current.selectedSize).toBeNull()
    expect(result.current.selectedSizeOffers.find((offer) => offer.sizeEu === "40")?.available).toBe(false)
    expect(result.current.selectedSizeOffers.find((offer) => offer.sizeEu === "41")?.available).toBe(true)
    act(() => result.current.setSelectedSize("41"))
    expect(result.current.selectedProductPrice?.value).toBe("11 000 ₽")
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(result.current.catalogPriceState.lookup?.[slug]).toBeUndefined()
    expect(result.current.selectedSize).toBeNull()
    expect(result.current.selectedSizeOffers.some((offer) => offer.available)).toBe(false)
    expect(result.current.selectedProductPrice?.value).toBe("Цена уточняется")
    expect(result.current.catalogPriceState.catalogStatuses[slug].status).toBe("stale")
    expect(result.current.catalogPriceState.orderCreationEnabled).toBe(false)
    expect(fetch.mock.calls.every(([url]) => String(url).includes("mode=catalog"))).toBe(true)
  })
})
