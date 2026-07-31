import { MoveRight } from "lucide-react"
import { useState, type CSSProperties } from "react"

import type { CatalogProduct } from "../../catalog/catalog"
import type { CatalogPriceMap } from "../cart"
import {
  getDisplayPrice,
  getProductPath,
  getSizeRangeLabel,
  getSourcingMode,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"

interface ProductCardProps {
  featured: boolean
  index: number
  product: CatalogProduct
  catalogPriceLookup: CatalogPriceMap | null
}
export function ProductCard({
  featured,
  index,
  product,
  catalogPriceLookup,
}: ProductCardProps) {
  const price = getDisplayPrice(product, catalogPriceLookup)
  const [mediaReady, setMediaReady] = useState(false)

  return (
    <article
      className={`product-card ${featured ? "product-card--feature" : ""}`}
      data-category={product.category}
      style={{ "--card-index": index } as CSSProperties}
    >
      <a
        className="product-card__link"
        href={getProductPath(product)}
        aria-label={`Открыть товар: ${product.brand} ${product.name}`}
      >
        <span className={`product-card__visual ${mediaReady ? "product-card__visual--ready" : ""}`}>
          <img
            className="product-card__image"
            src={resolveAssetUrl(product.image)}
            width="1200"
            height="900"
            loading={index < 12 ? "eager" : "lazy"}
            decoding="async"
            alt={`${product.brand} ${product.name}`}
            fetchPriority={index < 4 ? "high" : "auto"}
            onLoad={() => setMediaReady(true)}
            onError={(event) => {
              setImageFallback(event, product.fallbackImage)
              setMediaReady(true)
            }}
          />
        </span>
        <span className="product-card__body">
          <span className="product-card__topline">
            <span className="product-card__brand">{product.brand}</span>
            <span className="product-card__mode">{getSourcingMode(product)}</span>
          </span>
          <h3>{product.name}</h3>
          <span className="product-card__sizes">Размеры {getSizeRangeLabel(product)}</span>
          <span className="product-card__bottom">
            <span>
              <b>{price.value}</b>
              <em>{price.detail}</em>
            </span>
            <span className="product-card__cta">
              Подробнее
              <MoveRight aria-hidden="true" size={16} />
            </span>
          </span>
        </span>
      </a>
    </article>
  )
}
