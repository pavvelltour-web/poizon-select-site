import { AlertCircle, ChevronDown, MoveRight, RotateCcw, SlidersHorizontal } from "lucide-react"
import { useState } from "react"

import {
  catalogCategories,
  type CatalogSort,
} from "../../catalog/catalog"
import {
  categoryCopy,
  categoryDetails,
  categoryIcons,
  categoryTone,
  getDisplayPrice,
  getProductPath,
  quickFilters,
  resolveAssetUrl,
  setImageFallback,
  sortOptions,
  taskChips,
  Search,
} from "../landing-data"
import type { ActiveCategory } from "../landing-types"
import type { LandingStorefront } from "../use-landing-storefront"
import { ProductCard } from "./product-card"

interface CatalogSectionProps {
  storefront: LandingStorefront
}

export const CATALOG_PAGE_SIZE = 24

const categoryAccessibleNames: Record<ActiveCategory, string> = {
  all: "Все товары",
  "court-shoes": "Кроссовки для зала",
  volleyball: "Волейбольные пары для матча",
  basketball: "Баскетбольные пары для игры",
  recovery: "Обувь для восстановления после тренировки",
  apparel: "Спортивная одежда",
  sneakers: "Базовые модели на каждый день",
}

export function CatalogSection({ storefront }: CatalogSectionProps) {
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

  return (
    <section className="catalog-shell" id="catalog" aria-labelledby="catalog-title">
      <div className="catalog-heading">
        <div>
          <h2 id="catalog-title">Выберите товар.</h2>
        </div>
        <p>
          Откройте модель, посмотрите фотографии и выберите размер. Если нужного
          товара нет, введите бренд, модель или задачу в поиске.
        </p>
      </div>

      <TaskFinder storefront={storefront} />
      <CatalogToolbar storefront={storefront} />
      <CategoryRow storefront={storefront} />

      <div className="catalog-status" aria-live="polite">
        <strong>{storefront.filteredProducts.length} товаров</strong>
        <span>{categoryCopy[storefront.category]}</span>
        {remainingProducts > 0 ? (
          <span>Показано {visibleProducts.length}</span>
        ) : null}
      </div>

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

      {storefront.filteredProducts.length > 0 ? (
        <>
          <div className="product-grid" id="catalog-product-grid">
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.slug}
                product={product}
                catalogPriceLookup={storefront.catalogPriceState.lookup}
                catalogStatus={storefront.catalogPriceState.status}
                publishedOffer={storefront.catalogPriceState.items[product.slug] ?? null}
                featured={index === 0}
                index={index}
              />
            ))}
          </div>
          {remainingProducts > 0 ? (
            <div className="catalog-more">
              <button
                className="button button--quiet"
                type="button"
                aria-controls="catalog-product-grid"
                onClick={() =>
                  setCatalogPage({
                    key: viewKey,
                    count: visibleCount + CATALOG_PAGE_SIZE,
                  })
                }
              >
                Показать ещё {nextPageSize}
                <ChevronDown aria-hidden="true" size={18} />
              </button>
              <span>Осталось {remainingProducts}</span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="catalog-empty" role="status">
          <h3>Ничего не нашли по этому запросу.</h3>
          <p>
            Попробуйте бренд, модель, размер или задачу: ASICS, Mizuno, Nike,
            зал, игровой день, восстановление.
          </p>
          <button type="button" className="button button--quiet" onClick={storefront.resetCatalog}>
            <RotateCcw aria-hidden="true" size={18} />
            Показать все товары
          </button>
        </div>
      )}
    </section>
  )
}

