import { describe, expect, it } from "vitest"
import type { CatalogProduct } from "../catalog/catalog"
import type { CatalogAvailabilityStatus } from "./catalog-availability"
import { parseCheckoutCatalog } from "./cart"
import { getAvailableColorways, parseCatalogColorways } from "./catalog-colorways"

function fixture() {
  const now = Date.now()
  const observed = new Date(now - 60_000).toISOString()
  const expires = new Date(now + 60 * 60_000).toISOString()
  const variants = ["white", "black", "red"].map((color, index) => ({
    slug: `exact-model-${color}`,
    product_ref: String(index + 1).repeat(64),
    color_label: color,
    image_url: "javascript:untrusted-media",
  }))
  const products: CatalogProduct[] = variants.map((variant, index) => ({
    slug: variant.slug, brand: "Nike", name: "Exact Model", kind: "footwear", category: "basketball",
    categoryLabel: "Баскетбол", sportPriority: true, query: "Nike Exact Model", note: "",
    image: `/catalog/${variant.slug}/1.webp`, fallbackImage: `/catalog/${variant.slug}/1.webp`, gallery: [],
    // The original reviewed product predates additive supplier metadata.
    ...(index > 0 ? { supplierProductRef: variant.product_ref } : {}),
  }))
  const rawGroups = Object.fromEntries(variants.map((variant) => [variant.slug, {
    family_id: "reviewed-exact-model-v1", model_name: "Exact Model", color_label: variant.color_label,
    product_ref: variant.product_ref, variants: structuredClone(variants),
  }]))
  const snapshot = parseCheckoutCatalog({
    version: "test-colorways-v1", catalog_mode: "curated_live_poizon", snapshot_hours: 12,
    order_creation_enabled: false,
    catalog_statuses: Object.fromEntries(variants.map((variant) => [variant.slug, {
      source: "poizon", status: "in_stock", checked_at: observed, expires_at: expires,
    }])),
    items: variants.map((variant) => ({
      slug: variant.slug, name: "Nike Exact Model", brand: "Nike", product_kind: "footwear",
      sizes: ["43"], price_rub: 20_000, price_status: "current", fulfillment_mode: "made_to_order",
      availability: "supplier_verified", live_provider_verified: true, display_price_verified: true,
      checkout_ready: false, observed_at: observed, expires_at: expires,
      size_offers: [{
        sku_id: `${variant.slug}-sku-43`, size_eu: "43", price_cny: 500, price_rub: 20_000,
        price_status: "current", available: true, checkout_confirmed: false, live_provider_verified: true,
        source_updated_at: observed, source_expires_at: expires,
      }],
    })),
  })!
  const groups = parseCatalogColorways(rawGroups)
  const resolve = (at = now) => getAvailableColorways(products[0], groups, products, snapshot.items, snapshot.catalogStatuses, at)
  return { now, products, variants, rawGroups, groups, snapshot, resolve }
}

