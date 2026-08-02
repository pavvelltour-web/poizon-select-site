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
    version: "2026-07-31-v2",
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

function readyGtCutSearchPayload() {
  const payload = readySearchPayload("Nike G.T. Cut Academy basketball volleyball")
  return {
    ...payload,
    results: [{
      ...payload.results[0],
      provider_product_id: "poizon-gt-cut-academy",
      provider_url: "https://www.poizon.com/product/gt-cut-academy",
      name: "G.T. Cut Academy",
      model: "G.T. Cut Academy",
      article: "GT-CUT-ACADEMY",
      offers: [{
        sku_id: "gt-cut-44",
        size: "44",
        ru: "43",
        us: "10",
        cn: "280",
        currency: "CNY",
        price_cny: 899,
        quote_rub: 24500,
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
        source: "poizon",
        provider_product_id: "poizon-air-force-1-07-white",
        provider_url: "https://www.poizon.com/product/dv0788-104",
        brand: "Nike",
        name: "Air Force 1 '07 White",
        article: "DV0788-104",
        kind: "footwear",
        images: ["https://cdn.poizon.example/air-force-1.webp"],
        observed_at: observedAt,
        expires_at: expiresAt,
        offers: [
          {
            sku_id: "sku-42",
            size: "42",
            currency: "CNY",
            price_cny: 699,
            quote_rub: 16700,
          },
          {
            sku_id: "sku-43",
            size: "43",
            currency: "CNY",
            price_cny: 729,
            quote_rub: 17300,
          },
        ],
      },
    ],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("LandingPage", () => {
  it("renders the approved eight-product home and progressively reveals the full catalog", () => {
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

    while (productLinks().length < publicCatalogProducts.length) {
      fireEvent.click(screen.getByRole("button", { name: /Показать ещё/ }))
    }

    expect(productLinks()).toHaveLength(publicCatalogProducts.length)
    expect(screen.queryByRole("button", { name: /Показать ещё/ })).toBeNull()
    expect(screen.getByText("Показан весь каталог")).toBeInTheDocument()
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
    expect(within(dialog).getAllByText(/^\d{1,3}(?: \d{3})+ ₽$/).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Открыть фото в полном размере" })).toBeInTheDocument()
    expect(screen.queryByText(/VITE_BOT_USERNAME|менеджер/i)).toBeNull()
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
    expect(screen.getByText("Фото товара 1 из 5")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Следующее фото товара" }))

    heroImage = screen.getByRole("img", {
      name: /ASICS SKY ELITE FF 3/,
    })
    expect(heroImage).toHaveAttribute(
      "src",
      expect.stringContaining("asics-sky-elite-ff-3/02-three-quarter.png"),
    )
    expect(screen.getByText("Фото товара 2 из 5")).toBeInTheDocument()

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

  it("uses the verified API for Russian and English catalog searches", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/api/catalog/search") && options?.method === "POST") {
        const body = JSON.parse(String(options.body)) as { query: string }
        return { ok: true, json: async () => readySearchPayload(body.query) }
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
      expect(screen.getAllByTestId("live-search-result")).toHaveLength(1)
    })
    const liveResult = screen.getByTestId("live-search-result")
    expect(within(liveResult).getByText("Артикул: DV0788-104")).toBeInTheDocument()
    expect(within(liveResult).getByText("Проверенные размеры: 42, 43")).toBeInTheDocument()
    expect(within(liveResult).getByText("16 700 ₽")).toBeInTheDocument()
    expect(within(liveResult).getByText("Официальная цена: ¥699")).toBeInTheDocument()
    expect(within(liveResult).getByRole("link", { name: "Карточка Poizon" })).toHaveAttribute(
      "href",
      "https://www.poizon.com/product/dv0788-104",
    )
    expect(within(liveResult).getByRole("link", { name: "Открыть @SelectBuyerBot" })).toHaveAttribute(
      "href",
      "https://t.me/SelectBuyerBot",
    )
    expect(within(liveResult).queryByRole("button", { name: /Добавить в заказ/ })).toBeNull()

    view.unmount()
    window.history.replaceState(null, "", "/")
    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)
    const finder = screen.getByLabelText("Помощь с выбором")
    await user.type(
      within(finder).getByRole("searchbox", { name: "Опишите задачу для подбора" }),
      "Nike DV0788-104 42 до 18000",
    )
    await waitFor(() => {
      expect(within(finder).getByText("Артикул: DV0788-104")).toBeInTheDocument()
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
    expect(within(finder).getByText("Цена и наличие требуют проверки.")).toBeInTheDocument()
    expect(within(finder).queryByText("16 000 ₽")).toBeNull()
  })

  it("keeps published catalog prices readable when the API is temporarily offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    window.history.replaceState(null, "", "/catalog")
    render(<LandingPage configuredBotUsername={null} />)

    await waitFor(() => {
      expect(
        screen.getByText(
          "Цены из витрины видны. Оформление вернётся после восстановления связи с сервером.",
        ),
      ).toBeInTheDocument()
    })

    const firstCard = productLinks()[0]
    expect(within(firstCard).getByText("34 500 ₽")).toBeInTheDocument()
    expect(within(firstCard).queryByText("—")).toBeNull()
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

  it("uses the matching live result instead of a mismatched first result", async () => {
    const matchingPayload = readyGtCutSearchPayload()
    const matchingResult = {
      ...matchingPayload.results[0],
      model: "G.T. Cut Academy",
      offers: matchingPayload.results[0].offers.map((offer) => ({ ...offer, ru: "42" })),
    }
    const mismatchedResult = {
      ...matchingResult,
      provider_product_id: "poizon-air-force-1-07-white",
      provider_url: "https://www.poizon.com/product/cw2288-111",
      name: "Air Force 1 '07 White",
      model: "Air Force 1 '07 White",
      article: "CW2288-111",
      offers: matchingResult.offers.map((offer) => ({ ...offer, ru: "99" })),
    }
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      json: async () => _url.endsWith("/api/catalog/search")
        ? { ...matchingPayload, results: [mismatchedResult, matchingResult] }
        : checkoutCatalogPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")
    render(<LandingPage configuredBotUsername={null} />)

    expect(await screen.findByRole("button", {
      name: "42 RU, 44 EU, 24 500 ₽",
    })).toBeEnabled()
    expect(screen.queryByRole("button", {
      name: "99 RU, 44 EU, 24 500 ₽",
    })).toBeNull()
  })

  it("adds a selected product to the site cart and submits checkout", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true,
      status: options?.method === "POST" && _url.endsWith("/api/checkout/orders") ? 201 : 200,
      json: async () => _url.endsWith("/api/catalog/search")
        ? readyGtCutSearchPayload()
        : options?.method === "POST" && _url.endsWith("/api/checkout/orders")
        ? {
            checkout_id: "web-test",
            order_number: "KB-20260801-TEST",
            order_ids: [101],
            amounts: {
              merchandise_rub: 24500,
              payable_now_rub: 24500,
              delivery_due_later_rub: 880,
              currency: "RUB",
            },
            delivery: {
              method: "cdek_courier",
              provider: "cdek",
              city: "Москва",
              postal_code: "119607",
              address: "ул. Лобачевского, 100",
              pvz_code: null,
              amount_rub: 880,
              quote_status: "estimated",
              min_days: null,
              max_days: null,
              payment_timing: "separate_after_arrival",
            },
            status: "payment_ready",
            payment_url: "https://securepay.tbank.ru/test",
            message: "Заказ создан.",
          }
        : checkoutCatalogPayload(),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(await screen.findByRole("button", {
      name: "43 RU, 44 EU, 24 500 ₽",
    }))
    const purchaseButton = screen.getByRole("button", { name: /Добавить в заказ/ })
    expect(purchaseButton).toHaveAttribute("data-selected-size", "44")
    expect(purchaseButton).toHaveAttribute("data-display-price", "24 500 ₽")
    await user.click(purchaseButton)
    expect(screen.getByRole("button", { name: "Добавлено" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Открыть заказ" }))

    const cart = screen.getByRole("dialog", { name: "Корзина" })
    expect(within(cart).getByText(/Nike G.T. Cut Academy/)).toBeInTheDocument()
    expect(within(cart).getByText("Товары сейчас")).toBeInTheDocument()

    await user.type(within(cart).getByLabelText("ФИО получателя"), "Павел Шустров")
    await user.type(
      within(cart).getByLabelText("Телефон для связи и СДЭК"),
      "+79990000000",
    )
    await user.type(within(cart).getByLabelText("Email для чека"), "buyer@example.com")
    await user.type(within(cart).getByLabelText("Город"), "Москва")
    await user.type(within(cart).getByLabelText("Почтовый индекс"), "119607")
    await user.type(within(cart).getByLabelText("Адрес доставки"), "ул. Лобачевского, 100")
    await user.click(within(cart).getByRole("checkbox", { name: /публичной оферты/i }))
    await user.click(
      within(cart).getByRole("checkbox", { name: /обработку персональных данных/i }),
    )
    await user.click(within(cart).getByRole("button", { name: "Оплатить товары 24 500 ₽" }))

    const lastOrderCall = await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/checkout/orders"),
      )
      expect(postCall).toBeDefined()
      return postCall as [
        unknown,
        { body?: string; headers?: Record<string, string> },
      ]
    })
    const body = JSON.parse(lastOrderCall[1].body as string)
    expect(lastOrderCall[1].headers?.["Idempotency-Key"]).toMatch(
      /^[\x21-\x7e]{8,80}$/,
    )
    expect(body.customer.full_name).toBe("Павел Шустров")
    expect(body.items[0]).toMatchObject({
      product_slug: "nike-gt-cut-academy",
      size_eu: "44",
      quantity: 1,
      price_rub: 24500,
      price_version: "2026-07-31-v2",
    })
    expect(body.delivery).toEqual({
      method: "cdek_courier",
      city: "Москва",
      postal_code: "119607",
      address: "ул. Лобачевского, 100",
      pvz_code: null,
    })
    const payment = await screen.findByRole("dialog", { name: "Оплата" })
    expect(within(payment).getByText(/KB-20260801-TEST/)).toBeInTheDocument()
    expect(within(payment).getByText(/Доставка 880 ₽ оплачивается отдельно/)).toBeInTheDocument()
    expect(within(payment).getByRole("link", { name: "Перейти к оплате" })).toHaveAttribute(
      "href",
      "https://securepay.tbank.ru/test",
    )
  })

  it("keeps the PDP visible but blocks add-to-cart when order creation is disabled", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => _url.endsWith("/api/catalog/search")
        ? readyGtCutSearchPayload()
        : checkoutCatalogPayload(undefined, {
          orderCreationEnabled: false,
          onlinePaymentEnabled: false,
        }),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")

    render(<LandingPage configuredBotUsername={null} />)

    await user.click(await screen.findByRole("button", {
      name: "43 RU, 44 EU, 24 500 ₽",
    }))
    const purchaseButton = await screen.findByRole("button", {
      name: "Оформление временно недоступно",
    })
    expect(purchaseButton).toBeDisabled()
    expect(purchaseButton).toHaveAttribute("data-order-enabled", "false")
    expect(purchaseButton).toHaveAttribute("data-selected-size", "44")
    expect(screen.queryByRole("dialog", { name: "Корзина" })).toBeNull()
    expect(fetchMock.mock.calls.some(
      (call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/checkout/orders"),
    )).toBe(false)
  })

  it("keeps a valid persisted cart readable but blocks checkout when order creation is disabled", async () => {
    localStorage.setItem(
      "kicksbase-cart-v1",
      JSON.stringify([{ slug: "nike-gt-cut-academy", size: "44", quantity: 1 }]),
    )
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => checkoutCatalogPayload(undefined, {
        orderCreationEnabled: false,
        onlinePaymentEnabled: false,
      }),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/?cart=1")

    render(<LandingPage configuredBotUsername={null} />)

    const cart = await screen.findByRole("dialog", { name: "Корзина" })
    expect(
      await within(cart).findByText("Цена и размеры видны. Оформление заказа сейчас отключено."),
    ).toBeInTheDocument()
    expect(
      within(cart).getByRole("button", { name: "Оформление временно недоступно" }),
    ).toBeDisabled()
    expect(within(cart).getAllByText("24 500 ₽")).toHaveLength(2)
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
