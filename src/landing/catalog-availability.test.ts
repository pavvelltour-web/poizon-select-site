import { describe, expect, it } from "vitest"
import { catalogAvailabilityLabel, parseCatalogAvailability } from "./catalog-availability"
import { parseCheckoutCatalog } from "./cart"

const observation = {
  checked_at: new Date(Date.now() - 60_000).toISOString(),
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  source: "poizon",
}

describe("Poizon catalogue availability evidence", () => {
  it("retains a confirmed no-stock product even when there is no price or SKU quote", () => {
    const snapshot = parseCheckoutCatalog({
      version: "poizon-live-v1", catalog_mode: "curated_live_poizon", snapshot_hours: 12,
      items: [], catalog_statuses: { "nike-kd-18": { ...observation, status: "out_of_stock" } },
    })!
    expect(snapshot.items).toEqual({})
    expect(snapshot.lookup).toEqual({})
    expect(snapshot.orderCreationEnabled).toBe(false)
    expect(catalogAvailabilityLabel(null, snapshot.catalogStatuses["nike-kd-18"], "ready"))
      .toBe("Проверенные размеры отсутствуют на Poizon")
  })

  it.each(["source_unavailable", "not_found", "not_matched", "stock_unknown", "unverified"])(
    "does not label %s as no stock", (status) => {
      const states = parseCatalogAvailability({ product: { ...observation, status } })
      expect(catalogAvailabilityLabel(null, states.product, "ready")).not.toContain("отсутствуют на Poizon")
    },
  )

  it("does not turn status-only in-stock metadata into a price or checkout permission", () => {
    const snapshot = parseCheckoutCatalog({
      version: "poizon-live-v1", catalog_mode: "curated_live_poizon", snapshot_hours: 12,
      items: [], catalog_statuses: { product: { ...observation, status: "in_stock" } },
    })!
    expect(snapshot.lookup).toEqual({})
    expect(snapshot.orderCreationEnabled).toBe(false)
  })

  it.each([null, "invalid", new Date(Date.now() - 1).toISOString()])(
    "downgrades out-of-stock metadata without a valid current expiry: %s", (expires_at) => {
      const states = parseCatalogAvailability({ product: { ...observation, expires_at, status: "out_of_stock" } })
      expect(states.product.status).toBe("stale")
    },
  )

  it("rejects unknown sources and does not copy private provider fields", () => {
    const states = parseCatalogAvailability({
      invalid: { ...observation, source: "mock", status: "out_of_stock" },
      product: { ...observation, status: "out_of_stock", provider_key: "not-for-the-browser" },
    })
    expect(states.invalid).toBeUndefined()
    expect(states.product).not.toHaveProperty("provider_key")
  })
})
