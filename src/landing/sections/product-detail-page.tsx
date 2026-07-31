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
  getDisplayPrice,
  getProductUse,
  getSizeOptions,
  getSourcingMode,
  kindLabels,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"
import type { StorefrontState } from "../landing-types"

interface ProductDetailPageProps {
  product: CatalogProduct | null
  storefront: StorefrontState
}

export function ProductDetailPage({ product, storefront }: ProductDetailPageProps) {
  const touchStartX = useRef<number | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoom, setZoom] = useState(1)

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

  useEffect(() => {
    setImageIndex(0)
    setSelectedSize(null)
    setZoom(1)
  }, [product?.slug])

  useEffect(() => {
    if (!lightboxOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false)
      else if (event.key === "ArrowLeft") previousImage()
      else if (event.key === "ArrowRight") nextImage()
      else if (event.key === "+" || event.key === "=") {
        setZoom((value) => Math.min(2.5, value + 0.25))
      } else if (event.key === "-") {
        setZoom((value) => Math.max(1, value - 0.25))
      } else if (event.key === "0") setZoom(1)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [lightboxOpen, gallery.length])

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

  const price = getDisplayPrice(product, storefront.catalogPriceState.lookup)
  const sizeOptions = getSizeOptions(product)
  const imageSrc = currentImage?.src ?? product.fallbackImage
  const imageAlt = currentImage?.alt ?? `${product.brand} ${product.name}`

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
              onClick={() => setLightboxOpen(true)}
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
              {gallery.length ? imageIndex + 1 : 0}/{gallery.length}
            </span>
          </div>

          <div className="pdp-gallery__thumbs" aria-label="Выбор фотографии">
            {gallery.map((image, index) => (
              <button
                key={`${image.src}-${index}`}
                type="button"
                aria-label={`Показать фото ${index + 1}`}
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
          <p className="pdp-buybox__brand">{product.brand}</p>
          <h1 id="pdp-title">{product.name}</h1>
          <p className="pdp-buybox__use">{getProductUse(product)}</p>

          <div className="pdp-buybox__availability">
            <span>
              <Truck aria-hidden="true" size={18} />
              <strong>{getSourcingMode(product)}</strong>
            </span>
            <small>Срок и стоимость доставки показываются до оплаты.</small>
          </div>

          <div className="pdp-buybox__price">
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

          <button
            className="button button--primary pdp-buybox__cta"
            type="button"
            disabled={!selectedSize}
            onClick={() => {
              if (selectedSize) storefront.addProductToCart(product, selectedSize)
            }}
          >
            <ShoppingBag aria-hidden="true" size={19} />
            {selectedSize ? `Добавить в заказ · ${price.value}` : "Выберите размер"}
          </button>

          <dl className="pdp-facts">
            <div>
              <dt>Категория</dt>
              <dd>{kindLabels[product.kind]}</dd>
            </div>
            <div>
              <dt>Получение</dt>
              <dd>{getSourcingMode(product)}</dd>
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

      {lightboxOpen ? (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Полноэкранное фото товара"
          onWheel={(event) => {
            setZoom((value) =>
              event.deltaY < 0 ? Math.min(2.5, value + 0.25) : Math.max(1, value - 0.25),
            )
          }}
        >
          <button
            className="photo-lightbox__close"
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Закрыть фото"
          >
            <X aria-hidden="true" size={22} />
          </button>
          <button
            className="photo-lightbox__nav photo-lightbox__nav--prev"
            type="button"
            onClick={previousImage}
            disabled={gallery.length <= 1}
            aria-label="Предыдущее фото"
          >
            <ChevronLeft aria-hidden="true" size={28} />
          </button>
          <img
            src={resolveAssetUrl(imageSrc)}
            width="1200"
            height="900"
            alt={imageAlt}
            style={{ transform: `scale(${zoom})` }}
            onError={(event) => setImageFallback(event, product.fallbackImage)}
          />
          <button
            className="photo-lightbox__nav photo-lightbox__nav--next"
            type="button"
            onClick={nextImage}
            disabled={gallery.length <= 1}
            aria-label="Следующее фото"
          >
            <ChevronRight aria-hidden="true" size={28} />
          </button>
          <div className="photo-lightbox__tools" aria-label="Масштаб фотографии">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
              aria-label="Уменьшить фото"
            >
              <ZoomOut aria-hidden="true" size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
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
