import {
  ArrowUpRight,
  BadgeCheck,
  Copy,
  RotateCcw,
  Search,
  Send,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  catalogCategories,
  catalogProducts,
  filterCatalog,
  findProductBySlug,
  formatRub,
  sortCatalog,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogSort,
  type ProductKind,
} from "../catalog/catalog"
import type { CSSProperties } from "react"
import {
  buildOrderRequest,
  buildTelegramBotUrl,
  copyOrderRequest,
  resolveBotUsername,
} from "./order-request"

type ActiveCategory = "all" | CatalogCategory

interface LandingPageProps {
  configuredBotUsername?: string | null
}

interface UrlState {
  category: ActiveCategory
  search: string
  sort: CatalogSort
  productSlug: string | null
}

const sortOptions: readonly { id: CatalogSort; label: string }[] = [
  { id: "featured", label: "По подборке" },
  { id: "price-asc", label: "Цена ниже" },
  { id: "price-desc", label: "Цена выше" },
  { id: "name", label: "Бренд A-Z" },
]

const categoryCopy: Record<ActiveCategory, string> = {
  all: "Вся подборка",
  volleyball: "Зал, прыжок и боковая устойчивость",
  basketball: "Баскетбольные performance-пары, которые берут для волейбольного зала",
  training: "ОФП, силовой зал и функциональные тренировки",
  recovery: "Слайды, теплый слой и восстановление",
  lifestyle: "Кроссовки на каждый день и культовые пары",
  apparel: "Футболки, худи, аксессуары и верхний слой",
}

const categoryTone: Record<ActiveCategory, string> = {
  all: "gear",
  volleyball: "jump",
  basketball: "court",
  training: "train",
  recovery: "reset",
  lifestyle: "street",
  apparel: "kit",
}

const kindLabels: Record<ProductKind, string> = {
  footwear: "Обувь",
  apparel: "Одежда",
  accessory: "Аксессуар",
}

const fallbackFromPrices: Record<ProductKind, string> = {
  footwear: "от 7 000 ₽",
  apparel: "от 3 000 ₽",
  accessory: "от 2 500 ₽",
}

function marketPriceToFrom(price: string): string {
  const firstNumber = price.match(/^\d+(?:[.,]\d+)?/)?.[0]
  if (!firstNumber) return `от ${price}`
  if (price.includes("тыс")) return `от ${firstNumber} тыс. ₽`
  return `от ${firstNumber} ₽`
}

function getDisplayPrice(product: CatalogProduct) {
  if (product.orderQuote) {
    return {
      detail: "по формуле",
      label: "Цена от",
      value: `от ${formatRub(product.orderQuote.totalRub)}`,
    }
  }

  if (product.marketPrice) {
    return {
      detail: "ориентир",
      label: "Цена от",
      value: marketPriceToFrom(product.marketPrice),
    }
  }

  return {
    detail: "после проверки",
    label: "Цена от",
    value: fallbackFromPrices[product.kind],
  }
}

function getProductTags(product: CatalogProduct): string[] {
  const tags: string[] = []
  const note = product.note.toLowerCase()

  if (product.category === "volleyball") tags.push("волейбол")
  if (product.category === "basketball") tags.push("баскетбол для зала")
  if (product.category === "training") tags.push("ОФП")
  if (product.category === "recovery") tags.push("recovery")
  if (product.category === "lifestyle") tags.push("lifestyle")
  if (product.kind !== "footwear") tags.push(kindLabels[product.kind].toLowerCase())
  if (product.sportPriority) tags.push("для зала")
  if (/цеп|grip|traction/.test(note)) tags.push("цепкость")
  if (/амортиз|мягк|cushion/.test(note)) tags.push("амортизация")
  if (/стабил|боков|control/.test(note)) tags.push("стабильность")

  return Array.from(new Set(tags)).slice(0, 3)
}

function isCategory(value: string | null): value is ActiveCategory {
  return catalogCategories.some((category) => category.id === value)
}

