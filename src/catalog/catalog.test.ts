import { describe, expect, it } from "vitest"

import unifiedCatalogMediaManifest from "../../catalog-media/unified-catalog-media.json"

import {
  canonicalCatalogMediaUrl,
  catalogProducts,
  dedupeCatalogGallery,
  filterCatalog,
  findProductBySlug,
  formatRub,
  isPublicCatalogProduct,
  MARKET_PRICE_BASIS,
  PRICE_FORMULA_BASIS,
  publicCatalogProducts,
  sortCatalog,
} from "./catalog"

const unifiedGalleryBySlug = new Map(
  unifiedCatalogMediaManifest.products.map((product) => [
    product.slug,
    [...product.frames].sort((left, right) => left.position - right.position),
  ]),
)

function versionedFrameUrl(frame: { file: string; sha256: string }): string {
  return `${frame.file.replace(/^public\//, "")}?v=${frame.sha256.slice(0, 16)}`
}

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
    ).toHaveLength(6)
    expect(
      catalogProducts.filter((product) => product.category === "protection"),
    ).toHaveLength(7)
    expect(
      catalogProducts.filter((product) => product.category === "balls"),
    ).toHaveLength(4)
    expect(
      catalogProducts.filter((product) => product.category === "bags"),
    ).toHaveLength(6)
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

  it("publishes all footwear, apparel and accessories to the public storefront", () => {
    expect(publicCatalogProducts).toHaveLength(100)
    expect(publicCatalogProducts).toEqual(
      catalogProducts.filter(isPublicCatalogProduct),
    )
    expect(publicCatalogProducts.filter((product) => product.kind === "accessory")).toHaveLength(25)
  })

  it("keeps every product field useful with consistent local gallery sets", () => {
    const imagePaths = new Set<string>()

    for (const product of catalogProducts) {
      const manifestFrames = unifiedGalleryBySlug.get(product.slug)

      expect(product.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(product.brand.trim()).toBe(product.brand)
      expect(product.brand.length).toBeGreaterThan(1)
      expect(product.name.trim()).toBe(product.name)
      expect(product.name.length).toBeGreaterThan(2)
      expect(product.categoryLabel.length).toBeGreaterThan(2)
      expect(product.query.length).toBeGreaterThan(8)
      expect(product.fallbackImage).toMatch(/^catalog\/[a-z0-9-]+\.webp$/)
      expect(product.gallery).toHaveLength(5)
      expect(manifestFrames).toHaveLength(5)
      expect(product.image).toBe(product.gallery[0]?.src)
      expect(product.gallery.map((image) => image.src)).toEqual(
        manifestFrames?.map(versionedFrameUrl),
      )
      expect(product.gallery.map((image) => image.angle)).toEqual(
        manifestFrames?.map((frame) => frame.angle),
      )
      expect(new Set(product.gallery.map((image) => image.contentSignal)).size).toBe(
        product.gallery.length,
      )
      expect(product.gallery.every(
        (image) => image.source === "KICKSBASE unified catalog media manifest",
      )).toBe(true)
      imagePaths.add(product.fallbackImage)
      expect(Boolean(product.marketPrice || product.orderQuote)).toBe(true)
    }

    expect(imagePaths.size).toBe(100)
    expect(catalogProducts.every((product) => product.gallery.length === 5)).toBe(true)
  })

  it("keeps preview, product sheet and PDP on the manifest's five ordered images", () => {
    for (const [slug, expectedFrames] of unifiedGalleryBySlug) {
      const product = findProductBySlug(slug)

      expect(product, slug).not.toBeNull()
      expect(product?.image, slug).toBe(versionedFrameUrl(expectedFrames[0]!))
      expect(product?.gallery.map((image) => image.src), slug).toEqual(
        expectedFrames.map(versionedFrameUrl),
      )
      expect(product?.gallery.map((image) => image.angle), slug).toEqual(
        expectedFrames.map((frame) => frame.angle),
      )
    }
  })

  it("deduplicates media by content signal and canonical source URL", () => {
    const transformedNikeA =
      "https://static.nike.com/a/images/t_default/example/product.webp?wid=800&q_auto=eco"
    const transformedNikeB =
      "https://static.nike.com/a/images/t_PDP_1728_v1/example/product.webp?wid=1728"

    expect(canonicalCatalogMediaUrl(transformedNikeA)).toBe(
      canonicalCatalogMediaUrl(transformedNikeB),
    )
    expect(
      dedupeCatalogGallery([
        { src: transformedNikeA, alt: "A", source: "Nike" },
        { src: transformedNikeB, alt: "B", source: "Nike" },
      ]),
    ).toHaveLength(1)
    expect(
      dedupeCatalogGallery([
        { src: "catalog/a.webp", alt: "A", source: "Project", contentSignal: "same" },
        { src: "catalog/b.webp", alt: "B", source: "Project", contentSignal: "same" },
      ]),
    ).toHaveLength(1)
  })

  it("uses concise public descriptions without performance jargon", () => {
    const visibleCopy = publicCatalogProducts
      .map((product) => `${product.categoryLabel} ${product.note}`)
      .join(" ")

    expect(visibleCopy).not.toMatch(
      /guard|performance|альтернатив|impact|grip|recovery-зон/iu,
    )
  })

  it("calculates buyer-facing order quotes with the backend component formula", () => {
    const gtCut = findProductBySlug("nike-gt-cut-academy")

    expect(gtCut?.formulaBasis).toBe(PRICE_FORMULA_BASIS)
    expect(gtCut?.orderQuote).toMatchObject({
      priceYuan: 760,
      yuanRate: 13,
      paymentFeePercent: 2.5,
      internationalLogistics: 3000,
      serviceFeePercent: 35,
      marginTargetPercent: 35,
      marginFloorPercent: 30,
    })
    expect(formatRub(gtCut?.orderQuote?.totalRub ?? 0)).toBe("24 500 ₽")
  })

  it("filters by category and a case-insensitive search phrase", () => {
    expect(filterCatalog(publicCatalogProducts, "volleyball", "")).toHaveLength(19)
    expect(filterCatalog(publicCatalogProducts, "court-shoes", "")).toHaveLength(37)
    expect(filterCatalog(publicCatalogProducts, "sneakers", "")).toHaveLength(22)
    expect(filterCatalog(publicCatalogProducts, "apparel", "")).toHaveLength(16)
    expect(filterCatalog(publicCatalogProducts, "accessories", "")).toHaveLength(25)
    expect(filterCatalog(publicCatalogProducts, "all", "ronaldinho")).toHaveLength(1)
    expect(filterCatalog(publicCatalogProducts, "all", "Force Nike Air").map((product) => product.slug)).toEqual([
      "nike-air-force-1-07-white",
    ])
    expect(filterCatalog(publicCatalogProducts, "all", "sabr").map((product) => product.slug)).toContain(
      "nike-sabrina-3",
    )
    expect(filterCatalog(publicCatalogProducts, "all", "Nike Metcon 10")).toEqual([])
    expect(filterCatalog(publicCatalogProducts, "all", "волейбольный мяч").map((product) => product.slug)).toEqual([
      "molten-v5m5000-flistatec",
      "molten-v5m4500-volleyball",
      "mikasa-v200w-volleyball",
    ])
    expect(filterCatalog(publicCatalogProducts, "basketball", "NIKE")).toHaveLength(6)
    const nikeSlugs = filterCatalog(publicCatalogProducts, "all", "Nike").map(
      (product) => product.slug,
    )
    expect(filterCatalog(publicCatalogProducts, "all", "найк").map((product) => product.slug)).toEqual(
      nikeSlugs,
    )
    expect(filterCatalog(publicCatalogProducts, "all", "наик").map((product) => product.slug)).toEqual(
      nikeSlugs,
    )
    expect(
      filterCatalog(publicCatalogProducts, "recovery", "not-a-real-product"),
    ).toEqual([])
  })

  it("sorts deterministically with prices for every catalog item", () => {
    const courtNike = filterCatalog(publicCatalogProducts, "court-shoes", "NIKE")

    expect(sortCatalog(courtNike, "featured").map((product) => product.slug)).toEqual([
      "nike-kd-18",
      "nike-gt-cut-academy",
      "nike-sabrina-3",
      "nike-zoom-hyperset-2",
      "nike-hyperace-3-se",
      "nike-lebron-nxxt-genisus",
      "nike-calm-slide",
      "nike-aone",
      "nike-free-metcon-6",
      "nike-ja-3",
    ])
    expect(sortCatalog(catalogProducts, "price-asc")[0].slug).toBe(
      "adidas-crazyflight-shorts",
    )
    expect(sortCatalog(catalogProducts, "price-asc").at(-1)?.slug).toBe(
      "supreme-mm6-zip-hoodie-black",
    )
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
