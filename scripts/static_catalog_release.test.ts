import { createHash } from "node:crypto"
import vm from "node:vm"
import ts from "typescript"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const expectedStaticProductCount = Number(process.env.EXPECTED_STATIC_PRODUCTS ?? "87")
const expectedFootwearProductCount = Number(process.env.EXPECTED_STATIC_FOOTWEAR ?? "59")
const expectedStaticApparelProductCount = Number(process.env.EXPECTED_STATIC_APPAREL ?? "16")
const expectedStaticAccessoryProductCount = Number(process.env.EXPECTED_STATIC_ACCESSORIES ?? "12")
const catalogPath = path.join(siteRoot, "site-release", "kicksbase-signal-catalog-v4.html")
const directionPath = path.join(siteRoot, "site-release", "kicksbase-direction-03-blue-field-v2.html")
const verifiedPricesPath = path.join(siteRoot, "site-release", "verified-catalog-prices.js")
const manifestPath = path.join(siteRoot, "site-release", "PRODUCT_MEDIA_MANIFEST.json")
const assetsPath = path.join(siteRoot, "site-release", "assets", "blue-field-v2")
const sourceCatalogPath = path.join(siteRoot, "src", "catalog", "catalog.ts")

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

const batchThreeSlugs = [
  "asics-upcourt-6",
  "asics-rote-japan-lyte-ff-3",
  "mizuno-wave-momentum-3",
  "mizuno-cyclone-speed-5",
  "adidas-stabil-16-indoor",
  "puma-fuse-3",
] as const

const batchFourSlugs = [
  "asics-netburner-ballistic-ff-4",
  "mizuno-wave-lightning-z8",
  "mizuno-wave-lightning-z8-mid",
  "mizuno-wave-momentum-elite-mid",
  "mizuno-wave-momentum-pro",
  "mizuno-wave-luminous-3",
] as const

const batchFiveSlugs = [
  "mizuno-wave-voltage-2",
  "adidas-handball-spezial-core-black",
  "new-balance-1000-black",
  "asics-gel-kayano-20-glacier-grey",
  "asics-gel-1130-black-pure-silver",
  "asics-gel-nyc-cream-oyster-grey",
] as const

const batchSixSlugs = [
  "asics-gel-kayano-14-white-midnight",
  "salomon-xt-6-white-lunar-rock",
  "new-balance-9060-rain-cloud",
  "new-balance-2002r-protection-pack",
  "new-balance-530-white-silver-navy",
  "new-balance-1906r-silver-metallic",
] as const

const batchSevenSlugs = [
  "hoka-ora-recovery-slide-3",
  "nike-calm-slide",
  "oofos-ooahh-slide",
  "crocs-mellow-recovery-slide",
  "nike-mind-001-slide-black",
  "nike-zoom-vomero-5-photon-dust",
] as const

const batchEightSlugs = [
  "nike-air-max-95-black-anthracite",
  "nike-air-force-1-07-white",
  "nike-dunk-low-panda",
  "adidas-samba-og-white-black",
  "adidas-gazelle-indoor-green",
  "adidas-campus-00s-core-black",
] as const

const batchNineSlugs = [
  "converse-chuck-70-high-black",
  "vans-old-skool-36-black-white",
  "timberland-field-boot-beef-broccoli",
] as const

const batchTenSlugs = [
  "nike-dri-fit-volleyball-jersey",
  "mizuno-volleyball-practice-tee",
  "asics-actibreeze-match-top",
  "adidas-crazyflight-shorts",
  "nike-pro-compression-shorts",
  "under-armour-heatgear-top",
] as const

const batchElevenSlugs = [
  "adidas-own-the-run-shorts",
  "on-performance-tights",
  "nike-therma-fit-training-hoodie",
  "adidas-zne-track-jacket",
  "essentials-hoodie-light-oatmeal",
  "north-face-1996-nuptse-black",
] as const

