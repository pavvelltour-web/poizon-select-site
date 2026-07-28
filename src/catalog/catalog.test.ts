import { describe, expect, it } from "vitest"

import {
  catalogProducts,
  filterCatalog,
  findProductBySlug,
  formatRub,
  MARKET_PRICE_BASIS,
  PRICE_FORMULA_BASIS,
  sortCatalog,
} from "./catalog"

describe("catalogProducts", () => {
  it("contains exactly 100 unique products in the requested category split", () => {
    expect(catalogProducts).toHaveLength(100)
    expect(new Set(catalogProducts.map((product) => product.slug)).size).toBe(100)
    expect(
      catalogProducts.filter((product) => product.category === "volleyball"),
    ).toHaveLength(23)
    expect(
      catalogProducts.filter((product) => product.category === "basketball"),
    ).toHaveLength(12)
    expect(
      catalogProducts.filter((product) => product.category === "training"),
    ).toHaveLength(10)
    expect(
      catalogProducts.filter((product) => product.category === "recovery"),
    ).toHaveLength(10)
    expect(
      catalogProducts.filter((product) => product.category === "lifestyle"),
    ).toHaveLength(22)
    expect(
      catalogProducts.filter((product) => product.category === "apparel"),
    ).toHaveLength(23)
  })

  it("keeps sport-priority focused on volleyball, basketball and support items", () => {
    const priority = catalogProducts.filter((product) => product.sportPriority)
    expect(priority).toHaveLength(70)
    expect(priority.filter((product) => product.kind === "footwear")).toHaveLength(
      37,
    )
    expect(priority.filter((product) => product.kind === "apparel")).toHaveLength(
      10,
    )
    expect(priority.filter((product) => product.kind === "accessory")).toHaveLength(
      23,
    )
    expect(priority.every((product) => product.marketPrice)).toBe(true)
    expect(priority.every((product) => product.priceBasis === MARKET_PRICE_BASIS)).toBe(
      true,
    )
  })

  it("keeps every product field useful with consistent local gallery sets", () => {
    const imagePaths = new Set<string>()

    for (const product of catalogProducts) {
      const assetSlug = product.fallbackImage
        .replace(/^catalog\//, "")
        .replace(/\.webp$/, "")

      expect(product.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(product.brand.trim()).toBe(product.brand)
      expect(product.brand.length).toBeGreaterThan(1)
      expect(product.name.trim()).toBe(product.name)
      expect(product.name.length).toBeGreaterThan(2)
      expect(product.categoryLabel).toContain("·")
      expect(product.query.length).toBeGreaterThan(8)
      expect(product.fallbackImage).toMatch(/^catalog\/[a-z0-9-]+\.webp$/)
      expect(product.gallery).toHaveLength(5)
      expect(product.image).toBe(product.fallbackImage)
      expect(product.gallery.map((image) => image.src)).toEqual([
        product.fallbackImage,
        `catalog/gallery/${assetSlug}-2.webp`,
        `catalog/gallery/${assetSlug}-3.webp`,
        `catalog/gallery/${assetSlug}-4.webp`,
        `catalog/gallery/${assetSlug}-5.webp`,
      ])
      expect(
        product.gallery.every(
          (image) => image.source === "Project-generated studio reference",
        ),
      ).toBe(true)
      imagePaths.add(product.fallbackImage)
    }

    expect(imagePaths.size).toBe(100)
  })

  it("calculates buyer-facing order quotes with the backend component formula", () => {
    const gtCut = findProductBySlug("nike-gt-cut-academy")

    expect(gtCut?.formulaBasis).toBe(PRICE_FORMULA_BASIS)
    expect(gtCut?.orderQuote).toMatchObject({
      priceYuan: 760,
      yuanRate: 12.5,
      paymentFeePercent: 7,
      internationalLogistics: 1800,
      serviceFeePercent: 12,
    })
    expect(formatRub(gtCut?.orderQuote?.totalRub ?? 0)).toBe("13 465 ₽")
  })

  it("filters by category and a case-insensitive search phrase", () => {
    expect(filterCatalog(catalogProducts, "volleyball", "")).toHaveLength(23)
    expect(filterCatalog(catalogProducts, "all", "ronaldinho")).toHaveLength(1)
    expect(filterCatalog(catalogProducts, "basketball", "NIKE")).toHaveLength(7)
    expect(filterCatalog(catalogProducts, "recovery", "not-a-real-product")).toEqual(
      [],
    )
  })

  it("sorts deterministically without inventing prices for request-only items", () => {
    const trainingNike = filterCatalog(catalogProducts, "training", "NIKE")

    expect(sortCatalog(trainingNike, "featured").map((product) => product.slug)).toEqual([
      "nike-pro-compression-shorts",
      "nike-free-metcon-6",
      "nike-resistance-band-heavy",
      "nike-hyperfuel-water-bottle",
    ])
    expect(sortCatalog(catalogProducts, "price-asc")[0].slug).toBe(
      "rocktape-kinesiology-tape-black",
    )
    expect(sortCatalog(catalogProducts, "price-asc").at(-1)?.marketPrice).toBeUndefined()
    expect(sortCatalog(catalogProducts, "name")[0].brand).toBe("adidas")
  })

  it("looks up products only by stable slug", () => {
    expect(findProductBySlug("nike-gt-cut-academy")?.query).toBe(
      "Nike G.T. Cut Academy basketball volleyball",
    )
    expect(findProductBySlug("../nike-gt-cut-academy")).toBeNull()
    expect(findProductBySlug(null)).toBeNull()
  })
})
