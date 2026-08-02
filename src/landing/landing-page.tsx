import { AnimatePresence } from "motion/react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { findPublicProductBySlug } from "../catalog/catalog"
import { CatalogSection } from "./sections/catalog-section"
import { CheckoutOutcomePage } from "./checkout-outcome-page"
import { CartDrawer } from "./sections/cart-drawer"
import { Footer } from "./sections/footer"
import { Header } from "./sections/header"
import { HeroSection } from "./sections/hero-section"
import { InfoSections } from "./sections/info-sections"
import { LegalFooter, LegalHeader } from "./sections/legal-chrome"
import { ProductDetailPage } from "./sections/product-detail-page"
import { PaymentDialog } from "./sections/payment-dialog"
import { ProductSheet } from "./sections/product-sheet"
import { useLandingStorefront } from "./use-landing-storefront"

interface LandingPageProps {
  configuredBotUsername?: string | null
}

type StaticRoute =
  | "contacts"
  | "delivery-returns"
  | "offer"
  | "privacy"
  | "personal-data-consent"
  | "cookies"

export function LandingPage({ configuredBotUsername }: LandingPageProps) {
  const storefront = useLandingStorefront(configuredBotUsername)
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(loadFavoriteSlugs)
  const rawPathname = typeof window === "undefined" ? "/" : window.location.pathname
  const pathname = canonicalLegacyPath(rawPathname)
  const searchParams = readSearchParams()
  const routeName = pathname.replace(/^\/|\/$/g, "")
  const productRouteMatch = pathname.match(/^\/product\/([^/]+)\/?$/u)
  const legacyProductSlug = productRouteMatch
    ? null
    : searchParams.get("product")
  let productRouteSlug: string | null = null
  const encodedProductRouteSlug = productRouteMatch?.[1] ?? legacyProductSlug
  if (encodedProductRouteSlug) {
    try {
      productRouteSlug = productRouteMatch?.[1]
        ? decodeURIComponent(encodedProductRouteSlug)
        : encodedProductRouteSlug
    } catch {
      productRouteSlug = null
    }
  }
  const productRoute = productRouteMatch !== null || legacyProductSlug !== null
  const routeProduct = findPublicProductBySlug(productRouteSlug)
  const catalogRoute = pathname === "/catalog"
  const legalDesignRoute =
    staticRouteName(pathname) === "offer" ||
    staticRouteName(pathname) === "privacy" ||
    staticRouteName(pathname) === "personal-data-consent" ||
    staticRouteName(pathname) === "cookies"

  useEffect(() => {
    if (rawPathname === pathname) return
    const hash = pathname === "/catalog" ? "" : window.location.hash
    window.history.replaceState(window.history.state, "", `${pathname}${window.location.search}${hash}`)
  }, [pathname, rawPathname])

  useEffect(() => {
    window.localStorage.setItem("kicksbase-favorites-v1", JSON.stringify(favoriteSlugs))
  }, [favoriteSlugs])

  const toggleFavorite = (slug: string) => {
    setFavoriteSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    )
  }

  useEffect(() => {
    if (!legacyProductSlug || productRouteMatch) return
    const canonicalPath = `/product/${encodeURIComponent(legacyProductSlug)}`
    window.history.replaceState(window.history.state, "", canonicalPath)
  }, [legacyProductSlug, productRouteMatch !== null])
  const checkoutOutcome =
    pathname === "/checkout/success"
      ? "success"
      : pathname === "/checkout/fail"
        ? "fail"
        : null
  const staticRoute: StaticRoute | null =
    routeName === "contacts" ||
    routeName === "delivery-returns" ||
    routeName === "offer" ||
    routeName === "privacy" ||
    routeName === "personal-data-consent" ||
    routeName === "cookies"
      ? routeName
      : null

  return (
    <div className={`kb-page${catalogRoute ? " catalog-page" : ""}${legalDesignRoute ? " legal-page" : ""}`}>
      <a
        className="skip-link"
        href={staticRoute || checkoutOutcome || productRoute ? "#route-main" : "#catalog"}
      >
        {staticRoute || checkoutOutcome || productRoute
          ? "Перейти к содержанию"
          : "Перейти к товарам"}
      </a>

      {legalDesignRoute ? (
        <LegalHeader cartCount={storefront.cartCount} openCart={storefront.openCart} />
      ) : (
        <Header
          cartCount={storefront.cartCount}
          openCart={storefront.openCart}
          personalDataConsentVersion={
            storefront.catalogPriceState.personalDataConsentVersion
          }
          refreshPersonalDataConsentVersion={
            storefront.refreshPersonalDataConsentVersion
          }
          searchValue={storefront.search}
          onSearchChange={storefront.setSearchValue}
          favoriteSlugs={favoriteSlugs}
          onRemoveFavorite={toggleFavorite}
          onOpenProduct={storefront.openProduct}
        />
      )}

      <main
        className={legalDesignRoute ? "legal-main shell" : undefined}
        id={legalDesignRoute ? "route-main" : undefined}
        data-od-id={legalDesignRoute ? "legal-main" : undefined}
      >
        {checkoutOutcome ? (
          <CheckoutOutcomePage
            outcome={checkoutOutcome}
            botUrl={storefront.botUrl}
          />
        ) : staticRoute ? (
          <StaticRoutePage route={staticRoute} />
        ) : productRoute && !routeProduct ? (
          <ProductDetailPage product={routeProduct} storefront={storefront} />
        ) : catalogRoute ? (
          <>
            <section className="catalog-intro container" data-od-id="catalog-intro" aria-labelledby="catalog-page-title">
              <h1 id="catalog-page-title">Каталог<br />KICKSBASE</h1>
            </section>
            <CatalogSection
              storefront={storefront}
              favoriteSlugs={favoriteSlugs}
              onToggleFavorite={toggleFavorite}
              mode="full"
            />
          </>
        ) : (
          <>
            <HeroSection />
            <CatalogSection
              storefront={storefront}
              favoriteSlugs={favoriteSlugs}
              onToggleFavorite={toggleFavorite}
            />
            <InfoSections mode="order" />
          </>
        )}
      </main>

      {legalDesignRoute ? <LegalFooter /> : <Footer />}
      <CookieNotice />

      <AnimatePresence>
        {storefront.selectedProduct ? (
          <ProductSheet key="product-dialog" storefront={storefront} />
        ) : null}
        {storefront.isCartOpen ? (
          <CartDrawer key="cart-drawer" storefront={storefront} />
        ) : null}
        {storefront.checkoutResult.status === "created" ? (
          <PaymentDialog key="payment-dialog" storefront={storefront} />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function canonicalLegacyPath(pathname: string): string {
  if (pathname === "/kicksbase-signal-catalog.html" || pathname === "/kicksbase-signal-catalog-v4.html") return "/catalog"
  if (pathname === "/kicksbase-legal.html") {
    if (window.location.hash === "#privacy") return "/privacy"
    if (window.location.hash === "#delivery") return "/delivery-returns"
    if (window.location.hash === "#contacts") return "/contacts"
    return "/offer"
  }
  if (pathname === "/kicksbase-direction-03-blue-field-v2.html" || pathname === "/kicksbase-signal-pdp.html") return "/"
  return pathname
}

function staticRouteName(pathname: string): StaticRoute | null {
  const routeName = pathname.replace(/^\/|\/$/g, "")
  return routeName === "contacts" ||
    routeName === "delivery-returns" ||
    routeName === "offer" ||
    routeName === "privacy" ||
    routeName === "personal-data-consent" ||
    routeName === "cookies"
    ? routeName
    : null
}

function loadFavoriteSlugs(): string[] {
  if (typeof window === "undefined") return []
  try {
    const value = JSON.parse(window.localStorage.getItem("kicksbase-favorites-v1") || "[]")
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function readSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function StaticRoutePage({ route }: { route: StaticRoute }) {
  if (route === "offer" || route === "privacy") {
    return (
      <LegalPageShell>
        <OfferPage />
        <PrivacyPage />
      </LegalPageShell>
    )
  }
  if (route === "personal-data-consent") {
    return <LegalPageShell><PersonalDataConsentPage /></LegalPageShell>
  }
  if (route === "cookies") return <LegalPageShell><CookiesPage /></LegalPageShell>

  if (route === "contacts") {
    return (
      <article className="legal-route" id="route-main" aria-labelledby="contacts-title">
        <a className="legal-route__back" href="/">На главную</a>
        <p className="legal-route__eyebrow">KICKSBASE</p>
        <h1 id="contacts-title">Контакты</h1>
        <div className="legal-route__grid">
          <section>
            <h2>Поддержка</h2>
            <p><a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a></p>
            <p><a href="https://t.me/kicksbase_officialbot">Telegram @kicksbase_officialbot</a></p>
            <p>Ежедневно с 10:00 до 22:00 по московскому времени.</p>
          </section>
          <section>
            <h2>Продавец</h2>
            <p>ИП Шустров Павел Павлович</p>
            <p>ИНН 772919270272, ОГРНИП 323774600547884</p>
            <p>119607, Москва, ул. Лобачевского, д. 100, корп. 2, кв. 539.</p>
            <p>
              Приём обращений и заказов осуществляется онлайн. Адрес регистрации
              не является публичным шоурумом или пунктом выдачи.
            </p>
          </section>
        </div>
      </article>
    )
  }

  return (
    <article className="legal-route" id="route-main" aria-labelledby="delivery-title">
      <a className="legal-route__back" href="/">На главную</a>
      <p className="legal-route__eyebrow">Условия заказа</p>
      <h1 id="delivery-title">Доставка и возврат</h1>
      <div className="legal-route__grid">
        <section>
          <h2>Доставка</h2>
          <p>
            Местонахождение товара и срок показываются в карточке. Заказы из Китая
            в среднем поступают в Москву за 10-18 дней. Затем заказ передаётся
            в СДЭК. Перед переходом к оплате товаров сайт показывает отдельный
            расчёт доставки. Доставка сохраняется в заказе и оплачивается отдельно
            после прибытия товара.
          </p>
        </section>
        <section>
          <h2>Возврат</h2>
          <p>
            Покупатель вправе отказаться от товара до передачи и в течение 7 дней
            после передачи при сохранении товарного вида и потребительских свойств.
            При получении проверьте упаковку, пломбы и комплектность. Ограничения
            применяются только в случаях, прямо предусмотренных законом.
          </p>
        </section>
        <section>
          <h2>Дополнительные варианты</h2>
          <p>
            По желанию покупателя KICKSBASE может помочь с комиссионной продажей
            неподошедшей пары или начислить бонусные единицы Kikki. Это добровольная
            дополнительная возможность и не заменяет возврат денег, когда он положен
            по закону.
          </p>
        </section>
        <section>
          <h2>Как обратиться</h2>
          <p>
            Напишите на <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>
            {" "}или в Telegram @kicksbase_officialbot. Укажите номер заказа и приложите фото.
          </p>
        </section>
      </div>
    </article>
  )
}

function LegalPageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="legal-hero">
        <p className="legal-kicker">Правовая информация</p>
        <h1>Условия покупки и обработки данных</h1>
        <p>Документы собраны в читаемой форме и доступны до подтверждения заказа.</p>
      </header>
      <nav className="legal-tabs" aria-label="Документы">
        <a href="#offer">Публичная оферта</a>
        <a href="#privacy">Персональные данные</a>
      </nav>
      {children}
    </>
  )
}

function LegalDocument({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <article className="legal-document" id={id} data-od-id={`legal-${id}`}>
      <header className="legal-document-head">
        <h2>{title}</h2>
        <p className="legal-edition">{eyebrow}</p>
      </header>
      <div>
        <div className="legal-sections">{children}</div>
        <p className="legal-review">
          Документ опубликован для информирования пользователей и подлежит проверке
          владельцем и профильным юристом при изменении процессов или законодательства.
        </p>
      </div>
    </article>
  )
}

function OfferPage() {
  return (
    <LegalDocument id="offer" eyebrow="Редакция от 31 июля 2026 года" title="Публичная оферта">
      <section>
        <h3>1. Продавец</h3>
        <p>
          ИП Шустров Павел Павлович, ИНН 772919270272, ОГРНИП 323774600547884.
          Адрес регистрации: 119607, Москва, ул. Лобачевского, д. 100, корп. 2,
          кв. 539. Поддержка: <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>
          {" "}и Telegram @kicksbase_officialbot.
        </p>
      </section>
      <section>
        <h3>2. Товар и заказ</h3>
        <p>
          Витрина предназначена для дистанционной продажи оригинальной обуви,
          одежды и экипировки. Наименование, размер, количество, местонахождение,
          цена и доступный срок показываются в карточке и заказе. Покупатель обязан
          проверить их до оплаты.
        </p>
      </section>
      <section>
        <h3>3. Заключение договора</h3>
        <p>
          Покупатель оформляет заказ, отдельно принимает оферту и даёт согласие на
          обработку данных. Договор заключается в порядке, установленном законом,
          после принятия заказа информационной системой и выдачи подтверждения либо
          кассового чека. При технической ошибке цены стороны действуют по закону и
          согласуют корректное исполнение или возврат оплаты.
        </p>
      </section>
      <section>
        <h3>4. Цена и оплата</h3>
        <p>
          Цена товара указывается в рублях и оплачивается при оформлении. Расчёт
          СДЭК показывается до перехода к платёжному партнёру, сохраняется в заказе
          и оплачивается отдельно после прибытия товара. Доступные способы оплаты
          товаров отображаются на защищённой платёжной странице. Электронный чек направляется
          на указанные email или телефон. Для маркированного товара формируются чеки
          в соответствии с применимыми правилами фискализации.
        </p>
      </section>
      <section>
        <h3>5. Доставка</h3>
        <p>
          Способ, стоимость и ориентировочный срок зависят от местонахождения товара.
          Заказы из Китая в среднем поступают в Москву за 10-18 дней, затем передаются
          в СДЭК по выбранному адресу или коду ПВЗ. Срок является оценкой
          и может меняться из-за перевозки, таможни и обстоятельств вне контроля
          продавца. Покупатель проверяет упаковку, пломбы и комплектность при получении.
        </p>
      </section>
      <section>
        <h3>6. Отказ и возврат</h3>
        <p>
          Покупатель вправе отказаться от товара до передачи и после передачи в
          сроки и на условиях дистанционной продажи, установленных законом. Для
          товара надлежащего качества сохраняются товарный вид и потребительские
          свойства. Происхождение или отправка товара из Китая сами по себе не
          отменяют законные права покупателя. Исключения применяются только в прямо
          предусмотренных законом случаях, включая товар с индивидуально-определёнными
          свойствами. Правила и адрес обращения указаны на странице{" "}
          <a href="/delivery-returns">«Доставка и возврат»</a>.
        </p>
      </section>
      <section>
        <h3>7. Качество и претензии</h3>
        <p>
          При недостатке товара покупатель может заявить предусмотренные законом
          требования. Обращение направляется на support@kicksbase.ru с номером
          заказа, описанием и фото. Продавец подтверждает получение и отвечает в
          применимый законом срок. Спор стороны сначала стараются урегулировать
          претензионно; право обратиться в суд или государственный орган сохраняется.
        </p>
      </section>
      <section>
        <h3>8. Дополнительные варианты</h3>
        <p>
          Комиссионная продажа неподошедшей пары и бонусные единицы Kikki могут
          предлагаться только добровольно. Они не являются деньгами, не выводятся
          на банковскую карту и не заменяют возврат денег, когда он положен по закону.
        </p>
      </section>
    </LegalDocument>
  )
}

function PrivacyPage() {
  return (
    <LegalDocument id="privacy" eyebrow="152-ФЗ · информация для пользователя" title="Политика обработки персональных данных">
      <section>
        <h3>1. Оператор</h3>
        <p>
          ИП Шустров Павел Павлович, ИНН 772919270272, ОГРНИП 323774600547884,
          адрес: 119607, Москва, ул. Лобачевского, д. 100, корп. 2, кв. 539.
          По вопросам данных: <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>.
        </p>
      </section>
      <section>
        <h3>2. Какие данные обрабатываются</h3>
        <p>
          ФИО, телефон, email, адрес и параметры доставки, состав и история заказа,
          сведения об оплате и чеке без хранения полных реквизитов карты, сообщения
          поддержке, данные SMS-входа, IP-адрес, сведения о браузере, журналы
          безопасности, необходимые cookie и локальные идентификаторы.
        </p>
      </section>
      <section>
        <h3>3. Цели</h3>
        <p>
          Регистрация и вход, создание и исполнение заказа, оплата и фискализация,
          доставка, возврат и рассмотрение обращений, защита сайта и предотвращение
          злоупотреблений, исполнение бухгалтерских, налоговых и иных обязанностей.
          Рекламная рассылка не подключается к сервисному SMS-входу автоматически.
        </p>
      </section>
      <section>
        <h3>4. Правовые основания</h3>
        <p>
          Согласие субъекта, заключение и исполнение договора по инициативе
          покупателя, исполнение обязанностей оператора по закону и иные основания,
          прямо предусмотренные законодательством. Там, где требуется согласие,
          пользователь отмечает отдельный пустой чекбокс.
        </p>
      </section>
      <section>
        <h3>5. Действия с данными</h3>
        <p>
          Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение,
          использование, передача необходимым исполнителям, обезличивание,
          блокирование, удаление и уничтожение с применением автоматизированной и
          неавтоматизированной обработки.
        </p>
      </section>
      <section>
        <h3>6. Исполнители</h3>
        <p>
          Данные в минимально необходимом объёме могут получать платёжный партнёр,
          CloudKassir и ОФД, СДЭК и выбранная служба доставки, поставщик сервисных
          SMS, российский хостинг и техническая поддержка. Полные реквизиты карты
          обрабатывает платёжный партнёр. Передача выполняется по договору или
          законному основанию.
        </p>
      </section>
      <section>
        <h3>7. Локализация и сроки</h3>
        <p>
          Первичная запись и хранение данных граждан РФ выполняются с использованием
          баз данных в России. Данные хранятся не дольше, чем требуется для цели,
          договора, претензий и обязательных бухгалтерских, налоговых и кассовых
          сроков, после чего удаляются или обезличиваются, если закон не требует иного.
        </p>
      </section>
      <section>
        <h3>8. Права пользователя</h3>
        <p>
          Пользователь вправе запросить сведения об обработке, доступ, исправление,
          блокирование или удаление данных, отозвать согласие и обжаловать действия
          оператора. Запрос направляется на support@kicksbase.ru; для защиты данных
          оператор может запросить разумное подтверждение личности. Отзыв не отменяет
          обработку, уже выполненную законно, и хранение, обязательное по закону.
        </p>
      </section>
      <section>
        <h3>9. Защита</h3>
        <p>
          Применяются разграничение доступа, HTTPS, журналирование, резервное
          копирование, контроль секретов, ограничение сетевых вызовов и организационные
          меры. Ни один способ защиты не исключает риск полностью; об инцидентах
          оператор действует в установленном законом порядке.
        </p>
      </section>
    </LegalDocument>
  )
}

function PersonalDataConsentPage() {
  return (
    <LegalDocument id="personal-data-consent" eyebrow="Отдельное согласие" title="Согласие на обработку персональных данных">
      <section>
        <h3>Кому даётся согласие</h3>
        <p>
          ИП Шустрову Павлу Павловичу, ИНН 772919270272, ОГРНИП
          323774600547884, по адресу и контактам, указанным на странице{" "}
          <a href="/contacts">«Контакты»</a>.
        </p>
      </section>
      <section>
        <h3>Состав данных и цели</h3>
        <p>
          ФИО, телефон, email, адрес доставки, параметры и история заказа,
          обращения и технические данные обрабатываются для входа, оформления,
          оплаты, фискализации, доставки, возврата, поддержки и безопасности.
          Согласие на рекламные сообщения этим документом не предоставляется.
        </p>
      </section>
      <section>
        <h3>Разрешённые действия</h3>
        <p>
          Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение,
          использование, необходимая передача исполнителям из политики, блокирование,
          удаление и уничтожение автоматизированным и неавтоматизированным способом.
        </p>
      </section>
      <section>
        <h3>Срок и отзыв</h3>
        <p>
          Согласие действует до достижения целей либо отзыва, если закон не требует
          продолжить хранение. Отзыв направляется на support@kicksbase.ru с данными,
          позволяющими найти запрос. Отзыв не влияет на законность действий до его
          получения и может сделать невозможным исполнение незавершённого заказа.
        </p>
      </section>
      <section>
        <h3>Как подтверждается</h3>
        <p>
          Пользователь самостоятельно отмечает пустой чекбокс рядом со ссылкой на
          это согласие. Принятие оферты и согласие на данные являются двумя отдельными
          действиями. Для сервисного SMS-входа используется отдельное согласие в
          форме входа.
        </p>
      </section>
    </LegalDocument>
  )
}

function CookiesPage() {
  return (
    <LegalDocument id="cookies" eyebrow="Только необходимые технологии" title="Уведомление о cookie">
      <section>
        <h3>Что используется</h3>
        <p>
          Сайт использует только необходимые cookie и локальные записи для работы
          сессии и SMS-входа, защиты от межсайтовых запросов, сохранения корзины,
          состояния интерфейса и отметки о показе этого уведомления.
        </p>
      </section>
      <section>
        <h3>Для чего</h3>
        <p>
          Эти технологии обеспечивают безопасность, авторизацию, оформление заказа
          и непрерывность витрины. Рекламные cookie, профилирование и необязательные
          аналитические трекеры в текущей версии не используются.
        </p>
      </section>
      <section>
        <h3>Управление</h3>
        <p>
          Пользователь может удалить или заблокировать записи в настройках браузера.
          После этого потребуется войти заново, корзина может очиститься, а отдельные
          функции заказа перестанут работать. Срок cookie ограничивается задачей
          сессии, безопасностью или сохранением выбранного состояния.
        </p>
      </section>
      <section>
        <h3>Изменения</h3>
        <p>
          Если появятся необязательные аналитические или рекламные технологии,
          уведомление и механизм выбора должны быть обновлены до их включения.
          Вопросы принимаются по адресу support@kicksbase.ru.
        </p>
      </section>
    </LegalDocument>
  )
}

function CookieNotice() {
  const [isVisible, setVisible] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisible(localStorage.getItem("kicksbase-cookie-notice") !== "accepted")
  }, [])

  useEffect(() => {
    const notice = noticeRef.current

    if (!isVisible || !notice) {
      document.documentElement.style.removeProperty("--kb-cookie-notice-height")
      return
    }

    const updateNoticeHeight = () => {
      document.documentElement.style.setProperty(
        "--kb-cookie-notice-height",
        `${Math.ceil(notice.getBoundingClientRect().height)}px`,
      )
    }

    updateNoticeHeight()
    window.addEventListener("resize", updateNoticeHeight)

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateNoticeHeight)
    resizeObserver?.observe(notice)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateNoticeHeight)
      document.documentElement.style.removeProperty("--kb-cookie-notice-height")
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div
      ref={noticeRef}
      className="cookie-notice"
      role="region"
      aria-label="Согласие на использование cookie"
    >
      <p>
        Сайт использует необходимые файлы cookie для работы витрины и сохранения корзины.
        Продолжая использование сайта, вы соглашаетесь с{" "}
        <a href="/privacy">Политикой обработки персональных данных</a>.
      </p>
      <button
        type="button"
        className="button button--primary"
        onClick={() => {
          localStorage.setItem("kicksbase-cookie-notice", "accepted")
          setVisible(false)
        }}
      >
        Понятно
      </button>
    </div>
  )
}