const batchTwelveSlugs = [
  "supreme-mm6-zip-hoodie-black",
  "jordan-nigel-sylvester-bike-air-jersey",
  "nike-barcelona-ronaldinho-jersey",
  "kith-adidas-messi-tee",
] as const

const accessoryBatchOneSlugs = [
  "nike-vapor-elite-volleyball-kneepads",
  "mizuno-vs1-ultra-kneepad",
  "molten-v5m5000-flistatec",
  "theraband-resistance-band-set",
] as const

const accessoryBatchTwoSlugs = [
  "hyperice-vyper-go-roller",
  "rocktape-kinesiology-tape-black",
  "mueller-jumpers-knee-strap",
  "bauerfeind-sports-knee-support",
] as const

const accessoryBatchThreeSlugs = [
  "mizuno-arm-sleeves",
  "stance-icon-crew-socks",
  "mikasa-v200w-volleyball",
] as const

const accessoryBatchFourSlugs = ["wilson-evo-nxt-basketball"] as const

const strictFootwearV1Slugs = [
  "nike-kd-18",
  "nike-sabrina-3",
  "oofos-ooahh-slide",
] as const

const strictFootwearV1Labels = [
  "Боковой профиль",
  "Спереди, 3/4",
  "Пара спереди, 3/4",
  "Пара сзади",
  "Подошва",
] as const

const apparelSlugs = new Set<string>([...batchTenSlugs, ...batchElevenSlugs, ...batchTwelveSlugs])
const accessorySlugs = new Set<string>([...accessoryBatchOneSlugs, ...accessoryBatchTwoSlugs, ...accessoryBatchThreeSlugs, ...accessoryBatchFourSlugs])

function expectedProductKind(slug: string): string {
  if (apparelSlugs.has(slug)) return "apparel"
  if (accessorySlugs.has(slug)) return "accessory"
  return "footwear"
}

function loadCatalogSlugs(source: string, kind: string): string[] {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  }).outputText
  const module = { exports: {} as { catalogProducts?: Array<{ slug: string; kind: string }> } }
  vm.runInNewContext(transpiled, {
    exports: module.exports,
    module,
    require(specifier: string): never {
      throw new Error("unexpected runtime import while loading catalog.ts: " + specifier)
    },
  }, { filename: sourceCatalogPath, timeout: 5000 })
  return (module.exports.catalogProducts ?? [])
    .filter((product) => product.kind === kind)
    .map((product) => product.slug)
}

