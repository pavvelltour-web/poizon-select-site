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
            <p>
              <a href="https://t.me/kicksbase_officialbot">Telegram @kicksbase_officialbot</a>
              {" "}— только для общих вопросов без номера оформленного заказа,
              адреса, паспорта, ИНН и платёжных реквизитов.
            </p>
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
            загруженности погранпереходов международная доставка может занять до
            60 календарных дней с даты оплаты. Это предельный срок передачи для
            такого заказа; 10–18 дней остаются только ориентиром.
          </p>
          <p>
            Международная доставка 1500 ₽ уже включена в цену каждого товара
            под выкуп из КНР.
            Доставка по РФ не входит в цену товара. Онлайн-оплата становится
            доступна только после рабочего расчёта: до перехода к платёжному
            партнёру показывается точный тариф подключённого сервиса доставки.
          </p>
        </section>
        <section>
          <h2>Возврат</h2>
          <p>
            <strong>Стандартные товары из наличия и под заказ:</strong> отказаться
            можно до передачи и в течение 7 дней после неё при сохранении товарного
            вида и потребительских свойств. Если письменная информация о порядке
            возврата не была предоставлена при доставке, срок составляет 3 месяца.
          </p>
          <p>
            Деньги возвращаются не позднее 10 дней после требования. Для товара
            надлежащего качества из суммы могут быть вычтены только расходы на его
            доставку от покупателя продавцу. Отсутствие чека не исключает другие
            доказательства покупки.
          </p>
          <p>
            <strong>Отдельная байерская услуга:</strong> эти условия не относятся
            к обычному заказу товара в корзине сайта и применяются только когда
            услуга отдельно названа и оценена в индивидуальном заказе. От дальнейшего
            исполнения такого поручения
            можно отказаться в любое время. Мы вернём неиспользованный остаток
            аванса за вычетом стоимости уже оказанной части услуги и документально
            подтверждённых расходов по конкретному заказу. Это применяется только
            к отдельно указанной услуге и не уменьшает законный возврат стоимости
            стандартного товара. По запросу предоставим расчёт.
          </p>
        </section>
        <section>
          <h2>Брак или ошибочный товар</h2>
          <p>
            При недостатке, несоответствии описанию, артикулу, размеру или
            комплектации покупатель выбирает предусмотренное законом требование:
            в том числе замену, уменьшение цены, безвозмездное устранение недостатка,
            возмещение расходов на его устранение либо возврат денег.
            Возврат товара с недостатком выполняется за наш счёт.
          </p>
        </section>
        <section>
          <h2>Если не подошёл размер</h2>
          <p>
            По желанию покупателя поможем продать неподошедшую пару
            через комиссионный отдел или по согласованию начислим бонусные единицы
            Kikki. Это добровольные варианты: они не заменяют положенный по закону
            денежный возврат и не являются выводимыми деньгами.
          </p>
        </section>
        <section>
          <h2>Как обратиться</h2>
          <p>
            Напишите на <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>
            {" "}и укажите номер заказа. Telegram используйте только для общих
            вопросов без номера оформленного заказа, адреса, паспорта, ИНН и
            платёжных реквизитов.
            Фото или видео помогут ускорить проверку, но не являются условием
            принятия обращения.
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
        Мы объединяем склад наличия в Москве и сервис заказа товаров у продавцов
        на Poizon (Dewu) в Китае.
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
            <li>До выкупа фиксируем идентификатор товара, модель, артикул и размер.</li>
            <li>Названный в заказе логистический партнёр организует международную перевозку.</li>
            <li>Ориентир до Москвы — 10–18 дней; предельный срок — 60 дней с оплаты.</li>
            <li>После прибытия в РФ оплатите рассчитанную доставку по России.</li>
            <li>Для стандартной пары действует право на дистанционный возврат.</li>
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
        <section><h2>Как проверяется товар?</h2><p>До выкупа мы сверяем идентификатор товара, модель, артикул и размер с данными Poizon/Dewu и сохраняем эти параметры заказа. Переданные поставщиком документы выдаются в фактически полученном составе. Пломба, QR-код или сертификат входят в комплект только тогда, когда это прямо указано для выбранного товара.</p></section>
        <section><h2>Зачем паспорт и ИНН?</h2><p>Если перевозчик подтвердит необходимость этих данных для персонального таможенного декларирования, мы запросим их после оплаты в отдельной защищённой форме. До этого данные не собираются и иностранным получателям не передаются.</p></section>
        <section><h2>Если не подошёл размер из Китая?</h2><p>Для стандартной серийной пары действует право на дистанционный возврат. Дополнительно, по вашему выбору, можем помочь с комиссионной продажей пары или начислить Kikki; это не заменяет денежный возврат, положенный по закону.</p></section>
        <section><h2>Почему доставка по РФ отдельно?</h2><p>1500 ₽ международной доставки уже включены в товар. Онлайн-оплата доступна только после того, как точный российский тариф подключённого сервиса доставки показан перед переходом к платёжному партнёру.</p></section>
        <section><h2>Что если заказ задерживается?</h2><p>10–18 дней — ориентир, а предельный срок передачи для заказа из КНР составляет 60 календарных дней с даты оплаты. Если срок нарушен, покупатель сохраняет предусмотренные законом требования. Обращения по заказу принимаются по email.</p></section>
      </div>
    </article>
  )
}

