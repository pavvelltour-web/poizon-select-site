import { Heart } from "lucide-react"
import { useState, type MouseEvent } from "react"

import type { CatalogProduct } from "../../catalog/catalog"
import type { PublishedCatalogItem } from "../cart"
import {
  getProductPath,
  getProductTypeLabel,
  getProductUse,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"
import { formatRub } from "../../catalog/catalog"
import type { StorefrontPoizonPrice } from "../landing-types"

interface ProductCardProps {
  featured: boolean
  index: number
  product: CatalogProduct
  catalogPoizonPrice: StorefrontPoizonPrice | null
  catalogPoizonPricesReady: boolean
  publishedOffer: PublishedCatalogItem | null
  favorite?: boolean
  onToggleFavorite?: (slug: string) => void
  onOpen?: (product: CatalogProduct, trigger: HTMLElement, preferredSize?: string) => void
}

export function ProductCard({
  index,
  product,
  catalogPoizonPrice,
  catalogPoizonPricesReady,
  publishedOffer,
  favorite = false,
  onToggleFavorite,
  onOpen,
}: ProductCardProps) {
  const [mediaReady, setMediaReady] = useState(false)
  const displayPrice = catalogPoizonPrice
    ? formatRub(catalogPoizonPrice.total_rub)
    : catalogPoizonPricesReady ? "Уточняется" : "Сверяем…"
  const primaryImage = resolveAssetUrl(product.image)
  // The third frame is the canonical front three-quarter pair view for footwear.
  // Keep the second gallery image untouched for its own product-gallery position.
  const hoverImageIndex = product.kind === "footwear" ? 2 : 1
  const hoverImage = resolveAssetUrl(product.gallery[hoverImageIndex]?.src ?? product.image)
  // A storefront price chip is not stock data.  Never render the bundled
  // catalogue size grid as if Poizon had confirmed it; only a server-verified
  // offer may expose actionable sizes on a static catalogue card.
  const sizes = publishedOffer?.liveProviderVerified && publishedOffer.sizes.length
    ? publishedOffer.sizes
    : []
  const cardSizes = (sizes.length >= 7 ? [sizes[2], sizes[4], sizes[6]] : sizes.slice(0, 3))
    .filter((size): size is string => Boolean(size))
  const sourceSizesConfirmed = cardSizes.length > 0 && publishedOffer?.availability === "supplier_verified"
  const eta = sourceSizesConfirmed && publishedOffer?.etaMinDays && publishedOffer.etaMaxDays
    ? `Доставка ${publishedOffer.etaMinDays}–${publishedOffer.etaMaxDays} дней`
    : "Размеры и наличие уточнит Telegram"

  const openProduct = (event: MouseEvent<HTMLElement>, preferredSize?: string) => {
    if (!onOpen || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpen(product, event.currentTarget, preferredSize)
  }

  return (
    <article
      className="product-card product-card--normalized"
      data-category={product.category}
      data-kind={product.kind}
      data-od-id={`product-card-${product.slug}`}
    >
      <a
        className="product-open product-card__link"
        href={getProductPath(product)}
        data-od-id={`open-product-${product.slug}`}
        aria-label={`Открыть товар: ${product.brand} ${product.name}. Цена ${displayPrice}. ${sourceSizesConfirmed ? "Размеры подтверждены источником" : "Размеры и наличие требуют проверки"}`}
        onClick={openProduct}
      >
        <span className={`product-media ${mediaReady ? "is-ready" : ""}`}>
          {index < 2 ? <span className="badge-stack"><span className="product-badge badge-choice">Выбор клиентов</span></span> : null}
          <img
            className="product-card__image"
            src={primaryImage}
            width="1600"
            height="1200"
            loading="lazy"
            decoding="async"
            alt=""
            onLoad={() => setMediaReady(true)}
            onError={(event) => {
              setImageFallback(event, product.fallbackImage)
              setMediaReady(true)
            }}
          />
          <span className="product-pair" aria-hidden="true" data-hover-frame={hoverImageIndex + 1}>
            <img
              src={hoverImage}
              width="1600"
              height="1200"
              alt=""
              loading="lazy"
              onError={(event) => setImageFallback(event, product.fallbackImage)}
            />
          </span>
        </span>
        <span className="product-info">
          <span className="sr-only product-card__type">{getProductTypeLabel(product)}</span>
          <span className="product-name">{product.kind === "footwear" ? "Кроссовки " : ""}{product.brand} {product.name}</span>
          <span className="product-use">{getProductUse(product)}</span>
          <span className="product-price-row">
            <span className="product-price">{displayPrice}</span>
            <span className="product-supply">
              {catalogPoizonPrice ? "Цена на 12 часов" : eta}
            </span>
          </span>
        </span>
      </a>
      <button
        className={`favorite-button ${favorite ? "is-active" : ""}`}
        type="button"
        data-od-id={`favorite-product-${product.slug}`}
        aria-label={`${favorite ? "Удалить" : "Добавить"} ${product.brand} ${product.name} ${favorite ? "из избранного" : "в избранное"}`}
        aria-pressed={favorite}
        onClick={() => onToggleFavorite?.(product.slug)}
      >
        <Heart aria-hidden="true" />
      </button>
      <div className="card-sizes">
        <span>{sourceSizesConfirmed ? `Размеры ${product.kind === "footwear" ? "EU" : ""}` : "Размеры и наличие"}</span>
        {sourceSizesConfirmed ? (
          <div className="card-size-options">
            {cardSizes.map((size) => (
              <button className="card-size-button" key={size} type="button" data-od-id={`size-${product.slug}-${size.replaceAll(".", "-")}`} onClick={(event) => openProduct(event, size)}>{size}</button>
            ))}
            <button className="card-size-button card-size-button--all" type="button" data-od-id={`size-${product.slug}-all`} onClick={(event) => openProduct(event)}>Все</button>
          </div>
        ) : (
          <p className="card-size-unverified">Уточнить в Telegram по актуальному запросу</p>
        )}
      </div>
    </article>
  )
}
