import { LoaderCircle, Search } from "lucide-react"

import { safeHttpsUrl } from "../cart"
import { buildLiveProductTelegramBotUrl } from "../order-request"
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

function formatLiveSize(offer: LivePoizonOffer): string {
  const labels = [
    offer.ru ? `RU ${offer.ru}` : null,
    offer.eu ? `EU ${offer.eu}` : null,
    offer.us ? `US ${offer.us}` : null,
    offer.cn ? `CN ${offer.cn}` : null,
  ].filter((label): label is string => !!label)
  return labels.length > 0 ? labels.join(" · ") : `Размер Poizon: ${offer.size}`
}

function populatedText(value: string | null | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : ""
  return text || null
}

function liveProductTitle(brand: string | null | undefined, name: string): string {
  const normalizedBrand = populatedText(brand)
  const normalizedName = name.trim()
  if (!normalizedBrand) return normalizedName

  // Batch Sync product names sometimes already include the brand. Keep the
  // card title natural instead of rendering e.g. “Nike Nike Air Force 1”.
  return normalizedName.toLocaleLowerCase().startsWith(normalizedBrand.toLocaleLowerCase())
    ? normalizedName
    : `${normalizedBrand} ${normalizedName}`
}

function stockLabel(inStock: boolean | null | undefined): string | null {
  if (inStock === true) return "В наличии по данным Poizon."
  if (inStock === false) return "Сейчас нет в наличии по данным Poizon."
  return null
}

function offerStockLabel(offer: LivePoizonOffer): string {
  if (offer.available === true) return " · в наличии"
  if (offer.available === false) return " · нет в наличии"
  return " · наличие уточняется"
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
        {storefront.liveSearchStatus === "clarification" && storefront.liveSearchMessage ? (
          <div className="live-poizon-search__clarification" role="status">
            <p>{storefront.liveSearchMessage}</p>
            {storefront.liveSearchClarificationOptions.length > 0 ? (
              <div className="live-poizon-search__choices" aria-label="Уточнить модель">
                {storefront.liveSearchClarificationOptions.map((option) => (
                  <button
                    className="button button--quiet"
                    key={option.query}
                    type="button"
                    onClick={() => void storefront.submitLiveSearch(option.query)}
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
        <div className="live-poizon-search__results" aria-label="Результаты живого поиска Poizon">
          {storefront.liveSearchResults.map((product) => {
            const offers = product.offers
            const availability = stockLabel(product.in_stock)
            const sizeContext = populatedText(product.size_context)
            const sizeChart = populatedText(product.size_chart)
            const sizeImage = safeHttpsUrl(product.size_image)
            // The documented source uses both a text chart and a URL in this
            // field depending on the seller. Render a verified URL as the
            // chart itself rather than exposing an unhelpful raw link.
            const sizeChartImage = safeHttpsUrl(sizeChart)
            const sizeChartText = sizeChartImage ? null : sizeChart
            const sizeImages = [...new Set(
              [sizeImage, sizeChartImage].filter((image): image is string => Boolean(image)),
            )]
            const lowestOffer = offers.reduce<LivePoizonOffer | null>(
              (lowest, offer) =>
                !lowest || offer.total_rub < lowest.total_rub
                  ? offer
                  : lowest,
              null,
            )
            if (!lowestOffer) return null
            const botHref = buildLiveProductTelegramBotUrl(
              storefront.botUsername,
              product,
              storefront.liveSearchNormalizedQuery,
            )
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
                  <span>Цена Poizon проверена сейчас</span>
                  <small>Выберите размер</small>
                </div>
                <h4>{liveProductTitle(product.brand, product.name)}</h4>
                {product.description ? <p>{product.description}</p> : null}
                {product.article ? <p>Артикул: {product.article}</p> : null}
                {product.color ? <p>Цвет: {product.color}</p> : null}
                {availability ? <p className="live-poizon-search__availability">{availability}</p> : null}
                {sizeContext ? <p className="live-poizon-search__size-context">{sizeContext}</p> : null}
                {sizeChartText ? <p className="live-poizon-search__size-chart">{sizeChartText}</p> : null}
                {sizeImages.map((image) => (
                  <figure key={image} className="live-poizon-search__size-image">
                    <img
                      src={image}
                      alt={`Таблица размеров Poizon для ${product.name}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <figcaption>Таблица размеров от Poizon</figcaption>
                  </figure>
                ))}
                <strong className="live-poizon-search__total">
                  от {formatRub(lowestOffer.total_rub)}
                </strong>
                <p className="live-poizon-search__fixed-until">
                  Цена и курс получены по текущему запросу Poizon. Перед оформлением
                  выбранный размер перепроверяется.
                </p>
                <div className="live-poizon-search__sizes" aria-label={`Размеры ${product.name}`}>
                  {offers.map((offer) => (
                    <span key={`${product.product_ref}:${offer.size}`}>
                      {formatLiveSize(offer)} · {formatRub(offer.total_rub)}
                      {offerStockLabel(offer)}
                    </span>
                  ))}
                </div>
                <PriceBreakdown offer={lowestOffer} />
                {botHref ? (
                  <a className="button button--quiet" href={botHref} target="_blank" rel="noreferrer">
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