describe("explicit catalogue colourway contract", () => {
  it.each([null, undefined, [], "family", 42])("treats missing or invalid optional metadata as no colourways: %s", (input) => {
    expect(parseCatalogColorways(input)).toEqual({})
  })

  it("navigates exact canonical products while global order creation and per-SKU checkout are disabled", () => {
    const { products, snapshot, resolve } = fixture()
    expect(snapshot.orderCreationEnabled).toBe(false)
    expect(Object.values(snapshot.items).every((item) => !item.checkoutReady)).toBe(true)
    const options = resolve()
    expect(options.map((option) => option.colorLabel)).toEqual(["white", "black", "red"])
    options.forEach((option, index) => {
      expect(option.product).toBe(products[index])
      expect(option.product.image).toBe(`/catalog/${products[index].slug}/1.webp`)
    })
  })

  it("discards untrusted image URLs and fields outside the public colour contract", () => {
    const { rawGroups, products } = fixture()
    Object.assign(rawGroups[products[0].slug], { provider_secret: "discard-me" })
    const groups = parseCatalogColorways(rawGroups)
    expect(groups[products[0].slug]).not.toHaveProperty("provider_secret")
    expect(groups[products[0].slug].variants[0]).toEqual({
      slug: products[0].slug, productRef: "1".repeat(64), colorLabel: "white",
    })
  })

  it.each(["slug", "product_ref"] as const)("rejects ambiguous repeated variant %s", (key) => {
    const { rawGroups, products } = fixture()
    const row = rawGroups[products[0].slug]
    row.variants[1][key] = row.variants[0][key]
    expect(parseCatalogColorways(rawGroups)).not.toHaveProperty(products[0].slug)
  })

  it.each([
    { product_ref: "raw-supplier-spu-id" }, { color_label: "<script>" },
    { family_id: "" }, { model_name: "\nprivate" },
  ])("rejects malformed group metadata: %j", (change) => {
    const { rawGroups, products } = fixture()
    Object.assign(rawGroups[products[0].slug], change)
    expect(parseCatalogColorways(rawGroups)).not.toHaveProperty(products[0].slug)
  })

  it("requires the current product's exact identity in its own family", () => {
    const { rawGroups, products } = fixture()
    rawGroups[products[0].slug].variants[0].product_ref = "a".repeat(64)
    expect(parseCatalogColorways(rawGroups)).not.toHaveProperty(products[0].slug)
  })

  it("never infers relationships from an identical title", () => {
    const { products, snapshot } = fixture()
    expect(getAvailableColorways(products[0], {}, products, snapshot.items, snapshot.catalogStatuses)).toEqual([])
  })

  it("intersects the reviewed family with canonical products instead of making new products from colour metadata", () => {
    const { products, resolve } = fixture()
    products.pop()
    expect(resolve().map((option) => option.product.slug)).toEqual(products.map((product) => product.slug))
  })

  it.each(["supplier-reference", "family", "reciprocal-reference", "missing-row"])(
    "excludes a sibling with inconsistent %s identity", (problem) => {
      const { products, groups, resolve } = fixture()
      const sibling = products[2]
      if (problem === "supplier-reference") sibling.supplierProductRef = "a".repeat(64)
      if (problem === "family") groups[sibling.slug].familyId = "another-reviewed-family"
      if (problem === "reciprocal-reference") groups[sibling.slug].variants[0].productRef = "a".repeat(64)
      if (problem === "missing-row") delete groups[sibling.slug]
      expect(resolve().map((option) => option.colorLabel)).toEqual(["white", "black"])
    },
  )

  it("rejects duplicate canonical slugs and product aliases sharing a supplier reference", () => {
    const { products, resolve } = fixture()
    products.push({ ...products[2] })
    expect(resolve().map((option) => option.colorLabel)).toEqual(["white", "black"])
    products[3].slug = "duplicate-spu-alias"
    expect(resolve().map((option) => option.colorLabel)).toEqual(["white", "black"])
  })

  it.each<CatalogAvailabilityStatus>([
    "out_of_stock", "stock_unknown", "price_unavailable", "not_matched", "not_found",
    "source_unavailable", "stale", "unverified",
  ])("removes a %s sibling even with a still-current price", (status) => {
    const { products, snapshot, resolve } = fixture()
    snapshot.catalogStatuses[products[2].slug].status = status
    expect(resolve().map((option) => option.colorLabel)).toEqual(["white", "black"])
  })

  it("requires both stock evidence and a priced exact size offer", () => {
    const { products, snapshot, resolve } = fixture()
    delete snapshot.catalogStatuses[products[2].slug]
    snapshot.items[products[1].slug].sizeOffers = []
    expect(resolve()).toEqual([])
  })

  it.each([
    { available: null }, { available: false }, { priceStatus: "historical" },
    { priceRub: 0 }, { priceRub: Number.NaN }, { priceCny: 0 }, { liveProviderVerified: false },
    { sourceUpdatedAt: null }, { sourceExpiresAt: "invalid" },
  ])("removes a sibling without a positive, current, verified size offer: %j", (change) => {
    const { products, snapshot, resolve } = fixture()
    Object.assign(snapshot.items[products[2].slug].sizeOffers[0], change)
    expect(resolve().map((option) => option.colorLabel)).toEqual(["white", "black"])
  })

  it.each(["source", "snapshot", "stock"])("rechecks %s expiry after parsing while the page remains open", (boundary) => {
    const { now, products, snapshot, resolve } = fixture()
    const earlyExpiry = new Date(now + 30_000).toISOString()
    const item = snapshot.items[products[2].slug]
    if (boundary === "source") item.sizeOffers[0].sourceExpiresAt = earlyExpiry
    if (boundary === "snapshot") item.expiresAt = earlyExpiry
    if (boundary === "stock") snapshot.catalogStatuses[products[2].slug].expiresAt = earlyExpiry
    expect(resolve(now + 29_999)).toHaveLength(3)
    expect(resolve(now + 30_000).map((option) => option.colorLabel)).toEqual(["white", "black"])
  })

  it("does not retain a colour chooser once only one available exact product remains", () => {
    const { products, snapshot, resolve } = fixture()
    delete snapshot.items[products[1].slug]
    delete snapshot.items[products[2].slug]
    expect(resolve()).toEqual([])
  })
})
