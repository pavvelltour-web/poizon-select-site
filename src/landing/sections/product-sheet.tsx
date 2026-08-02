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

import { formatRub } from "../../catalog/catalog"
import {
  getProductTypeLabel,
  getProductUse,
  kindLabels,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"
import type { StorefrontState } from "../landing-types"
import { useModalDialog } from "../use-modal-dialog"
import { useProductLightbox } from "../use-product-lightbox"

interface ProductSheetProps {
  storefront: StorefrontState
}

export function ProductSheet({ storefront }: ProductSheetProps) {
  const touchStartX = useRef<number | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
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
  useModalDialog({
    dialogRef,
    initialFocusRef: closeButtonRef,
    isOpen: Boolean(product),
    onClose: storefront.closeProduct,
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
  const selectedSizeOffer = storefront.selectedSize
    ? storefront.selectedSizeOffers.find(
      (offer) => offer.sizeEu === storefront.selectedSize && offer.available,
    ) ?? null
    : null
  const selectedProductInCart = Boolean(
    storefront.selectedSize && storefront.cartLines.some(
      (line) => line.product.slug === product.slug && line.size === storefront.selectedSize,
    ),
  )
  const catalogReady =
    storefront.catalogPriceState.status === "ready" &&
    publishedOffer?.availability === "catalog_listed"
  const canAddToCart = Boolean(
    catalogReady &&
    storefront.catalogPriceState.orderCreationEnabled &&
    selectedSizeOffer?.checkoutConfirmed,
  )
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
      />
      <motion.aside
        ref={dialogRef}
        id="product-dialog"
        className="sheet product-sheet product-sheet--rebuilt"
        data-od-id="product-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-sheet-title"
        data-testid="order-dock"
      >
        <div className="product-sheet-grid">
        <div
          className={`sheet-media product-sheet__media ${selectedMediaReady ? "product-sheet__media--ready" : ""}`}
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
          <div className="sheet-gallery product-sheet__gallery" data-od-id="product-gallery" aria-label="Галерея товара">
          <div className="sheet-gallery-main">
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
          </div>
          <div className="sheet-gallery-thumbs product-sheet__thumbs" aria-label="Миниатюры фото">
            {storefront.selectedVisibleGallery.map((image, index) => (
              <button
                key={`${image.src}-${index}`}
                className={`sheet-gallery-thumb product-sheet__thumb ${
                  thumbsReady[`${image.src}-${index}`] ? "product-sheet__thumb--ready" : ""
                }`}
                type="button"
                data-od-id={`gallery-${product.slug}-${index + 1}`}
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
          <p className="sheet-photo-caption">Фото товара {storefront.selectedImageDisplayIndex} из {storefront.selectedVisibleGallery.length}</p>
        </div>

        <div
          className="sheet-copy product-sheet__content"
          data-testid="product-sheet-scroll"
          tabIndex={0}
          aria-label="Данные товара"
        >
          <div className="sheet-head">
            <h2 id="product-sheet-title" ref={storefront.sheetHeadingRef} tabIndex={-1}>{getProductTypeLabel(product)} {product.brand} {product.name}</h2>
            <button ref={closeButtonRef} className="icon-button modal-close product-sheet__close" type="button" onClick={storefront.closeProduct} aria-label="Закрыть карточку товара"><X aria-hidden="true" size={20} /></button>
          </div>
          <p className="sheet-category product-sheet__type">{kindLabels[product.kind]}</p>
          <p className="sheet-description product-sheet__description">{getProductUse(product)}</p>
          <p className="sheet-price">{price?.value}</p>
          <p className="sheet-supply">{sourcingMode}</p>

          <div
            className="product-size product-size--matrix"
            aria-label="Выбор размера и цены"
            aria-busy={storefront.selectedSizeOfferStatus === "loading"}
          >
            <div className="product-size__head">
              <strong>Размер: RU (EU)</strong>
              <details className="product-size__guide">
                <summary>Гайд размера</summary>
                <div>
                  <table aria-label="Таблица размеров RU и EU">
                    <thead>
                      <tr><th>RU</th><th>EU</th></tr>
                    </thead>
                    <tbody>
                      {storefront.selectedSizeOffers.map((offer) => (
                        <tr key={`guide-${offer.sizeEu}`}>
                          <td>{offer.sizeRu ?? "—"}</td>
                          <td>{offer.sizeEu}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
            <div className="size-price-grid" aria-label="Размеры и цены на выбор">
              {storefront.selectedSizeOffers.map((offer) => (
                <button
                  key={offer.sizeEu}
                  className="size-price-cell"
                  type="button"
                  data-od-id={`sheet-size-${product.slug}-${offer.sizeEu.replaceAll(".", "-")}`}
                  aria-label={`${offer.sizeRu ?? "Размер RU не указан"} RU, ${offer.sizeEu} EU, ${offer.priceRub ? formatRub(offer.priceRub) : "нет в наличии"}`}
                  aria-pressed={storefront.selectedSize === offer.sizeEu}
                  disabled={!offer.available || !offer.priceRub}
                  onClick={() => storefront.setSelectedSize(offer.sizeEu)}
                >
                  <span className="size-price-cell__sizes">
                    <strong>{offer.sizeRu ?? "—"}</strong>
                    <small>({offer.sizeEu})</small>
                  </span>
                  <span className="size-price-cell__price">
                    {offer.priceRub ? formatRub(offer.priceRub) : "— ₽"}
                  </span>
                </button>
              ))}
            </div>
            {storefront.selectedSizeOfferStatus === "loading" ? (
              <p className="product-size__status sr-only" role="status">Получаем размеры и цены...</p>
            ) : storefront.selectedSizeOfferStatus === "failed" ? (
              <p className="product-size__status sr-only" role="status">
                {storefront.selectedSizeOfferError ?? "Размеры временно недоступны."}
              </p>
            ) : !storefront.selectedSizeOffers.some((offer) => offer.available) ? (
              <p className="product-size__status sr-only" role="status">Актуальных предложений по размерам нет.</p>
            ) : null}
            {selectedSizeOffer && !selectedSizeOffer.checkoutConfirmed ? (
              <p className="product-size__status sr-only" role="status">
                Цена ещё не подтверждена для оплаты. Оформите запрос менеджеру.
              </p>
            ) : null}
          </div>

          <div className="product-sheet__purchase">
            <span>
              <small>{price?.label}</small>
              <strong>{price?.value}</strong>
              <em>{price?.detail}</em>
            </span>
            <button
              className="dialog-primary add-button button button--primary"
              type="button"
              onClick={storefront.addSelectedToCart}
              disabled={!storefront.selectedSize || !canAddToCart}
              data-selected-size={storefront.selectedSize ?? ""}
              data-display-price={price?.value ?? ""}
              data-order-enabled={String(storefront.catalogPriceState.orderCreationEnabled)}
            >
              <ShoppingCart aria-hidden="true" size={18} />
              {storefront.selectedSizeOfferStatus === "loading"
                ? "Проверяем размеры"
                : !catalogReady
                ? "Проверяем каталог"
                : !storefront.catalogPriceState.orderCreationEnabled
                  ? "Оформление временно недоступно"
                : selectedSizeOffer && !selectedSizeOffer.checkoutConfirmed
                  ? "Заказ через менеджера"
                : storefront.selectedSize
                  ? selectedProductInCart
                    ? "Добавлено"
                    : "Добавить в заказ"
                  : "Выберите размер выше"}
            </button>
            {storefront.checkoutResult.status === "failed" ? (
              <p className="product-sheet__feedback" role="alert">
                {storefront.checkoutResult.message}
              </p>
            ) : null}
            <p className="sr-only" aria-live="polite">
              {selectedProductInCart ? "Товар добавлен в корзину" : ""}
            </p>
          </div>

          <section className="sheet-spec-section" data-od-id="product-short-specs" aria-labelledby="sheet-spec-title">
          <h3 id="sheet-spec-title">Краткие характеристики</h3>
          <dl className="sheet-specs product-facts">
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
          </section>

          <p className="product-sheet__fineprint">
            Оплата доступна после подтверждения выбранного товара. Доставка СДЭК оплачивается отдельно.
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
        </div>
      </motion.aside>
      {lightbox.isOpen ? (
        <motion.div
          ref={lightbox.dialogRef}
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Показ фото товара"
          tabIndex={-1}
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
            ref={lightbox.canvasRef}
            className="photo-lightbox__canvas"
            role="group"
            aria-label={`Фото ${storefront.selectedImageDisplayIndex} из ${storefront.selectedVisibleGallery.length}. Смахните влево или вправо при масштабе 100%.`}
            onPointerDown={lightbox.onPointerDown}
            onPointerMove={lightbox.onPointerMove}
            onPointerUp={lightbox.onPointerUp}
            onPointerCancel={lightbox.onPointerCancel}
          >
            <img
              ref={lightbox.imageRef}
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
          <div
            className="photo-lightbox__tools"
            aria-label="Инструменты фото"
            aria-live="polite"
          >
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
