import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LandingPage } from "./landing-page"
import { publicCatalogProducts } from "../catalog/catalog"
import { CATALOG_PAGE_SIZE } from "./sections/catalog-section"

function productLinks() {
  return screen
    .getAllByRole("link", { name: /Открыть товар:/ })
    .filter((link) => link.classList.contains("product-card__link"))
}

function checkoutCatalogPayload(
  sizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
  capabilities = {
    orderCreationEnabled: true,
    onlinePaymentEnabled: true,
  },
) {
  return {
    version: "2026-08-02-v3",
    personal_data_consent_version: "pd-2026-08",
    order_creation_enabled: capabilities.orderCreationEnabled,
    online_payment_enabled: capabilities.onlinePaymentEnabled,
    items: [
      {
        slug: "nike-gt-cut-academy",
        name: "G.T. Cut Academy",
        brand: "Nike",
        product_kind: "footwear",
        sizes,
        price_rub: 24500,
        image_url: "https://kicksbase.ru/catalog/nike-gt-cut-academy.webp",
        fulfillment_mode: "made_to_order",
        availability: "catalog_listed",
        eta_min_days: 10,
        eta_max_days: 18,
        live_provider_verified: false,
        size_offers: sizes.map((size) => ({
          sku_id: `gt-cut-${size}`,
          size_eu: size,
          size_ru: String(Number(size) - 1),
          price_rub: 24500,
          available: true,
          checkout_confirmed: true,
          live_provider_verified: true,
        })),
      },
    ],
  }
}

function livePoizonOnlyCheckoutPayload() {
  return {
    catalog_mode: "live_poizon_only",
    version: "live-poizon-only-v1",
    order_creation_enabled: false,
    online_payment_enabled: false,
    items: [],
    prices: {},
  }
}

function readyGtCutSearchPayload() {
  const payload = readySearchPayload("Nike G.T. Cut Academy basketball volleyball")
  return {
    ...payload,
    results: [{
      ...payload.results[0],
      product_ref: "gt-cut-academy",
      name: "G.T. Cut Academy",
      model: "G.T. Cut Academy",
      article: "GT-CUT-ACADEMY",
      color: "Black / White",
      offers: [{
        size: "44",
        eu: "44",
        ru: "43",
        us: "10",
        cn: "280",
        available: true,
        quote_rub: 24500,
        rf_delivery: 1000,
        total_rub: 25500,
        price_breakdown: null,
      }],
    }],
  }
}

function readySearchPayload(normalizedQuery = "Nike Air Force 1") {
  const observedAt = new Date(Date.now() - 60_000).toISOString()
  const expiresAt = new Date(Date.now() + 14 * 60_000).toISOString()
  return {
    status: "ready",
    normalized_query: normalizedQuery,
    results: [
      {
        product_ref: "air-force-1-07-white",
        brand: "Nike",
        name: "Air Force 1 '07 White",
        article: "DV0788-104",
        color: "White / University Red",
        kind: "footwear",
        description: null,
        images: ["https://cdn.poizon.example/air-force-1.webp"],
        observed_at: observedAt,
        expires_at: expiresAt,
        offers: [
          {
            size: "42",
            eu: "42",
            ru: "41",
            us: "8.5",
            cn: "265",
            available: true,
            quote_rub: 16700,
            rf_delivery: 1000,
            total_rub: 17700,
            price_breakdown: null,
          },
          {
            size: "43",
            eu: "43",
            ru: "42",
            us: "9",
            cn: "270",
            available: null,
            quote_rub: 17300,
            rf_delivery: 1000,
            total_rub: 18300,
            price_breakdown: null,
          },
        ],
      },
    ],
  }
}