function galleryPaths(slug: string): string[] {
  const hover = slug === "nike-aone"
    ? "hover/nike-aone-front-pair-bg-v2.png"
    : `hover/${slug}-front-pair-bg.png`
  if (strictFootwearV1Slugs.includes(slug as (typeof strictFootwearV1Slugs)[number])) {
    return [
      `${slug}-stage.png`,
      `gallery/normalized/${slug}-2.png`,
      hover,
      `gallery/normalized/${slug}-4.png`,
      `gallery/normalized/${slug}-5.png`,
    ]
  }
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
    expect(Number.isInteger(expectedStaticProductCount)).toBe(true)
    expect(Number.isInteger(expectedFootwearProductCount)).toBe(true)
    expect(Number.isInteger(expectedStaticApparelProductCount)).toBe(true)
    expect(Number.isInteger(expectedStaticAccessoryProductCount)).toBe(true)
    expect(expectedStaticProductCount).toBeGreaterThan(0)
    expect(expectedFootwearProductCount).toBeGreaterThan(0)
    expect(expectedStaticApparelProductCount).toBeGreaterThan(0)
    expect(expectedStaticAccessoryProductCount).toBeGreaterThan(0)

    const [catalogHtml, directionHtml, verifiedPrices, manifestJson, sourceCatalog] = await Promise.all([
      readFile(catalogPath, "utf8"),
      readFile(directionPath, "utf8"),
      readFile(verifiedPricesPath, "utf8"),
      readFile(manifestPath, "utf8"),
      readFile(sourceCatalogPath, "utf8"),
    ])
    const manifest = JSON.parse(manifestJson) as {
      policy: { activeBlueFieldGallery: { activeSlugs: string[] } }
      products: Array<{
        sku: string
        productKind: string
        assets: Array<{ path: string; sha256: string }>
      }>
    }
    const catalog = new JSDOM(catalogHtml, { url: "https://kicksbase.local/" }).window.document
    const direction = new JSDOM(directionHtml, { url: "https://kicksbase.local/" }).window.document

    for (const document of [catalog, direction]) {
      expect(document.querySelector('script[src^="verified-catalog-prices.js"]')).not.toBeNull()
      expect(
        [...document.querySelectorAll(".product-price")].every((price) => price.textContent?.trim() === "По запросу"),
      ).toBe(true)
    }
    for (const required of [
      'var ENDPOINT = "/api/checkout/orders?mode=catalog"',
      'credentials: "omit"',
      'payload.catalog_mode !== "curated_live_poizon"',
      "payload.snapshot_hours !== 12",
      "skuCounts",
      "sizeCounts",
      "setPrices({})",
    ]) {
      expect(verifiedPrices).toContain(required)
    }

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

    expect(catalogCards).toHaveLength(expectedStaticProductCount)
    expect(new Set(catalogProductSlugs).size).toBe(expectedStaticProductCount)
    expect(new Set(catalogOdIds).size).toBe(expectedStaticProductCount)
    expect(new Set(catalogHrefs).size).toBe(expectedStaticProductCount)
    expect(catalogProductSlugs.every(Boolean)).toBe(true)
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchTwoSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchThreeSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchFourSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchFiveSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchSixSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchSevenSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchEightSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchNineSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchTenSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchElevenSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(batchTwelveSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(accessoryBatchOneSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(accessoryBatchTwoSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(accessoryBatchThreeSlugs))
    expect(catalogProductSlugs).toEqual(expect.arrayContaining(accessoryBatchFourSlugs))
    expect(catalog.querySelector("[data-catalog-count]")?.textContent?.trim()).toMatch(
      new RegExp(`^${expectedStaticProductCount}\\s+модел`),
    )

    const directionCards = [...direction.querySelectorAll<HTMLElement>("[data-product]")]
    const directionSlugs = directionCards.map((card) => {
      const odId = card.dataset.odId ?? ""
      expect(odId).toMatch(/^product-card-[a-z0-9-]+$/)
      return odId.replace(/^product-card-/, "")
    })
    const directionGallerySlugs = directionCards.map((card) => card.dataset.gallerySlug ?? "")
    const directionOdIds = directionCards.map((card) => card.dataset.odId ?? "")

    expect(directionCards).toHaveLength(expectedStaticProductCount)
    expect(new Set(directionSlugs).size).toBe(expectedStaticProductCount)
    expect(new Set(directionGallerySlugs).size).toBe(expectedStaticProductCount)
    expect(directionGallerySlugs.every(Boolean)).toBe(true)
    expect(new Set(directionOdIds).size).toBe(expectedStaticProductCount)
    expect([...new Set(catalogProductSlugs)].sort()).toEqual([...new Set(directionSlugs)].sort())
    expect(directionCards.filter((card) => !card.hasAttribute("hidden"))).toHaveLength(8)
    expect(directionCards.filter((card) => card.hasAttribute("hidden"))).toHaveLength(expectedStaticProductCount - 8)

    const catalogFootwearSlugs = loadCatalogSlugs(sourceCatalog, "footwear")
    const staticFootwearSlugs = directionCards
      .filter((card) => card.dataset.productKind === "footwear")
      .map((card) => (card.dataset.odId ?? "").replace(/^product-card-/, ""))
    expect(catalogFootwearSlugs).toHaveLength(expectedFootwearProductCount)
    expect(new Set(catalogFootwearSlugs).size).toBe(expectedFootwearProductCount)
    expect([...catalogFootwearSlugs].sort()).toEqual([...staticFootwearSlugs].sort())

    const catalogApparelSlugs = loadCatalogSlugs(sourceCatalog, "apparel")
    const staticApparelSlugs = directionCards
      .filter((card) => card.dataset.productKind === "apparel")
      .map((card) => (card.dataset.odId ?? "").replace(/^product-card-/, ""))
    expect(catalogApparelSlugs).toHaveLength(expectedStaticApparelProductCount)
    expect(new Set(catalogApparelSlugs).size).toBe(expectedStaticApparelProductCount)
    expect([...catalogApparelSlugs].sort()).toEqual([...staticApparelSlugs].sort())

    const catalogAccessorySlugs = loadCatalogSlugs(sourceCatalog, "accessory")
    const staticAccessorySlugs = directionCards
      .filter((card) => card.dataset.productKind === "accessory")
      .map((card) => (card.dataset.odId ?? "").replace(/^product-card-/, ""))
    expect(staticAccessorySlugs).toHaveLength(expectedStaticAccessoryProductCount)
    expect(new Set(staticAccessorySlugs).size).toBe(expectedStaticAccessoryProductCount)
    expect(catalogAccessorySlugs).toEqual(expect.arrayContaining(staticAccessorySlugs))

    const activeSlugs = manifest.policy.activeBlueFieldGallery.activeSlugs
    expect(activeSlugs).toHaveLength(expectedStaticProductCount)
    expect(new Set(activeSlugs).size).toBe(expectedStaticProductCount)
    expect([...activeSlugs].sort()).toEqual([...directionGallerySlugs].sort())
    for (const slug of [...strictFootwearV1Slugs, ...batchThreeSlugs, ...batchFourSlugs, ...batchFiveSlugs, ...batchSixSlugs, ...batchSevenSlugs, ...batchEightSlugs, ...batchNineSlugs, ...batchTenSlugs, ...batchElevenSlugs, ...batchTwelveSlugs, ...accessoryBatchOneSlugs, ...accessoryBatchTwoSlugs, ...accessoryBatchThreeSlugs, ...accessoryBatchFourSlugs]) {
      const record = manifest.products.find((product) => product.sku === `static-${slug}`)
      expect(record, `${slug} is missing from the release manifest`).toBeDefined()
      expect(record!.productKind).toBe(expectedProductKind(slug))
      expect(record!.assets.map((asset) => asset.path)).toEqual(
        galleryPaths(slug).map((asset) => `assets/blue-field-v2/${asset}`),
      )
      for (const asset of record!.assets) {
        const bytes = await readFile(path.join(siteRoot, "site-release", asset.path))
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256)
      }
    }

    const expectedDisplayTypes: Record<string, string> = {
      "hoka-ora-recovery-slide-3": "Тапочки",
      "nike-calm-slide": "Тапочки",
      "oofos-ooahh-slide": "Тапочки",
      "crocs-mellow-recovery-slide": "Тапочки",
      "nike-mind-001-slide-black": "Мюли",
      "nike-zoom-vomero-5-photon-dust": "Кроссовки",
      "nike-dunk-low-panda": "Кеды",
      "adidas-samba-og-white-black": "Кеды",
      "adidas-gazelle-indoor-green": "Кеды",
      "adidas-campus-00s-core-black": "Кеды",
      "converse-chuck-70-high-black": "Кеды",
      "vans-old-skool-36-black-white": "Кеды",
      "timberland-field-boot-beef-broccoli": "Ботинки",
    }

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
      expect(card.dataset.productKind).toBe(expectedProductKind(slug))
      if (strictFootwearV1Slugs.includes(slug as (typeof strictFootwearV1Slugs)[number])) {
        expect(card.dataset.galleryContract).toBe("footwear-v1")
        expect(card.dataset.galleryLabels?.split("|")).toEqual(strictFootwearV1Labels)
      }
      if (expectedDisplayTypes[slug]) {
        expect(card.dataset.type).toBe(expectedDisplayTypes[slug])
      }
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
