import { useState } from "react"
import { LoaderCircle, Search } from "lucide-react"

import type { LivePoizonOffer, LivePoizonProduct } from "../landing-types"
import type { LandingStorefront } from "../use-landing-storefront"

interface LivePoizonSearchProps {
  storefront: LandingStorefront
}

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
})

const yuan = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function formatRub(value: number) {
  return rub.format(value)
}

function formatCny(value: number) {
  return `¥${yuan.format(value)}`
}

function formatLiveSize(offer: LivePoizonOffer): string {
  const labels = [
    offer.ru ? `RU ${offer.ru}` : null,
    offer.eu ? `EU ${offer.eu}` : null,
    offer.us ? `US ${offer.us}` : null,
    offer.cn ? `CN ${offer.cn}` : null,
  ].filter((label): label is string => Boolean(label))
  return labels.length > 0 ? labels.join(" · ") : `Размер: ${offer.size}`
}

function productTitle(product: LivePoizonProduct): string {
  if (!product.brand) return product.name
  return product.name.toLocaleLowerCase().startsWith(product.brand.toLocaleLowerCase())
    ? product.name
    : `${product.brand} ${product.name}`
}

function stockLabel(inStock: boolean | null): string {
  if (inStock === true) return "В наличии по данным поиска."
  if (inStock === false) return "Сейчас нет в наличии по данным поиска."
  return "Наличие уточняется."
}

function offerStockLabel(offer: LivePoizonOffer): string {
  if (offer.available === true) return "в наличии"
  if (offer.available === false) return "нет в наличии"
  return "наличие уточняется"
}

function PriceBreakdown({ offer }: { offer: LivePoizonOffer }) {
  const breakdown = offer.price_breakdown

  return (
    <dl className="live-poizon-search__breakdown" aria-label="Детализация выбранной цены">
      <div>
        <dt>Цена товара · {formatCny(offer.price_cny)}</dt>
        <dd>{formatRub(breakdown.purchase_rub)}</dd>
      </div>
      <div>
        <dt>Конвертация 4%</dt>
        <dd>{formatRub(breakdown.conversion_fee)}</dd>
      </div>
      <div>
        <dt>Комиссия 6%</dt>
        <dd>{formatRub(breakdown.first_six_percent_fee)}</dd>
      </div>
      <div>
        <dt>Наша наценка</dt>
        <dd>{formatRub(breakdown.service_markup)}</dd>
      </div>
      <div>
        <dt>Доставка по РФ</dt>
        <dd>{formatRub(breakdown.delivery_rub)}</dd>
      </div>
      <div>
        <dt>Финальная комиссия 6%</dt>
        <dd>{formatRub(breakdown.final_six_percent_fee)}</dd>
      </div>
    </dl>
  )
}

