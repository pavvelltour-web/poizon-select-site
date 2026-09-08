import { describe, expect, it, vi } from "vitest"

vi.mock("../../catalog-media/supplier-catalog-media.json", () => {
  const frames = ["lateral", "medial", "three-quarter", "rear", "outsole"].map((angle, index) => ({
    position: index + 1, angle, file: `/catalog/supplier/exact-model-${index + 1}.webp`,
    visual_review: { status: "approved" },
  }))
  return { default: { products: [
    { slug: "exact-model", product_ref: "exact-reference", missing_angles: [], frames },
    { slug: "partial-model", product_ref: "partial-reference", missing_angles: ["outsole"], frames: frames.slice(0, 4) },
    { slug: "unreviewed-model", product_ref: "unreviewed-reference", missing_angles: [], frames: frames.map((frame) => (
      frame.position === 3 ? { ...frame, visual_review: { status: "pending" } } : frame
    )) },
  ] } }
})

import { getSupplierCatalogMedia } from "./supplier-catalog-media"

const originals = ["https://cdn.poizon.com/current-exact-original.jpg"]

describe("reviewed supplier media resolution", () => {
  it("resolves all five ordered views for the exact approved identity", () => {
    expect(getSupplierCatalogMedia({ slug: "exact-model", productRef: "exact-reference", images: originals }))
      .toEqual([1, 2, 3, 4, 5].map((position) => `/catalog/supplier/exact-model-${position}.webp`))
  })

  it("keeps current originals when the same slug belongs to a different product reference", () => {
    expect(getSupplierCatalogMedia({ slug: "exact-model", productRef: "different-reference", images: originals })).toBe(originals)
  })

  it.each([
    ["partial-model", "partial-reference"],
    ["unreviewed-model", "unreviewed-reference"],
    ["unlisted-model", "unlisted-reference"],
  ])("keeps current originals for incomplete or unapproved %s", (slug, productRef) => {
    expect(getSupplierCatalogMedia({ slug, productRef, images: originals })).toBe(originals)
  })
})
