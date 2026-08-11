import {
  AlertCircle,
  BadgeCheck,
  ChevronDown,
  MoveRight,
  RotateCcw,
  Send,
} from "lucide-react"
import { useState } from "react"

import { formatRub, publicCatalogProducts, type CatalogSort } from "../../catalog/catalog"
import {
  resolveAssetUrl,
  sortOptions,
  Search,
} from "../landing-data"
import { buildLiveProductTelegramBotUrl } from "../order-request"
import type {
  CatalogSearchFallback,
  CatalogSearchOffer,
  CatalogSearchResult,
} from "../cart"
import type { CatalogSearchState } from "../landing-types"
import type { LandingStorefront } from "../use-landing-storefront"
import { ProductCard } from "./product-card"

interface CatalogSectionProps {
  storefront: LandingStorefront
  favoriteSlugs?: readonly string[]
  onToggleFavorite?: (slug: string) => void
  mode?: "popular" | "full"
}

export const CATALOG_PAGE_SIZE = 24

const approvedPopularSlugs = [
  "nike-kd-18",
  "nike-sabrina-3",
  "nike-aone",
  "asics-sky-elite-ff-3",
  "li-ning-wade-808-4-ultra",
  "new-balance-two-wxy-v5",
  "anta-kai-1",
  "nike-free-metcon-6",
] as const

const finderScenarios = [
  { label: "Для игры в зале", query: "Нужны кроссовки для игры в зале до 25 000 ₽" },
  { label: "Для тренировок", query: "Нужны кроссовки для регулярных тренировок до 22 000 ₽" },
  { label: "Женская посадка", query: "Нужна женская модель для зала до 25 000 ₽" },
] as const