function catalogSearchPayload(normalizedQuery = "Nike Air Force 1") {
  return {
    status: "catalog",
    normalized_query: normalizedQuery,
    results: [],
    fallback: [{
      source: "catalog",
      slug: "nike-air-force-1-07-white",
      name: "Air Force 1 ’07 White",
      brand: "Nike",
      image: "https://kicksbase.ru/catalog/nike-air-force-1-07-white.webp",
      navigation_url: "https://kicksbase.ru/product/nike-air-force-1-07-white",
      availability: "unverified",
    }],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("LandingPage", () => {
  it("renders the approved eight-product home and progressively reveals the full catalog", async () => {
    const user = userEvent.setup()
    const view = render(<LandingPage configuredBotUsername={null} />)

    expect(
      screen.getByRole("heading", { name: "Выберите пару под свой запрос." }),
    ).toBeInTheDocument()
    expect(productLinks()).toHaveLength(8)
    expect(screen.getByRole("link", { name: "Открыть весь каталог" })).toHaveAttribute(
      "href",
      "/catalog",
    )
    expect(screen.queryByText("по запросу")).toBeNull()
    const firstCard = productLinks()[0]
    expect(firstCard).toHaveAccessibleName(/Nike KD 18/)
    expect(within(firstCard).getByText("Кроссовки Nike KD 18")).toBeInTheDocument()
    expect(
      screen.getByText(/Срок и итоговую стоимость показываем до оплаты/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/менеджер/i)).toBeNull()
    expect(screen.getByLabelText("Согласие на использование cookie")).toHaveTextContent(
      "Сайт использует необходимые файлы cookie для работы витрины и сохранения корзины. Продолжая использование сайта, вы соглашаетесь с Политикой обработки персональных данных.",
    )
    const paymentMethods = screen.getByLabelText("Способы оплаты")
    for (const method of ["МИР", "СБП", "Visa", "Mastercard"]) {
      expect(within(paymentMethods).getByText(method)).toBeInTheDocument()
    }

    view.unmount()
    window.history.replaceState(null, "", "/catalog")
    render(<LandingPage configuredBotUsername={null} />)
    expect(productLinks()).toHaveLength(CATALOG_PAGE_SIZE)
    expect(
      screen.getByText(`${publicCatalogProducts.length} товаров, показано 24`),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: `Показать ещё ${CATALOG_PAGE_SIZE}` }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: `Показать ещё ${CATALOG_PAGE_SIZE}` }))
    expect(productLinks()).toHaveLength(CATALOG_PAGE_SIZE * 2)
    expect(screen.getByRole("button", { name: /Показать ещё/ })).toBeInTheDocument()
  })

  it("canonicalizes the trailing-slash catalog route and renders the full catalog view", () => {
    window.history.replaceState(null, "", "/catalog/")

    render(<LandingPage configuredBotUsername={null} />)

    expect(window.location.pathname).toBe("/catalog")
    expect(screen.getByRole("heading", { name: /Каталог/ })).toBeInTheDocument()
    expect(productLinks()).toHaveLength(CATALOG_PAGE_SIZE)
  })

  it.each([
    ["/offer", "Публичная оферта"],
    ["/privacy", "Политика обработки персональных данных"],
    ["/personal-data-consent", "Согласие на обработку персональных данных"],
    ["/cookies", "Уведомление о cookie"],
    ["/contacts", "Контакты"],
    ["/delivery-returns", "Доставка и возврат"],
  ])("renders dedicated storefront route %s", (path, heading) => {
    window.history.replaceState(null, "", path)
    render(<LandingPage configuredBotUsername={null} />)

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument()
    if (["/offer", "/privacy", "/personal-data-consent", "/cookies"].includes(path)) {
      expect(document.querySelector(".legal-main .legal-hero")).not.toBeNull()
      expect(document.querySelector(".legal-main .legal-document")).not.toBeNull()
    } else {
      expect(screen.getByRole("link", { name: "На главную" })).toHaveAttribute("href", "/")
    }
    expect(screen.queryByRole("link", { name: /Открыть товар:/ })).toBeNull()
  })

  it("uses the approved legal chrome and section hierarchy", () => {
    window.history.replaceState(null, "", "/offer")
    render(<LandingPage configuredBotUsername={null} />)

    expect(document.querySelector('header[data-od-id="legal-header"] .header-inner.shell')).not.toBeNull()
    expect(document.querySelector('[data-od-id="legal-logo"] .brand-logo')).not.toBeNull()
    expect(document.querySelector('main[data-od-id="legal-main"].legal-main.shell')).not.toBeNull()
    expect(document.querySelectorAll(".legal-sections h2")).toHaveLength(0)
    expect(document.querySelectorAll(".legal-sections h3").length).toBeGreaterThan(0)
  })

  it("treats the bank success return as pending until the server confirms payment", () => {
    window.history.replaceState(null, "", "/checkout/success?OrderId=web_101")
    render(<LandingPage configuredBotUsername={null} />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Проверяем платёж" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Возврат на сайт ещё не означает/)).toBeInTheDocument()
    expect(screen.getByText(/Номер операции/)).toHaveTextContent("web_101")
    expect(screen.getByRole("link", { name: "Проверить заказ" })).toHaveAttribute(
      "href",
      "/?login=1",
    )
    expect(screen.queryByText(/успешно оплачен|оплата прошла/i)).toBeNull()
  })

  it("offers a safe retry path when the bank did not confirm payment", () => {
    window.history.replaceState(null, "", "/checkout/fail")
    render(<LandingPage configuredBotUsername={null} />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Платёж не подтверждён" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Мы не получили подтверждение оплаты/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Вернуться в корзину" })).toHaveAttribute(
      "href",
      "/?cart=1",
    )
  })

  it("filters and sorts the full catalog deterministically", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/catalog?category=volleyball")
    render(<LandingPage configuredBotUsername={null} />)

    expect(productLinks()).toHaveLength(19)
    expect(window.location.search).toBe("?category=volleyball")

    await user.type(screen.getByRole("searchbox", { name: "Поиск по товарам" }), "nike")
    expect(productLinks()).toHaveLength(2)
    expect(window.location.search).toBe("?category=volleyball&q=nike")

    await user.selectOptions(screen.getByRole("combobox", { name: "Сортировка" }), [
      "price-desc",
    ])
    expect(productLinks()[0]).toHaveAccessibleName(/Nike ZOOM HYPERSET 2/)
    expect(window.location.search).toBe(
      "?category=volleyball&q=nike&sort=price-desc",
    )

    await user.clear(screen.getByRole("searchbox", { name: "Поиск по товарам" }))
    expect(productLinks()).toHaveLength(19)
    expect(window.location.search).toBe("?category=volleyball&sort=price-desc")
  })

  it("recovers from an empty search result", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/catalog")
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Поиск по товарам" }),
      "definitely-not-a-product",
    )
    expect(screen.getByText("Ничего не нашли по этому запросу.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Показать все товары/ }))
    expect(productLinks()).toHaveLength(CATALOG_PAGE_SIZE)
  })

  it("publishes a stable product deep link and opens the approved product sheet", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/catalog")
    const view = render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск по товарам" }), "Ronaldinho")
    const productLink = screen.getByRole("link", {
      name: /Открыть товар: Nike Football FC Barcelona Ronaldinho/,
    })
    expect(productLink).toHaveAttribute(
      "href",
      "/product/nike-barcelona-ronaldinho-jersey",
    )

    view.unmount()
    window.history.replaceState(null, "", "/product/nike-barcelona-ronaldinho-jersey")
    render(<LandingPage configuredBotUsername={null} />)

    const dialog = screen.getByRole("dialog", { name: /Ronaldinho #10 Jersey/ })
    expect(dialog).toHaveAttribute("id", "product-dialog")
    expect(within(dialog).getAllByText(/Сверяем…|Уточняется/).length).toBeGreaterThan(0)
    expect(within(dialog).queryByText(/^\d{1,3}(?: \d{3})+ ₽$/)).toBeNull()
    expect(screen.getByRole("button", { name: "Открыть фото в полном размере" })).toBeInTheDocument()
    expect(screen.queryByText(/VITE_BOT_USERNAME|менеджер/i)).toBeNull()
  })

  it("gives a cart deep link precedence over a product sheet and restores the product on close", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy?cart=1")
    render(<LandingPage configuredBotUsername={null} />)

    const cart = screen.getByRole("dialog", { name: "Корзина" })
    expect(screen.queryByRole("dialog", { name: /Nike G\.T\. Cut Academy/ })).toBeNull()

    await user.click(within(cart).getByRole("button", { name: "Закрыть заказ" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Корзина" })).toBeNull()
    })
    expect(screen.getByRole("dialog", { name: /Nike G\.T\. Cut Academy/ })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/product/nike-gt-cut-academy")
    expect(window.location.search).toBe("")
  })

  it("adds and removes the cart query without disturbing catalog filters", async () => {
    const user = userEvent.setup()
    window.history.replaceState(
      null,
      "",
      "/catalog?category=volleyball&q=nike&sort=price-desc",
    )
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(screen.getByRole("button", { name: "Открыть корзину" }))
    const cart = screen.getByRole("dialog", { name: "Корзина" })
    expect(window.location.pathname).toBe("/catalog")
    expect(window.location.search).toBe(
      "?category=volleyball&q=nike&sort=price-desc&cart=1",
    )

    await user.click(within(cart).getByRole("button", { name: "Закрыть заказ" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Корзина" })).toBeNull()
    })
    expect(window.location.pathname).toBe("/catalog")
    expect(window.location.search).toBe("?category=volleyball&q=nike&sort=price-desc")
  })

  it("makes the complete accessories category available by URL", () => {
    window.history.replaceState(null, "", "/catalog?category=accessories")
    render(<LandingPage configuredBotUsername={null} />)

    expect(screen.getByText("25 товаров, показано 24")).toBeInTheDocument()
    expect(productLinks()).toHaveLength(CATALOG_PAGE_SIZE)
    expect(window.location.search).toBe("?category=accessories")
  })

  it("lets the full product gallery move, enlarge and zoom", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/product/asics-sky-elite-ff-3")
    render(<LandingPage configuredBotUsername={null} />)

    let heroImage = screen.getByRole("img", {
      name: /ASICS SKY ELITE FF 3/,
    })
    expect(heroImage).toHaveAttribute(
      "src",
      "http://localhost:3000/storefront-media/approved/products/asics-sky-elite-ff-3/01-side.png",
    )
    expect(screen.getByText("Фото товара 1 из 5 · Боковой профиль")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Следующее фото товара" }))

    heroImage = screen.getByRole("img", {
      name: /ASICS SKY ELITE FF 3/,
    })
    expect(heroImage).toHaveAttribute(
      "src",
      expect.stringContaining("asics-sky-elite-ff-3/03-side.png"),
    )
    expect(screen.getByText("Фото товара 2 из 5 · Противоположный боковой профиль")).toBeInTheDocument()

    const openPhotoButton = screen.getByRole("button", {
      name: "Открыть фото в полном размере",
    })
    await user.click(openPhotoButton)
    const lightbox = screen.getByRole("dialog", { name: "Показ фото товара" })
    expect(within(lightbox).getByText("100%")).toBeInTheDocument()
    const closePhotoButton = within(lightbox).getByRole("button", { name: "Закрыть фото" })
    await waitFor(() => expect(closePhotoButton).toHaveFocus())

    const canvas = within(lightbox).getByRole("group", { name: /Фото 2 из 5/ })
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 280,
      clientY: 180,
    })
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 180,
      clientY: 184,
    })
    fireEvent.pointerUp(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 180,
      clientY: 184,
    })
    expect(
      within(lightbox).getByRole("group", { name: /Фото 3 из 5/ }),
    ).toBeInTheDocument()
    expect(within(lightbox).getByText("100%")).toBeInTheDocument()

    await user.click(within(lightbox).getByRole("img", { name: /ASICS SKY ELITE FF 3/ }))
    expect(within(lightbox).getByText("200%")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "Показ фото товара" })).toBeNull()
    await waitFor(() => expect(openPhotoButton).toHaveFocus())

    expect(document.querySelectorAll(".sheet-gallery-thumb")).toHaveLength(5)
  })

  it("uses the approved hero asset and lazily loads catalog photography", () => {
    render(<LandingPage configuredBotUsername={null} />)

    expect(document.querySelector(".hero img")).toHaveAttribute(
      "src",
      "/storefront-media/approved/assets/blue-field-v2/nike-kd-18-hero-cutout-v2.png",
    )

    document.querySelectorAll<HTMLImageElement>(".product-card__image").forEach((image) => {
      expect(image).toHaveAttribute("loading", "lazy")
    })
  })

  it("uses local catalog results for Russian and English catalog searches", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/api/catalog/search") && options?.method === "POST") {
        const body = JSON.parse(String(options.body)) as { query: string }
        return { ok: true, json: async () => catalogSearchPayload(body.query) }
      }
      if (url.includes("/api/checkout/orders")) {
        return { ok: true, json: async () => checkoutCatalogPayload() }
      }
      return { ok: false, json: async () => null }
    })
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/catalog")
    const view = render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    const catalogQuery = "найк DV0788-104 42 до 18000"
    await user.type(screen.getByRole("searchbox", { name: "Поиск по товарам" }), catalogQuery)

    await waitFor(() => {
      expect(screen.getByText("Результаты из опубликованного каталога KICKSBASE.")).toBeInTheDocument()
    })
    const catalogResult = screen.getAllByRole("link", { name: "Открыть товар: Nike Air Force 1 ’07 White" })
      .find((link) => link.classList.contains("live-search-fallback"))
    expect(catalogResult).toHaveAttribute(
      "href",
      "/product/nike-air-force-1-07-white",
    )
    expect(screen.queryByText("Проверка Poizon временно недоступна.")).toBeNull()

    view.unmount()
    window.history.replaceState(null, "", "/")
    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)
    const finder = screen.getByLabelText("Помощь с выбором")
    await user.type(
      within(finder).getByRole("searchbox", { name: "Опишите задачу для подбора" }),
      "Nike DV0788-104 42 до 18000",
    )
    await waitFor(() => {
      expect(within(finder).getByText("Результаты из опубликованного каталога KICKSBASE.")).toBeInTheDocument()
    })

    const searchCalls = fetchMock.mock.calls.filter(
      ([url, options]) =>
        String(url).endsWith("/api/catalog/search") && options?.method === "POST",
    )
    expect(searchCalls.map(([, options]) => JSON.parse(String(options?.body)))).toEqual(
      expect.arrayContaining([
        { query: catalogQuery, limit: 4 },
        { query: "Nike DV0788-104 42 до 18000", limit: 4 },
      ]),
    )
  })

  it("renders several public Poizon cards with Russian details, sizes and RUB totals only", async () => {
    const user = userEvent.setup()
    const first = readySearchPayload("Nike Air Force 1")
    const second = {
      ...first.results[0],
      product_ref: "air-force-1-07-black",
      name: "Air Force 1 '07 Black",
      article: "CW2288-001",
      color: "Black / White",
      description: "Чёрные кроссовки для повседневной носки.",
      images: ["https://cdn.poizon.example/air-force-1-black.webp"],
      offers: [{
        size: "42",
        eu: "42",
        ru: "41",
        us: "8.5",
        cn: "265",
        available: true,
        quote_rub: 16_900,
        rf_delivery: 1000,
        total_rub: 17_900,
        price_breakdown: null,
      }],
    }
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => url.endsWith("/api/catalog/search") && options?.method === "POST"
        ? { ...first, results: [{
          ...first.results[0],
          description: "Белые кроссовки из натуральной кожи.",
        }, second] }
        : livePoizonOnlyCheckoutPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/catalog")
    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск по товарам" }), "найк аир форс")

    await waitFor(() => {
      expect(screen.getAllByTestId("live-search-result")).toHaveLength(2)
    })
    expect(screen.getByText("Белые кроссовки из натуральной кожи.")).toBeInTheDocument()
    expect(screen.getByText("Чёрные кроссовки для повседневной носки.")).toBeInTheDocument()
    expect(screen.getByText(/RU 41 · EU 42 · US 8\.5 · CN 265 · 17\s?700 ₽/)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Выбрать в Telegram" })).toHaveLength(2)
    expect(document.body.textContent).not.toContain("¥")
    expect(document.body.textContent).not.toContain("SKU")
    expect(document.body.textContent).not.toContain("Карточка Poizon")
    expect(document.body.textContent).not.toContain("poizon.com/product")
  })

  it("shows live Poizon photos, translated description and an article-safe Telegram handoff", async () => {
    const user = userEvent.setup()
    const payload = readySearchPayload("Nike Air Force 1")
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => url.endsWith("/api/catalog/search") && options?.method === "POST"
        ? {
          ...payload,
          results: [{
            ...payload.results[0],
            description: "Белые кроссовки из натуральной кожи.",
          }],
        }
        : livePoizonOnlyCheckoutPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск в Poizon" }), "Nike Air Force 1")
    await user.click(screen.getByRole("button", { name: "Найти в Poizon" }))

    expect(await screen.findByText("Белые кроссовки из натуральной кожи.")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Air Force 1 '07 White" }))
      .toHaveAttribute("src", "https://cdn.poizon.example/air-force-1.webp")
    expect(screen.getByText(/RU 41 · EU 42 · US 8\.5 · CN 265 · 17\s?700 ₽/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Выбрать и заказать в Telegram" }))
      .toHaveAttribute("href", "https://t.me/SelectBuyerBot?start=live_RFYwNzg4LTEwNA")
    expect(fetchMock.mock.calls).toContainEqual(expect.arrayContaining([
      "/api/catalog/search",
      expect.objectContaining({ method: "POST" }),
    ]))
  })

  it("does not look up a provider when a customer opens a published product card", async () => {
    const fetchMock = vi.fn(async (url: string, _options?: RequestInit) => ({
      ok: url.includes("/api/checkout/orders?mode=catalog"),
      json: async () => checkoutCatalogPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")

    render(<LandingPage configuredBotUsername={null} />)

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /Nike G\.T\. Cut Academy/ })).toBeInTheDocument()
    })
    expect(fetchMock.mock.calls.filter(([url, options]) =>
      String(url).endsWith("/api/catalog/search") && options?.method === "POST",
    )).toHaveLength(0)
  })

  it("uses no-price static fallback only when the search API is unavailable", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Опишите задачу для подбора" }),
      "белые найк air force 42 до 18000",
    )

    const finder = screen.getByLabelText("Помощь с выбором")
    await waitFor(() => {
      expect(
        within(finder).getByRole("link", { name: /Nike Air Force 1 ’07 White/ }),
      ).toHaveAttribute("href", "/product/nike-air-force-1-07-white")
    })
    expect(within(finder).getByText("Показаны товары из локальной витрины.")).toBeInTheDocument()
    expect(within(finder).queryByText("16 000 ₽")).toBeNull()
  })

  it("never replaces a missing Poizon snapshot with a bundled catalog price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    window.history.replaceState(null, "", "/catalog")
    render(<LandingPage configuredBotUsername={null} />)

    const firstCard = productLinks()[0]
    await waitFor(() => {
      expect(within(firstCard).getByText("Уточняется")).toBeInTheDocument()
    })
    expect(within(firstCard).queryByText("34 500 ₽")).toBeNull()
  })

  it("maps a legacy product query to the canonical product page", async () => {
    window.history.replaceState(
      null,
      "",
      "/?category=basketball&q=nike&sort=price-asc&product=nike-gt-cut-academy",
    )

    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    expect(screen.getByRole("dialog", { name: /Nike G\.T\. Cut Academy/ })).toHaveAttribute(
      "id",
      "product-dialog",
    )
    await waitFor(() => {
      expect(window.location.pathname).toBe("/product/nike-gt-cut-academy")
      expect(window.location.search).toBe("")
    })
  })

  it("keeps product URLs clean while filters stay on the catalog URL", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/catalog?category=basketball")
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск по товарам" }), "nike")
    const productLink = screen.getByRole("link", {
      name: /Открыть товар: Nike G.T. Cut Academy/,
    })
    expect(productLink).toHaveAttribute("href", "/product/nike-gt-cut-academy")
    expect(screen.getByRole("searchbox", { name: "Поиск по товарам" })).toHaveValue(
      "nike",
    )
    expect(productLinks()).toHaveLength(6)
    expect(window.location.search).toBe("?category=basketball&q=nike")
  })

  it("keeps invalid legacy product links on an accessible canonical not-found page", async () => {
    window.history.replaceState(null, "", "/?product=not-a-real-product")
    render(<LandingPage configuredBotUsername={null} />)

    expect(screen.getByRole("heading", { name: "Такой страницы нет." })).toBeInTheDocument()
    await waitFor(() => {
      expect(window.location.pathname).toBe("/product/not-a-real-product")
    })
  })

  it("opens the configured bot with the canonical catalog SKU without a provider lookup", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => url.includes("/api/checkout/orders?mode=catalog")
        ? checkoutCatalogPayload()
        : {},
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")
    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    expect(await screen.findByRole("link", {
      name: "Продолжить заказ в Telegram",
    })).toHaveAttribute("href", "https://t.me/SelectBuyerBot?start=sku_nike-gt-cut-academy")
    expect(fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/catalog/search"),
    )).toHaveLength(0)
  })

  it("keeps ordering in Telegram instead of submitting a stale site-cart total", async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => checkoutCatalogPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")
    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    expect(await screen.findByRole("link", { name: "Продолжить заказ в Telegram" }))
      .toHaveAttribute("href", "https://t.me/SelectBuyerBot?start=sku_nike-gt-cut-academy")
    expect(fetchMock.mock.calls.some(
      (call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/checkout/orders"),
    )).toBe(false)
  })

  it("keeps the Telegram order path available even when legacy web checkout is disabled", async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => _url.endsWith("/api/catalog/search")
        ? readyGtCutSearchPayload()
        : livePoizonOnlyCheckoutPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")

    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    expect(await screen.findByRole("link", { name: "Продолжить заказ в Telegram" }))
      .toHaveAttribute("href", "https://t.me/SelectBuyerBot?start=sku_nike-gt-cut-academy")
    expect(screen.queryByRole("dialog", { name: "Корзина" })).toBeNull()
    expect(fetchMock.mock.calls.some(
      (call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/checkout/orders"),
    )).toBe(false)
  })

  it("clears a persisted legacy cart and routes the customer to Telegram", async () => {
    localStorage.setItem(
      "kicksbase-cart-v1",
      JSON.stringify([{ slug: "nike-gt-cut-academy", size: "44", quantity: 1 }]),
    )
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => livePoizonOnlyCheckoutPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/?cart=1")

    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    const cart = await screen.findByRole("dialog", { name: "Корзина" })
    expect(await within(cart).findByText("Оформление на сайте перенесено в Telegram.")).toBeInTheDocument()
    expect(within(cart).getByRole("link", { name: "Продолжить в Telegram" }))
      .toHaveAttribute("href", "https://t.me/SelectBuyerBot")
    expect(within(cart).queryByText("24 500 ₽")).toBeNull()
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("kicksbase-cart-v1") || "null")).toEqual([])
    })
    expect(fetchMock.mock.calls.some(
      (call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/checkout/orders"),
    )).toBe(false)
  })

  it("flags a persisted size that is absent from the server catalogue", async () => {
    localStorage.setItem(
      "kicksbase-cart-v1",
      JSON.stringify([{ slug: "nike-gt-cut-academy", size: "99", quantity: 1 }]),
    )
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => checkoutCatalogPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/?cart=1")

    render(<LandingPage configuredBotUsername={null} />)

    const cart = await screen.findByRole("dialog", { name: "Корзина" })
    expect(
      await within(cart).findByText(/Товар или размер отсутствует в опубликованном каталоге/),
    ).toBeInTheDocument()
    expect(within(cart).getByRole("button", { name: /Оплатить товары/ })).toBeDisabled()
    expect(fetchMock.mock.calls.some(
      (call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/checkout/orders"),
    )).toBe(false)
  })

  it("states the v10 split-payment terms on the offer and delivery pages", () => {
    window.history.replaceState(null, "", "/offer")
    const view = render(<LandingPage configuredBotUsername={null} />)
    expect(screen.getByText(/оплачивается отдельно после прибытия товара/i)).toBeInTheDocument()

    view.unmount()
    window.history.replaceState(null, "", "/delivery-returns")
    render(<LandingPage configuredBotUsername={null} />)
    expect(screen.getByText(/оплачивается отдельно после прибытия товара/i)).toBeInTheDocument()
  })
})
