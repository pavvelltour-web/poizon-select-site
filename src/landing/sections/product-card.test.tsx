import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { findProductBySlug } from "../../catalog/catalog"
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

    expect(product.gallery[1]?.src).toContain("03-side.png")
    expect(product.gallery[2]?.src).toContain("02-three-quarter.png")
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