export function CatalogSection({
  storefront,
  favoriteSlugs = [],
  onToggleFavorite,
  mode = "popular",
}: CatalogSectionProps) {
  const viewKey = `${storefront.category}\u0000${storefront.search}\u0000${storefront.sort}`
  const [catalogPage, setCatalogPage] = useState({
    key: viewKey,
    count: CATALOG_PAGE_SIZE,
  })
  const visibleCount = catalogPage.key === viewKey
    ? catalogPage.count
    : CATALOG_PAGE_SIZE
  const visibleProducts = storefront.filteredProducts.slice(0, visibleCount)
  const remainingProducts = Math.max(
    0,
    storefront.filteredProducts.length - visibleProducts.length,
  )
  const nextPageSize = Math.min(CATALOG_PAGE_SIZE, remainingProducts)
  const commerceNotice =
    storefront.catalogPriceState.status === "loading"
      ? "Проверяем доступность оформления. Цены из витрины уже видны."
      : storefront.catalogPriceState.status === "failed"
        ? "Цены из витрины видны. Оформление вернётся после восстановления связи с сервером."
        : !storefront.catalogPriceState.orderCreationEnabled
          ? "Цены видны. Оформление заказа пока отключено."
          : !storefront.catalogPriceState.onlinePaymentEnabled
            ? "Заказ можно оформить. Онлайн-оплата пока недоступна."
            : null

  if (mode === "popular") {
    const popularProducts = approvedPopularSlugs.flatMap((slug) => {
      const product = publicCatalogProducts.find((item) => item.slug === slug)
      return product ? [product] : []
    })

    return (
      <>
        <TaskFinder storefront={storefront} />
        <section className="popular container" id="popular" data-od-id="popular-products" aria-labelledby="catalog-title">
          <span className="anchor-target" id="catalog" aria-hidden="true" />
          <div className="section-head section-head--catalog">
            <div>
              <p className="eyebrow">Популярные модели</p>
              <h2 className="section-title" id="catalog-title" data-od-id="popular-title">Сейчас выбирают</h2>
            </div>
          </div>
          <div className="product-grid" data-od-id="popular-product-grid">
            {popularProducts.map((product, index) => (
              <ProductCard
                key={product.slug}
                product={product}
                catalogPoizonPrice={storefront.catalogPoizonPrices[product.slug] ?? null}
                catalogPoizonPricesReady={storefront.catalogPoizonPricesReady}
                publishedOffer={storefront.catalogPriceState.items[product.slug] ?? null}
                featured={index < 2}
                index={index}
                favorite={favoriteSlugs.includes(product.slug)}
                onToggleFavorite={onToggleFavorite}
                onOpen={storefront.openProduct}
              />
            ))}
          </div>
          <div className="catalog-link-row" data-od-id="catalog-link-row">
            <span className="catalog-total">Нужна другая модель?</span>
            <a className="catalog-link" href="/catalog" data-od-id="catalog-link">Открыть весь каталог <span aria-hidden="true">→</span></a>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <section className="catalog-main container" id="catalog" data-od-id="catalog-products" aria-labelledby="catalog-products-title">
        <CatalogToolbar storefront={storefront} />
        {storefront.search.trim().length >= 2 ? (
          <SearchResults
            state={storefront.catalogSearch}
            botUsername={storefront.botUsername}
            className="catalog-live-search"
          />
        ) : null}

        <div className="catalog-status" aria-live="polite">
          <h2 id="catalog-products-title">Все модели</h2>
          <p>{storefront.filteredProducts.length} товаров{remainingProducts > 0 ? `, показано ${visibleProducts.length}` : ""}</p>
        </div>

        {storefront.filteredProducts.length > 0 ? (
          <>
            <div className="product-grid" id="catalog-product-grid" data-od-id="catalog-product-grid">
              {visibleProducts.map((product, index) => (
                <ProductCard
                  key={product.slug}
                  product={product}
                  catalogPoizonPrice={storefront.catalogPoizonPrices[product.slug] ?? null}
                  catalogPoizonPricesReady={storefront.catalogPoizonPricesReady}
                  publishedOffer={storefront.catalogPriceState.items[product.slug] ?? null}
                  featured={index < 2}
                  index={index}
                  favorite={favoriteSlugs.includes(product.slug)}
                  onToggleFavorite={onToggleFavorite}
                  onOpen={storefront.openProduct}
                />
              ))}
            </div>
            <div className="catalog-link-row">
              <span className="catalog-total">
                {remainingProducts > 0 ? `Осталось ${remainingProducts}` : "Показан весь каталог"}
              </span>
              {remainingProducts > 0 ? (
                <button
                  className="catalog-link"
                  type="button"
                  aria-controls="catalog-product-grid"
                  onClick={() => setCatalogPage({ key: viewKey, count: visibleCount + CATALOG_PAGE_SIZE })}
                >
                  Показать ещё {nextPageSize} <ChevronDown aria-hidden="true" size={18} />
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="catalog-empty" role="status">
            <h3>Ничего не нашли по этому запросу.</h3>
            <p>Попробуйте бренд, модель, размер или задачу.</p>
            <button type="button" className="dialog-primary" onClick={storefront.resetCatalog}>
              <RotateCcw aria-hidden="true" size={18} />
              Показать все товары
            </button>
          </div>
        )}
        {commerceNotice ? (
          <p
            className="catalog-commerce-notice"
            data-tone={storefront.catalogPriceState.status}
            role={storefront.catalogPriceState.status === "failed" ? "alert" : "status"}
          >
            <AlertCircle aria-hidden="true" size={18} />
            {commerceNotice}
          </p>
        ) : null}
      </section>
    </>
  )
}

function TaskFinder({ storefront }: CatalogSectionProps) {
  return (
    <section className="finder-section container" id="finder" data-od-id="finder-section" aria-labelledby="finder-title">
      <div className="finder" aria-label="Помощь с выбором">
        <div>
          <p className="eyebrow">Подбор по задаче</p>
          <h2 id="finder-title" data-od-id="finder-title">Опишите, как вы тренируетесь</h2>
          <p className="finder-copy">Укажите задачу и бюджет — покажем подходящие модели из каталога.</p>
        </div>
        <form className="finder-form" onSubmit={(event) => event.preventDefault()}>
          <div className="scenario-row" aria-label="Быстрые сценарии">
            {finderScenarios.map((scenario) => (
              <button
                className="scenario"
                key={scenario.label}
                type="button"
                aria-pressed={storefront.taskInput === scenario.query}
                onClick={() => storefront.setTaskInput(scenario.query)}
              >
                {scenario.label}
              </button>
            ))}
          </div>
          <div className="finder-input-row">
            <label>
              <span className="sr-only">Опишите задачу для подбора</span>
              <input
                className="text-input"
                type="search"
                value={storefront.taskInput}
                onChange={(event) => storefront.setTaskInput(event.target.value)}
                placeholder="Например: кроссовки для зала до 25 000 ₽"
                autoComplete="off"
              />
            </label>
            <button className="primary-button" type="submit" data-od-id="finder-submit">Показать модели</button>
          </div>
          <div className={`finder-results ${storefront.taskInput.trim().length >= 2 ? "is-visible" : ""}`} aria-live="polite">
            {storefront.taskInput.trim().length >= 2 ? (
              <SearchResults
                state={storefront.taskSearch}
                botUsername={storefront.botUsername}
                className="task-finder__results"
              />
            ) : null}
          </div>
        </form>
      </div>
    </section>
  )
}

interface SearchResultsProps {
  state: CatalogSearchState
  botUsername: string | null
  className: string
}

function SearchResults({ state, botUsername, className }: SearchResultsProps) {
  if (state.status === "idle") return null

  const response = state.response
  const liveResults = response?.status === "ready" ? response.results : []
  const isUnavailable = state.status === "failed" || response?.status === "unavailable"
  const statusText =
    state.status === "loading"
      ? "Ищем в каталоге KICKSBASE..."
      : state.status === "failed"
        ? state.error ?? "Поиск временно недоступен."
        : response?.status === "clarification"
          ? response.clarification ?? "Уточните модель, артикул, размер или бюджет."
          : response?.status === "unavailable"
            ? response.clarification ?? "Поиск по каталогу временно недоступен."
            : null
  const showEmpty =
    state.status === "ready" &&
    response?.status === "ready" &&
    liveResults.length === 0 &&
    state.fallback.length === 0

  return (
    <div className={`live-search ${className}`} data-status={state.status}>
      {statusText ? (
        <p
          className="live-search__status"
          role={isUnavailable ? "alert" : "status"}
          aria-live="polite"
        >
          <AlertCircle aria-hidden="true" size={18} />
          {statusText}
        </p>
      ) : null}

      {liveResults.length > 0 ? (
        <div className="live-search__results" aria-live="polite">
          {liveResults.map((result) => (
            <LiveSearchResultCard
              key={result.productRef}
              result={result}
              botUsername={botUsername}
              normalizedQuery={response?.normalizedQuery ?? null}
            />
          ))}
        </div>
      ) : null}

      {state.fallback.length > 0 ? (
        <div className="live-search__fallback" aria-live="polite">
          <p>
            {response?.status === "catalog"
              ? "Результаты из опубликованного каталога KICKSBASE."
              : "Показаны товары из локальной витрины."}
          </p>
          <div>
            {state.fallback.map((item) => (
              <CatalogFallbackCard key={item.slug} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <p className="live-search__empty" role="status">
          По Poizon по этому запросу ничего не найдено. Уточните модель или артикул.
        </p>
      ) : null}
    </div>
  )
}

function formatSearchSize(offer: CatalogSearchOffer): string {
  const labels = [
    offer.ru ? `RU ${offer.ru}` : null,
    offer.eu ? `EU ${offer.eu}` : null,
    offer.us ? `US ${offer.us}` : null,
    offer.cn ? `CN ${offer.cn}` : null,
  ].filter((label): label is string => !!label)
  return labels.length > 0 ? labels.join(" · ") : `Размер Poizon: ${offer.size}`
}

function LiveSearchResultCard({
  result,
  botUsername,
  normalizedQuery,
}: {
  result: CatalogSearchResult
  botUsername: string | null
  normalizedQuery: string | null
}) {
  const title = [result.brand, result.name].filter(Boolean).join(" ")
  const sizes = [...new Set(result.offers.map(formatSearchSize))]
  const lowestOffer = result.offers.reduce((lowest, offer) =>
    offer.totalRub < lowest.totalRub ? offer : lowest,
  )
  const botHref = buildLiveProductTelegramBotUrl(botUsername, result, normalizedQuery)

  return (
    <article className="live-search-card" data-testid="live-search-result">
      <img
        src={resolveAssetUrl(result.images[0] ?? "")}
        width="1200"
        height="900"
        alt={title}
        onError={(event) => {
          event.currentTarget.hidden = true
        }}
      />
      <div className="live-search-card__content">
        <p className="live-search-card__source">
          <BadgeCheck aria-hidden="true" size={16} />
          Poizon · цена зафиксирована
        </p>
        <h3>{title}</h3>
        {result.article ? <p className="live-search-card__article">Артикул: {result.article}</p> : null}
        {result.color ? <p className="live-search-card__article">Цвет: {result.color}</p> : null}
        {result.description ? <p className="live-search-card__description">{result.description}</p> : null}
        {result.inStock === true ? <p className="live-search-card__availability">В наличии по данным Poizon.</p> : null}
        {result.inStock === false ? <p className="live-search-card__availability">Сейчас нет в наличии по данным Poizon.</p> : null}
        {result.sizeContext ? <p className="live-search-card__sizes">{result.sizeContext}</p> : null}
        {result.sizeChart ? <p className="live-search-card__sizes">{result.sizeChart}</p> : null}
        {result.sizeImage ? (
          <figure className="live-search-card__size-image">
            <img
              src={result.sizeImage}
              alt={`Таблица размеров Poizon для ${title}`}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <figcaption>Таблица размеров от Poizon</figcaption>
          </figure>
        ) : null}
        <p className="live-search-card__sizes">
          Доступные размеры: {sizes.join(", ")}
        </p>
        <p className="live-search-card__price">
          <span>Итог от</span>
          <strong>{formatRub(lowestOffer.totalRub)}</strong>
        </p>
        <p className="live-search-card__delivery">
          Включая фиксированную доставку по РФ {formatRub(lowestOffer.rfDelivery)}.
        </p>
        <div className="live-search-card__offers" aria-label={`Размеры и итоговые цены ${title}`}>
          {result.offers.map((offer) => (
            <span key={`${result.productRef}:${offer.size}`}>
              {formatSearchSize(offer)} · {formatRub(offer.totalRub)}
              {offer.available === null ? " · наличие уточняется" : " · в наличии"}
            </span>
          ))}
        </div>
        <div className="live-search-card__actions">
          {botHref ? (
            <a
              className="button button--primary"
              href={botHref}
              target="_blank"
              rel="noreferrer"
            >
              <Send aria-hidden="true" size={16} />
              Выбрать в Telegram
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function CatalogFallbackCard({ item }: { item: CatalogSearchFallback }) {
  const title = [item.brand, item.name].filter(Boolean).join(" ")

  return (
    <a
      className="live-search-fallback"
      href={item.navigationUrl}
      aria-label={`Открыть товар: ${title}`}
    >
      <img
        src={resolveAssetUrl(item.image)}
        width="1200"
        height="900"
        alt=""
        onError={(event) => {
          event.currentTarget.hidden = true
        }}
      />
      <span>
        <small>Опубликованный каталог KICKSBASE</small>
        <strong>{title}</strong>
      </span>
      <MoveRight aria-hidden="true" size={18} />
    </a>
  )
}

function CatalogToolbar({ storefront }: CatalogSectionProps) {
  return (
    <div className="catalog-controls" data-od-id="catalog-controls" aria-label="Фильтры товаров">
      <label className="catalog-search" htmlFor="catalog-search-input">
        <span className="sr-only">Поиск по товарам</span>
        <Search aria-hidden="true" size={18} />
        <input
          id="catalog-search-input"
          type="search"
          value={storefront.search}
          onChange={(event) => storefront.setSearchValue(event.target.value)}
          placeholder="Найти бренд или модель"
          autoComplete="off"
        />
      </label>

      <label className="catalog-sort">
        <span className="sr-only">Сортировка</span>
        <select
          id="catalog-sort-select"
          aria-label="Сортировка"
          value={storefront.sort}
          onChange={(event) => storefront.selectSort(event.target.value as CatalogSort)}
        >
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
