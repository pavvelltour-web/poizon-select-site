import { Heart } from "lucide-react"
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type SyntheticEvent } from "react"

import type { CatalogProduct } from "../../catalog/catalog"
import { getCardThumbnailUrl } from "../../catalog/card-thumbnail-versions"
import type { CatalogPriceMap, PublishedCatalogItem } from "../cart"
import {
  getDisplayPrice,
  getProductPath,
  getProductTypeLabel,
  getProductUse,
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
  favorite?: boolean
  onToggleFavorite?: (slug: string) => void
  onOpen?: (product: CatalogProduct, trigger: HTMLElement, preferredSize?: string) => void
}

function fallbackSizes(kind: CatalogProduct["kind"]): readonly string[] {
  if (kind === "apparel") return ["XS", "S", "M", "L", "XL"]
  if (kind === "accessory") return ["Один размер"]
  return ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"]
}

function retryThumbnailOnce(
  event: SyntheticEvent<HTMLImageElement>,
  thumbnailUrl: string,
): boolean {
  const image = event.currentTarget
  if (image.dataset.thumbnailRetry === "1") return false

  image.dataset.thumbnailRetry = "1"
  image.removeAttribute("srcset")
  image.removeAttribute("sizes")
  image.src = `${thumbnailUrl}${thumbnailUrl.includes("?") ? "&" : "?"}retry=1`
  return true
}

export function ProductCard({
  index,
  product,
  catalogPriceLookup,
  catalogStatus,
  publishedOffer,
  favorite = false,
  onToggleFavorite,
  onOpen,
}: ProductCardProps) {
  const price = getDisplayPrice(product, catalogPriceLookup)
  const [mediaReady, setMediaReady] = useState(false)
  const [hoverRequested, setHoverRequested] = useState(false)
  const [hoverReady, setHoverReady] = useState(false)
  const hoverImageRef = useRef<HTMLImageElement | null>(null)
  const displayPrice = price.value
  const primaryImage = resolveAssetUrl(product.image)
  // The third frame is the canonical front three-quarter pair view for footwear.
  // Keep the second gallery image untouched for its own product-gallery position.
  const hoverImageIndex = product.kind === "footwear" ? 2 : 1
  const hoverImage = resolveAssetUrl(product.gallery[hoverImageIndex]?.src ?? product.image)
  const thumbnail = (position: number, width: number) =>
    resolveAssetUrl(getCardThumbnailUrl(product.slug, position, width))
  const primaryThumbnail640 = thumbnail(1, 640)
  const primaryThumbnail960 = thumbnail(1, 960)
  const primaryThumbnail1280 = thumbnail(1, 1280)
  const hoverThumbnail640 = thumbnail(hoverImageIndex + 1, 640)
  const hoverThumbnail960 = thumbnail(hoverImageIndex + 1, 960)
  const hoverThumbnail1280 = thumbnail(hoverImageIndex + 1, 1280)
  const sizes = publishedOffer?.sizes.length ? publishedOffer.sizes : fallbackSizes(product.kind)
  const cardSizes = (sizes.length >= 7 ? [sizes[2], sizes[4], sizes[6]] : sizes.slice(0, 3))
    .filter((size): size is string => Boolean(size))
  const available = !(
    catalogStatus === "ready" &&
    (!publishedOffer || publishedOffer.availability !== "catalog_listed")
  )
  const productDisplayName = product.kind === "footwear" && product.category === "recovery"
    ? `${product.brand} ${product.name}`
    : `${product.kind === "footwear" ? "Кроссовки " : ""}${product.brand} ${product.name}`
  const eta = publishedOffer?.etaMinDays && publishedOffer.etaMaxDays
    ? `Доставка ${publishedOffer.etaMinDays}–${publishedOffer.etaMaxDays} дней`
    : "Доставка 10–18 дней"

  const openProduct = (event: MouseEvent<HTMLElement>, preferredSize?: string) => {
    if (!onOpen || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpen(product, event.currentTarget, preferredSize)
  }

  const requestHover = () => {
    if (hoverImage !== primaryImage) setHoverRequested(true)
  }

  const requestHoverOnPointer = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") requestHover()
  }

  useEffect(() => {
    const hoverElement = hoverImageRef.current
    if (hoverRequested && hoverElement?.complete && hoverElement.naturalWidth > 0) {
      setHoverReady(true)
    }
  }, [hoverRequested])

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
        aria-label={`Открыть товар: ${product.brand} ${product.name}. Цена ${displayPrice}${available ? "" : ". Нет в продаже"}`}
        onClick={openProduct}
        onFocus={requestHover}
        onPointerEnter={requestHoverOnPointer}
      >
        <span className={`product-media ${mediaReady ? "is-ready" : ""} ${hoverReady ? "is-hover-ready" : ""}`}>
          {index < 2 ? <span className="badge-stack"><span className="product-badge badge-choice">Выбор клиентов</span></span> : null}
          <img
            className="product-card__image"
            src={primaryThumbnail640}
            srcSet={`${primaryThumbnail640} 640w, ${primaryThumbnail960} 960w, ${primaryThumbnail1280} 1280w`}
            sizes="(max-width: 620px) 50vw, (max-width: 980px) 33vw, (max-width: 1680px) 25vw, 20vw"
            width="1600"
            height="1200"
            loading={index < 4 ? "eager" : "lazy"}
            fetchPriority={index < 2 ? "high" : "auto"}
            decoding="async"
            alt=""
            onLoad={() => setMediaReady(true)}
            onError={(event) => {
              if (retryThumbnailOnce(event, primaryThumbnail640)) return
              setImageFallback(event, product.fallbackImage)
              setMediaReady(true)
            }}
          />
          <span className="product-pair" aria-hidden="true" data-hover-frame={hoverImageIndex + 1}>
            {hoverRequested ? (
              <img
                ref={hoverImageRef}
                src={hoverThumbnail640}
                srcSet={`${hoverThumbnail640} 640w, ${hoverThumbnail960} 960w, ${hoverThumbnail1280} 1280w`}
                sizes="(max-width: 620px) 50vw, (max-width: 980px) 33vw, (max-width: 1680px) 25vw, 20vw"
                width="1600"
                height="1200"
                alt=""
                decoding="async"
                onLoad={() => setHoverReady(true)}
                onError={(event) => {
                  if (retryThumbnailOnce(event, hoverThumbnail640)) return
                  setImageFallback(event, product.fallbackImage)
                }}
              />
            ) : null}
          </span>
        </span>
        <span className="product-info">
          <span className="sr-only product-card__type">{getProductTypeLabel(product)}</span>
          <span className="product-name">{productDisplayName}</span>
          <span className="product-use">{getProductUse(product)}</span>
          <span className="product-price-row">
            <span className="product-price">{displayPrice}</span>
            <span className="product-supply">{available ? eta : "Нет в продаже"}</span>
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
        <span>Размеры {product.kind === "footwear" ? "EU" : ""}</span>
        <div className="card-size-options">
          {cardSizes.map((size) => (
            <button className="card-size-button" key={size} type="button" data-od-id={`size-${product.slug}-${size.replaceAll(".", "-")}`} onClick={(event) => openProduct(event, size)}>{size}</button>
          ))}
          <button className="card-size-button card-size-button--all" type="button" data-od-id={`size-${product.slug}-all`} onClick={(event) => openProduct(event)}>Все</button>
        </div>
      </div>
    </article>
  )
}
