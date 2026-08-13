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
  quickFilters,
  resolveAssetUrl,
  scenarioTiles,
  setImageFallback,
  sortOptions,
  taskChips,
  Search,
} from "../landing-data"
import type { ActiveCategory } from "../landing-types"
import type { LandingStorefront } from "../use-landing-storefront"
import { LivePoizonSearch } from "./live-poizon-search"
import { ProductCard } from "./product-card"

interface CatalogSectionProps {
  storefront: LandingStorefront
}

export function CatalogSection({ storefront }: CatalogSectionProps) {
  return (
    <section className="catalog-shell" id="catalog" aria-labelledby="catalog-title">
      <div className="catalog-heading">
        <div>
          <p className="eyebrow">Каталог</p>
          <h2 id="catalog-title">Выберите экипировку под свою игру.</h2>
        </div>
        <p>
          Разделы собраны по реальным сценариям: прыжок, боковая работа,
          защита коленей, тренировка и восстановление после зала.
        </p>
      </div>

      <TaskFinder storefront={storefront} />
      <LivePoizonSearch storefront={storefront} />
      <ScenarioGrid storefront={storefront} />
      <CatalogToolbar storefront={storefront} />
      <CategoryRow storefront={storefront} />

      <div className="catalog-status" aria-live="polite">
        <strong>{storefront.filteredProducts.length} позиций</strong>
        <span>{categoryCopy[storefront.category]}</span>
      </div>

      {storefront.filteredProducts.length > 0 ? (
        <div className="product-grid">
          {storefront.filteredProducts.map((product, index) => (
            <ProductCard
              key={product.slug}
              product={product}
              featured={index === 0}
              index={index}
              openProduct={storefront.openProduct}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-empty" role="status">
          <h3>Ничего не нашли по этому запросу.</h3>
          <p>
            Попробуйте бренд, модель или категорию: ASICS, Mizuno, Nike,
            баскетбол, recovery.
          </p>
          <button type="button" className="button button--quiet" onClick={storefront.resetCatalog}>
            <RotateCcw aria-hidden="true" size={18} />
            Показать всю подборку
          </button>
        </div>
      )}
    </section>
  )
}

function TaskFinder({ storefront }: CatalogSectionProps) {
  return (
    <div className="task-finder" aria-label="Подбор по задаче">
      <div className="task-finder__copy">
        <Search aria-hidden="true" size={22} />
        <span>
          <strong>Подбор по задаче</strong>
          <em>Опишите игру, покрытие, боль или бюджет, а каталог поднимет подходящие позиции.</em>
        </span>
      </div>
      <label className="task-finder__input">
        <span className="sr-only">Опишите задачу для подбора по задаче</span>
        <Search aria-hidden="true" size={18} />
        <input
          type="search"
          value={storefront.taskInput}
          onChange={(event) => storefront.setTaskInput(event.target.value)}
          placeholder="Например: прыжок в волейболе, мягкое приземление, защита коленей..."
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
              const price = getDisplayPrice(match.product)

              return (
                <button
                  key={match.product.slug}
                  type="button"
                  onClick={(event) => storefront.openProduct(match.product, event.currentTarget)}
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
                </button>
              )
            })
          ) : (
            <p>Не нашли точного совпадения. Попробуйте указать спорт, покрытие или бюджет.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function ScenarioGrid({ storefront }: CatalogSectionProps) {
  return (
    <div className="scenario-grid" aria-label="Сценарии выбора">
      {scenarioTiles.map((tile) => {
        const ScenarioIcon = tile.icon

        return (
          <button
            key={tile.id}
            type="button"
            onClick={() => storefront.selectCategory(tile.id)}
            aria-pressed={storefront.category === tile.id}
          >
            <span className="scenario-grid__icon" aria-hidden="true">
              <ScenarioIcon size={22} />
            </span>
            <span>
              <small>{categoryDetails[tile.id]}</small>
              <strong>{tile.title}</strong>
              <em>{tile.text}</em>
            </span>
            <MoveRight aria-hidden="true" size={18} />
          </button>
        )
      })}
    </div>
  )
}

function CatalogToolbar({ storefront }: CatalogSectionProps) {
  return (
    <div className="catalog-toolbar" aria-label="Фильтры каталога">
      <label className="catalog-search">
        <span className="sr-only">Поиск по каталогу</span>
        <Search aria-hidden="true" size={18} />
        <input
          type="search"
          value={storefront.search}
          onChange={(event) => storefront.setSearchValue(event.target.value)}
          placeholder="Nike, ASICS, Mizuno, наколенники, мяч..."
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

      <div className="category-row" role="group" aria-label="Категории">
        {catalogCategories.map((item) => {
          const id = item.id as ActiveCategory
          const CategoryIcon = categoryIcons[id]

          return (
            <button
              key={item.id}
              type="button"
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
