import { describe, expect, it } from "vitest"

import {
  catalogProducts,
  filterCatalog,
  MARKET_PRICE_BASIS,
} from "./catalog"

describe("catalogProducts", () => {
  it("contains exactly 60 unique products in the requested category split", () => {
    expect(catalogProducts).toHaveLength(60)
    expect(new Set(catalogProducts.map((product) => product.slug)).size).toBe(60)
    expect(
      catalogProducts.filter((product) => product.category === "volleyball"),
    ).toHaveLength(18)
    expect(
      catalogProducts.filter((product) => product.category === "training"),
    ).toHaveLength(8)
    expect(
      catalogProducts.filter((product) => product.category === "recovery"),
    ).toHaveLength(4)
    expect(
      catalogProducts.filter((product) => product.category === "lifestyle"),
    ).toHaveLength(22)
    expect(
      catalogProducts.filter((product) => product.category === "apparel"),
    ).toHaveLength(8)
  })

  it("keeps SPORT FIRST at exactly 20 pairs and 10 apparel items", () => {
    const priority = catalogProducts.filter((product) => product.sportPriority)
    expect(priority).toHaveLength(30)
    expect(priority.filter((product) => product.kind === "footwear")).toHaveLength(
      20,
    )
    expect(priority.filter((product) => product.kind === "apparel")).toHaveLength(
      10,
    )
    expect(priority.every((product) => product.marketPrice)).toBe(true)
    expect(priority.every((product) => product.priceBasis === MARKET_PRICE_BASIS)).toBe(
      true,
    )
  })

  it("keeps every bot query useful and every image local", () => {
    const imagePaths = new Set<string>()

    for (const product of catalogProducts) {
      expect(product.query.length).toBeGreaterThan(8)
      expect(product.image).toMatch(/^catalog\/[a-z0-9-]+\.webp$/)
      expect(product.image).not.toMatch(/^https?:/)
      imagePaths.add(product.image)
    }

    expect(imagePaths.size).toBe(60)
  })

  it("filters by category and a case-insensitive search phrase", () => {
    expect(filterCatalog(catalogProducts, "volleyball", "")).toHaveLength(18)
    expect(filterCatalog(catalogProducts, "all", "ronaldinho")).toHaveLength(1)
    expect(filterCatalog(catalogProducts, "training", "NIKE")).toHaveLength(
      2,
    )
    expect(filterCatalog(catalogProducts, "recovery", "не существует")).toEqual([])
  })
})
