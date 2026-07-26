import { useEffect, useMemo, useRef, useState } from "react"

import {
  catalogCategories,
  catalogProducts,
  filterCatalog,
  type CatalogCategory,
  type CatalogProduct,
  type ProductKind,
} from "../catalog/catalog"
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

const categoryCopy: Record<ActiveCategory, string> = {
  all: "Вся витрина: sport-first, лайфстайл и одежда",
  volleyball: "Зал, прыжок, боковое движение и фиксация",
  training: "ОФП, силовой зал и функциональные тренировки",
  recovery: "Слайды, худи и вещи после тренировки",
  lifestyle: "Кроссовки на каждый день и культовые пары",
  apparel: "Футболки, худи, аксессуары и верхний слой",
}

const kindLabels: Record<ProductKind, string> = {
  footwear: "Обувь",
  apparel: "Одежда",
  accessory: "Аксессуар",
}

const sizeHints: Record<ProductKind, string> = {
  footwear: "EU 39–45 · точный размер проверит менеджер",
  apparel: "S–XL · посадку сверяем перед оплатой",
  accessory: "One size / размер по карточке",
}

const marketplaceNotes = [
  {
    title: "Поиск как в крупном магазине",
    text: "Сначала задача и категория, потом карточка товара. Без длинного лендинга перед покупкой.",
  },
  {
    title: "Цена как рыночный ориентир",
    text: "Показываем диапазон по РФ для sport-first, но финал считаем после проверки размера и продавца.",
  },
  {
    title: "Один понятный CTA",
    text: "Карточка готовит чистый запрос для Telegram-бота: бренд, модель, артикул или сценарий.",
  },
]

