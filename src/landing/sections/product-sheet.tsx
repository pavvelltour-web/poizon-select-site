import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Maximize2,
  Send,
  ShoppingCart,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import {
  getProductScenario,
  getSourcingMode,
  kindLabels,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"
import type { StorefrontState } from "../landing-types"

interface ProductSheetProps {
  storefront: StorefrontState
}

export function ProductSheet({ storefront }: ProductSheetProps) {
  const touchStartX = useRef<number | null>(null)
  const [isLightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxZoom, setLightboxZoom] = useState(1)
  const product = storefront.selectedProduct
  const selectedImageSrcKey = storefront.selectedImage?.src ?? ""

  useEffect(() => {
    setLightboxZoom(1)
  }, [selectedImageSrcKey])

  useEffect(() => {
    if (!isLightboxOpen) return

    const onLightboxKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        setLightboxOpen(false)
      }
    }

    document.addEventListener("keydown", onLightboxKeyDown, true)
    return () => document.removeEventListener("keydown", onLightboxKeyDown, true)
  }, [isLightboxOpen])

  if (!product) return null

  const price = storefront.selectedProductPrice
  const botUrl = storefront.botUrl
  const botUsername = storefront.botUsername
  const selectedImageSrc = selectedImageSrcKey || product.fallbackImage
  const selectedImageAlt = storefront.selectedImage?.alt ?? `${product.brand} ${product.name}`

  const zoomIn = () => setLightboxZoom((zoom) => Math.min(zoom + 0.25, 2.5))
  const zoomOut = () => setLightboxZoom((zoom) => Math.max(zoom - 0.25, 1))

  return (
    <>
      <motion.button
        className="sheet-scrim"
        type="button"
        onClick={storefront.closeProduct}
        aria-label="Закрыть карточку товара"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        className="product-sheet product-sheet--rebuilt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-sheet-title"
        data-testid="order-dock"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <button
          className="product-sheet__close"
          type="button"
          onClick={storefront.closeProduct}
          aria-label="Закрыть карточку товара"
        >
          <X aria-hidden="true" size={20} />
        </button>

        <div
          className="product-sheet__media product-sheet__gallery"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current
            touchStartX.current = null
            const endX = event.changedTouches[0]?.clientX
            if (startX === null || endX === undefined) return
            const deltaX = endX - startX
            if (Math.abs(deltaX) < 42) return
            if (deltaX > 0) storefront.showPreviousProductImage()
            else storefront.showNextProductImage()
          }}
        >
          <motion.img
            key={selectedImageSrc}
            src={resolveAssetUrl(selectedImageSrc)}
            width="1200"
            height="900"
            alt={selectedImageAlt}
            onError={(event) => setImageFallback(event, product.fallbackImage)}
            initial={{ opacity: 0.8, scale: 0.992 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.16 }}
            onClick={() => setLightboxOpen(true)}
          />
          <button
            className="product-sheet__expand"
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Открыть фото на весь экран"
          >
            <Maximize2 aria-hidden="true" size={18} />
          </button>
          <button
            className="product-sheet__nav product-sheet__nav--prev"
            type="button"
            onClick={storefront.showPreviousProductImage}
            disabled={storefront.selectedVisibleGallery.length <= 1}
            aria-label="Предыдущее фото товара"
          >
            <ChevronLeft aria-hidden="true" size={24} />
          </button>
          <button
            className="product-sheet__nav product-sheet__nav--next"
            type="button"
            onClick={storefront.showNextProductImage}
            disabled={storefront.selectedVisibleGallery.length <= 1}
            aria-label="Следующее фото товара"
          >
            <ChevronRight aria-hidden="true" size={24} />
          </button>
          <div className="product-sheet__media-meta">
            <span>
              {storefront.selectedImageDisplayIndex}/
              {storefront.selectedVisibleGallery.length}
            </span>
            <strong>{product.brand}</strong>
          </div>
          <div className="product-sheet__dots" aria-label="Фото товара">
            {storefront.selectedVisibleGallery.map((image, index) => (
              <button
                key={`dot-${image.src}-${index}`}
                type="button"
                aria-label={`Показать фото ${index + 1}`}
                aria-current={index === storefront.selectedImageIndex}
                onClick={() => storefront.selectProductImage(index)}
              />
            ))}
          </div>
          <div className="product-sheet__thumbs" aria-label="Галерея товара">
            {storefront.selectedVisibleGallery.map((image, index) => (
              <button
                key={`${image.src}-${index}`}
                type="button"
                aria-label={`Показать фото ${index + 1}`}
                aria-current={index === storefront.selectedImageIndex}
                onClick={() => storefront.selectProductImage(index)}
              >
                <img
                  src={resolveAssetUrl(image.src)}
                  width="120"
                  height="90"
                  alt=""
                  onError={(event) => setImageFallback(event, product.fallbackImage)}
                />
              </button>
            ))}
          </div>
        </div>

        <div
          className="product-sheet__content"
          data-testid="product-sheet-scroll"
          tabIndex={0}
          aria-label="Детали товара"
        >
          <div className="product-sheet__identity">
            <span>{product.sportPriority ? "Для зала" : kindLabels[product.kind]}</span>
            <span>{getProductScenario(product)}</span>
          </div>
          <h2 id="product-sheet-title" ref={storefront.sheetHeadingRef} tabIndex={-1}>
            {product.brand} {product.name}
          </h2>
          <p className="product-sheet__description">{product.note}</p>

          <div className="product-size" aria-label="Выбор размера">
            <span>
              <strong>Размер</strong>
              <em>Выберите перед заявкой, менеджер проверит наличие.</em>
            </span>
            <div className="product-size__grid">
              {storefront.selectedSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={storefront.selectedSize === size}
                  onClick={() => storefront.setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="product-sheet__purchase">
            <span>
              <small>{price?.label}</small>
              <strong>{price?.value}</strong>
              <em>{price?.detail}</em>
            </span>
            <button
              className="button button--primary"
              type="button"
              onClick={storefront.addSelectedToCart}
              disabled={!storefront.selectedSize}
            >
              <ShoppingCart aria-hidden="true" size={18} />
              {storefront.selectedSize ? "Добавить в корзину" : "Выберите размер выше"}
            </button>
          </div>

          <dl className="product-facts">
            <div>
              <dt>Сценарий</dt>
              <dd>{getProductScenario(product)}</dd>
            </div>
            <div>
              <dt>Тип</dt>
              <dd>{kindLabels[product.kind]}</dd>
            </div>
            <div>
              <dt>Размер</dt>
              <dd>{storefront.selectedSize ?? "Не выбран"}</dd>
            </div>
            <div>
              <dt>Формат</dt>
              <dd>{getSourcingMode(product)}, затем СДЭК</dd>
            </div>
            <div>
              <dt>{price?.label}</dt>
              <dd>{price?.value}</dd>
            </div>
          </dl>

          <p className="product-sheet__fineprint">
            Итоговая цена фиксируется перед оплатой после проверки размера, цвета,
            продавца и наличия. Доставка СДЭК показывается отдельно.
          </p>
          <p className="product-sheet__order-proof">
            После заявки менеджер подтвердит размер, цвет, продавца, бирки,
            упаковку и доступность перед оплатой.
          </p>

          <label className="request-box">
            <span>Запрос менеджеру</span>
            <textarea readOnly value={storefront.request} rows={3} />
          </label>

          {botUrl ? (
            <div className="product-sheet__actions">
              <button type="button" className="button button--quiet" onClick={storefront.copyRequest}>
                <Copy aria-hidden="true" size={18} />
                {storefront.copyState === "copied" ? "Запрос готов" : "Скопировать запрос"}
              </button>
              <button type="button" className="button button--quiet" onClick={storefront.openCart}>
                <ShoppingCart aria-hidden="true" size={18} />
                Открыть корзину
              </button>
              <a className="button button--primary" href={botUrl} target="_blank" rel="noreferrer">
                <Send aria-hidden="true" size={18} />
                Открыть @{botUsername}
              </a>
            </div>
          ) : (
            <div className="product-sheet__actions">
              <button type="button" className="button button--quiet" onClick={storefront.copyRequest}>
                <Copy aria-hidden="true" size={18} />
                {storefront.copyState === "copied" ? "Запрос готов" : "Скопировать запрос"}
              </button>
              <button type="button" className="button button--primary" onClick={storefront.openCart}>
                <ShoppingCart aria-hidden="true" size={18} />
                Открыть корзину
              </button>
              <p className="product-sheet__demo">
                Ссылка на менеджера появится после подключения Telegram.
              </p>
            </div>
          )}

          {storefront.copyState === "failed" ? (
            <p className="product-sheet__feedback" role="alert">
              Не удалось скопировать автоматически. Выделите текст выше и
              скопируйте его вручную.
            </p>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {storefront.copyState === "copied"
              ? "Запрос скопирован в буфер обмена"
              : ""}
          </p>
        </div>
      </motion.aside>
      {isLightboxOpen ? (
        <motion.div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фото товара"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onWheel={(event) => {
            if (event.deltaY < 0) zoomIn()
            else zoomOut()
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
            onClick={storefront.showPreviousProductImage}
            disabled={storefront.selectedVisibleGallery.length <= 1}
            aria-label="Предыдущее фото товара"
          >
            <ChevronLeft aria-hidden="true" size={28} />
          </button>
          <img
            src={resolveAssetUrl(selectedImageSrc)}
            width="1200"
            height="900"
            alt={selectedImageAlt}
            style={{ transform: `scale(${lightboxZoom})` }}
            onError={(event) => setImageFallback(event, product.fallbackImage)}
          />
          <button
            className="photo-lightbox__nav photo-lightbox__nav--next"
            type="button"
            onClick={storefront.showNextProductImage}
            disabled={storefront.selectedVisibleGallery.length <= 1}
            aria-label="Следующее фото товара"
          >
            <ChevronRight aria-hidden="true" size={28} />
          </button>
          <div className="photo-lightbox__tools" aria-label="Масштаб фото">
            <button type="button" onClick={zoomOut} aria-label="Уменьшить фото">
              <ZoomOut aria-hidden="true" size={18} />
            </button>
            <span>{Math.round(lightboxZoom * 100)}%</span>
            <button type="button" onClick={zoomIn} aria-label="Увеличить фото">
              <ZoomIn aria-hidden="true" size={18} />
            </button>
          </div>
        </motion.div>
      ) : null}
    </>
  )
}
