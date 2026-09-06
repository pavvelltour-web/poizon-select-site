import { describe, expect, it } from "vitest"
import { publicCatalogProducts } from "../catalog/catalog"
import { getDisplayPrice, getSizeOptions } from "./landing-data"
import { mergeSupplierCatalog, parseSupplierCatalog } from "./supplier-catalog"

function metadata(index: number) {
  return {
    slug: `supplier-model-${index}`, brand: "adidas", name: `Supplier model ${index}`,
    article: `ARTICLE-${index}`, kind: "footwear", category: "basketball", source: "poizon",
    product_ref: index.toString(16).padStart(64, "0"), images: [`https://cdn.poizon.com/product-${index}.jpg`],
  }
}

describe("additional canonical supplier products", () => {
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