function TaskFinder({ storefront }: CatalogSectionProps) {
  return (
    <div className="task-finder" id="selection" aria-label="Помощь с выбором">
      <div className="task-finder__copy">
        <Search aria-hidden="true" size={22} />
        <span>
          <strong>Поможем выбрать</strong>
          <em>Опишите задачу. Поиск покажет подходящие пары.</em>
        </span>
      </div>
      <label className="task-finder__input">
        <span className="sr-only">Опишите задачу для подбора</span>
        <Search aria-hidden="true" size={18} />
        <input
          type="search"
          value={storefront.taskInput}
          onChange={(event) => storefront.setTaskInput(event.target.value)}
          placeholder="Бренд, модель, задача, размер, цвет и бюджет"
          autoComplete="off"
        />
      </label>
      <div className="task-finder__chips" aria-label="Быстрые задачи">
        {taskChips.map((task) => (
          <button key={task} type="button" onClick={() => storefront.setTaskInput(task)}>
            {task}
          </button>
        ))}
      </div>
      {storefront.taskInput.trim() ? (
        <div className="task-finder__results" aria-live="polite">
          {storefront.taskMatches.length > 0 ? (
            storefront.taskMatches.slice(0, 4).map((match) => {
              const price = getDisplayPrice(match.product, storefront.catalogPriceState.lookup)

              return (
                <a
                  key={match.product.slug}
                  href={getProductPath(match.product)}
                  aria-label={`Открыть товар: ${match.product.brand} ${match.product.name}`}
                >
                  <img
                    src={resolveAssetUrl(match.product.image)}
                    width="1200"
                    height="900"
                    alt=""
                    onError={(event) => setImageFallback(event, match.product.fallbackImage)}
                  />
                  <span>
                    <small>{match.reason}</small>
                    <strong>
                      {match.product.brand} {match.product.name}
                    </strong>
                    <em>{price.value}</em>
                  </span>
                  <MoveRight aria-hidden="true" size={18} />
                </a>
              )
            })
          ) : (
            <p>Не нашли точного совпадения. Укажите задачу, размер или модель.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CatalogToolbar({ storefront }: CatalogSectionProps) {
  return (
    <div className="catalog-toolbar" aria-label="Фильтры товаров">
      <label className="catalog-search">
        <span className="sr-only">Поиск по товарам</span>
        <Search aria-hidden="true" size={18} />
        <input
          type="search"
          value={storefront.search}
          onChange={(event) => storefront.setSearchValue(event.target.value)}
          placeholder="Nike, ASICS, Mizuno, размер, модель..."
          autoComplete="off"
        />
      </label>

      <label className="catalog-sort">
        <SlidersHorizontal aria-hidden="true" size={18} />
        <span className="sr-only">Сортировка</span>
        <select
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

      <button className="icon-button" type="button" onClick={storefront.resetCatalog}>
        <RotateCcw aria-hidden="true" size={18} />
        <span className="sr-only">Сбросить фильтры</span>
      </button>
    </div>
  )
}

function CategoryRow({ storefront }: CatalogSectionProps) {
  return (
    <>
      <div className="quick-refine" aria-label="Быстрые подборки">
        {quickFilters.map((filter) => {
          const QuickIcon = filter.icon

          return (
            <button
              key={filter.label}
              type="button"
              onClick={() =>
                storefront.applyQuickFilter({
                  category: filter.category as ActiveCategory,
                  search: "search" in filter ? filter.search : undefined,
                  sort: "sort" in filter ? (filter.sort as CatalogSort) : undefined,
                })
              }
            >
              <QuickIcon aria-hidden="true" size={18} />
              <span>
                <strong>{filter.label}</strong>
                <small>{filter.detail}</small>
              </span>
            </button>
          )
        })}
      </div>

      <div className="category-row" role="group" aria-label="Категории товара">
        {catalogCategories.map((item) => {
          const id = item.id as ActiveCategory
          const CategoryIcon = categoryIcons[id]

          return (
            <button
              key={item.id}
              type="button"
              aria-label={categoryAccessibleNames[id]}
              aria-pressed={storefront.category === item.id}
              data-tone={categoryTone[id]}
              onClick={() => storefront.selectCategory(id)}
            >
              <span className="category-row__mark" aria-hidden="true" />
              <span className="category-row__icon" aria-hidden="true">
                <CategoryIcon size={18} />
              </span>
              <span className="category-row__content">
                <span>{item.label}</span>
                <em>{categoryDetails[id]}</em>
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}
