import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { findProductBySlug } from "../../catalog/catalog"
import { getProductTypeLabel } from "../landing-data"
import { ProductCard } from "./product-card"

function renderCard(slug: string) {
  const product = findProductBySlug(slug)
  if (!product) throw new Error(`Missing fixture product: ${slug}`)

  return {
    product,
    ...render(
      <ProductCard
        catalogPriceLookup={null}
        catalogStatus="loading"
        featured={false}
        index={0}
        product={product}
        publishedOffer={null}
      />,
    ),
  }
}

describe("ProductCard hover media", () => {
  it("uses logical photo three for footwear without changing photo two", () => {
    const { container, product } = renderCard("nike-sabrina-3")
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")
    const hoverFrame = container.querySelector(".product-pair")

    expect(product.gallery[1]?.src).toContain("catalog/gallery/nike-sabrina-3-2.webp")
    expect(product.gallery[2]?.src).toContain("catalog/gallery/nike-sabrina-3-3.webp")
    expect(hoverFrame).toHaveAttribute("data-hover-frame", "3")
    expect(hover).toHaveAttribute(
      "src",
      new URL(product.gallery[2]?.src ?? "", window.location.origin).toString(),
    )
  })

  it("uses logical photo three for slides because they are footwear", () => {
    const { container, product } = renderCard("nike-calm-slide")
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")

    expect(container.querySelector(".product-pair")).toHaveAttribute("data-hover-frame", "3")
    expect(hover).toHaveAttribute(
      "src",
      new URL(product.gallery[2]?.src ?? "", window.location.origin).toString(),
    )
  })

  it("keeps logical photo two as the hover view for non-footwear products", () => {
    const { container, product } = renderCard("adidas-crazyflight-shorts")
    const hover = container.querySelector<HTMLImageElement>(".product-pair img")

    expect(container.querySelector(".product-pair")).toHaveAttribute("data-hover-frame", "2")
    expect(hover).toHaveAttribute(
      "src",
      new URL(product.gallery[1]?.src ?? "", window.location.origin).toString(),
    )
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
