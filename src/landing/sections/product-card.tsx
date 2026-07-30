import { MoveRight } from "lucide-react"
import type { CSSProperties } from "react"

import type { CatalogProduct } from "../../catalog/catalog"
import {
  getDisplayPrice,
  getProductUse,
  kindLabels,
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
  const galleryPreview = product.gallery[1]?.src ?? product.fallbackImage

  return (
    <button
      className={`product-card ${featured ? "product-card--feature" : ""}`}
      type="button"
      data-category={product.category}
      style={{ "--card-index": index } as CSSProperties}
      onClick={(event) => openProduct(product, event.currentTarget)}
      aria-label={`Открыть карточку: ${product.brand} ${product.name}`}
    >
      <span className="product-card__visual">
        <img
          className="product-card__image product-card__image--primary"
          src={resolveAssetUrl(product.image)}
          width="1200"
          height="900"
          loading={index < 8 ? "eager" : "lazy"}
          decoding="async"
          alt=""
          onError={(event) => {
            setImageFallback(event, product.fallbackImage)
          }}
        />
        <img
          className="product-card__image product-card__image--alt"
          src={resolveAssetUrl(galleryPreview)}
          width="1200"
          height="900"
          loading="lazy"
          decoding="async"
          alt=""
          onError={(event) => {
            setImageFallback(event, product.fallbackImage)
          }}
        />
      </span>
      <span className="product-card__body">
        <span className="product-card__topline">
          <span className="product-card__brand">{product.brand}</span>
          <span className="product-card__kind">{kindLabels[product.kind]}</span>
        </span>
        <strong>{product.name}</strong>
        <span className="product-card__meta">{getProductUse(product)}</span>
        <span className="product-card__bottom">
          <span>
            <small>{price.label}</small>
            <b>{price.value}</b>
            <em>{price.detail}</em>
          </span>
          <span className="product-card__cta">
            Открыть
            <MoveRight aria-hidden="true" size={16} />
          </span>
        </span>
      </span>
    </button>
  )
}