function isSort(value: string | null): value is CatalogSort {
  return sortOptions.some((option) => option.id === value)
}

function readUrlState(): UrlState {
  if (typeof window === "undefined") {
    return { category: "all", search: "", sort: "featured", productSlug: null }
  }

  const params = new URLSearchParams(window.location.search)
  const category = params.get("category")
  const sort = params.get("sort")

  return {
    category: isCategory(category) ? category : "all",
    search: params.get("q") ?? "",
    sort: isSort(sort) ? sort : "featured",
    productSlug: params.get("product"),
  }
}

export function LandingPage({ configuredBotUsername }: LandingPageProps) {
  const initialState = useMemo(() => readUrlState(), [])
  const [category, setCategory] = useState<ActiveCategory>(initialState.category)
  const [search, setSearch] = useState(initialState.search)
  const [sort, setSort] = useState<CatalogSort>(initialState.sort)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initialState.productSlug,
  )
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  )
  const sheetHeadingRef = useRef<HTMLHeadingElement>(null)
  const productTriggerRef = useRef<HTMLButtonElement>(null)

  const botUsername = resolveBotUsername(
    configuredBotUsername === undefined
      ? import.meta.env.VITE_BOT_USERNAME
      : configuredBotUsername,
  )
  const botUrl = buildTelegramBotUrl(botUsername)
  const selectedProduct = useMemo(
    () => findProductBySlug(selectedSlug),
    [selectedSlug],
  )
  const selectedProductPrice = selectedProduct ? getDisplayPrice(selectedProduct) : null
  const selectedGallery = selectedProduct?.gallery ?? []
  const selectedImage =
    selectedGallery[Math.min(selectedImageIndex, selectedGallery.length - 1)] ??
    null
  const filteredProducts = useMemo(() => {
    return sortCatalog(filterCatalog(catalogProducts, category, search), sort)
  }, [category, search, sort])
  const request = selectedProduct ? buildOrderRequest(selectedProduct) : ""

  const categoryCounts = useMemo(() => {
    const counts = new Map<ActiveCategory, number>([["all", catalogProducts.length]])
    for (const item of catalogCategories) {
      if (item.id === "all") continue
      counts.set(
        item.id,
        catalogProducts.filter((product) => product.category === item.id).length,
      )
    }
    return counts
  }, [])

  const writeUrl = (
    nextState: Partial<UrlState>,
    mode: "push" | "replace" = "replace",
  ) => {
    if (typeof window === "undefined") return

    const nextCategory = nextState.category ?? category
    const nextSearch = nextState.search ?? search
    const nextSort = nextState.sort ?? sort
    const nextProductSlug =
      nextState.productSlug === undefined ? selectedSlug : nextState.productSlug
    const url = new URL(window.location.href)

    if (nextCategory === "all") url.searchParams.delete("category")
    else url.searchParams.set("category", nextCategory)

    if (nextSearch.trim()) url.searchParams.set("q", nextSearch.trim())
    else url.searchParams.delete("q")

    if (nextSort === "featured") url.searchParams.delete("sort")
    else url.searchParams.set("sort", nextSort)

    if (nextProductSlug) url.searchParams.set("product", nextProductSlug)
    else url.searchParams.delete("product")

    const nextPath = `${url.pathname}${url.search}${url.hash}`
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextPath === currentPath) return

    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", nextPath)
  }

  useEffect(() => {
    const handlePopState = () => {
      const nextState = readUrlState()
      setCategory(nextState.category)
      setSearch(nextState.search)
      setSort(nextState.sort)
      setSelectedSlug(nextState.productSlug)
      setSelectedImageIndex(0)
      setCopyState("idle")
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    if (!selectedSlug || selectedProduct) return
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    writeUrl({ productSlug: null }, "replace")
  })

  useEffect(() => {
    if (!selectedProduct) return
    sheetHeadingRef.current?.focus({ preventScroll: true })
  }, [selectedProduct])

  useEffect(() => {
    if (!selectedProduct) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      closeProduct()
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  })

  const selectCategory = (nextCategory: ActiveCategory) => {
    setCategory(nextCategory)
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    setCopyState("idle")
    writeUrl({ category: nextCategory, productSlug: null })
  }

  const updateSearch = (nextSearch: string) => {
    setSearch(nextSearch)
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    writeUrl({ search: nextSearch, productSlug: null })
  }

  const updateSort = (nextSort: CatalogSort) => {
    setSort(nextSort)
    writeUrl({ sort: nextSort })
  }

  const resetCatalog = () => {
    setCategory("all")
    setSearch("")
    setSort("featured")
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    setCopyState("idle")
    writeUrl({ category: "all", search: "", sort: "featured", productSlug: null })
  }

  const openProduct = (product: CatalogProduct, trigger: HTMLButtonElement) => {
    productTriggerRef.current = trigger
    setCopyState("idle")
    setSelectedSlug(product.slug)
    setSelectedImageIndex(0)
    writeUrl({ productSlug: product.slug }, "push")
  }

  const closeProduct = () => {
    const trigger = productTriggerRef.current
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    setCopyState("idle")
    writeUrl({ productSlug: null }, "replace")
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    })
  }

  const copyRequest = async () => {
    const copied = await copyOrderRequest(request)
    setCopyState(copied ? "copied" : "failed")
  }

  return (
    <div className={`kb-page ${selectedProduct ? "kb-page--sheet-open" : ""}`}>
      <a className="skip-link" href="#catalog">
        Перейти к каталогу
      </a>

      <header className="kb-header">
        <a className="kb-brand" href="/" aria-label="KICKSBASE">
          <img src="brand/kicksbase-logo.webp" width="80" height="80" alt="" />
          <span>
            <strong>KICKSBASE</strong>
            <small>Заловая экипировка</small>
          </span>
        </a>

        <nav className="kb-nav" aria-label="Основная навигация">
          <a href="#catalog">Каталог</a>
          <a href="#how-it-works">Заказ</a>
          <a href="#trust">Условия</a>
        </nav>

        {botUrl ? (
          <a
            className="kb-header__cta"
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send aria-hidden="true" size={17} />
            Telegram
          </a>
        ) : (
          <a className="kb-header__cta" href="#catalog">
            <ShoppingBag aria-hidden="true" size={17} />
            Выбрать
          </a>
        )}
      </header>

      <main>
        <section className="shop-hero" aria-labelledby="hero-title">
          <a className="shop-hero__media" href="#catalog" aria-label="Открыть каталог">
            <img
              src="brand/kicksbase-culture-hero.webp"
              width="1536"
              height="864"
              alt="Фирменный зал KICKSBASE с экипировкой, court wall и лаймовыми линиями"
            />
          </a>
          <div className="shop-hero__copy">
            <p className="eyebrow">Court kit · shoes · recovery</p>
            <h1 id="hero-title">KICKSBASE</h1>
            <p className="shop-hero__lead">
              Экипировка для людей, которые живут залом: обувь, форма, защита и
              recovery в одной чистой витрине.
            </p>
            <div className="hero-actions">
              <a className="button button--primary" href="#catalog">
                <ShoppingBag aria-hidden="true" size={18} />
                Смотреть каталог
              </a>
              {botUrl ? (
                <a
                  className="button button--quiet"
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Send aria-hidden="true" size={18} />
                  Telegram
                </a>
              ) : null}
            </div>
            <div className="hero-marks" aria-label="Преимущества каталога">
              <span>
                <BadgeCheck aria-hidden="true" size={16} />
                100 позиций
              </span>
              <span>
                <BadgeCheck aria-hidden="true" size={16} />
                Полный комплект
              </span>
              <span>
                <BadgeCheck aria-hidden="true" size={16} />
                Итог до оплаты
              </span>
            </div>
          </div>
        </section>

        <section className="catalog-shell" id="catalog" aria-labelledby="catalog-title">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">Каталог</p>
              <h2 id="catalog-title">Соберите комплект под зал и тренировки.</h2>
            </div>
            <p>
              Фильтруйте по спорту, модели и типу товара. В карточке видны цена от,
              назначение и быстрый запрос менеджеру.
            </p>
          </div>

          <div className="catalog-toolbar" aria-label="Фильтры каталога">
            <label className="catalog-search">
              <span className="sr-only">Поиск по каталогу</span>
              <Search aria-hidden="true" size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="ASICS, Metarise, Nike, худи..."
                autoComplete="off"
              />
            </label>

            <label className="catalog-sort">
              <SlidersHorizontal aria-hidden="true" size={18} />
              <span className="sr-only">Сортировка</span>
              <select
                value={sort}
                onChange={(event) => updateSort(event.target.value as CatalogSort)}
              >
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="icon-button" type="button" onClick={resetCatalog}>
              <RotateCcw aria-hidden="true" size={18} />
              <span className="sr-only">Сбросить фильтры</span>
            </button>
          </div>

          <div className="category-row" role="group" aria-label="Категории">
            {catalogCategories.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={category === item.id}
                onClick={() => selectCategory(item.id)}
                data-tone={categoryTone[item.id]}
              >
                <span className="category-row__mark" aria-hidden="true" />
                <span>{item.label}</span>
                <small>{categoryCounts.get(item.id) ?? 0}</small>
              </button>
            ))}
          </div>

          <div className="catalog-status" aria-live="polite">
            <strong>{filteredProducts.length}</strong>
            <span>{categoryCopy[category]}</span>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product, index) => {
                const price = getDisplayPrice(product)
                const tags = getProductTags(product)

                return (
                  <button
                    className="product-card"
                    type="button"
                    key={product.slug}
                    style={{ "--card-index": index } as CSSProperties}
                    onClick={(event) => openProduct(product, event.currentTarget)}
                    aria-label={`Открыть карточку: ${product.brand} ${product.name}`}
                  >
                    <span className="product-card__visual">
                      <img
                        src={product.image}
                        width="1200"
                        height="900"
                        loading={index < 8 ? "eager" : "lazy"}
                        decoding="async"
                        alt=""
                        onError={(event) => {
                          event.currentTarget.src = product.fallbackImage
                        }}
                      />
                      <span className="product-card__badge">
                        {product.sportPriority ? "Sport" : kindLabels[product.kind]}
                      </span>
                    </span>
                    <span className="product-card__body">
                      <span className="product-card__brand">{product.brand}</span>
                      <strong>{product.name}</strong>
                      <span className="product-card__meta">
                        {product.categoryLabel}
                      </span>
                      <span className="product-card__tags" aria-hidden="true">
                        {tags.slice(0, 2).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </span>
                      <span className="product-card__bottom">
                        <span>
                          <small>{price.label}</small>
                          <b>{price.value}</b>
                          <em>{price.detail}</em>
                        </span>
                        <ArrowUpRight aria-hidden="true" size={19} />
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="catalog-empty" role="status">
              <h3>Ничего не нашли по этому запросу.</h3>
              <p>
                Попробуйте бренд, модель или категорию: ASICS, Mizuno, Nike,
                баскетбол, recovery.
              </p>
              <button type="button" className="button button--quiet" onClick={resetCatalog}>
                <RotateCcw aria-hidden="true" size={18} />
                Показать всю подборку
              </button>
            </div>
          )}
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">Как заказать</p>
            <h2 id="how-title">Путь заказа короткий и понятный.</h2>
          </div>
          <ol className="steps">
            <li>
              <span>1</span>
              <h3>Открыть карточку</h3>
              <p>Посмотреть ракурсы, категорию, назначение и стартовую цену.</p>
            </li>
            <li>
              <span>2</span>
              <h3>Отправить запрос</h3>
              <p>Сайт готовит короткую строку для Telegram без лишней разметки.</p>
            </li>
            <li>
              <span>3</span>
              <h3>Получить расчет</h3>
              <p>Менеджер сверяет размер, продавца, наличие, бирки и итоговую сумму.</p>
            </li>
          </ol>
        </section>

        <section className="trust-section" id="trust" aria-labelledby="trust-title">
          <div className="section-heading">
            <p className="eyebrow">Перед оплатой</p>
            <h2 id="trust-title">Подтверждаем детали заказа.</h2>
          </div>
          <div className="trust-grid">
            <article>
              <h3>Бирки и упаковка</h3>
              <p>Показываем доступный размер, цвет, бирки, коробку или упаковку товара.</p>
            </article>
            <article>
              <h3>Финальная сумма</h3>
              <p>Считаем выкуп, комиссию, логистику и доставку до оплаты.</p>
            </article>
            <article>
              <h3>Подбор комплекта</h3>
              <p>Помогаем собрать пару, защиту, recovery и тренировочные аксессуары под задачу.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="kb-footer">
        <div className="kb-footer__intro">
          <a className="kb-brand" href="/" aria-label="KICKSBASE">
            <img src="brand/kicksbase-logo.webp" width="80" height="80" alt="" />
            <span>
              <strong>KICKSBASE</strong>
              <small>Заловая экипировка</small>
            </span>
          </a>
          <p>
            Витрина для быстрого выбора экипировки под заказ через Telegram. Вы
            выбираете товар, мы подтверждаем размер, бирки, упаковку и финальную сумму до оплаты.
          </p>
        </div>

        <div className="kb-footer__grid" aria-label="Уточнения по заказу">
          <article>
            <strong>Проверка</strong>
            <p>SKU, продавец, размер, цвет и наличие.</p>
          </article>
          <article>
            <strong>Расчет</strong>
            <p>Цена выкупа, комиссия, логистика и итог.</p>
          </article>
          <article>
            <strong>Поддержка</strong>
            <p>Фото товара, бирки и упаковка перед оплатой.</p>
          </article>
        </div>

        <div className="kb-footer__bottom">
          <p>
            Товарные знаки принадлежат их владельцам. Финальное подтверждение по
            заказу всегда делается менеджером перед оплатой.
          </p>
          <a href="#catalog">Открыть каталог</a>
        </div>
      </footer>

      {selectedProduct && (
        <>
          <button
            className="sheet-scrim"
            type="button"
            onClick={closeProduct}
            aria-label="Закрыть карточку товара"
          />
          <aside
            className="product-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-sheet-title"
            data-testid="order-dock"
          >
            <button
              className="product-sheet__close"
              type="button"
              onClick={closeProduct}
              aria-label="Закрыть карточку товара"
            >
              <X aria-hidden="true" size={20} />
            </button>

            <div className="product-sheet__media">
              <img
                src={selectedImage?.src ?? selectedProduct.fallbackImage}
                width="1200"
                height="900"
                alt={selectedImage?.alt ?? `${selectedProduct.brand} ${selectedProduct.name}`}
                onError={(event) => {
                  event.currentTarget.src = selectedProduct.fallbackImage
                }}
              />
              <div className="product-sheet__thumbs" aria-label="Галерея товара">
                {selectedGallery.slice(0, 7).map((image, index) => (
                  <button
                    key={`${image.src}-${index}`}
                    type="button"
                    aria-current={index === selectedImageIndex}
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <img
                      src={image.src}
                      width="120"
                      height="90"
                      alt=""
                      onError={(event) => {
                        event.currentTarget.src = selectedProduct.fallbackImage
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="product-sheet__content">
              <p className="eyebrow">
                {selectedProduct.sportPriority ? "Для зала" : kindLabels[selectedProduct.kind]}
              </p>
              <h2 id="product-sheet-title" ref={sheetHeadingRef} tabIndex={-1}>
                {selectedProduct.brand} {selectedProduct.name}
              </h2>
              <p>{selectedProduct.note}</p>

              <dl className="product-facts">
                <div>
                  <dt>Категория</dt>
                  <dd>{selectedProduct.categoryLabel}</dd>
                </div>
                <div>
                  <dt>Тип</dt>
                  <dd>{kindLabels[selectedProduct.kind]}</dd>
                </div>
                <div>
                  <dt>{selectedProductPrice?.label}</dt>
                  <dd>{selectedProductPrice?.value}</dd>
                </div>
              </dl>

              {selectedProduct.orderQuote ? (
                <dl className="price-breakdown" aria-label="Расчет заказа">
                  <div>
                    <dt>Цена источника</dt>
                    <dd>¥{selectedProduct.orderQuote.priceYuan}</dd>
                  </div>
                  <div>
                    <dt>Курс</dt>
                    <dd>{selectedProduct.orderQuote.yuanRate} ₽/¥</dd>
                  </div>
                  <div>
                    <dt>Выкуп</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.purchaseRub)}</dd>
                  </div>
                  <div>
                    <dt>Оплата {selectedProduct.orderQuote.paymentFeePercent}%</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.paymentFee)}</dd>
                  </div>
                  <div>
                    <dt>Логистика</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.internationalLogistics)}</dd>
                  </div>
                  <div>
                    <dt>Сервис {selectedProduct.orderQuote.serviceFeePercent}%</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.serviceFee)}</dd>
                  </div>
                  <div>
                    <dt>РФ доставка</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.rfDelivery)}</dd>
                  </div>
                  <div>
                    <dt>Итого</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.totalRub)}</dd>
                  </div>
                </dl>
              ) : null}

              <p className="product-sheet__fineprint">
                {selectedProduct.formulaBasis && selectedProduct.orderQuote
                  ? `${selectedProduct.formulaBasis}: ¥${selectedProduct.orderQuote.priceYuan} × ${selectedProduct.orderQuote.yuanRate} ₽ + комиссия оплаты ${selectedProduct.orderQuote.paymentFeePercent}% + международная логистика ${formatRub(selectedProduct.orderQuote.internationalLogistics)} + сервис max(${formatRub(selectedProduct.orderQuote.serviceFeeFloor)}, ${selectedProduct.orderQuote.serviceFeePercent}%). Финальный расчет обновляется после подтверждения размера, наличия и продавца.`
                  : selectedProduct.priceBasis
                    ? `${selectedProduct.priceBasis}. Финальный расчет формируется после подтверждения карточки, размера и продавца.`
                    : "Цена, размер, цвет, наличие, бирки и упаковка подтверждаются по конкретному товару перед оплатой."}
              </p>

              <p className="product-sheet__order-proof">
                После заявки пришлем расчет, фото или скрин товара, доступный размер,
                цвет, продавца, бирки и финальную сумму перед оплатой.
              </p>

              <label className="request-box">
                <span>Запрос менеджеру</span>
                <textarea readOnly value={request} rows={3} />
              </label>

              <div className="product-sheet__actions">
                <button type="button" className="button button--quiet" onClick={copyRequest}>
                  <Copy aria-hidden="true" size={18} />
                  {copyState === "copied" ? "Запрос готов" : "Скопировать запрос"}
                </button>
                {botUrl ? (
                  <a
                    className="button button--primary"
                    href={botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Send aria-hidden="true" size={18} />
                    Открыть @{botUsername}
                  </a>
                ) : (
                  <p className="product-sheet__demo">
                    Ссылка на менеджера появится после подключения Telegram.
                  </p>
                )}
              </div>

              {copyState === "failed" ? (
                <p className="product-sheet__feedback" role="alert">
                  Не удалось скопировать автоматически. Выделите текст выше и скопируйте его вручную.
                </p>
              ) : null}
              <p className="sr-only" aria-live="polite">
                {copyState === "copied" ? "Запрос скопирован в буфер обмена" : ""}
              </p>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
