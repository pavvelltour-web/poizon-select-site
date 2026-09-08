import { describe, expect, it } from "vitest"

import manifest from "../../catalog-media/supplier-catalog-media.json"
import { mergeSupplierCatalog, parseSupplierCatalog } from "./supplier-catalog"
import { getSupplierCatalogMedia } from "./supplier-catalog-media"

describe("current supplier media inventory fallback", () => {
  it("keeps caller images for current inventory entries without frames", () => {
    const emptyRows = manifest.products.filter((product) => product.frames.length === 0)
    const additions = parseSupplierCatalog(emptyRows.map((product) => ({
      slug: product.slug,
      product_ref: product.product_ref,
      source: "poizon",
      brand: "Nike",
      name: "Source image fallback fixture",
      article: null,
      kind: "footwear",
      category: "basketball",
      // The manifest inventories identities and frame gaps. Incoming API images
      // remain the fallback; these deterministic URLs do not require a network read.
      images: [
        `https://cdn.poizon.com/${product.slug}-source-front.jpg`,
        `https://cdn.poizon.com/${product.slug}-source-rear.jpg`,
      ],
    })))
    expect(additions).toHaveLength(emptyRows.length)
    const merged = mergeSupplierCatalog([], additions)
    expect(merged).toHaveLength(emptyRows.length)

    additions.forEach((supplier, index) => {
      expect(getSupplierCatalogMedia(supplier)).toBe(supplier.images)
      expect(merged[index].slug).toBe(supplier.slug)
      expect(merged[index].supplierProductRef).toBe(supplier.productRef)
      expect(merged[index].image).toBe(supplier.images[0])
      expect(merged[index].fallbackImage).toBe(supplier.images[0])
      expect(merged[index].gallery.map((frame) => frame.src)).toEqual(supplier.images)
    })
  })
})
