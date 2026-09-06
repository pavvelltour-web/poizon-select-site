import { describe, expect, it } from "vitest"
import { publicCatalogProducts } from "../catalog/catalog"
import { findTaskMatches, getDisplayPrice, getProductTypeLabel, getProductUse, getSizeOptions } from "./landing-data"
import { mergeSupplierCatalog, parseSupplierCatalog } from "./supplier-catalog"

function metadata(index: number) {
  return {
    slug: `supplier-model-${index}`, brand: "adidas", name: `Supplier model ${index}`,
    article: `ARTICLE-${index}`, kind: "footwear", category: "basketball", source: "poizon",
    product_ref: index.toString(16).padStart(64, "0"), images: [`https://cdn.poizon.com/product-${index}.jpg`],
  }
}

describe("additional canonical supplier products", () => {
  it("does not invent an indoor or everyday use case for a source-labelled training product", () => {
    const [product] = mergeSupplierCatalog([], parseSupplierCatalog([
      { ...metadata(1), brand: "Nike", name: "Nike High Jump Elite", category: "training" },
    ]))
    expect(product.name).toBe("High Jump Elite")
    expect(product.query).toBe("Nike High Jump Elite ARTICLE-1")
    expect(product.sportPriority).toBe(false)
    expect(findTaskMatches([product], "для зала")).toEqual([])
    expect(getProductTypeLabel(product)).toBe("Обувь")
    expect(getProductUse(product)).toBe("Модель из каталога Poizon")
  })

  it.each(["Li Ning", "Li-Ning", "LINING"])("does not repeat a leading source brand: %s", (prefix) => {
    const [product] = mergeSupplierCatalog([], parseSupplierCatalog([
      { ...metadata(1), brand: "Li-Ning", name: `${prefix} DLO 1` },
    ]))
    expect(product.name).toBe("DLO 1")
  })

  it("does not treat absent supplier prices as zero-cost budget matches", () => {
    const products = mergeSupplierCatalog([], parseSupplierCatalog([metadata(1)]))
    expect(findTaskMatches(products, "до 10000")).toEqual([])
    expect(findTaskMatches(products, "недорого")).toEqual([])
    expect(findTaskMatches(products, "до 10000", { "supplier-model-1": 9000 })).toHaveLength(1)
    expect(findTaskMatches(products, "до 10000", { "supplier-model-1": 11000 })).toEqual([])
  })

  it("supports more than100 products while preserving every original product and image", () => {
    const products = mergeSupplierCatalog(publicCatalogProducts, parseSupplierCatalog(Array.from({ length: 90 }, (_, i) => metadata(i))))
    expect(products).toHaveLength(190)
    publicCatalogProducts.forEach((original, index) => expect(products[index]).toBe(original))
    expect(new Set(products.map((product) => product.slug)).size).toBe(190)
    for (const added of products.slice(100)) {
      expect(added.image).toMatch(/^https:\/\/cdn\.poizon\.com\//)
      expect(added.orderQuote).toBeUndefined()
      expect(added.chinaPriceYuan).toBeUndefined()
      expect(getDisplayPrice(added).value).toBe("По запросу")
      expect(getSizeOptions(added)).toEqual([])
    }
  })

  it("fails closed for duplicate slug or provider identity, including malformed colliding rows", () => {
    expect(parseSupplierCatalog([metadata(1), { ...metadata(2), slug: metadata(1).slug }])).toEqual([])
    expect(parseSupplierCatalog([metadata(1), { ...metadata(2), product_ref: metadata(1).product_ref }])).toEqual([])
    expect(parseSupplierCatalog([metadata(1), { slug: metadata(1).slug }])).toEqual([])
  })

  it("never replaces an original product with server metadata for the same slug", () => {
    const products = mergeSupplierCatalog(publicCatalogProducts, parseSupplierCatalog([
      { ...metadata(1), slug: publicCatalogProducts[0].slug },
    ]))
    expect(products).toHaveLength(100)
    expect(products[0]).toBe(publicCatalogProducts[0])
  })

  it.each(["http://cdn.poizon.com/1.jpg", "https://localhost/1.jpg", "https://unapproved.example/1.jpg", "https://user:secret@cdn.poizon.com/1.jpg"])(
    "rejects images outside the existing approved media boundary: %s", (image) => {
      expect(parseSupplierCatalog([{ ...metadata(1), images: [image] }])).toEqual([])
    },
  )

  it("does not project untrusted price, stock or checkout fields from metadata", () => {
    const [product] = mergeSupplierCatalog([], parseSupplierCatalog([
      { ...metadata(1), price_rub: 1, available: true, checkout_ready: true, orderQuote: { totalRub: 1 } },
    ]))
    expect(product).not.toHaveProperty("available")
    expect(product).not.toHaveProperty("price_rub")
    expect(product.orderQuote).toBeUndefined()
  })
})
