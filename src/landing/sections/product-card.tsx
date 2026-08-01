import { useState, type CSSProperties } from "react"

import type { CatalogProduct } from "../../catalog/catalog"
import type { CatalogPriceMap, PublishedCatalogItem } from "../cart"
import {
  getDisplayPrice,
  getProductPath,
  getProductTypeLabel,
  getProductVariantLabel,
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
  const variant = getProductVariantLabel(product)
  const priceIsPublished =
    catalogStatus === "ready" && publishedOffer?.availability === "catalog_listed"
  const displayPrice = priceIsPublished || catalogStatus === "loading" ? price.value : "—"
  const exceptionalStatus =
    catalogStatus === "failed"
      ? { text: "Заказ временно недоступен", tone: "alert" }
      : catalogStatus === "loading"
        ? { text: "Проверяем цену и наличие", tone: "muted" }
        : !publishedOffer || publishedOffer.availability !== "catalog_listed"
          ? { text: "Нет в продаже", tone: "alert" }
          : null

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
          {variant ? <span className="product-card__variant">{variant}</span> : null}
          {exceptionalStatus ? (
            <span className="product-card__status" data-tone={exceptionalStatus.tone}>
              {exceptionalStatus.text}
            </span>
          ) : null}
          <span className="product-card__bottom">
            <span>
              <b>{displayPrice}</b>
            </span>
          </span>
        </span>
      </a>
    </article>
  )
}