function AuthenticityPage() {
  return (
    <article className="legal-route" id="route-main" aria-labelledby="auth-title">
      <a className="legal-route__back" href="/">На главную</a>
      <p className="legal-route__eyebrow">Проверка заказа</p>
      <h1 id="auth-title">Проверка товара и документов</h1>
      <div className="legal-route__grid">
        <section><h2>До выкупа</h2><p>Закрепляем в заказе идентификатор товара, модель, артикул, размер и цену из данных площадки. Данные площадки являются источником информации о товаре, но не заменяют обязательные документы о соответствии.</p></section>
        <section><h2>При получении</h2><p>Сопоставляем модель, артикул и размер с заказом. Фактически полученные от поставщика сведения и документы передаются покупателю; пломба, QR-код или сертификат не обещаются, если их нет в описании конкретного товара.</p></section>
        <section><h2>Если есть сомнения</h2><p>Примем обращение и при необходимости организуем проверку качества в установленном законом порядке. При недостатке, подделке или несоответствии заказу покупатель сохраняет весь предусмотренный законом выбор требований.</p></section>
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
      </div>
    </article>
  )
}

function OfferPage() {
  return (
    <LegalDocument id="offer" eyebrow="Редакция от 10 сентября 2026 года" title="Публичная оферта">
      <section>
        <h3>1. Продавец / Исполнитель</h3>
        <p>
          ИП Шустров Павел Павлович, ИНН 772919270272, ОГРНИП 323774600547884.
          Адрес регистрации: 119607, Москва, ул. Лобачевского, д. 100, корп. 2,
          кв. 539. Поддержка по заказам:{" "}
          <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>. Для общих
          вопросов без номера оформленного заказа, адреса, паспорта, ИНН и
          платёжных реквизитов:{" "}
          <a href="https://t.me/kicksbase_officialbot">Telegram @kicksbase_officialbot</a>.
        </p>
      </section>
      <section>
        <h3>2. Предмет договора и варианты заказа</h3>
        <p>
          Через обычную корзину сайта KICKSBASE продаёт стандартные товары по
          правилам дистанционной торговли, включая товары, приобретаемые у
          зарубежного поставщика для исполнения заказа. Байерская услуга не входит
          в обычный заказ на сайте. Она может оказываться только по отдельному
          индивидуальному заказу, где услуга и её цена прямо выделены.
        </p>
        <p>
          Тип заказа, наименование, размер, количество, местонахождение и цена
          отображаются до направления заказа. Сроки передачи определены разделом 5
          настоящей оферты. Покупатель обязан проверить параметры до оформления.
        </p>
      </section>
      <section>
        <h3>3. Заключение договора</h3>
        <p>
          Покупатель направляет через сайт оформленный заказ, отдельно принимает
          оферту и даёт согласие на обработку данных. Розничный договор считается
          заключённым с момента получения KICKSBASE такого сообщения о намерении
          приобрести товар; система без задержки направляет подтверждение с номером,
          составом и ценой. Договор отдельно
          указанной байерской услуги считается заключённым при получении заказа,
          в котором эта услуга и её цена выделены отдельно. Оплата исполняет
          денежную обязанность, но не даёт права односторонне менять условия.
          Если цена иностранного продавца изменилась до выкупа, выкуп совершается
          только после отдельного согласия Заказчика; иначе неиспользованный аванс
          возвращается.
        </p>
      </section>
      <section>
        <h3>4. Цена и оплата</h3>
        <p>
          Для товара из наличия указывается розничная цена. Для стандартного товара
          под заказ розничная цена включает международную доставку 1500 ₽ и
          возвращается вместе с ней при законном
          отказе от стандартного товара, кроме расходов на доставку возвращаемого
          товара от Покупателя Продавцу. Доставка по РФ в эту цену не входит.
          Онлайн-оплата доступна только после рабочего расчёта: точный тариф
          подключённого сервиса доставки показывается до перехода к платёжному партнёру.
          Отдельная байерская услуга, если она будет заказана вне обычной корзины,
          указывается и оценивается отдельно.
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
          занять до 60 календарных дней с даты оплаты. Этот 60-дневный период является
          предельным сроком передачи, а 10–18 дней приводятся только как ориентир.
          При получении Покупатель проверяет упаковку и комплектность; такая
          проверка не лишает его прав в отношении скрытых недостатков.
        </p>
      </section>
      <section>
        <h3>6. Отказ и возврат</h3>
        <p>
          <strong>Стандартные товары, независимо от места закупки:</strong> отказ
          возможен в любое время до передачи и в течение 7 дней после неё при
          сохранении товарного вида и потребительских свойств. Если письменная
          информация о порядке и сроках возврата не предоставлена при доставке,
          срок отказа после передачи составляет 3 месяца. Отсутствие кассового
          чека не исключает иные доказательства покупки.
        </p>
        <p>
          Возврат стоимости стандартного товара выполняется не позднее 10 дней со
          дня требования. Из суммы могут быть вычтены только расходы продавца на
          доставку возвращаемого товара от Покупателя. Исключение применяется лишь
          к товару с созданными по индивидуальному заданию свойствами, который может
          использоваться исключительно заказавшим его потребителем.
        </p>
        <p>
          <strong>Отдельная байерская услуга:</strong> этот пункт не применяется к
          обычному заказу товара через корзину сайта. Если услуга и её цена прямо
          выделены в отдельном индивидуальном заказе, Заказчик вправе в любое время отказаться
          от дальнейшего исполнения поручения. Исполнитель возвращает неиспользованный
          остаток аванса за вычетом стоимости фактически оказанной части услуги и
          документально подтверждённых расходов, понесённых до получения отказа и
          непосредственно связанных с конкретным заказом. По требованию Заказчика
          предоставляются расчёт и подтверждающие документы. Возвращённые иностранным
          продавцом суммы передаются Заказчику. Этот пункт не ограничивает обязательные
          права потребителя и применяется только к отдельно указанной в заказе
          услуге. Её расходы не удерживаются повторно из предусмотренного законом
          возврата стоимости стандартного товара. Подробности — на странице{" "}
          <a href="/delivery-returns">«Доставка и возврат»</a>.
        </p>
      </section>
      <section>
        <h3>7. Качество и претензионный порядок</h3>
        <p>
          При недостатке, несоответствии описанию, заказанному артикулу, размеру или
          комплектации Покупатель по своему выбору вправе предъявить требования,
          предусмотренные ст. 18 Закона РФ «О защите прав потребителей», в том числе
          замену, уменьшение цены, безвозмездное устранение недостатка, возмещение
          расходов на его устранение либо отказ от договора и возврат
          уплаченной суммы. Возврат товара с недостатком осуществляется за счёт
          Продавца. Для недостатков услуги применяются права, предусмотренные ст. 29.
          Обращение можно направить на support@kicksbase.ru; фото и видео ускоряют
          проверку, но не являются обязательным условием. Претензионный порядок
          добровольный и не ограничивает обращение в суд или государственные органы.
        </p>
      </section>
      <section>
        <h3>8. Дополнительные варианты</h3>
        <p>
          Комиссионная продажа неподошедшей пары, в том числе выкупленной из КНР,
          и зачисление бонусных единиц Kikki являются добровольными сервисными
          услугами. Они не являются деньгами, не выводятся на карту и предоставляются
          по согласованию сторон для помощи Покупателю. Они не заменяют денежный
          возврат, когда право на него предусмотрено законом.
        </p>
      </section>
    </LegalDocument>
  )
}