export function LandingPage({ configuredBotUsername }: LandingPageProps) {
  const [category, setCategory] = useState<ActiveCategory>("all")
  const [search, setSearch] = useState("")
  const [selectedProduct, setSelectedProduct] =
    useState<CatalogProduct | null>(null)
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
  const filteredProducts = useMemo(
    () => filterCatalog(catalogProducts, category, search),
    [category, search],
  )
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

  const openProduct = (
    product: CatalogProduct,
    trigger: HTMLButtonElement,
  ) => {
    productTriggerRef.current = trigger
    setCopyState("idle")
    setSelectedProduct(product)
  }

  const closeProduct = () => {
    const trigger = productTriggerRef.current
    setSelectedProduct(null)
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    })
  }

  const copyRequest = async () => {
    const copied = await copyOrderRequest(request)
    setCopyState(copied ? "copied" : "failed")
  }

  return (
    <div
      id="top"
      className={`kb-page ${selectedProduct ? "kb-page--sheet-open" : ""}`}
    >
      <a className="skip-link" href="#catalog">
        Перейти к товарам
      </a>

      <header className="kb-header">
        <a className="kb-brand" href="#top" aria-label="KicksBase — главная">
          <img
            src="brand/kicksbase-logo.webp"
            width="720"
            height="720"
            alt=""
          />
          <span>
            <strong>KicksBase</strong>
            <small>Poizon buyer</small>
          </span>
        </a>

        <nav className="kb-nav" aria-label="Основная навигация">
          <a href="#catalog">Каталог</a>
          <a href="#fit-guide">Как выбрать</a>
          <a href="#how-it-works">Как заказать</a>
        </nav>

        <a className="kb-header__cta" href="#catalog">
          Смотреть товары
        </a>
      </header>

      <main>
        <section className="hero-shop" aria-labelledby="hero-title">
          <div className="hero-shop__copy">
            <p className="eyebrow">Sport-first selection · 60 товаров</p>
            <h1 id="hero-title">Кроссовки и экипировка для заказа через Poizon.</h1>
            <p className="hero-shop__lead">
              Витрина KicksBase начинается со спорта: 20 пар обуви и 10 вещей
              для волейбола, ОФП и восстановления. Выберите товар, откройте
              карточку и отправьте готовый запрос в Telegram.
            </p>

            <label className="hero-search">
              <span>Быстрый поиск</span>
              <SearchIcon />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ASICS, Metarise, Nike, шорты..."
                autoComplete="off"
              />
            </label>

            <div className="hero-shop__actions" aria-label="Быстрые действия">
              <a className="button button--primary" href="#catalog">
                Перейти к каталогу
                <ArrowIcon />
              </a>
              <a className="button button--quiet" href="#fit-guide">
                Подобрать по задаче
              </a>
            </div>
          </div>

          <div className="hero-shop__visual" aria-label="Витрина KicksBase">
            <img
              src="brand/kicksbase-hero.webp"
              width="1600"
              height="1000"
              alt="Кроссовки и тренировочная форма на белой студийной поверхности"
            />
            <div className="hero-card">
              <span>SPORT FIRST</span>
              <strong>30 позиций</strong>
              <p>Зал, тренинг, recovery</p>
            </div>
          </div>
        </section>

        <section className="store-logic" aria-label="Принципы витрины">
          {marketplaceNotes.map((note) => (
            <article key={note.title}>
              <h2>{note.title}</h2>
              <p>{note.text}</p>
            </article>
          ))}
        </section>

        <section className="fit-guide" id="fit-guide" aria-labelledby="fit-title">
          <div className="section-heading">
            <p className="eyebrow">Shop by need</p>
            <h2 id="fit-title">Выберите не раздел, а задачу.</h2>
          </div>
          <div className="need-grid">
            <button type="button" onClick={() => setCategory("volleyball")}>
              <span>01</span>
              <strong>Волейбол</strong>
              <small>Прыжок, боковая устойчивость, зал</small>
            </button>
            <button type="button" onClick={() => setCategory("training")}>
              <span>02</span>
              <strong>Тренинг</strong>
              <small>ОФП, силовая, функциональная работа</small>
            </button>
            <button type="button" onClick={() => setCategory("recovery")}>
              <span>03</span>
              <strong>Recovery</strong>
              <small>Слайды, тёплый слой, дорога домой</small>
            </button>
            <button type="button" onClick={() => setCategory("lifestyle")}>
              <span>04</span>
              <strong>Лайфстайл</strong>
              <small>Пары на каждый день и громкие силуэты</small>
            </button>
          </div>
        </section>

        <section className="catalog-shell" id="catalog" aria-labelledby="catalog-title">
          <div className="section-heading section-heading--catalog">
            <div>
              <p className="eyebrow">Catalog</p>
              <h2 id="catalog-title">60 товаров в понятной магазинной сетке.</h2>
            </div>
            <p>
              Для sport-first позиций указан редакционный диапазон рынка РФ на
              26.07.2026. Это не оферта и не обещание наличия: менеджер
              подтверждает цвет, размер, продавца и итоговую цену перед оплатой.
            </p>
          </div>

          <div className="catalog-layout">
            <aside className="catalog-sidebar" aria-label="Фильтр каталога">
              <p>Категории</p>
              <div className="category-list" role="group" aria-label="Категории">
                {catalogCategories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={category === item.id}
                    onClick={() => setCategory(item.id)}
                  >
                    <span>{item.label}</span>
                    <small aria-hidden="true">{categoryCounts.get(item.id) ?? 0}</small>
                  </button>
                ))}
              </div>
              <div className="sidebar-note">
                <strong>{categoryCounts.get(category) ?? 0}</strong>
                <span>{categoryCopy[category]}</span>
              </div>
            </aside>

            <div className="catalog-main">
              <div className="catalog-bar">
                <p aria-live="polite">Найдено: {filteredProducts.length}</p>
                <label className="catalog-search">
                  <span className="sr-only">Поиск по каталогу</span>
                  <SearchIcon />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Поиск по бренду, модели или артикулу"
                    autoComplete="off"
                  />
                </label>
              </div>

              {filteredProducts.length > 0 ? (
                <div className="product-grid">
                  {filteredProducts.map((product, index) => (
                    <button
                      className={`product-card ${product.sportPriority ? "product-card--sport" : ""}`}
                      type="button"
                      key={product.slug}
                      onClick={(event) => openProduct(product, event.currentTarget)}
                      aria-label={`Проверить цену и размер: ${product.brand} ${product.name}`}
                    >
                      <span className="product-card__visual">
                        <img
                          src={product.image}
                          width="1200"
                          height="900"
                          loading={index < 6 ? "eager" : "lazy"}
                          decoding="async"
                          alt=""
                        />
                        <span className="product-card__badge">
                          {product.sportPriority ? "SPORT" : kindLabels[product.kind]}
                        </span>
                      </span>
                      <span className="product-card__body">
                        <span className="product-card__meta">
                          <span>{product.brand}</span>
                          <span>{product.categoryLabel}</span>
                        </span>
                        <strong>{product.name}</strong>
                        <span className="product-card__note">{product.note}</span>
                        <span className="product-card__bottom">
                          <span>
                            <small>{product.marketPrice ? "Рынок РФ*" : "Цена"}</small>
                            <b>{product.marketPrice ?? "по запросу"}</b>
                          </span>
                          <span className="product-card__arrow">
                            <ArrowIcon />
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="catalog-empty" role="status">
                  <h3>В подборке такого названия пока нет.</h3>
                  <p>
                    Сбросьте фильтр или отправьте точное название боту: он ищет
                    шире этой витрины.
                  </p>
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => {
                      setCategory("all")
                      setSearch("")
                    }}
                  >
                    Показать все 60 позиций
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">Order flow</p>
            <h2 id="how-title">Как клиент проходит путь.</h2>
          </div>
          <ol className="steps">
            <li>
              <span>1</span>
              <h3>Открывает карточку</h3>
              <p>Смотрит ориентир, назначение, диапазон рынка и доступный тип размера.</p>
            </li>
            <li>
              <span>2</span>
              <h3>Отправляет запрос</h3>
              <p>Сайт готовит короткий текст для бота без лишних фраз и HTML.</p>
            </li>
            <li>
              <span>3</span>
              <h3>Получает проверку</h3>
              <p>Бот или менеджер сверяет карточку, размер, продавца и итоговый расчёт.</p>
            </li>
          </ol>
        </section>

        <section className="trust-section" aria-labelledby="trust-title">
          <div className="section-heading">
            <p className="eyebrow">Before payment</p>
            <h2 id="trust-title">Что важно знать перед заказом.</h2>
          </div>
          <div className="trust-grid">
            <article>
              <h3>Каталог показывает 60 товарных ориентиров</h3>
              <p>
                30 sport-first позиций стоят в начале витрины: 20 пар обуви и
                10 вещей для спортсменов. Остальные 30 — сохранённые
                лайфстайл-позиции.
              </p>
            </article>
            <article>
              <h3>Все 30 ценовых диапазонов — редакционные ориентиры</h3>
              <p>
                Это рыночная выборка на 26.07.2026, а не индивидуальная
                проверка каждой модели или SKU. Финальный расчёт делает менеджер
                перед оплатой.
              </p>
            </article>
            <article>
              <h3>Визуалы помогают выбрать, но не заменяют проверку</h3>
              <p>
                Изображения — project-generated референсы. Цвет, продавец,
                размерную сетку и наличие подтверждаем в карточке Poizon.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="kb-footer">
        <a className="kb-brand" href="#top" aria-label="KicksBase — наверх">
          <img src="brand/kicksbase-logo.webp" width="720" height="720" alt="" />
          <span>
            <strong>KicksBase</strong>
            <small>Poizon buyer</small>
          </span>
        </a>
        <p>
          Визуалы являются project-generated референсами, не официальными
          фото брендов. Товарные знаки принадлежат владельцам.
        </p>
        <a href="#top">Наверх</a>
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
              <CloseIcon />
            </button>
            <div className="product-sheet__media">
              <img
                src={selectedProduct.image}
                width="1200"
                height="900"
                alt={`${selectedProduct.brand} ${selectedProduct.name}`}
              />
            </div>
            <div className="product-sheet__content">
              <p className="eyebrow">
                {selectedProduct.sportPriority ? "Sport-first" : kindLabels[selectedProduct.kind]}
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
                  <dt>Размер</dt>
                  <dd>{sizeHints[selectedProduct.kind]}</dd>
                </div>
                <div>
                  <dt>{selectedProduct.marketPrice ? "Ориентир рынка" : "Цена"}</dt>
                  <dd>{selectedProduct.marketPrice ?? "по запросу"}</dd>
                </div>
              </dl>

              {selectedProduct.priceBasis ? (
                <p className="product-sheet__fineprint">
                  {selectedProduct.priceBasis}. Финальный расчёт формируется
                  после проверки карточки, размера и продавца.
                </p>
              ) : (
                <p className="product-sheet__fineprint">
                  Лайфстайл-позиции считаются после проверки конкретной
                  карточки и размера.
                </p>
              )}

              <label className="request-box">
                <span>Текст для Telegram</span>
                <textarea readOnly value={request} rows={3} />
              </label>

              <div className="product-sheet__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={copyRequest}
                >
                  <CopyIcon />
                  {copyState === "copied" ? "Запрос скопирован" : "Скопировать запрос"}
                </button>
                {botUrl ? (
                  <a
                    className="button button--dark"
                    href={botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть @{botUsername}
                    <ArrowIcon />
                  </a>
                ) : (
                  <p className="product-sheet__demo">
                    Демо-режим: запрос можно скопировать. Ссылка на Telegram
                    появится после подключения имени бота.
                  </p>
                )}
              </div>

              {copyState === "failed" ? (
                <p className="product-sheet__feedback" role="alert">
                  Не удалось скопировать автоматически. Выделите текст выше и
                  скопируйте его вручную.
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

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="7" y="7" width="9" height="9" rx="1.5" />
      <path d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  )
}
