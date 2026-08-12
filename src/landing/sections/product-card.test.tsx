import { act, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { findProductBySlug } from "../../catalog/catalog"
import { getProductTypeLabel } from "../landing-data"
import { ProductCard } from "./product-card"

function renderCard(slug: string, index = 0) {
  const product = findProductBySlug(slug)
  if (!product) throw new Error(`Missing fixture product: ${slug}`)

  return {
    product,
    ...render(
      <ProductCard
        catalogPriceLookup={null}
        catalogStatus="loading"
        featured={false}
        index={index}
        product={product}
        publishedOffer={null}
      />,
    ),
  }
}

function advanceImageRetry(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds)
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe("ProductCard hover media", () => {
  it("prioritizes only the first two primary card images", () => {
    const first = renderCard("nike-sabrina-3", 0)
    const second = renderCard("nike-sabrina-3", 1)
    const later = renderCard("nike-sabrina-3", 2)

    expect(first.container.querySelector(".product-card__image")).toHaveAttribute("loading", "eager")
    expect(first.container.querySelector(".product-card__image")).toHaveAttribute("fetchpriority", "high")
    expect(second.container.querySelector(".product-card__image")).toHaveAttribute("loading", "eager")
    expect(later.container.querySelector(".product-card__image")).toHaveAttribute("loading", "lazy")
    expect(later.container.querySelector(".product-card__image")).toHaveAttribute("fetchpriority", "auto")
  })

  it("uses logical photo three for footwear without changing photo two", () => {
    const { container, product } = renderCard("nike-sabrina-3")
    const hoverFrame = container.querySelector(".product-pair")
    const primary = container.querySelector<HTMLImageElement>(".product-card__image")

    expect(product.gallery[1]?.src).toContain("catalog/gallery/nike-sabrina-3-2.webp")
    expect(product.gallery[2]?.src).toContain("catalog/gallery/nike-sabrina-3-3.webp")
    expect(hoverFrame).toHaveAttribute("data-hover-frame", "3")
    expect(container.querySelector(".product-pair img")).toBeNull()
    expect(primary).toHaveAttribute("src", expect.stringContaining("catalog/thumbs/nike-sabrina-3-1-640.webp"))
    expect(primary).toHaveAttribute("srcset", expect.stringContaining("nike-sabrina-3-1-960.webp"))

    fireEvent.focus(container.querySelector(".product-card__link")!)
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")
    expect(hover).toHaveAttribute(
      "src",
      expect.stringContaining("catalog/thumbs/nike-sabrina-3-3-640.webp"),
    )
  })

  it("uses logical photo three for slides because they are footwear", () => {
    const { container } = renderCard("nike-calm-slide")

    expect(container.querySelector(".product-pair")).toHaveAttribute("data-hover-frame", "3")
    fireEvent.focus(container.querySelector(".product-card__link")!)
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")
    expect(hover).toHaveAttribute(
      "src",
      expect.stringContaining("catalog/thumbs/nike-calm-slide-3-640.webp"),
    )
  })

  it("keeps logical photo two as the hover view for non-footwear products", () => {
    const { container } = renderCard("adidas-crazyflight-shorts")

    expect(container.querySelector(".product-pair")).toHaveAttribute("data-hover-frame", "2")
    fireEvent.focus(container.querySelector(".product-card__link")!)
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")
    expect(hover).toHaveAttribute(
      "src",
      expect.stringContaining("catalog/thumbs/adidas-crazyflight-shorts-2-640.webp"),
    )
  })

  it.each(["rocktape-kinesiology-tape-black", "theraband-resistance-band-set"])(
    "ships a versioned logical photo two thumbnail for recovery accessory %s",
    (slug) => {
      const { container } = renderCard(slug)

      fireEvent.focus(container.querySelector(".product-card__link")!)
      const hover = container.querySelector<HTMLImageElement>(".product-pair img")
      expect(hover?.src).toContain(`catalog/thumbs/${slug}-2-640.webp?v=`)
    },
  )

  it("waits for a loaded hover thumbnail before allowing the visual swap", () => {
    const { container } = renderCard("nike-sabrina-3")
    const media = container.querySelector(".product-media")
    const link = container.querySelector(".product-card__link")!

    fireEvent.focus(link)
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")
    if (!hover) throw new Error("Missing hover image")

    expect(media).not.toHaveClass("is-hover-ready")
    fireEvent.load(hover)
    expect(media).toHaveClass("is-hover-ready")
  })

  it("backs off through compact thumbnail candidates before using the matching full frame", () => {
    vi.useFakeTimers()
    const { container, product } = renderCard("nike-sabrina-3")
    const primary = container.querySelector<HTMLImageElement>(".product-card__image")
    if (!primary) throw new Error("Missing primary image")

    fireEvent.error(primary)
    expect(container.querySelector(".product-media")).toHaveClass("is-media-retrying")
    expect(container.querySelector(".product-media__loading")).not.toBeNull()
    advanceImageRetry(180)
    expect(container.querySelector(".product-media")).not.toHaveClass("is-media-retrying")
    expect(primary).not.toHaveAttribute("srcset")
    expect(primary).not.toHaveAttribute("sizes")
    expect(primary.src).toContain("catalog/thumbs/nike-sabrina-3-1-640.webp?v=")
    expect(primary.src).toContain("retry=1")

    fireEvent.error(primary)
    advanceImageRetry(560)
    expect(primary.src).toContain("catalog/thumbs/nike-sabrina-3-1-960.webp?v=")
    expect(primary.src).toContain("retry=2")

    fireEvent.error(primary)
    advanceImageRetry(0)
    expect(primary.src).toContain(product.fallbackImage)

    fireEvent.focus(container.querySelector(".product-card__link")!)
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")
    if (!hover) throw new Error("Missing hover image")

    fireEvent.error(hover)
    advanceImageRetry(180)
    expect(hover).not.toHaveAttribute("srcset")
    expect(hover).not.toHaveAttribute("sizes")
    expect(hover.src).toContain("catalog/thumbs/nike-sabrina-3-3-640.webp?v=")
    expect(hover.src).toContain("retry=1")

    fireEvent.error(hover)
    advanceImageRetry(560)
    expect(hover.src).toContain("catalog/thumbs/nike-sabrina-3-3-960.webp?v=")
    expect(hover.src).toContain("retry=2")

    fireEvent.error(hover)
    advanceImageRetry(0)
    expect(hover.src).toContain(product.gallery[2]?.src ?? "")
    fireEvent.load(hover)
    expect(container.querySelector(".product-media")).toHaveClass("is-hover-ready")
  })

  it("keeps photo two as the final hover fallback for apparel", () => {
    vi.useFakeTimers()
    const { container, product } = renderCard("adidas-crazyflight-shorts")

    fireEvent.focus(container.querySelector(".product-card__link")!)
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")
    if (!hover) throw new Error("Missing hover image")

    fireEvent.error(hover)
    advanceImageRetry(180)
    fireEvent.error(hover)
    advanceImageRetry(560)
    fireEvent.error(hover)
    advanceImageRetry(0)

    expect(hover.src).toContain(product.gallery[1]?.src ?? "")
  })

  it("shows a nonblank media fallback only after every primary candidate fails", () => {
    vi.useFakeTimers()
    const { container } = renderCard("nike-sabrina-3")
    const primary = container.querySelector<HTMLImageElement>(".product-card__image")
    if (!primary) throw new Error("Missing primary image")

    fireEvent.error(primary)
    advanceImageRetry(180)
    fireEvent.error(primary)
    advanceImageRetry(560)
    fireEvent.error(primary)
    advanceImageRetry(0)
    fireEvent.error(primary)

    expect(container.querySelector(".product-media")).toHaveClass("is-media-failed")
    expect(container.querySelector(".product-media__error")).not.toBeNull()
  })
})

describe("Recovery footwear naming", () => {
  it("builds the natural OOFOS modal title without duplicate footwear wording", () => {
    const product = findProductBySlug("oofos-ooahh-slide")
    if (!product) throw new Error("Missing OOFOS fixture product")

    expect(product.name).toBe("OOahh")
    expect(`${getProductTypeLabel(product)} ${product.brand} ${product.name}`).toBe(
      "Тапочки OOFOS OOahh",
    )
  })

  it.each([
    "nike-calm-slide",
    "crocs-mellow-recovery-slide",
    "hoka-ora-recovery-slide-3",
    "nike-mind-001-slide-black",
  ])("keeps a sensible slipper type for %s", (slug) => {
    const product = findProductBySlug(slug)
    if (!product) throw new Error(`Missing recovery fixture product: ${slug}`)

    expect(getProductTypeLabel(product)).toBe("Тапочки")
  })
})
