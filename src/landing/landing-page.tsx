import { AnimatePresence } from "motion/react"
import { useEffect, useRef, useState, type ReactNode } from "react"

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
  | "how-it-works"
  | "faq"
  | "authenticity"
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
  const routeProduct = storefront.products.find((product) => product.slug === productRouteSlug) ?? null
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
    routeName === "how-it-works" ||
    routeName === "faq" ||
    routeName === "authenticity" ||
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
          products={storefront.products}
          catalogPriceLookup={storefront.catalogPriceState.lookup}
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
          storefront.catalogPriceState.status === "loading"
            ? <p id="route-main" role="status">Загружаем товар из каталога Poizon…</p>
            : storefront.catalogPriceState.status === "failed"
              ? <section id="route-main" className="container">
                <h1>Каталог Poizon временно недоступен</h1>
                <p>Не удалось проверить этот товар. Повторите попытку после восстановления связи.</p>
                <a href="/catalog">Открыть каталог</a>
              </section>
              : <ProductDetailPage product={routeProduct} storefront={storefront} />
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
  if (pathname.endsWith("/") && pathname.slice(0, -1) === "/catalog") return pathname.slice(0, -1)
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
    routeName === "how-it-works" ||
    routeName === "faq" ||
    routeName === "authenticity" ||
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

  if (route === "how-it-works") return <HowItWorksPage />
  if (route === "faq") return <FaqPage />
  if (route === "authenticity") return <AuthenticityPage />

  return (
    <article className="legal-route" id="route-main" aria-labelledby="delivery-title">
      <a className="legal-route__back" href="/">На главную</a>
      <p className="legal-route__eyebrow">Условия заказа</p>
      <h1 id="delivery-title">Доставка и возврат</h1>
      <div className="legal-route__grid">
        <section>
          <h2>Доставка</h2>
          <p><strong>Товары из наличия:</strong> отправка по РФ через СДЭК занимает 1–3 рабочих дня.</p>
          <p>
            <strong>Товары под выкуп из Китая:</strong> средний срок поступления на
            склад в Москве — 10–18 дней. Это ориентир; в редких случаях из-за
            углублённого таможенного досмотра, праздничных дней в КНР/РФ или
            загруженности погранпереходов международная доставка может занять до 2 месяцев.
          </p>
          <p>
            Международная доставка 1500 ₽ уже включена в цену каждого товара.
            Точная доставка по РФ рассчитывается через RAKETA до оплаты товара,
            сохраняется в заказе и оплачивается отдельно после прибытия в РФ.
          </p>
        </section>
        <section>
          <h2>Возврат</h2>
          <p>
            <strong>Из наличия в РФ:</strong> отказаться можно до получения и в
            течение 7 дней после получения при сохранении товарного вида, ярлыков
            и упаковки. Обратную доставку товара надлежащего качества оплачивает покупатель.
          </p>
          <p>
            <strong>Под выкуп из Китая:</strong> до фактического выкупа заказ можно
            отменить с возвратом 100% средств. После выкупа расходы на закупку по
            индивидуальному запросу считаются фактически понесёнными и не
            возвращаются; возврат надлежащего товара из-за размера или фасона не производится.
          </p>
        </section>
        <section>
          <h2>Брак или ошибочный товар</h2>
          <p>
            При производственном браке либо ошибочном артикуле/размере по вине
            продавца или исполнителя оформим полный возврат средств или замену за наш счёт.
          </p>
        </section>
        <section>
          <h2>Если не подошёл размер</h2>
          <p>
            Для индивидуального заказа из Китая поможем продать неподошедшую пару
            через комиссионный отдел или по согласованию начислим бонусные единицы
            Kikki. Эти варианты добровольны и не являются выводимыми деньгами.
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

function HowItWorksPage() {
  return (
    <article className="legal-route" id="route-main" aria-labelledby="how-title">
      <a className="legal-route__back" href="/">На главную</a>
      <p className="legal-route__eyebrow">Путь заказа</p>
      <h1 id="how-title">Как работает KICKSBASE</h1>
      <p>
        Мы объединяем склад наличия в Москве и байерский сервис для прямого
        выкупа оригинальных товаров с Poizon (Dewu) в Китае.
      </p>
      <div className="legal-route__grid">
        <section>
          <h2>Из наличия в Москве</h2>
          <ol>
            <li>Выберите позицию с меткой «В наличии».</li>
            <li>Оформите и оплатите заказ на сайте.</li>
            <li>Мы передадим товар в СДЭК в течение 1–3 рабочих дней.</li>
            <li>Получите заказ с правом возврата в течение 7 дней.</li>
          </ol>
        </section>
        <section>
          <h2>Под выкуп из Китая</h2>
          <ol>
            <li>Выберите модель и размер с меткой «Под заказ из КНР».</li>
            <li>Проверьте итог выкупа, комиссии и международной логистики.</li>
            <li>После оплаты байер выкупит конкретную пару в Китае.</li>
            <li>Poizon проведёт многоэтапную проверку подлинности.</li>
            <li>RAKETA организует международную логистику и таможенное оформление.</li>
            <li>Ориентир до Москвы — 10–18 дней, в редких случаях до 2 месяцев.</li>
            <li>После прибытия в РФ оплатите рассчитанную доставку по России.</li>
          </ol>
        </section>
      </div>
    </article>
  )
}

function FaqPage() {
  return (
    <article className="legal-route" id="route-main" aria-labelledby="faq-title">
      <a className="legal-route__back" href="/">На главную</a>
      <p className="legal-route__eyebrow">Помощь покупателю</p>
      <h1 id="faq-title">Частые вопросы</h1>
      <div className="legal-route__grid">
        <section><h2>Как проверяется подлинность?</h2><p>Товары под заказ выкупаются на Poizon/Dewu, проходят многоэтапную экспертную проверку и получают фирменную пломбу, сертификат с QR-кодом и цифровой идентификатор.</p></section>
        <section><h2>Зачем паспорт и ИНН?</h2><p>Они нужны исключительно для персонального таможенного декларирования международной посылки. Мы запросим их после оплаты и передадим логистическому партнёру и таможенным органам в необходимом объёме.</p></section>
        <section><h2>Если не подошёл размер из Китая?</h2><p>После индивидуального выкупа возврат надлежащего товара не производится. Мы можем помочь с комиссионной продажей пары или по согласованию начислить Kikki.</p></section>
        <section><h2>Почему доставка по РФ отдельно?</h2><p>1500 ₽ международной доставки уже включены в товар. Точный российский тариф рассчитывает RAKETA; он фиксируется в заказе и оплачивается перед отправкой из Москвы или при получении.</p></section>
        <section><h2>Что если заказ задерживается?</h2><p>10–18 дней — ориентир. При таможенных проверках, праздниках или загруженности границы срок может увеличиться до 2 месяцев; поддержку по заказу даём через email и Telegram.</p></section>
      </div>
    </article>
  )
}

function AuthenticityPage() {
  return (
    <article className="legal-route" id="route-main" aria-labelledby="auth-title">
      <a className="legal-route__back" href="/">На главную</a>
      <p className="legal-route__eyebrow">Legit Check</p>
      <h1 id="auth-title">Гарантия оригинальности</h1>
      <div className="legal-route__grid">
        <section><h2>Экспертиза</h2><p>Специалисты проверяют геометрию колодки, материалы, швы, ультрафиолетовые маркировки, стельки, бирки и коробку, затем сравнивают детали с эталонной базой и присваивают паре индивидуальный номер.</p></section>
        <section><h2>Комплектация</h2><p>Успешно проверенная пара получает фирменную пломбу Poizon, сертификат подлинности с QR-кодом и защитную упаковку. Снятие пломбы нарушает целостность результата проверки.</p></section>
        <section><h2>Наша гарантия</h2><p>При сомнениях организуем повторную независимую экспертизу. Если она выявит несоответствие, вернём 100% средств, включая логистические расходы.</p></section>
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
    <LegalDocument id="offer" eyebrow="Редакция от 9 сентября 2026 года" title="Публичная оферта">
      <section>
        <h3>1. Продавец / Исполнитель</h3>
        <p>
          ИП Шустров Павел Павлович, ИНН 772919270272, ОГРНИП 323774600547884.
          Адрес регистрации: 119607, Москва, ул. Лобачевского, д. 100, корп. 2,
          кв. 539. Поддержка: <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>
          {" "}и Telegram @kicksbase_support_bot.
        </p>
      </section>
      <section>
        <h3>2. Предмет договора и варианты заказа</h3>
        <p>
          KICKSBASE продаёт товары из наличия со склада в РФ по правилам
          дистанционной торговли, а также оказывает по поручению Заказчика услуги
          персонального выкупа оригинальных товаров у зарубежных продавцов и на
          площадках в КНР с организацией международной доставки в РФ.
        </p>
        <p>
          Тип заказа, наименование, размер, количество, местонахождение, цена и
          ориентировочный срок отображаются в карточке товара и заказе. Покупатель
          (Заказчик) обязан проверить все параметры до оплаты.
        </p>
      </section>
      <section>
        <h3>3. Заключение договора</h3>
        <p>
          Покупатель оформляет заказ, отдельно принимает оферту и даёт согласие на
          обработку данных. Договор считается заключённым с момента принятия заказа
          системой и оплаты Покупателем. При технической ошибке расчёта цены стороны
          согласуют корректное исполнение либо возврат оплаты до отправки товара из
          наличия или совершения выкупа в КНР.
        </p>
      </section>
      <section>
        <h3>4. Цена и оплата</h3>
        <p>
          Для товара из наличия указывается розничная цена. Для товара под выкуп
          общая сумма состоит из стоимости выкупа в КНР, вознаграждения Исполнителя
          и расходов на международную логистику. Международная доставка 1500 ₽
          включена в цену товара. Расчёт доставки по РФ выполняется через RAKETA,
          показывается до перехода к платёжному партнёру, сохраняется в заказе и
          оплачивается отдельно после прибытия товара на склад в РФ либо перед отправкой.
          Электронный чек направляется на email или телефон.
        </p>
      </section>
      <section>
        <h3>5. Доставка</h3>
        <p>
          Товары из наличия передаются в СДЭК в течение 1–3 рабочих дней с момента
          оплаты. Товары под выкуп из КНР в среднем поступают в Москву за 10–18 дней,
          после чего передаются в СДЭК. Срок ориентировочный; в редких случаях из-за
          таможенных проверок, праздничных дней, загруженности погранпереходов или
          иных обстоятельств вне контроля Исполнителя международная доставка может
          занять до 2 месяцев. При получении Покупатель проверяет упаковку, пломбы
          и комплектность.
        </p>
      </section>
      <section>
        <h3>6. Отказ и возврат</h3>
        <p>
          <strong>Из наличия в РФ:</strong> отказ возможен до передачи и в течение
          7 дней после неё при сохранении товарного вида, потребительских свойств,
          оригинальной упаковки, пломб и ярлыков. Обратную доставку товара
          надлежащего качества оплачивает Покупатель или её стоимость удерживается
          из возвращаемой суммы (ст. 26.1 Закона РФ «О защите прав потребителей»).
        </p>
        <p>
          <strong>Под выкуп из КНР:</strong> до фактического выкупа у продавца
          возможен отказ с возвратом 100% средств. После выкупа направленная на него
          сумма признаётся фактически понесёнными расходами (ст. 32 Закона РФ «О
          защите прав потребителей», ст. 782 ГК РФ) и возврату не подлежит. Возврат
          товара надлежащего качества по причине неподходящего размера или фасона
          после выкупа не производится. Подробности — на странице{" "}
          <a href="/delivery-returns">«Доставка и возврат»</a>.
        </p>
      </section>
      <section>
        <h3>7. Качество и претензионный порядок</h3>
        <p>
          При производственном браке либо ошибочном артикуле или размере по вине
          Продавца/Исполнителя гарантируется полный возврат средств или замена за
          наш счёт. Претензия направляется на support@kicksbase.ru с номером заказа,
          описанием и фото/видео. Ответ предоставляется в установленный законом срок;
          спор сначала урегулируется в досудебном порядке.
        </p>
      </section>
      <section>
        <h3>8. Дополнительные варианты</h3>
        <p>
          Комиссионная продажа неподошедшей пары, в том числе выкупленной из КНР,
          и зачисление бонусных единиц Kikki являются добровольными сервисными
          услугами. Они не являются деньгами, не выводятся на карту и предоставляются
          по согласованию сторон для помощи Покупателю.
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
          паспортные данные (серия, номер, дата выдачи, кем выдан) и ИНН,
          необходимые для таможенного оформления международных грузов, сведения
          об оплате и чеке без хранения полных реквизитов карты, сообщения поддержке,
          данные SMS-входа, IP-адрес, сведения о браузере, журналы безопасности,
          необходимые cookie и локальные идентификаторы.
        </p>
      </section>
      <section>
        <h3>3. Цели</h3>
        <p>
          Регистрация и вход, создание и исполнение заказов из наличия и услуг по
          персональному выкупу из КНР, оплата и фискализация, международная и
          внутрироссийская доставка, таможенное декларирование, возврат и рассмотрение
          обращений, защита сайта и исполнение бухгалтерских, налоговых и иных обязанностей.
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
          использование, передача необходимым исполнителям, включая трансграничную
          передачу, обезличивание,
          блокирование, удаление и уничтожение с применением автоматизированной и
          неавтоматизированной обработки.
        </p>
      </section>
      <section>
        <h3>6. Исполнители и трансграничная передача</h3>
        <p>
          Данные в минимально необходимом объёме могут получать платёжный партнёр,
          CloudKassir и ОФД; логистический партнёр по международной доставке,
          таможенной очистке и консолидации грузов из КНР, включая ООО «РАКЕТА-СИЭН»
          и сервис RAKETA; СДЭК и иные курьерские службы по РФ; поставщик сервисных
          SMS, российский хостинг и техническая поддержка. Полные реквизиты карты
          обрабатывает платёжный партнёр.
        </p>
        <p>
          При заказе под выкуп из Китая пользователь прямо соглашается на обработку
          и трансграничную передачу минимально необходимых данных — ФИО, телефона,
          паспортных данных, ИНН и адреса — логистическим партнёрам и таможенным
          органам исключительно для декларирования, таможенной очистки и доставки
          товара из КНР в РФ. Передача выполняется по договору или законному основанию.
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
        <h3>1. Перечень персональных данных</h3>
        <p>
          ФИО, телефон, email, адрес доставки, паспортные данные (серия, номер,
          дата выдачи, код подразделения, кем выдан) и ИНН для заказов под выкуп
          из-за рубежа, состав заказа, IP-адрес и данные cookie.
        </p>
      </section>
      <section>
        <h3>2. Цели обработки</h3>
        <p>
          Регистрация и аутентификация; заключение и исполнение договоров
          купли-продажи и агентских договоров по выкупу и доставке из КНР;
          международная и внутрироссийская логистика; таможенное декларирование
          и очистка; поддержка и обработка претензий.
        </p>
      </section>
      <section>
        <h3>3. Разрешённые действия</h3>
        <p>
          Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение,
          использование и передача, включая трансграничную передачу на территорию
          КНР партнёрам по логистике и таможенным органам, а также ООО «РАКЕТА-СИЭН»
          и СДЭК, обезличивание, блокирование, удаление и уничтожение данных.
        </p>
      </section>
      <section>
        <h3>4. Срок и отзыв</h3>
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