function PrivacyPage() {
  return (
    <LegalDocument id="privacy" eyebrow="Редакция от 10 сентября 2026 года · 152-ФЗ" title="Политика обработки персональных данных">
      <section>
        <h3>1. Оператор</h3>
        <p>
          ИП Шустров Павел Павлович, ИНН 772919270272, ОГРНИП 323774600547884,
          адрес: 119607, Москва, ул. Лобачевского, д. 100, корп. 2, кв. 539.
          По вопросам данных: <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>.
        </p>
      </section>
      <section>
        <h3>2. Субъекты, данные и цели</h3>
        <p><strong>Посетители сайта:</strong> IP-адрес, сведения о браузере, журналы безопасности, необходимые cookie и локальные идентификаторы — для работы и защиты сайта.</p>
        <p><strong>Пользователи SMS-входа:</strong> телефон, события отправки и проверки одноразового кода — для аутентификации и предотвращения злоупотреблений.</p>
        <p><strong>Покупатели и заказчики:</strong> ФИО, телефон, email, адрес и параметры доставки, состав и история заказа, сведения об оплате и чеке без полных реквизитов карты — для оформления и исполнения заказа, оплаты, фискализации, доставки и возврата.</p>
        <p><strong>Пользователи Telegram-бота:</strong> Telegram ID, username, указанное в профиле имя, сообщения и товарные запросы — для работы бота, ведения заявки и показа её статуса. Не отправляйте через Telegram номер оформленного заказа, адрес, паспорт, ИНН и платёжные реквизиты; поддержка по заказам работает по email.</p>
        <p><strong>Обращения:</strong> контакты, номер заказа и содержание переписки — для поддержки и рассмотрения требований.</p>
        <p><strong>Таможенные данные:</strong> паспортные данные и ИНН не собираются при обычном входе или оформлении заказа. Они могут быть запрошены после оплаты только при подтверждённой перевозчиком необходимости, в отдельной защищённой форме и на основании отдельного информированного согласия для конкретного заказа.</p>
      </section>
      <section>
        <h3>3. Правовые основания</h3>
        <p>
          Обработка выполняется на основании отдельного согласия, для заключения и
          исполнения договора по инициативе пользователя, исполнения обязанностей
          оператора по закону либо защиты законных интересов в предусмотренных законом
          пределах. Для каждой формы применяется только относящаяся к ней цель и
          минимальный набор данных. Сервисный SMS-вход не означает согласия на рекламу.
        </p>
      </section>
      <section>
        <h3>4. Действия с данными</h3>
        <p>
          Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение,
          использование, предоставление необходимым исполнителям, обезличивание,
          блокирование, удаление и уничтожение с автоматизацией или без неё.
        </p>
      </section>
      <section>
        <h3>5. Получатели</h3>
        <p>
          В минимально необходимом объёме данные могут получать подключённый
          платёжный партнёр, оператор онлайн-кассы и ОФД; поставщик сервисных SMS;
          российский хостинг и техническая поддержка. Данные службе доставки
          передаются только после подключения фактического перевозчика, раскрытия
          его сведений пользователю и обновления относящихся к передаче документов.
          Полные реквизиты карты магазин не получает.
          Фактический состав получателей зависит от выбранного способа оплаты и доставки.
        </p>
      </section>
      <section>
        <h3>6. Трансграничная передача</h3>
        <p>
          Передача российскому юридическому лицу сама по себе не является
          трансграничной. Через формы сайта и checkout иностранная передача не
          выполняется до подтверждения иностранного получателя, государства,
          перечня полей и выполнения требований ст. 12 Федерального закона № 152-ФЗ.
          Telegram — отдельная внешняя платформа; при запуске бота ей технически
          передаются и в CRM сохраняются данные, перечисленные в разделе 2. До
          завершения правового аудита платформы не отправляйте через неё номер
          оформленного заказа, адрес, паспорт, ИНН и платёжные реквизиты. Если
          иностранная передача потребуется для исполнения
          заказа, пользователь до неё получит отдельное уведомление и согласие с
          получателями, государством, целью и сроком обработки.
        </p>
      </section>
      <section>
        <h3>7. Локализация и сроки</h3>
        <p>
          При сборе данных граждан РФ через сайт запись, систематизация, накопление,
          хранение, уточнение и извлечение выполняются с использованием баз данных
          в России. Данные обрабатываются до достижения соответствующей цели или
          отзыва согласия, затем удаляются или обезличиваются, кроме сведений,
          которые оператор обязан хранить в течение установленного законом срока.
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
    <LegalDocument id="personal-data-consent" eyebrow="Редакция от 10 сентября 2026 года · отдельное согласие" title="Согласие на обработку персональных данных">
      <section>
        <h3>Кому даётся согласие</h3>
        <p>
          ИП Шустрову Павлу Павловичу, ИНН 772919270272, ОГРНИП
          323774600547884, по адресу и контактам, указанным на странице{" "}
          <a href="/contacts">«Контакты»</a>.
        </p>
      </section>
      <section id="sms-data">
        <h3>1. Сервисный SMS-вход</h3>
        <p>
          При отметке чекбокса в форме входа согласие охватывает только номер
          телефона, IP-адрес и технические события отправки и проверки кода.
          Цель — аутентификация, безопасность и предотвращение злоупотреблений.
          Для доставки SMS данные в необходимом объёме получает подключённый
          российский SMS-провайдер. Это согласие не распространяется на рекламу.
        </p>
      </section>
      <section id="checkout-data">
        <h3>2. Оформление заказа</h3>
        <p>
          При отметке чекбокса в корзине согласие охватывает введённые там ФИО,
          телефон, email, город, адрес или код ПВЗ, состав заказа, IP-адрес и
          технические журналы. Цели — оформление и исполнение заказа, оплата,
          фискализация, доставка, поддержка и рассмотрение требований. Получатели
          в минимально необходимом объёме: подключённые платёжный и кассовый
          партнёры, ОФД и выбранная служба доставки, названная в заказе до передачи данных.
        </p>
      </section>
      <section>
        <h3>3. Паспорт, ИНН и иностранные получатели</h3>
        <p>
          Настоящие чекбоксы SMS-входа и корзины не охватывают паспортные данные,
          ИНН или трансграничную передачу. При подтверждённой необходимости для
          таможенного оформления такие данные запрашиваются отдельно для конкретного
          заказа после указания точного получателя, страны, цели и срока обработки.
        </p>
      </section>
      <section>
        <h3>4. Действия, срок и отзыв</h3>
        <p>
          Разрешаются сбор, запись, систематизация, накопление, хранение, уточнение,
          извлечение, использование, предоставление указанным исполнителям,
          блокирование, удаление и уничтожение с автоматизацией или без неё.
          Согласие действует до достижения относящейся к форме цели либо отзыва.
          Отзыв направляется на support@kicksbase.ru. Он не отменяет ранее законную
          обработку и обязательное хранение, но может сделать невозможным исполнение
          незавершённого запроса или заказа.
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
      aria-label="Уведомление об использовании cookie"
    >
      <p>
        Используем только технически необходимые файлы cookie для безопасности,
        входа, работы витрины и сохранения корзины. Нажимая «Понятно», вы
        подтверждаете ознакомление с{" "}
        <a href="/cookies">уведомлением о cookie</a> и{" "}
        <a href="/privacy">политикой обработки данных</a>.
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
