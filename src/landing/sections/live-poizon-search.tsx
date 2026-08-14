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

const yuan = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 })

function formatRub(value: number) {
  return rub.format(value)
}

function PriceBreakdown({ offer }: { offer: LivePoizonOffer }) {
  const breakdown = offer.price_breakdown
  if (!breakdown) return null

  return (
    <dl className="live-poizon-search__breakdown">
      <div>
        <dt>Цена товара · ¥{yuan.format(offer.price_cny)} × курс ЦБ</dt>
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
          <p className="eyebrow">Другие товары по запросу</p>
          <h3 id="live-poizon-search-title">Проверьте цену модели, которой нет в витрине.</h3>
        </div>
        <p>
          Ищем через наш сервис и считаем по актуальному курсу ЦБ. Результат не является
          статической ценой каталога.
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
        {loading ? <p>Получаем CNY-цену и свежий курс ЦБ…</p> : null}
        {storefront.liveSearchStatus === "unavailable" && storefront.liveSearchMessage ? (
          <p role="status">{storefront.liveSearchMessage}</p>
        ) : null}
      </div>

      {storefront.liveSearchStatus === "ready" ? (
        <div className="live-poizon-search__results" aria-label="Результаты поиска">
          {storefront.liveSearchResults.flatMap((product) =>
            product.offers.map((offer) => (
              <article
                key={`${product.provider_product_id}:${offer.sku_id}`}
                className="live-poizon-search__result"
              >
                <div className="live-poizon-search__result-heading">
                  <span>Цена сейчас</span>
                  <small>Размер: {offer.size}</small>
                </div>
                <h4>{[product.brand, product.name].filter(Boolean).join(" ")}</h4>
                {product.article ? (
                  <p>
                    {product.article} · курс ЦБ: {product.yuan_rate.toFixed(2)} ₽/¥
                  </p>
                ) : (
                  <p>Курс ЦБ: {product.yuan_rate.toFixed(2)} ₽/¥</p>
                )}
                <strong className="live-poizon-search__total">
                  {formatRub(offer.total_rub ?? offer.quote_rub + offer.rf_delivery)}
                </strong>
                <PriceBreakdown offer={offer} />
                {storefront.botUrl ? (
                  <a className="button button--quiet" href={storefront.botUrl}>
                    Продолжить в Telegram
                  </a>
                ) : null}
              </article>
            )),
          )}
        </div>
      ) : null}
    </section>
  )
}
