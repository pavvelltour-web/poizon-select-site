import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Send,
  ShoppingBag,
  Truck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { CatalogProduct } from "../../catalog/catalog"
import {
  getProductGalleryAngleLabel,
  getProductTypeLabel,
  getProductUse,
  kindLabels,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"
import type { StorefrontState } from "../landing-types"
import { buildTelegramBotUrl } from "../order-request"
import { useProductLightbox } from "../use-product-lightbox"

interface ProductDetailPageProps {
  product: CatalogProduct | null
  storefront: StorefrontState
}

export function ProductDetailPage({ product, storefront }: ProductDetailPageProps) {
  const touchStartX = useRef<number | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)

  const gallery = product?.gallery.slice(0, 6) ?? []
  const currentImage = gallery[imageIndex] ?? gallery[0] ?? null

  const previousImage = () => {
    if (gallery.length <= 1) return
    setImageIndex((index) => (index === 0 ? gallery.length - 1 : index - 1))
  }

  const nextImage = () => {
    if (gallery.length <= 1) return
    setImageIndex((index) => (index + 1 >= gallery.length ? 0 : index + 1))
  }

  const lightbox = useProductLightbox({
    imageKey: currentImage?.src ?? product?.fallbackImage ?? "",
    previousImage,
    nextImage,
  })

  useEffect(() => {
    setImageIndex(0)
    setSelectedSize(null)
  }, [product?.slug])

  if (!product) {
    return (
      <article className="pdp-not-found" id="route-main">
        <p>Товар не найден</p>
        <h1>Такой страницы нет.</h1>
        <a className="button button--primary" href="/#catalog">
          Вернуться к товарам
        </a>
      </article>
    )
  }

  const price = storefront.getPoizonDisplayPrice(product)
  const botOrderUrl = buildTelegramBotUrl(storefront.botUsername, `sku_${product.slug}`)
  const publishedOffer = storefront.catalogPriceState.items[product.slug]
  const catalogReady =
    storefront.catalogPriceState.status === "ready" &&
    publishedOffer?.availability === "catalog_listed"
  const sizeOptions = catalogReady ? publishedOffer.sizes : []
  const orderCreationEnabled =
    catalogReady && storefront.catalogPriceState.orderCreationEnabled
  const sourcingMode = publishedOffer
    ? publishedOffer.fulfillmentMode === "in_stock"
      ? "В наличии в России"
      : "Под заказ из Китая"
    : storefront.catalogPriceState.status === "loading"
      ? "Проверяем данные"
      : "Недоступно для заказа"
  const eta = publishedOffer?.etaMinDays && publishedOffer.etaMaxDays
    ? `От ${publishedOffer.etaMinDays} до ${publishedOffer.etaMaxDays} дней до Москвы`
    : "Срок будет показан после серверной проверки"
  const deliveryRoute = publishedOffer?.fulfillmentMode === "in_stock"
    ? "Со склада в России"
    : publishedOffer
      ? "Из Китая через Москву"
      : "После проверки заказа"
  const imageSrc = currentImage?.src ?? product.fallbackImage
  const imageAlt = currentImage?.alt ?? `${product.brand} ${product.name}`
  const imageAngleLabel = getProductGalleryAngleLabel(product, imageIndex)

  return (
    <article className="pdp" id="route-main" aria-labelledby="pdp-title">
      <nav className="pdp__breadcrumbs" aria-label="Хлебные крошки">
        <a href="/">Главная</a>
        <span aria-hidden="true">/</span>
        <a href="/#catalog">Товары</a>
        <span aria-hidden="true">/</span>
        <span>{product.brand}</span>
      </nav>

      <div className="pdp__layout">
        <section className="pdp-gallery" aria-label="Фотографии товара">
          <div
            className="pdp-gallery__stage"
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(event) => {
              const start = touchStartX.current
              const end = event.changedTouches[0]?.clientX
              touchStartX.current = null
              if (start === null || end === undefined || Math.abs(end - start) < 42) return
              if (end > start) previousImage()
              else nextImage()
            }}
          >
            <button
              className="pdp-gallery__main"
              type="button"
              onClick={(event) => lightbox.open(event.currentTarget)}
              aria-label="Открыть фото в полном размере"
            >
              <img
                key={imageSrc}
                src={resolveAssetUrl(imageSrc)}
                width="1200"
                height="900"
                alt={imageAlt}
                fetchPriority="high"
                onError={(event) => setImageFallback(event, product.fallbackImage)}
              />
              <span>
                <Maximize2 aria-hidden="true" size={18} />
                Открыть фото
              </span>
            </button>
            <button
              className="pdp-gallery__arrow pdp-gallery__arrow--prev"
              type="button"
              onClick={previousImage}
              disabled={gallery.length <= 1}
              aria-label="Предыдущее фото товара"
            >
              <ChevronLeft aria-hidden="true" size={24} />
            </button>
            <button
              className="pdp-gallery__arrow pdp-gallery__arrow--next"
              type="button"
              onClick={nextImage}
              disabled={gallery.length <= 1}
              aria-label="Следующее фото товара"
            >
              <ChevronRight aria-hidden="true" size={24} />
            </button>
            <span className="pdp-gallery__count">
              Фото товара {gallery.length ? imageIndex + 1 : 0} из {gallery.length}
              {gallery.length ? ` · ${imageAngleLabel}` : ""}
            </span>
          </div>

          <div className="pdp-gallery__thumbs" aria-label="Выбор фотографии">
            {gallery.map((image, index) => (
              <button
                key={`${image.src}-${index}`}
                type="button"
                aria-label={`Показать фото ${index + 1}: ${getProductGalleryAngleLabel(product, index)}`}
                aria-current={index === imageIndex}
                onClick={() => setImageIndex(index)}
              >
                <img
                  src={resolveAssetUrl(image.src)}
                  width="160"
                  height="120"
                  alt=""
                  loading="lazy"
                  onError={(event) => setImageFallback(event, product.fallbackImage)}
                />
              </button>
            ))}
          </div>
        </section>

        <section className="pdp-buybox" aria-label="Информация о товаре">
          <p className="pdp-buybox__brand">{getProductTypeLabel(product)}</p>
          <h1 id="pdp-title">{product.brand} {product.name}</h1>
          <p className="pdp-buybox__use">{getProductUse(product)}</p>

          <div className="pdp-buybox__availability">
            <span>
              <Truck aria-hidden="true" size={18} />
              <strong>{sourcingMode}</strong>
            </span>
            <small>{eta}. Актуальное наличие проверяется при оформлении.</small>
          </div>

          <div className="pdp-buybox__price" id="pdp-price">
            <span>{price.label}</span>
            <strong>{price.value}</strong>
            <small>{price.detail}</small>
          </div>

          <div className="pdp-sizes">
            <div>
              <strong>Размер</strong>
              <a href="/delivery-returns">Как выбрать размер</a>
            </div>
            <div className="pdp-sizes__grid">
              {sizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={selectedSize === size}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {botOrderUrl ? (
          <a
            className="button button--primary pdp-buybox__cta"
            href={botOrderUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-selected-size={selectedSize ?? ""}
            data-display-price={price.value}
            data-catalog-ready={catalogReady ? "true" : "false"}
            data-order-enabled={orderCreationEnabled ? "true" : "false"}
            aria-describedby="pdp-price pdp-selection-status"
          >
            <ShoppingBag aria-hidden="true" size={19} />
            Оформить в Telegram
          </a>
          ) : (
            <p className="pdp-selection-status">Telegram-бот временно недоступен.</p>
          )}
          <span className="sr-only" id="pdp-selection-status" aria-live="polite">
            {selectedSize
              ? `Выбран размер ${selectedSize}. Цена товара ${price.value}.`
              : `Размер не выбран. Цена товара ${price.value}.`}
          </span>

          <dl className="pdp-facts">
            <div>
              <dt>Категория</dt>
              <dd>{kindLabels[product.kind]}</dd>
            </div>
            <div>
              <dt>Маршрут</dt>
              <dd>{deliveryRoute}</dd>
            </div>
          </dl>

          <div className="pdp-assurance">
            <BadgeCheck aria-hidden="true" size={21} />
            <span>
              <strong>Проверка подлинности</strong>
              <small>Перед отправкой проверяем товар и сохраняем документы заказа.</small>
            </span>
          </div>

          {storefront.botUrl ? (
            <a
              className="pdp-buybox__telegram"
              href={storefront.botUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send aria-hidden="true" size={18} />
              Задать вопрос в Telegram
            </a>
          ) : null}
        </section>
      </div>

      {lightbox.isOpen ? (
        <div
          ref={lightbox.dialogRef}
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Полноэкранное фото товара"
          tabIndex={-1}
          onWheel={lightbox.onWheel}
        >
          <button
            ref={lightbox.closeButtonRef}
            className="photo-lightbox__close"
            type="button"
            onClick={lightbox.close}
            aria-label="Закрыть фото"
          >
            <X aria-hidden="true" size={22} />
          </button>
          <button
            className="photo-lightbox__nav photo-lightbox__nav--prev"
            type="button"
            onClick={lightbox.showPreviousImage}
            disabled={gallery.length <= 1}
            aria-label="Предыдущее фото"
          >
            <ChevronLeft aria-hidden="true" size={28} />
          </button>
          <div
            ref={lightbox.canvasRef}
            className="photo-lightbox__canvas"
            role="group"
            aria-label={`Фото ${imageIndex + 1} из ${gallery.length}. Смахните влево или вправо при масштабе 100%.`}
            onPointerDown={lightbox.onPointerDown}
            onPointerMove={lightbox.onPointerMove}
            onPointerUp={lightbox.onPointerUp}
            onPointerCancel={lightbox.onPointerCancel}
          >
            <img
              ref={lightbox.imageRef}
              src={resolveAssetUrl(imageSrc)}
              width="1200"
              height="900"
              alt={imageAlt}
              draggable="false"
              style={{ transform: lightbox.transform }}
              onClick={lightbox.onImageClick}
              onError={(event) => setImageFallback(event, product.fallbackImage)}
            />
          </div>
          <button
            className="photo-lightbox__nav photo-lightbox__nav--next"
            type="button"
            onClick={lightbox.showNextImage}
            disabled={gallery.length <= 1}
            aria-label="Следующее фото"
          >
            <ChevronRight aria-hidden="true" size={28} />
          </button>
          <div
            className="photo-lightbox__tools"
            aria-label="Масштаб фотографии"
            aria-live="polite"
          >
            <button
              type="button"
              onClick={lightbox.zoomOut}
              aria-label="Уменьшить фото"
            >
              <ZoomOut aria-hidden="true" size={16} />
            </button>
            <span>{Math.round(lightbox.zoom * 100)}%</span>
            <button
              type="button"
              onClick={lightbox.zoomIn}
              aria-label="Увеличить фото"
            >
              <ZoomIn aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
