import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

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

describe("ProductCard hover media", () => {
  it("prioritizes only the first four primary card images", () => {
    const first = renderCard("nike-sabrina-3", 0)
    const later = renderCard("nike-sabrina-3", 4)

    expect(first.container.querySelector(".product-card__image")).toHaveAttribute("loading", "eager")
    expect(first.container.querySelector(".product-card__image")).toHaveAttribute("fetchpriority", "high")
    expect(later.container.querySelector(".product-card__image")).toHaveAttribute("loading", "lazy")
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

  it("retries a failed thumbnail once before using the fallback for primary and hover media", () => {
    const { container, product } = renderCard("nike-sabrina-3")
    const primary = container.querySelector<HTMLImageElement>(".product-card__image")
    if (!primary) throw new Error("Missing primary image")

    fireEvent.error(primary)
    expect(primary).not.toHaveAttribute("srcset")
    expect(primary).not.toHaveAttribute("sizes")
    expect(primary.src).toContain("catalog/thumbs/nike-sabrina-3-1-640.webp?v=")
    expect(primary.src).toContain("retry=1")

    fireEvent.error(primary)
    expect(primary.src).toContain(product.fallbackImage)

    fireEvent.focus(container.querySelector(".product-card__link")!)
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")
    if (!hover) throw new Error("Missing hover image")

    fireEvent.error(hover)
    expect(hover).not.toHaveAttribute("srcset")
    expect(hover).not.toHaveAttribute("sizes")
    expect(hover.src).toContain("catalog/thumbs/nike-sabrina-3-3-640.webp?v=")
    expect(hover.src).toContain("retry=1")

    fireEvent.error(hover)
    expect(hover.src).toContain(product.fallbackImage)
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
