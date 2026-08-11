import { LoaderCircle, Search } from "lucide-react"

import type { LivePoizonOffer } from "../landing-types"
import type { LandingStorefront } from "../use-landing-storefront"

interface LivePoizonSearchProps {
  storefront: LandingStorefront
}

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
})

function formatRub(value: number) {
  return rub.format(value)
}

function fixedUntil(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "на 12 часов"
  return `до ${new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)}`
}

function PriceBreakdown({ offer }: { offer: LivePoizonOffer }) {
  const breakdown = offer.price_breakdown
  if (!breakdown) return null

  return (
    <dl className="live-poizon-search__breakdown">
      <div>
        <dt>Базовая стоимость товара</dt>
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

export function LivePoizonSearch({ storefront }: LivePoizonSearchProps) {
  const loading = storefront.liveSearchStatus === "loading"

  return (
    <section className="live-poizon-search" aria-labelledby="live-poizon-search-title">
      <div className="live-poizon-search__heading">
        <div>
          <p className="eyebrow">Живой Poizon</p>
          <h3 id="live-poizon-search-title">Проверьте цену модели, которой нет в витрине.</h3>
        </div>
        <p>
          Проверяем Poizon через наш сервер. Показываем только итог в ₽ по
          единой формуле для сайта и Telegram.
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
          <span className="sr-only">Поиск в Poizon</span>
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
          {loading ? "Считаем…" : "Найти в Poizon"}
        </button>
      </form>

      <div className="live-poizon-search__status" aria-live="polite">
        {loading ? <p>Получаем подтверждённую цену и размеры…</p> : null}
        {storefront.liveSearchStatus === "unavailable" && storefront.liveSearchMessage ? (
          <p role="status">{storefront.liveSearchMessage}</p>
        ) : null}
      </div>

      {storefront.liveSearchStatus === "ready" ? (
        <div className="live-poizon-search__results" aria-label="Результаты живого поиска Poizon">
          {storefront.liveSearchResults.map((product) => {
            const offers = product.offers
            const lowestOffer = offers.reduce<LivePoizonOffer | null>(
              (lowest, offer) =>
                !lowest || (offer.total_rub ?? offer.quote_rub + offer.rf_delivery) <
                  (lowest.total_rub ?? lowest.quote_rub + lowest.rf_delivery)
                  ? offer
                  : lowest,
              null,
            )
            if (!lowestOffer) return null
            return (
              <article
                key={product.product_ref}
                className="live-poizon-search__result"
              >
                {product.images[0] ? (
                  <img
                    className="live-poizon-search__image"
                    src={product.images[0]}
                    alt={product.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <div className="live-poizon-search__result-heading">
                  <span>Цена Poizon зафиксирована</span>
                  <small>Выберите размер</small>
                </div>
                <h4>{[product.brand, product.name].filter(Boolean).join(" ")}</h4>
                {product.description ? <p>{product.description}</p> : null}
                {product.article ? <p>Артикул: {product.article}</p> : null}
                <strong className="live-poizon-search__total">
                  от {formatRub(lowestOffer.total_rub ?? lowestOffer.quote_rub + lowestOffer.rf_delivery)}
                </strong>
                <p className="live-poizon-search__fixed-until">
                  Цена и курс зафиксированы {fixedUntil(product.expires_at)}.
                </p>
                <div className="live-poizon-search__sizes" aria-label={`Размеры ${product.name}`}>
                  {offers.map((offer) => (
                    <span key={`${product.product_ref}:${offer.size}`}>
                      {offer.size} · {formatRub(offer.total_rub ?? offer.quote_rub + offer.rf_delivery)}
                    </span>
                  ))}
                </div>
                <PriceBreakdown offer={lowestOffer} />
                {storefront.liveSearchBotUrl ? (
                  <a className="button button--quiet" href={storefront.liveSearchBotUrl}>
                    Выбрать и заказать в Telegram
                  </a>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
