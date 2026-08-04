import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const expectedProductCount = Number(process.env.EXPECTED_STATIC_PRODUCTS ?? "20")
const catalogPath = path.join(siteRoot, "site-release", "kicksbase-signal-catalog-v4.html")
const directionPath = path.join(siteRoot, "site-release", "kicksbase-direction-03-blue-field-v2.html")
const assetsPath = path.join(siteRoot, "site-release", "assets", "blue-field-v2")

function productSlugFromHref(href: string): string {
  return new URL(href, "https://kicksbase.local/").searchParams.get("product") ?? ""
}

async function pngDimensions(file: string): Promise<[number, number]> {
  const bytes = await readFile(file)
  expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

const batchTwoSlugs = [
  "asics-sky-elite-ff-mt-3",
  "asics-metarise-2",
  "asics-gel-tactic-13",
  "nike-zoom-hyperset-2",
  "nike-hyperace-3-se",
  "adidas-crazyflight-6-mid",
] as const

function galleryPaths(slug: string): string[] {
  const hover = slug === "nike-aone"
    ? "hover/nike-aone-front-pair-bg-v2.png"
    : `hover/${slug}-front-pair-bg.png`
  return [
    `${slug}-stage.png`,
    hover,
    `gallery/normalized/${slug}-3.png`,
    `gallery/normalized/${slug}-4.png`,
    `gallery/normalized/${slug}-5.png`,
  ]
}

describe("static catalog release contract", () => {
  it("keeps catalog, product records, and packaged media in one complete contract", async () => {
    expect(Number.isInteger(expectedProductCount)).toBe(true)
    expect(expectedProductCount).toBeGreaterThan(0)

    const [catalogHtml, directionHtml] = await Promise.all([
      readFile(catalogPath, "utf8"),
      readFile(directionPath, "utf8"),
    ])
    const catalog = new JSDOM(catalogHtml).window.document
    const direction = new JSDOM(directionHtml).window.document

    const catalogCards = [...catalog.querySelectorAll<HTMLElement>("[data-catalog-card]")]
    const catalogLinks = catalogCards.map((card) => {
      const link = card.querySelector<HTMLAnchorElement>("a[href*='?product=']")
      expect(link, `${card.dataset.odId} must have a product link`).not.toBeNull()
      expect(new URL(link!.href, "https://kicksbase.local/").pathname).toBe("/kicksbase-direction-03-blue-field-v2.html")
      return link!
    })
    const catalogProductSlugs = catalogLinks.map((link) => productSlugFromHref(link.href))
    const catalogOdIds = catalogCards.map((card) => card.dataset.odId ?? "")
    const catalogHrefs = catalogLinks.map((link) => link.href)

    expect(catalogCards).toHaveLength(expectedProductCount)
    expect(new Set(catalogProductSlugs).size).toBe(expectedProductCount)
    expect(new Set(catalogOdIds).size).toBe(expectedProductCount)
    expect(new Set(catalogHrefs).size).toBe(expectedProductCount)
    expect(catalogProductSlugs.every(Boolean)).toBe(true)
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchTwoSlugs))
    expect(catalog.querySelector("[data-catalog-count]")?.textContent?.trim()).toMatch(
      new RegExp(`^${expectedProductCount}\\s+модел`),
    )

    const directionCards = [...direction.querySelectorAll<HTMLElement>("[data-product]")]
    const directionSlugs = directionCards.map((card) => {
      const odId = card.dataset.odId ?? ""
      expect(odId).toMatch(/^product-card-[a-z0-9-]+$/)
      return odId.replace(/^product-card-/, "")
    })
    const directionOdIds = directionCards.map((card) => card.dataset.odId ?? "")

    expect(directionCards).toHaveLength(expectedProductCount)
    expect(new Set(directionSlugs).size).toBe(expectedProductCount)
    expect(new Set(directionOdIds).size).toBe(expectedProductCount)
    expect([...new Set(catalogProductSlugs)].sort()).toEqual([...new Set(directionSlugs)].sort())
    expect(directionCards.filter((card) => !card.hasAttribute("hidden"))).toHaveLength(8)
    expect(directionCards.filter((card) => card.hasAttribute("hidden"))).toHaveLength(expectedProductCount - 8)

    const requiredDataFields = [
      "productKind",
      "type",
      "brand",
      "name",
      "price",
      "category",
      "categoryLabel",
      "description",
      "use",
      "supply",
      "image",
      "gallerySlug",
      "sizes",
      "odId",
    ] as const
    const imageChecks: Array<Promise<void>> = []
    const catalogCardBySlug = new Map(catalogProductSlugs.map((slug, index) => [slug, catalogCards[index]]))

    for (const card of directionCards) {
      const slug = (card.dataset.odId ?? "").replace(/^product-card-/, "")
      const catalogCard = catalogCardBySlug.get(slug)
      expect(catalogCard, `${slug} is missing from the catalog page`).toBeDefined()
      for (const field of requiredDataFields) {
        expect(card.dataset[field], `${slug} is missing data-${field}`).toBeTruthy()
      }
      expect(card.dataset.productKind).toBe("footwear")
      expect(card.dataset.odId).toBe(`product-card-${slug}`)
      expect(card.querySelector("[data-product-open]")).not.toBeNull()
      expect(card.querySelector("[data-favorite]")).not.toBeNull()
      expect(card.querySelector("[data-card-sizes]")).not.toBeNull()
      expect(card.dataset.sizes?.split(",").filter(Boolean).length).toBeGreaterThan(0)
      expect(catalogCard!.dataset.productKind).toBe(card.dataset.productKind)
      expect(catalogCard!.dataset.price).toBe(card.dataset.price)
      expect(catalogCard!.dataset.sizes).toBe(card.dataset.sizes)
      expect(catalogCard!.querySelector("img")?.getAttribute("src")).toBe(card.dataset.image)

      for (const relativeAssetPath of galleryPaths(card.dataset.gallerySlug!)) {
        const absoluteAssetPath = path.join(assetsPath, relativeAssetPath)
        imageChecks.push((async () => {
          const [width, height] = await pngDimensions(absoluteAssetPath)
          expect([width, height]).toEqual([1600, 1200])
          expect(width * 3).toBe(height * 4)
        })())
      }
    }
    await Promise.all(imageChecks)
  })
})
