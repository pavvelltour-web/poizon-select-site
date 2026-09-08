import { describe, expect, it, vi } from "vitest"

vi.mock("../../catalog-media/supplier-catalog-media.json", () => {
  const framesFor = (slug: string) => ["lateral", "medial", "three-quarter", "rear", "outsole"].map((angle, index) => ({
    position: index + 1, angle, file: `/catalog/supplier/${slug}-${index + 1}.webp`,
    visual_review: { status: "approved" },
  }))
  return { default: { products: [
    { slug: "exact-model", product_ref: "exact-reference", missing_angles: [], frames: framesFor("exact-model") },
    { slug: "empty-model", product_ref: "empty-reference", missing_angles: ["lateral", "medial", "three-quarter", "rear", "outsole"], frames: [] },
    { slug: "partial-model", product_ref: "partial-reference", missing_angles: ["outsole"], frames: framesFor("partial-model").slice(0, 4) },
    { slug: "unreviewed-model", product_ref: "unreviewed-reference", missing_angles: [], frames: framesFor("unreviewed-model").map((frame) => (
      frame.position === 3 ? { ...frame, visual_review: { status: "pending" } } : frame
    )) },
    { slug: "wrong-slug", product_ref: "wrong-slug-reference", missing_angles: [], frames: framesFor("another-model") },
    { slug: "wrong-file-position", product_ref: "wrong-file-position-reference", missing_angles: [], frames: framesFor("wrong-file-position").map((frame) => (
      { ...frame, file: `/catalog/supplier/wrong-file-position-${frame.position % 5 + 1}.webp` }
    )) },
    { slug: "wrong-position", product_ref: "wrong-position-reference", missing_angles: [], frames: framesFor("wrong-position").map((frame) => (
      frame.position === 3 ? { ...frame, position: 2 } : frame
    )) },
    { slug: "wrong-angle", product_ref: "wrong-angle-reference", missing_angles: [], frames: framesFor("wrong-angle").map((frame) => (
      frame.position === 3 ? { ...frame, angle: "unknown" } : frame
    )) },
    { slug: "missing-angle", product_ref: "missing-angle-reference", missing_angles: [], frames: framesFor("missing-angle").map((frame) => (
      frame.position === 3 ? { ...frame, angle: undefined } : frame
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
    ["empty-model", "empty-reference"],
    ["unreviewed-model", "unreviewed-reference"],
    ["unlisted-model", "unlisted-reference"],
  ])("keeps current originals for incomplete or unapproved %s", (slug, productRef) => {
    expect(getSupplierCatalogMedia({ slug, productRef, images: originals })).toBe(originals)
  })

  it.each(["wrong-slug", "wrong-file-position", "wrong-position", "wrong-angle", "missing-angle"])(
    "rejects an approved-looking set with %s instead of the exact five-view output contract", (slug) => {
      expect(getSupplierCatalogMedia({ slug, productRef: `${slug}-reference`, images: originals })).toBe(originals)
    },
  )
})
