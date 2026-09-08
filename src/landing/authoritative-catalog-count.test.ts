import { describe, expect, it } from "vitest"
import { publicCatalogProducts } from "../catalog/catalog"
import {
  filterAuthoritativeOriginals,
  parseCatalogCount,
  parseSupplierCatalog,
  resolveStorefrontCatalog,
} from "./supplier-catalog"

function fixture(count = 200) {
  const originals = publicCatalogProducts
  const retained = originals.slice(0, 29)
  const rawAdditions = Array.from({ length: count - retained.length }, (_, index) => ({
    slug: `reviewed-addition-${index}`, brand: "Nike", name: `Verified Model ${index}`,
    article: null, kind: "footwear", category: "basketball", source: "poizon",
    product_ref: index.toString(16).padStart(64, "0"), images: [`https://cdn.poizon.com/model-${index}.jpg`],
  }))
  const additions = parseSupplierCatalog(rawAdditions)
  // Membership can be authoritative even when current stock is unknown. It
  // supplies neither a price nor permission to order a product.
  const statuses: Record<string, unknown> = Object.fromEntries([
    ...retained.map((product) => [product.slug, { status: "unverified" }]),
    ...additions.map((product) => [product.slug, { status: "stock_unknown" }]),
  ])
  const resolve = (catalogCount: number | null = count, ready = true) =>
    resolveStorefrontCatalog(originals, additions, statuses, ready, catalogCount)
  return { originals, retained, rawAdditions, additions, statuses, resolve }
}

describe("explicit authoritative catalogue count", () => {
  it.each([1, 200, 201, 202, 10_000])("accepts the bounded integer count %s", (count) => {
    expect(parseCatalogCount(count)).toBe(count)
  })

  it.each([undefined, null, "200", true, {}, [], 0, -1, 200.5, 10_001, Number.NaN, Infinity, -Infinity])(
    "does not manufacture a count from invalid metadata: %s", (count) => {
      expect(parseCatalogCount(count)).toBeNull()
    },
  )

  it.each([200, 201, 202])("resolves exactly %s reviewed products without resurrecting retired originals", (count) => {
    const { originals, retained, additions, statuses, resolve } = fixture(count)
    const products = resolve()
    expect(products).toHaveLength(count)
    expect(new Set(products.map((product) => product.slug)).size).toBe(count)
    expect(new Set(products.map((product) => product.slug))).toEqual(new Set(Object.keys(statuses)))
    retained.forEach((product, index) => expect(products[index]).toBe(product))
    expect(products.some((product) => product.slug === originals[29].slug)).toBe(false)
    expect(products.slice(retained.length).map((product) => product.supplierProductRef))
      .toEqual(additions.map((product) => product.productRef))
    expect(filterAuthoritativeOriginals(originals, statuses, true, count)).toEqual(retained)
    expect(products.every((product) => !Object.hasOwn(product, "checkoutReady"))).toBe(true)
  })

  it("requires explicit count from the same snapshot instead of trusting a 200-key coincidence", () => {
    const { originals, additions, statuses, resolve } = fixture()
    expect(filterAuthoritativeOriginals(originals, statuses, true)).toBe(originals)
    expect(resolveStorefrontCatalog(originals, additions, statuses, true)).toBe(originals)
    expect(resolve(null)).toBe(originals)
  })

  it.each([0, -200, 200.5, 10_001, Number.NaN, Infinity, 199, 201])(
    "keeps bundled originals for an invalid or inconsistent declared count: %s", (count) => {
      const { originals, resolve } = fixture()
      expect(resolve(count)).toBe(originals)
    },
  )

  it("keeps bundled originals until catalogue loading succeeds", () => {
    const { originals, resolve } = fixture()
    expect(resolve(200, false)).toBe(originals)
  })

  it.each(["missing-status", "extra-status", "missing-product", "extra-product", "wrong-member"])(
    "requires complete coverage even when a snapshot has %s", (problem) => {
      const { originals, additions, statuses, resolve } = fixture()
      if (problem === "missing-status") delete statuses[additions[0].slug]
      if (problem === "extra-status") statuses["unreviewed-extra"] = { status: "in_stock" }
      if (problem === "missing-product") additions.pop()
      if (problem === "extra-product") additions.push({ ...additions[0], slug: "unreviewed-extra", productRef: "a".repeat(64) })
      if (problem === "wrong-member") {
        delete statuses[additions[0].slug]
        statuses["unknown-replacement"] = { status: "in_stock" }
      }
      expect(resolve()).toBe(originals)
    },
  )

  it("does not count duplicate product slugs as complete membership", () => {
    const { originals, additions, resolve } = fixture()
    additions[1] = { ...additions[0] }
    expect(resolve()).toBe(originals)
  })

  it("does not count different slug aliases of one supplier product as separate products", () => {
    const { originals, additions, resolve } = fixture()
    additions[1].productRef = additions[0].productRef
    expect(resolve()).toBe(originals)
  })

  it("rejects a duplicate retained original even if array length still matches the declared total", () => {
    const { originals, retained, additions, statuses } = fixture()
    const duplicateOriginals = [retained[0], ...originals]
    const shortenedAdditions = additions.slice(1)
    expect(resolveStorefrontCatalog(duplicateOriginals, shortenedAdditions, statuses, true, 200))
      .toBe(duplicateOriginals)
  })

  it("does not accept a duplicate reference across retained and added products", () => {
    const { originals, additions, statuses } = fixture()
    const originalsWithRef = originals.map((product, index) => index === 0
      ? { ...product, supplierProductRef: additions[0].productRef } : product)
    expect(resolveStorefrontCatalog(originalsWithRef, additions, statuses, true, 200)).toBe(originalsWithRef)
  })

  it("falls back when malformed duplicate API metadata is removed by the supplier parser", () => {
    const { originals, rawAdditions, statuses } = fixture()
    const additions = parseSupplierCatalog([...rawAdditions, { slug: rawAdditions[0].slug }])
    expect(resolveStorefrontCatalog(originals, additions, statuses, true, 200)).toBe(originals)
  })

  it.each(["../product", "Model Uppercase", "x".repeat(161)])("rejects invalid membership slug %s", (slug) => {
    const { originals, additions, statuses, resolve } = fixture()
    delete statuses[additions[0].slug]
    statuses[slug] = { status: "in_stock" }
    additions[0].slug = slug
    expect(resolve()).toBe(originals)
  })

  it("does not accept inherited status keys as declared membership", () => {
    const { originals, additions, statuses } = fixture()
    const inherited: Record<string, unknown> = Object.create(statuses)
    expect(resolveStorefrontCatalog(originals, additions, inherited, true, 200)).toBe(originals)
  })
})
