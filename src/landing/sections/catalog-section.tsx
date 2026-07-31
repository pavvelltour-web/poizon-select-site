import { MoveRight, RotateCcw, SlidersHorizontal } from "lucide-react"

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

export function CatalogSection({ storefront }: CatalogSectionProps) {
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
      </div>

      {storefront.filteredProducts.length > 0 ? (
        <div className="product-grid">
          {storefront.filteredProducts.map((product, index) => (
            <ProductCard
              key={product.slug}
              product={product}
              catalogPriceLookup={storefront.catalogPriceState.lookup}
              featured={index === 0}
              index={index}
            />
          ))}
        </div>
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
    <div className="task-finder" aria-label="Помощь с выбором">
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
              aria-label={
                id === "volleyball"
                  ? "На матч: Волейбол"
                  : id === "basketball"
                    ? "Для движения: Баскетбол"
                    : undefined
              }
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
