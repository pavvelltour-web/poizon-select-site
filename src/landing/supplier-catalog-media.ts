import manifest from "../../catalog-media/supplier-catalog-media.json"

interface SupplierMediaIdentity {
  slug: string
  productRef: string
  images: readonly string[]
}

interface ReviewedProductMedia {
  slug: string
  product_ref: string
  missing_angles: readonly string[]
  frames: readonly {
    position: number
    angle: string
    file: string
    visual_review: { status: string }
  }[]
}

const requiredAngles = ["lateral", "medial", "three-quarter", "rear", "outsole"]

const products: readonly ReviewedProductMedia[] = manifest.products
const approvedMedia = new Map(products.flatMap((product) => {
  const frames = [...product.frames].sort((left, right) => left.position - right.position)
  if (product.missing_angles.length !== 0 || frames.length !== requiredAngles.length ||
    frames.some((frame, index) => frame.position !== index + 1 ||
      frame.angle !== requiredAngles[index] || frame.visual_review.status !== "approved")) return []
  return [[product.slug, { productRef: product.product_ref, images: frames.map((frame) => frame.file) }] as const]
}))

/** Curated media belongs to one exact public catalogue identity. */
export function getSupplierCatalogMedia(product: SupplierMediaIdentity): readonly string[] {
  const media = approvedMedia.get(product.slug)
  return media?.productRef === product.productRef ? media.images : product.images
}
