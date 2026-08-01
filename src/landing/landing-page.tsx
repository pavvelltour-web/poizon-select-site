import { AnimatePresence } from "motion/react"
import { useEffect, useState, type ReactNode } from "react"

import { findPublicProductBySlug } from "../catalog/catalog"
import { CatalogSection } from "./sections/catalog-section"
import { CheckoutOutcomePage } from "./checkout-outcome-page"
import { CartDrawer } from "./sections/cart-drawer"
import { Footer } from "./sections/footer"
import { Header } from "./sections/header"
import { HeroSection } from "./sections/hero-section"
import { InfoSections } from "./sections/info-sections"
import { ProductSheet } from "./sections/product-sheet"
import { ProductDetailPage } from "./sections/product-detail-page"
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
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname
  const routeName = pathname.replace(/^\/|\/$/g, "")
  const productRouteMatch = pathname.match(/^\/product\/([^/]+)\/?$/u)
  let productRouteSlug: string | null = null
  if (productRouteMatch?.[1]) {
    try {
      productRouteSlug = decodeURIComponent(productRouteMatch[1])
    } catch {
      productRouteSlug = null
    }
  }
  const productRoute = productRouteMatch !== null
  const routeProduct = findPublicProductBySlug(productRouteSlug)
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
    <div
      className={`kb-page ${storefront.selectedProduct ? "kb-page--sheet-open" : ""}`}
    >
      <a
        className="skip-link"
        href={staticRoute || checkoutOutcome || productRoute ? "#route-main" : "#catalog"}
      >
        {staticRoute || checkoutOutcome || productRoute
          ? "Перейти к содержанию"
          : "Перейти к товарам"}
      </a>

      <Header
        cartCount={storefront.cartCount}
        openCart={storefront.openCart}
        personalDataConsentVersion={
          storefront.catalogPriceState.personalDataConsentVersion
        }
        refreshPersonalDataConsentVersion={
          storefront.refreshPersonalDataConsentVersion
        }
      />

      <main>
        {checkoutOutcome ? (
          <CheckoutOutcomePage
            outcome={checkoutOutcome}
            botUrl={storefront.botUrl}
          />
        ) : staticRoute ? (
          <StaticRoutePage route={staticRoute} />
        ) : productRoute ? (
          <ProductDetailPage product={routeProduct} storefront={storefront} />
        ) : (
          <>
            <HeroSection storefront={storefront} />
            <CatalogSection storefront={storefront} />
            <InfoSections mode="order" />
          </>
        )}
      </main>

      <Footer />
      <CookieNotice />

      <AnimatePresence>
        {!productRoute && storefront.selectedProduct ? (
          <ProductSheet key="product-sheet" storefront={storefront} />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {storefront.isCartOpen ? (
          <CartDrawer key="cart-drawer" storefront={storefront} />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function StaticRoutePage({ route }: { route: StaticRoute }) {
  if (route === "offer") return <OfferPage />
  if (route === "privacy") return <PrivacyPage />
  if (route === "personal-data-consent") return <PersonalDataConsentPage />
  if (route === "cookies") return <CookiesPage />

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

function LegalDocument({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <article className="legal-route" id="route-main">
      <a className="legal-route__back" href="/">На главную</a>
      <p className="legal-route__eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="legal-route__grid legal-route__grid--document">{children}</div>
      <p className="legal-route__review-note">
        Документ опубликован для информирования пользователей и подлежит проверке
        владельцем и профильным юристом при изменении процессов или законодательства.
      </p>
    </article>
  )
}

function OfferPage() {
  return (
    <LegalDocument eyebrow="Редакция от 31 июля 2026 года" title="Публичная оферта">
      <section>
        <h2>1. Продавец</h2>
        <p>
          ИП Шустров Павел Павлович, ИНН 772919270272, ОГРНИП 323774600547884.
          Адрес регистрации: 119607, Москва, ул. Лобачевского, д. 100, корп. 2,
          кв. 539. Поддержка: <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>
          {" "}и Telegram @kicksbase_officialbot.
        </p>
      </section>
      <section>
        <h2>2. Товар и заказ</h2>
        <p>
          Витрина предназначена для дистанционной продажи оригинальной обуви,
          одежды и экипировки. Наименование, размер, количество, местонахождение,
          цена и доступный срок показываются в карточке и заказе. Покупатель обязан
          проверить их до оплаты.
        </p>
      </section>
      <section>
        <h2>3. Заключение договора</h2>
        <p>
          Покупатель оформляет заказ, отдельно принимает оферту и даёт согласие на
          обработку данных. Договор заключается в порядке, установленном законом,
          после принятия заказа информационной системой и выдачи подтверждения либо
          кассового чека. При технической ошибке цены стороны действуют по закону и
          согласуют корректное исполнение или возврат оплаты.
        </p>
      </section>
      <section>
        <h2>4. Цена и оплата</h2>
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
        <h2>5. Доставка</h2>
        <p>
          Способ, стоимость и ориентировочный срок зависят от местонахождения товара.
          Заказы из Китая в среднем поступают в Москву за 10-18 дней, затем передаются
          в СДЭК по выбранному адресу или коду ПВЗ. Срок является оценкой
          и может меняться из-за перевозки, таможни и обстоятельств вне контроля
          продавца. Покупатель проверяет упаковку, пломбы и комплектность при получении.
        </p>
      </section>
      <section>
        <h2>6. Отказ и возврат</h2>
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
        <h2>7. Качество и претензии</h2>
        <p>
          При недостатке товара покупатель может заявить предусмотренные законом
          требования. Обращение направляется на support@kicksbase.ru с номером
          заказа, описанием и фото. Продавец подтверждает получение и отвечает в
          применимый законом срок. Спор стороны сначала стараются урегулировать
          претензионно; право обратиться в суд или государственный орган сохраняется.
        </p>
      </section>
      <section>
        <h2>8. Дополнительные варианты</h2>
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
    <LegalDocument eyebrow="152-ФЗ · информация для пользователя" title="Политика обработки персональных данных">
      <section>
        <h2>1. Оператор</h2>
        <p>
          ИП Шустров Павел Павлович, ИНН 772919270272, ОГРНИП 323774600547884,
          адрес: 119607, Москва, ул. Лобачевского, д. 100, корп. 2, кв. 539.
          По вопросам данных: <a href="mailto:support@kicksbase.ru">support@kicksbase.ru</a>.
        </p>
      </section>
      <section>
        <h2>2. Какие данные обрабатываются</h2>
        <p>
          ФИО, телефон, email, адрес и параметры доставки, состав и история заказа,
          сведения об оплате и чеке без хранения полных реквизитов карты, сообщения
          поддержке, данные SMS-входа, IP-адрес, сведения о браузере, журналы
          безопасности, необходимые cookie и локальные идентификаторы.
        </p>
      </section>
      <section>
        <h2>3. Цели</h2>
        <p>
          Регистрация и вход, создание и исполнение заказа, оплата и фискализация,
          доставка, возврат и рассмотрение обращений, защита сайта и предотвращение
          злоупотреблений, исполнение бухгалтерских, налоговых и иных обязанностей.
          Рекламная рассылка не подключается к сервисному SMS-входу автоматически.
        </p>
      </section>
      <section>
        <h2>4. Правовые основания</h2>
        <p>
          Согласие субъекта, заключение и исполнение договора по инициативе
          покупателя, исполнение обязанностей оператора по закону и иные основания,
          прямо предусмотренные законодательством. Там, где требуется согласие,
          пользователь отмечает отдельный пустой чекбокс.
        </p>
      </section>
      <section>
        <h2>5. Действия с данными</h2>
        <p>
          Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение,
          использование, передача необходимым исполнителям, обезличивание,
          блокирование, удаление и уничтожение с применением автоматизированной и
          неавтоматизированной обработки.
        </p>
      </section>
      <section>
        <h2>6. Исполнители</h2>
        <p>
          Данные в минимально необходимом объёме могут получать платёжный партнёр,
          CloudKassir и ОФД, СДЭК и выбранная служба доставки, поставщик сервисных
          SMS, российский хостинг и техническая поддержка. Полные реквизиты карты
          обрабатывает платёжный партнёр. Передача выполняется по договору или
          законному основанию.
        </p>
      </section>
      <section>
        <h2>7. Локализация и сроки</h2>
        <p>
          Первичная запись и хранение данных граждан РФ выполняются с использованием
          баз данных в России. Данные хранятся не дольше, чем требуется для цели,
          договора, претензий и обязательных бухгалтерских, налоговых и кассовых
          сроков, после чего удаляются или обезличиваются, если закон не требует иного.
        </p>
      </section>
      <section>
        <h2>8. Права пользователя</h2>
        <p>
          Пользователь вправе запросить сведения об обработке, доступ, исправление,
          блокирование или удаление данных, отозвать согласие и обжаловать действия
          оператора. Запрос направляется на support@kicksbase.ru; для защиты данных
          оператор может запросить разумное подтверждение личности. Отзыв не отменяет
          обработку, уже выполненную законно, и хранение, обязательное по закону.
        </p>
      </section>
      <section>
        <h2>9. Защита</h2>
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
    <LegalDocument eyebrow="Отдельное согласие" title="Согласие на обработку персональных данных">
      <section>
        <h2>Кому даётся согласие</h2>
        <p>
          ИП Шустрову Павлу Павловичу, ИНН 772919270272, ОГРНИП
          323774600547884, по адресу и контактам, указанным на странице{" "}
          <a href="/contacts">«Контакты»</a>.
        </p>
      </section>
      <section>
        <h2>Состав данных и цели</h2>
        <p>
          ФИО, телефон, email, адрес доставки, параметры и история заказа,
          обращения и технические данные обрабатываются для входа, оформления,
          оплаты, фискализации, доставки, возврата, поддержки и безопасности.
          Согласие на рекламные сообщения этим документом не предоставляется.
        </p>
      </section>
      <section>
        <h2>Разрешённые действия</h2>
        <p>
          Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение,
          использование, необходимая передача исполнителям из политики, блокирование,
          удаление и уничтожение автоматизированным и неавтоматизированным способом.
        </p>
      </section>
      <section>
        <h2>Срок и отзыв</h2>
        <p>
          Согласие действует до достижения целей либо отзыва, если закон не требует
          продолжить хранение. Отзыв направляется на support@kicksbase.ru с данными,
          позволяющими найти запрос. Отзыв не влияет на законность действий до его
          получения и может сделать невозможным исполнение незавершённого заказа.
        </p>
      </section>
      <section>
        <h2>Как подтверждается</h2>
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
    <LegalDocument eyebrow="Только необходимые технологии" title="Уведомление о cookie">
      <section>
        <h2>Что используется</h2>
        <p>
          Сайт использует только необходимые cookie и локальные записи для работы
          сессии и SMS-входа, защиты от межсайтовых запросов, сохранения корзины,
          состояния интерфейса и отметки о показе этого уведомления.
        </p>
      </section>
      <section>
        <h2>Для чего</h2>
        <p>
          Эти технологии обеспечивают безопасность, авторизацию, оформление заказа
          и непрерывность витрины. Рекламные cookie, профилирование и необязательные
          аналитические трекеры в текущей версии не используются.
        </p>
      </section>
      <section>
        <h2>Управление</h2>
        <p>
          Пользователь может удалить или заблокировать записи в настройках браузера.
          После этого потребуется войти заново, корзина может очиститься, а отдельные
          функции заказа перестанут работать. Срок cookie ограничивается задачей
          сессии, безопасностью или сохранением выбранного состояния.
        </p>
      </section>
      <section>
        <h2>Изменения</h2>
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

  useEffect(() => {
    setVisible(localStorage.getItem("kicksbase-cookie-notice") !== "accepted")
  }, [])

  if (!isVisible) return null

  return (
    <div className="cookie-notice" role="region" aria-label="Согласие на использование cookie">
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
