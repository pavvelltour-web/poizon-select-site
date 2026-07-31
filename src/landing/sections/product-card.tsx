import { MoveRight } from "lucide-react"
import { useState, type CSSProperties } from "react"

import type { CatalogProduct } from "../../catalog/catalog"
import {
  getDisplayPrice,
  getSourcingMode,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"

interface ProductCardProps {
  featured: boolean
  index: number
  product: CatalogProduct
  openProduct: (product: CatalogProduct, trigger: HTMLButtonElement) => void
}

export function ProductCard({
  featured,
  index,
  product,
  openProduct,
}: ProductCardProps) {
  const price = getDisplayPrice(product)
  const [mediaReady, setMediaReady] = useState(false)

  return (
    <button
      className={`product-card ${featured ? "product-card--feature" : ""}`}
      type="button"
      data-category={product.category}
      style={{ "--card-index": index } as CSSProperties}
      onClick={(event) => openProduct(product, event.currentTarget)}
      aria-label={`Открыть карточку: ${product.brand} ${product.name}`}
    >
      <span className={`product-card__visual ${mediaReady ? "product-card__visual--ready" : ""}`}>
        <img
          className="product-card__image"
          src={resolveAssetUrl(product.image)}
          width="1200"
          height="900"
          loading={index < 12 ? "eager" : "lazy"}
          decoding="async"
          alt=""
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
        <strong>{product.name}</strong>
        <span className="product-card__bottom">
          <span>
            <b>{price.value}</b>
            <em>{price.detail}</em>
          </span>
          <span className="product-card__cta">
            Смотреть
            <MoveRight aria-hidden="true" size={16} />
          </span>
        </span>
      </span>
    </button>
  )
}
