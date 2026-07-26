import { useEffect, useMemo, useRef, useState } from "react"

import {
  catalogCategories,
  catalogProducts,
  filterCatalog,
  type CatalogCategory,
  type CatalogProduct,
} from "../catalog/catalog"
import { MagicMarquee } from "./magic-marquee"
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

const processItems = [
  "Название или ссылка",
  "Поиск карточки",
  "Сверка фото и цены",
  "Проверка перед заказом",
]

export function LandingPage({
  configuredBotUsername,
}: LandingPageProps) {
  const [category, setCategory] = useState<ActiveCategory>("all")
  const [search, setSearch] = useState("")
  const [selectedProduct, setSelectedProduct] =
    useState<CatalogProduct | null>(null)
  const [copyState, setCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle")
  const orderHeadingRef = useRef<HTMLHeadingElement>(null)
  const orderTriggerRef = useRef<HTMLButtonElement>(null)

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

  useEffect(() => {
    if (!selectedProduct) return
    orderHeadingRef.current?.focus({ preventScroll: true })
  }, [selectedProduct])

  useEffect(() => {
    if (!selectedProduct) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return

      event.preventDefault()
      const trigger = orderTriggerRef.current
      setSelectedProduct(null)
      queueMicrotask(() => {
        if (trigger?.isConnected) trigger.focus({ preventScroll: true })
      })
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [selectedProduct])

  const prepareRequest = (
    product: CatalogProduct,
    trigger: HTMLButtonElement,
  ) => {
    orderTriggerRef.current = trigger
    setCopyState("idle")
    setSelectedProduct(product)
  }

  const closeRequest = () => {
    const trigger = orderTriggerRef.current
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
      className={`buyer-landing ${selectedProduct ? "buyer-landing--order-open" : ""}`}
    >
      <a className="skip-link" href="#catalog">
        Перейти к каталогу
      </a>

      <header className="site-header">
        <a className="brand-lockup" href="#top" aria-label="SELECT — на главную">
          <span className="brand-lockup__mark" aria-hidden="true">
            S/
          </span>
          <span>
            <strong>SELECT</strong>
            <small>personal buyer</small>
          </span>
        </a>

        <nav className="site-nav" aria-label="Основная навигация">
          <a href="#catalog">Каталог</a>
          <a href="#how-it-works">Как заказать</a>
          <a href="#questions">Вопросы</a>
        </nav>

        <a className="header-action" href="#catalog">
          Выбрать вещь
          <ArrowIcon />
        </a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="kicker">
              Каталог байера <span aria-hidden="true">·</span> 60 позиций
            </p>
            <h1 id="hero-title">
              <span className="hero__line">Вы называете</span>
              <span className="hero__line hero__line--accent">вещь.</span>
              <span className="hero__line">Мы начинаем</span>
              <span className="hero__line hero__line--accent">поиск.</span>
            </h1>
            <p className="hero__lede">
              Спортивная подборка для волейболистов стоит первой: 20 пар обуви
              и 10 вещей для игры, тренировок и восстановления. Ещё 30
              лайфстайл-позиций сохранены ниже. Цену и размер всегда
              подтверждаем перед заказом.
            </p>
            <div className="hero__actions">
              <a className="button button--primary" href="#catalog">
                Смотреть подборку
                <ArrowIcon />
              </a>
              <a className="text-link" href="#how-it-works">
                Как это работает
              </a>
            </div>
            <dl className="hero__facts">
              <div>
                <dt>2 формата</dt>
                <dd>Название или ссылка</dd>
              </div>
              <div>
                <dt>Без догадок</dt>
                <dd>Цена только после проверки</dd>
              </div>
            </dl>
          </div>

          <div className="hero__stage" aria-label="Пример задания для байера">
            <div className="hero__index" aria-hidden="true">
              60
            </div>
            <img
              className="hero__image"
              src="catalog/asics-sky-elite-ff-3.webp"
              width="1200"
              height="900"
              alt=""
            />
            <article className="buyer-ticket">
              <div className="buyer-ticket__head">
                <span>BUYER REQUEST</span>
                <span>READY</span>
              </div>
              <p className="buyer-ticket__title">Найти карточку</p>
              <dl>
                <div>
                  <dt>Что можно прислать</dt>
                  <dd>Модель, артикул или URL</dd>
                </div>
                <div>
                  <dt>Что получите</dt>
                  <dd>Карточку, фото и расчёт</dd>
                </div>
              </dl>
              <div className="buyer-ticket__code" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </article>
            <p className="hero__caption">
              Демо-каталог <span>→</span> запрос в Telegram
            </p>
          </div>
        </section>

        <section className="process-rail" aria-label="Этапы поиска товара">
          <p className="sr-only">
            Название или ссылка, поиск карточки, сверка фото и цены, проверка
            перед заказом.
          </p>
          <MagicMarquee pauseOnHover>
            {processItems.map((item) => (
              <span className="process-rail__item" key={item}>
                {item}
                <span aria-hidden="true">↗</span>
              </span>
            ))}
          </MagicMarquee>
        </section>

        <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
          <div className="section-intro">
            <p className="kicker">SPORT FIRST · текущая подборка</p>
            <div>
              <h2 id="catalog-title">60 товаров: сначала спорт, затем лайфстайл.</h2>
              <p>
                Первые 30 позиций собраны для аудитории пляжного и классического
                волейбола: 20 пар обуви и 10 вещей. Все 30 ценовых диапазонов —
                редакционные ориентиры по выборочной выборке публичных
                предложений РФ на 26.07.2026, а не индивидуальная проверка
                каждой модели или SKU. Конкретный размер, цвет и итоговую цену
                менеджер сверяет перед оплатой.
              </p>
            </div>
          </div>

          <aside className="sport-pricing" aria-label="Как считается итоговая цена">
            <div className="sport-pricing__lead">
              <span>20 пар</span>
              <span>10 вещей</span>
              <strong>SPORT FIRST</strong>
            </div>
            <div>
              <p className="sport-pricing__title">Понятная наценка без скрытой цены</p>
              <p>
                Итог = закупка + платёжные расходы + международная логистика +
                сервис. Для обуви ориентир сервиса — <b>max(1 500 ₽, 12%)</b>,
                для одежды — <b>max(700 ₽, 15%)</b>. Доставка по РФ считается
                отдельно и процентом повторно не облагается.
              </p>
            </div>
            <div className="sport-pricing__example">
              <span>Пример расчёта</span>
              <strong>10 000 + 1 800 + 700 + 1 500 = 14 000 ₽</strong>
              <small>до доставки по РФ · финал только после проверки</small>
            </div>
          </aside>

          <div className="catalog-toolbar">
            <div
              className="catalog-filters"
              role="group"
              aria-label="Фильтр каталога"
            >
              {catalogCategories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                >
                  {item.label}
                  <span aria-hidden="true">
                    {item.id === "all"
                      ? catalogProducts.length
                      : catalogProducts.filter(
                          (product) => product.category === item.id,
                        ).length}
                  </span>
                </button>
              ))}
            </div>

            <label className="catalog-search">
              <span className="sr-only">Поиск по каталогу</span>
              <SearchIcon />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Бренд или модель"
                autoComplete="off"
              />
            </label>
          </div>

          <p className="catalog-count" aria-live="polite">
            Найдено: {filteredProducts.length}
          </p>

          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => {
                const productNumber =
                  catalogProducts.findIndex(
                    (catalogProduct) => catalogProduct.slug === product.slug,
                  ) + 1

                return (
                  <article
                    className={`product-card ${product.sportPriority ? "product-card--sport" : ""}`}
                    key={product.slug}
                  >
                    <div
                      className={`product-card__visual product-card__visual--${product.category}`}
                    >
                      <span className="product-card__number" aria-hidden="true">
                        {String(productNumber).padStart(2, "0")}
                      </span>
                      <img
                        src={product.image}
                        width="1200"
                        height="900"
                        loading="lazy"
                        decoding="async"
                        alt=""
                      />
                      <span className="product-card__image-note">
                        Визуальный ориентир
                      </span>
                      {product.sportPriority ? (
                        <span className="product-card__priority">SPORT FIRST</span>
                      ) : null}
                    </div>
                    <div className="product-card__body">
                      <div className="product-card__meta">
                        <span>{product.brand}</span>
                        <span>{product.categoryLabel}</span>
                      </div>
                      <h3>{product.name}</h3>
                      <p>{product.note}</p>
                      <div className="product-card__footer">
                        <div>
                          <span>
                            {product.marketPrice ? "Рынок РФ*" : "Цена"}
                          </span>
                          <strong>{product.marketPrice ?? "по запросу"}</strong>
                          {product.priceBasis ? (
                            <small>{product.priceBasis}</small>
                          ) : null}
                        </div>
                        <button
                          className="circle-action"
                          type="button"
                          onClick={(event) =>
                            prepareRequest(product, event.currentTarget)
                          }
                          aria-label={`Проверить цену и размер: ${product.brand} ${product.name}`}
                        >
                          <ArrowIcon />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="catalog-empty" role="status">
              <p>В подборке такого названия пока нет.</p>
              <span>
                Сбросьте фильтр или отправьте точное название боту — он ищет
                шире витрины.
              </span>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setCategory("all")
                  setSearch("")
                }}
              >
                Показать все 60 позиций
              </button>
            </div>
          )}
        </section>

        <section
          className="how-section"
          id="how-it-works"
          aria-labelledby="how-title"
        >
          <div className="how-section__heading">
            <p className="kicker">Путь заказа</p>
            <h2 id="how-title">Три понятных шага — без фальшивой цены на витрине.</h2>
          </div>
          <ol className="steps">
            <li>
              <span>01</span>
              <h3>Покажите товар</h3>
              <p>
                Выберите позицию здесь, напишите название или пришлите ссылку
                на открытую HTML-карточку товара. Большинство таких страниц
                бот попробует разобрать автоматически.
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>Проверьте совпадение</h3>
              <p>
                Бот выделит модель из запроса и попробует найти её карточку в
                источнике Poizon. Если автоматическое распознавание не
                сработает, запрос увидит менеджер.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Подтвердите расчёт</h3>
              <p>
                Сверьте фото, размер и актуальную цену. Если источник не
                подтвердился, запрос уйдёт на ручную проверку.
              </p>
            </li>
          </ol>
        </section>

        <section
          className="questions-section"
          id="questions"
          aria-labelledby="questions-title"
        >
          <div>
            <p className="kicker">Коротко о важном</p>
            <h2 id="questions-title">До первого сообщения.</h2>
          </div>
          <div className="questions-list">
            <details>
              <summary>
                Можно искать товар, которого нет в подборке?
                <PlusIcon />
              </summary>
              <p>
                Да. Каталог показывает 60 товарных ориентиров. Бот принимает
                свободное название, артикул или ссылку на публичную страницу
                товара.
              </p>
            </details>
            <details>
              <summary>
                Почему здесь нет фиксированных цен?
                <PlusIcon />
              </summary>
              <p>
                Цена зависит от размера, продавца и момента проверки. Сайт не
                показывает выдуманную стоимость: расчёт формируется после
                подтверждения карточки источника.
              </p>
            </details>
            <details>
              <summary>
                Сайт работает без токена Telegram?
                <PlusIcon />
              </summary>
              <p>
                Да. В демо-режиме запрос можно подготовить и скопировать. Для
                кнопки перехода достаточно публичного имени бота; секретный
                BOT_TOKEN сайту не нужен и не должен попадать в его файлы.
              </p>
            </details>
          </div>
        </section>

        <section className="closing-cta" aria-labelledby="closing-title">
          <p className="kicker">Не нашли нужное?</p>
          <h2 id="closing-title">Принесите ссылку. Поиск начнём с неё.</h2>
          <p>
            Лучше всего подходят открытые HTML-карточки магазинов: бот
            попробует извлечь название и сопоставить его с Poizon. Сложные или
            закрытые страницы уйдут менеджеру на ручную проверку.
          </p>
          <a className="button button--light" href="#catalog">
            Выбрать отправную точку
            <ArrowIcon />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand-lockup brand-lockup--footer" href="#top">
          <span className="brand-lockup__mark" aria-hidden="true">
            S/
          </span>
          <span>
            <strong>SELECT</strong>
            <small>personal buyer</small>
          </span>
        </a>
        <p>
          Демонстрационная витрина. Товарные знаки принадлежат их владельцам.
          Наличие и цена подтверждаются отдельно.
        </p>
        <a href="#top">Наверх ↑</a>
      </footer>

      {selectedProduct && (
        <aside
          className="order-dock"
          aria-labelledby="order-dock-title"
          data-testid="order-dock"
        >
          <div className="order-dock__identity">
            <span>Запрос подготовлен</span>
            <h2 id="order-dock-title" ref={orderHeadingRef} tabIndex={-1}>
              {selectedProduct.brand} {selectedProduct.name}
            </h2>
          </div>
          <label className="order-dock__request">
            <span>Текст для бота</span>
            <textarea readOnly value={request} rows={4} />
          </label>
          <div className="order-dock__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={copyRequest}
            >
              <CopyIcon />
              {copyState === "copied" ? "Запрос скопирован" : "Скопировать"}
            </button>
            {botUrl ? (
              <a
                className="button button--outline"
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть @{botUsername}
                <ArrowIcon />
              </a>
            ) : (
              <p className="order-dock__demo">
                Демо-режим: запрос можно скопировать. Ссылка на Telegram
                появится после подключения бота.
              </p>
            )}
            {copyState === "failed" && (
              <p className="order-dock__feedback" role="alert">
                Не удалось скопировать автоматически. Выделите текст выше и
                скопируйте его вручную.
              </p>
            )}
            <p className="sr-only" aria-live="polite">
              {copyState === "copied"
                ? "Запрос скопирован в буфер обмена"
                : ""}
            </p>
          </div>
          <button
            className="order-dock__close"
            type="button"
            onClick={closeRequest}
            aria-label="Закрыть подготовленный запрос"
          >
            <CloseIcon />
          </button>
        </aside>
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3v14M3 10h14" />
    </svg>
  )
}
