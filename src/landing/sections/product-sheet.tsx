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
  getProductTypeLabel,
  getProductUse,
  kindLabels,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"
import type { StorefrontState } from "../landing-types"
import { useProductLightbox } from "../use-product-lightbox"

interface ProductSheetProps {
  storefront: StorefrontState
}

export function ProductSheet({ storefront }: ProductSheetProps) {
  const touchStartX = useRef<number | null>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const [selectedMediaReady, setSelectedMediaReady] = useState(false)
  const [thumbsReady, setThumbsReady] = useState<Record<string, boolean>>({})
  const product = storefront.selectedProduct
  const selectedImageSrcKey = storefront.selectedImage?.src ?? ""
  const lightbox = useProductLightbox({
    imageKey: selectedImageSrcKey,
    previousImage: storefront.showPreviousProductImage,
    nextImage: storefront.showNextProductImage,
  })

  useEffect(() => {
    setSelectedMediaReady(false)
  }, [selectedImageSrcKey])

  useEffect(() => {
    setSelectedMediaReady(false)
    setThumbsReady({})
  }, [product?.slug])

  if (!product) return null

  const price = storefront.selectedProductPrice
  const botUrl = storefront.botUrl
  const botUsername = storefront.botUsername
  const selectedImageSrc = selectedImageSrcKey || product.fallbackImage
  const selectedImageAlt = storefront.selectedImage?.alt ?? `${product.brand} ${product.name}`
  const publishedOffer = storefront.catalogPriceState.items[product.slug]
  const catalogReady =
    storefront.catalogPriceState.status === "ready" &&
    publishedOffer?.availability === "catalog_listed"
  const sourcingMode = publishedOffer
    ? publishedOffer.fulfillmentMode === "in_stock"
      ? "В наличии в России"
      : "Под заказ из Китая"
    : storefront.catalogPriceState.status === "loading"
      ? "Проверяем данные"
      : "Недоступно для заказа"

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
          className={`product-sheet__media product-sheet__gallery ${selectedMediaReady ? "product-sheet__media--ready" : ""}`}
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
            className={`product-sheet__media-image ${
              selectedMediaReady ? "product-sheet__media-image--ready" : ""
            }`}
            onLoad={() => setSelectedMediaReady(true)}
            onError={(event) => {
              setImageFallback(event, product.fallbackImage)
              setSelectedMediaReady(true)
            }}
            initial={{ opacity: 0.8, scale: 0.992 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.16 }}
            onClick={() => lightbox.open(expandButtonRef.current)}
          />
          <button
            ref={expandButtonRef}
            className="product-sheet__expand"
            type="button"
            onClick={(event) => lightbox.open(event.currentTarget)}
            aria-label="Открыть фото в полном размере"
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
          <div className="product-sheet__dots" aria-label="Переключение фото">
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
          <div className="product-sheet__thumbs" aria-label="Миниатюры фото">
            {storefront.selectedVisibleGallery.map((image, index) => (
              <button
                key={`${image.src}-${index}`}
                className={`product-sheet__thumb ${
                  thumbsReady[`${image.src}-${index}`] ? "product-sheet__thumb--ready" : ""
                }`}
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
                  onLoad={() =>
                    setThumbsReady((ready) => ({ ...ready, [`${image.src}-${index}`]: true }))
                  }
                  onError={(event) => {
                    setImageFallback(event, product.fallbackImage)
                    setThumbsReady((ready) => ({ ...ready, [`${image.src}-${index}`]: true }))
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        <div
          className="product-sheet__content"
          data-testid="product-sheet-scroll"
          tabIndex={0}
          aria-label="Данные товара"
        >
          <p className="product-sheet__type">{getProductTypeLabel(product)}</p>
          <h2 id="product-sheet-title" ref={storefront.sheetHeadingRef} tabIndex={-1}>
            {product.brand} {product.name}
          </h2>
          <p className="product-sheet__description">{getProductUse(product)}</p>

          <div className="product-size" aria-label="Выбор размера">
            <span>
              <strong>Размер</strong>
              <em>Выберите размер, чтобы добавить товар в заказ.</em>
            </span>
            <div className="product-size__grid" aria-label="Размеры на выбор">
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
              disabled={!storefront.selectedSize || !catalogReady}
            >
              <ShoppingCart aria-hidden="true" size={18} />
              {!catalogReady
                ? "Проверяем каталог"
                : storefront.selectedSize
                  ? "Добавить в заказ"
                  : "Выберите размер выше"}
            </button>
          </div>

          <dl className="product-facts">
            <div>
              <dt>Направление</dt>
              <dd>{kindLabels[product.kind]}</dd>
            </div>
            <div>
              <dt>Размер</dt>
              <dd>{storefront.selectedSize ?? "Не выбран"}</dd>
            </div>
            <div>
              <dt>Отправка</dt>
              <dd>{sourcingMode}</dd>
            </div>
            <div>
              <dt>{price?.label}</dt>
              <dd>{price?.value}</dd>
            </div>
          </dl>

          <p className="product-sheet__fineprint">
            Опубликованный каталог не подтверждает живой остаток Poizon. Товары оплачиваются
            сейчас, доставка СДЭК — отдельно после прибытия.
          </p>
          <p className="product-sheet__order-proof">
            Оплата проходит на защищённой странице банка.
          </p>

          <label className="request-box">
            <span>Запрос для Telegram</span>
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
                Открыть заказ
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
                Открыть заказ
              </button>
              <p className="product-sheet__demo">
                Оформление и оплата доступны в корзине сайта.
              </p>
            </div>
          )}

          {storefront.copyState === "failed" ? (
            <p className="product-sheet__feedback" role="alert">
              Не удалось скопировать автоматически. Выделите текст выше и скопируйте его вручную.
            </p>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {storefront.copyState === "copied"
              ? "Запрос скопирован в буфер обмена"
              : ""}
          </p>
        </div>
      </motion.aside>
      {lightbox.isOpen ? (
        <motion.div
          ref={lightbox.dialogRef}
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Показ фото товара"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
            disabled={storefront.selectedVisibleGallery.length <= 1}
            aria-label="Предыдущее фото"
          >
            <ChevronLeft aria-hidden="true" size={28} />
          </button>
          <div
            className="photo-lightbox__canvas"
            onPointerDown={lightbox.onPointerDown}
            onPointerMove={lightbox.onPointerMove}
            onPointerUp={lightbox.onPointerUp}
            onPointerCancel={lightbox.onPointerCancel}
          >
            <img
              src={resolveAssetUrl(selectedImageSrc)}
              width="1200"
              height="900"
              alt={selectedImageAlt}
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
            disabled={storefront.selectedVisibleGallery.length <= 1}
            aria-label="Следующее фото"
          >
            <ChevronRight aria-hidden="true" size={28} />
          </button>
          <div className="photo-lightbox__tools" aria-label="Инструменты фото">
            <button type="button" onClick={lightbox.zoomOut} aria-label="Уменьшить фото">
              <ZoomOut aria-hidden="true" size={18} />
            </button>
            <span>{Math.round(lightbox.zoom * 100)}%</span>
            <button type="button" onClick={lightbox.zoomIn} aria-label="Увеличить фото">
              <ZoomIn aria-hidden="true" size={18} />
            </button>
          </div>
        </motion.div>
      ) : null}
    </>
  )
}
