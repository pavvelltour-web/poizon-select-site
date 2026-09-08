import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../catalog-media/supplier-catalog-media.json", () => {
  const angles = ["lateral", "medial", "three-quarter", "rear", "outsole"]
  const frames = (slug: string) => angles.map((angle, index) => ({
    position: index + 1,
    angle,
    file: `/catalog/supplier/${slug}-${index + 1}.webp`,
    visual_review: { status: "approved" },
  }))
  return { default: { products: [
    {
      slug: "supplier-approved-model", product_ref: "a".repeat(64), missing_angles: [],
      frames: frames("supplier-approved-model").reverse(),
    },
    {
      slug: "supplier-four-frames", product_ref: "b".repeat(64), missing_angles: [],
      frames: frames("supplier-four-frames").slice(0, 4),
    },
    {
      slug: "supplier-missing-angle", product_ref: "c".repeat(64), missing_angles: ["rear"],
      frames: frames("supplier-missing-angle"),
    },
    {
      slug: "supplier-invalid-angle", product_ref: "d".repeat(64), missing_angles: [],
      frames: frames("supplier-invalid-angle").map((frame) => frame.position === 4 ? { ...frame, angle: "" } : frame),
    },
    {
      slug: "supplier-unapproved-frame", product_ref: "e".repeat(64), missing_angles: [],
      frames: frames("supplier-unapproved-frame").map((frame) => frame.position === 3
        ? { ...frame, visual_review: { status: "pending" } } : frame),
    },
    {
      slug: "supplier-wrong-file-slug", product_ref: "7".repeat(64), missing_angles: [],
      frames: frames("supplier-wrong-file-slug").map((frame) => frame.position === 3
        ? { ...frame, file: "/catalog/supplier/supplier-other-model-3.webp" } : frame),
    },
    {
      slug: "supplier-wrong-file-position", product_ref: "6".repeat(64), missing_angles: [],
      frames: frames("supplier-wrong-file-position").map((frame) => frame.position === 3
        ? { ...frame, file: "/catalog/supplier/supplier-wrong-file-position-4.webp" } : frame),
    },
    {
      slug: "nike-kd-18", product_ref: "f".repeat(64), missing_angles: [],
      frames: frames("nike-kd-18"),
    },
  ] } }
})

import { publicCatalogProducts } from "../catalog/catalog"
import { LandingPage } from "./landing-page"
import { ProductCard } from "./sections/product-card"
import { mergeSupplierCatalog, parseSupplierCatalog } from "./supplier-catalog"
import { getSupplierCatalogMedia } from "./supplier-catalog-media"

