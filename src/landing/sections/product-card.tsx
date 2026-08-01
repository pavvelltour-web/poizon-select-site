import { useState, type CSSProperties } from "react"

import type { CatalogProduct } from "../../catalog/catalog"
import type { CatalogPriceMap, PublishedCatalogItem } from "../cart"
import {
  getDisplayPrice,
  getProductPath,
  getProductTypeLabel,
  getSizeRangeLabel,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"

interface ProductCardProps {
  featured: boolean
  index: number
  product: CatalogProduct
  catalogPriceLookup: CatalogPriceMap | null
  catalogStatus: "loading" | "ready" | "failed"
  publishedOffer: PublishedCatalogItem | null
}
export function ProductCard({
  featured,
  index,
  product,
  catalogPriceLookup,
  catalogStatus,
  publishedOffer,
}: ProductCardProps) {
  const price = getDisplayPrice(product, catalogPriceLookup)
  const [mediaReady, setMediaReady] = useState(false)
  const sizeLabel = publishedOffer
    ? `${publishedOffer.sizes[0]}–${publishedOffer.sizes.at(-1)}`
    : getSizeRangeLabel(product)
  const sourcingMode = publishedOffer?.availability === "catalog_listed"
    ? publishedOffer.fulfillmentMode === "in_stock"
      ? "В наличии в России"
      : "Под заказ из Китая"
    : catalogStatus === "loading"
      ? "Предварительные данные"
      : "Недоступно для заказа"

  return (
    <article
      className={`product-card ${featured ? "product-card--feature" : ""}`}
      data-category={product.category}
      data-kind={product.kind}
      style={{ "--card-index": Math.min(index, 12) } as CSSProperties}
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
            loading="lazy"
            decoding="async"
            alt={`${product.brand} ${product.name}`}
            fetchPriority="auto"
            onLoad={() => setMediaReady(true)}
            onError={(event) => {
              setImageFallback(event, product.fallbackImage)
              setMediaReady(true)
            }}
          />
        </span>
        <span className="product-card__body">
          <span className="product-card__type">{getProductTypeLabel(product)}</span>
          <h3>{product.brand} {product.name}</h3>
          <span className="product-card__sizes">Размеры: {sizeLabel}</span>
          <span className="product-card__mode">{sourcingMode}</span>
          <span className="product-card__bottom">
            <span>
              <b>{price.value}</b>
              <em>{price.detail}</em>
            </span>
          </span>
        </span>
      </a>
    </article>
  )
}