function ProductResult({ product }: { product: LivePoizonProduct }) {
  const availableOffers = product.offers.filter((offer) => offer.available !== false)
  const defaultOffer = availableOffers[0] ?? product.offers[0]
  const [selectedOfferRef, setSelectedOfferRef] = useState(defaultOffer.offer_ref)
  const selectedOffer =
    product.offers.find((offer) => offer.offer_ref === selectedOfferRef) ?? defaultOffer
  const title = productTitle(product)

  return (
    <article className="live-poizon-search__result">
      <img
        className="live-poizon-search__image"
        src={product.images[0]}
        alt={title}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="live-poizon-search__result-heading">
        <span>Цена проверена сейчас</span>
        <small>Выберите размер</small>
      </div>
      <h4>{title}</h4>
      <p>{product.description}</p>
      {product.article ? <p>Артикул: {product.article}</p> : null}
      {product.color ? <p>Цвет: {product.color}</p> : null}
      <p className="live-poizon-search__availability">{stockLabel(product.in_stock)}</p>
      {product.size_context ? (
        <p className="live-poizon-search__size-context">{product.size_context}</p>
      ) : null}
      {product.size_chart ? <p className="live-poizon-search__size-chart">{product.size_chart}</p> : null}
      {product.size_image ? (
        <figure className="live-poizon-search__size-image">
          <img
            src={product.size_image}
            alt={`Таблица размеров для ${title}`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <figcaption>Таблица размеров</figcaption>
        </figure>
      ) : null}
      <div className="live-poizon-search__sizes" aria-label={`Размеры ${title}`}>
        {product.offers.map((offer) => {
          const selected = offer.offer_ref === selectedOffer.offer_ref
          return (
            <button
              aria-pressed={selected}
              className="live-poizon-search__size-choice"
              disabled={offer.available === false}
              key={offer.offer_ref}
              onClick={() => setSelectedOfferRef(offer.offer_ref)}
              type="button"
            >
              <span>{formatLiveSize(offer)}</span>
              <small>{offerStockLabel(offer)}</small>
            </button>
          )
        })}
      </div>
      <p className="live-poizon-search__selected-size">
        Выбранный размер: {formatLiveSize(selectedOffer)} · {formatCny(selectedOffer.price_cny)}
      </p>
      <strong className="live-poizon-search__total">{formatRub(selectedOffer.total_rub)}</strong>
      <p className="live-poizon-search__fixed-until">
        Итог относится к выбранному размеру. Перед оформлением он перепроверяется.
      </p>
      <PriceBreakdown offer={selectedOffer} />
    </article>
  )
}

export function LivePoizonSearch({ storefront }: LivePoizonSearchProps) {
  const loading = storefront.liveSearchStatus === "loading"

  return (
    <section className="live-poizon-search" aria-labelledby="live-poizon-search-title">
      <div className="live-poizon-search__heading">
        <div>
          <p className="eyebrow">Другие товары по запросу</p>
          <h3 id="live-poizon-search-title">Проверьте цену модели, которой нет в витрине.</h3>
        </div>
        <p>
          Ищем через наш сервис и показываем цену, фото, описание и размеры по текущему
          запросу. Это не статическая цена каталога.
        </p>
      </div>

      <form
        className="live-poizon-search__form"
        onSubmit={(event) => {
          event.preventDefault()
          void storefront.submitLiveSearch()
        }}
      >
        <label className="live-poizon-search__input">
          <span className="sr-only">Поиск товара</span>
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            value={storefront.liveSearchQuery}
            onChange={(event) => storefront.setLiveSearchQuery(event.target.value)}
            placeholder="Nike Air Force 1, DD8959-100, ASICS GEL-1130..."
            autoComplete="off"
          />
        </label>
        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? (
            <LoaderCircle className="live-poizon-search__spinner" aria-hidden="true" size={18} />
          ) : (
            <Search aria-hidden="true" size={18} />
          )}
          {loading ? "Считаем…" : "Найти товар"}
        </button>
      </form>

      <div className="live-poizon-search__status" aria-live="polite">
        {loading ? <p>Получаем подтверждённую цену и размеры…</p> : null}
        {storefront.liveSearchStatus === "clarification" && storefront.liveSearchMessage ? (
          <div className="live-poizon-search__clarification" role="status">
            <p>{storefront.liveSearchMessage}</p>
            {storefront.liveSearchClarificationOptions.length > 0 ? (
              <div className="live-poizon-search__choices" aria-label="Уточнить модель">
                {storefront.liveSearchClarificationOptions.map((option) => (
                  <button
                    className="button button--quiet"
                    key={option.query}
                    onClick={() => void storefront.submitLiveSearch(option.query)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {storefront.liveSearchStatus === "unavailable" && storefront.liveSearchMessage ? (
          <p role="status">{storefront.liveSearchMessage}</p>
        ) : null}
      </div>

      {storefront.liveSearchStatus === "ready" ? (
        <div className="live-poizon-search__results" aria-label="Результаты поиска">
          {storefront.liveSearchResults.map((product) => (
            <ProductResult key={product.product_ref} product={product} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
