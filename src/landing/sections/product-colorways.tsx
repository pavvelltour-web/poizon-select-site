import type { CatalogProduct } from "../../catalog/catalog"
import type { AvailableCatalogColorway } from "../catalog-colorways"
import { getProductPath, resolveAssetUrl } from "../landing-data"

export function ProductColorways({ product, variants, compact = false }: {
  product: CatalogProduct
  variants: readonly AvailableCatalogColorway[]
  compact?: boolean
}) {
  if (variants.length < 2) return null
  const current = variants.find((variant) => variant.product.slug === product.slug)
  return (
    <nav className={`product-colorways${compact ? " product-colorways--compact" : ""}`} aria-label={`Цвета ${product.brand} ${product.name}`}>
      <p>Цвет{current ? `: ${current.colorLabel}` : "а"}</p>
      <div className="product-colorways__options">
        {variants.map((variant) => (
          <a
            key={variant.productRef}
            href={getProductPath(variant.product)}
            aria-label={`Цвет: ${variant.colorLabel}`}
            aria-current={variant.product.slug === product.slug ? "page" : undefined}
            title={variant.colorLabel}
          >
            <img src={resolveAssetUrl(variant.product.image)} width="64" height="48" alt="" loading="lazy" />
            {!compact ? <span>{variant.colorLabel}</span> : null}
          </a>
        ))}
      </div>
    </nav>
  )
}
