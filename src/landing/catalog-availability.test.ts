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
      .toBe("Проверенных размеров нет в наличии")
  })

  it.each(["source_unavailable", "not_found", "not_matched", "stock_unknown", "unverified"])(
    "does not label %s as no stock", (status) => {
      const states = parseCatalogAvailability({ product: { ...observation, status } })
      expect(catalogAvailabilityLabel(null, states.product, "ready")).not.toContain("нет в наличии")
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

  it("identifies an unavailable CBR rate without fabricating a price or blaming Poizon stock", () => {
    const snapshot = parseCheckoutCatalog({
      version: "poizon-live-v1", catalog_mode: "curated_live_poizon", snapshot_hours: 12,
      items: [], catalog_statuses: { product: {
        ...observation, status: "source_unavailable", reason_code: "cny_rub_rate_unavailable",
      } },
    })!
    expect(catalogAvailabilityLabel(null, snapshot.catalogStatuses.product, "ready"))
      .toBe("Цена уточняется")
    expect(snapshot.lookup).toEqual({})
    expect(snapshot.orderCreationEnabled).toBe(false)
  })

  it("does not expose an unrecognized provider reason as customer copy", () => {
    const states = parseCatalogAvailability({ product: {
      ...observation, status: "source_unavailable", reason_code: "private provider details",
    } })
    expect(states.product).not.toHaveProperty("reasonCode")
    expect(catalogAvailabilityLabel(null, states.product, "ready")).toBe("Не удалось проверить наличие")
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