function sourceProduct(slug: string, productRef: string) {
  const [product] = parseSupplierCatalog([{
    slug,
    product_ref: productRef,
    source: "poizon",
    brand: "Nike",
    name: "Nike Reviewed supplier model",
    article: "EXACT-SPU-REFERENCE",
    kind: "footwear",
    category: "basketball",
    images: [
      `https://cdn.poizon.com/${slug}-current-front.jpg`,
      `https://cdn.poizon.com/${slug}-current-rear.jpg`,
    ],
  }])
  expect(product).toBeDefined()
  return product!
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("supplier catalogue merge with reviewed media", () => {
  it("uses all five approved frames in position order for an exact 64-hex product identity", () => {
    const supplier = sourceProduct("supplier-approved-model", "a".repeat(64))
    const originalImages = [...supplier.images]
    const expectedImages = [
      "/catalog/supplier/supplier-approved-model-1.webp",
      "/catalog/supplier/supplier-approved-model-2.webp",
      "/catalog/supplier/supplier-approved-model-3.webp",
      "/catalog/supplier/supplier-approved-model-4.webp",
      "/catalog/supplier/supplier-approved-model-5.webp",
    ]

    expect(getSupplierCatalogMedia(supplier)).toEqual(expectedImages)
    const [merged] = mergeSupplierCatalog([], [supplier])
    expect(merged.supplierProductRef).toBe(supplier.productRef)
    expect(merged.image).toBe(expectedImages[0])
    expect(merged.fallbackImage).toBe(expectedImages[0])
    expect(merged.gallery.map((frame) => frame.src)).toEqual(expectedImages)
    expect(merged.gallery).toHaveLength(5)
    expect(supplier.images).toEqual(originalImages)
  })

  it.each([
    ["different exact reference", "supplier-approved-model", "9".repeat(64)],
    ["only four frames", "supplier-four-frames", "b".repeat(64)],
    ["declared missing angle", "supplier-missing-angle", "c".repeat(64)],
    ["missing frame angle", "supplier-invalid-angle", "d".repeat(64)],
    ["unapproved frame", "supplier-unapproved-frame", "e".repeat(64)],
    ["another product's filename", "supplier-wrong-file-slug", "7".repeat(64)],
    ["incorrect frame position filename", "supplier-wrong-file-position", "6".repeat(64)],
    ["no manifest entry", "supplier-unlisted-model", "8".repeat(64)],
  ])("preserves the incoming hero, fallback and gallery for %s", (_reason, slug, productRef) => {
    const supplier = sourceProduct(slug, productRef)
    expect(getSupplierCatalogMedia(supplier)).toBe(supplier.images)

    const [merged] = mergeSupplierCatalog([], [supplier])
    expect(merged.image).toBe(supplier.images[0])
    expect(merged.fallbackImage).toBe(supplier.images[0])
    expect(merged.gallery.map((frame) => frame.src)).toEqual(supplier.images)
    expect(merged.gallery).toHaveLength(2)
  })

  it("leaves a legacy original as the same unchanged object even when reviewed supplier media uses its slug", () => {
    const original = publicCatalogProducts.find((product) => product.slug === "nike-kd-18")!
    const before = structuredClone(original)
    const sameSlug = sourceProduct(original.slug, "f".repeat(64))
    const addition = sourceProduct("supplier-approved-model", "a".repeat(64))
    const merged = mergeSupplierCatalog([original], [sameSlug, addition])

    expect(merged).toHaveLength(2)
    expect(merged[0]).toBe(original)
    expect(original).toEqual(before)
    expect(merged[1].slug).toBe(addition.slug)
    expect(merged[1].gallery).toHaveLength(5)
  })

  it("resolves the card hero and focus-loaded third frame from the site root on a nested product route", () => {
    const supplier = sourceProduct("supplier-approved-model", "a".repeat(64))
    const [product] = mergeSupplierCatalog([], [supplier])
    window.history.replaceState(null, "", `/product/${supplier.slug}`)
    const { container } = render(createElement(ProductCard, {
      product,
      featured: false,
      index: 0,
      catalogPriceLookup: null,
      catalogStatus: "ready",
      publishedOffer: null,
    }))
    const primary = container.querySelector<HTMLImageElement>(".product-card__image")!
    expect(primary.src).toBe(`${window.location.origin}/catalog/supplier/supplier-approved-model-1.webp`)
    expect(container.querySelector(".product-pair img")).toBeNull()

    fireEvent.focus(screen.getByRole("link", { name: /^Открыть товар: Nike Reviewed supplier model\./ }))
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")!
    expect(hover).not.toBeNull()
    expect(hover.src).toBe(`${window.location.origin}/catalog/supplier/supplier-approved-model-3.webp`)
    expect([primary, hover].every((image) => new URL(image.src).pathname !== "/catalog/supplier/"))
      .toBe(true)
  })

  it("opens approved media on a direct nested product URL and selects the fifth canonical frame", async () => {
    const user = userEvent.setup()
    const supplier = sourceProduct("supplier-approved-model", "a".repeat(64))
    const payload = {
      version: "approved-media-nested-route-v1",
      catalog_mode: "curated_live_poizon",
      snapshot_hours: 12,
      catalog_count: 1,
      items: [],
      order_creation_enabled: false,
      online_payment_enabled: false,
      catalog_statuses: {
        [supplier.slug]: { status: "unverified", source: "poizon", checked_at: null, expires_at: null },
      },
      catalog_products: [{
        slug: supplier.slug,
        product_ref: supplier.productRef,
        source: "poizon",
        brand: supplier.brand,
        name: supplier.name,
        article: supplier.article,
        kind: supplier.kind,
        category: supplier.category,
        images: supplier.images,
      }],
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
    window.history.replaceState(null, "", `/product/${supplier.slug}`)
    render(createElement(LandingPage, { configuredBotUsername: null }))
    const dialog = await screen.findByRole("dialog", { name: /Nike Reviewed supplier model$/ })
    const mainImage = within(dialog).getByRole("img", { name: "Nike Reviewed supplier model, фото 1" }) as HTMLImageElement
    const expectedImages = [1, 2, 3, 4, 5].map((position) =>
      `${window.location.origin}/catalog/supplier/supplier-approved-model-${position}.webp`)
    expect(mainImage.src).toBe(expectedImages[0])
    const thumbnails = within(dialog).getByLabelText("Миниатюры фото")
    expect([...thumbnails.querySelectorAll<HTMLImageElement>("img")].map((image) => image.src))
      .toEqual(expectedImages)
    expect([...dialog.querySelectorAll<HTMLImageElement>("img")].every((image) =>
      new URL(image.src).pathname !== "/catalog/supplier/")).toBe(true)

    await user.click(within(thumbnails).getByRole("button", { name: /^Показать фото 5:/ }))
    const lastImage = within(dialog).getByRole("img", { name: "Nike Reviewed supplier model, фото 5" }) as HTMLImageElement
    expect(lastImage.src).toBe(expectedImages[4])
    expect(within(thumbnails).getByRole("button", { name: /^Показать фото 5:/ }))
      .toHaveAttribute("aria-current", "true")
    expect(window.location.pathname).toBe(`/product/${supplier.slug}`)
  })
})
