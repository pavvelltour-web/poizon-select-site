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
  it("renders 24 products first, then progressively reveals the full catalog", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    expect(
      screen.getByRole("heading", { name: "Выберите модель. Остальное видно сразу." }),
    ).toBeInTheDocument()
    expect(productLinks()).toHaveLength(CATALOG_PAGE_SIZE)
    expect(screen.getByText(`Показано ${CATALOG_PAGE_SIZE}`)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: `Показать ещё ${CATALOG_PAGE_SIZE}` }),
    ).toBeInTheDocument()
    expect(screen.queryByText("по запросу")).toBeNull()
    expect(screen.getAllByText("24 500 ₽").length).toBeGreaterThan(0)
    const firstCard = productLinks()[0]
    expect(firstCard).toHaveAccessibleName(/Nike KD 18/)
    expect(within(firstCard).getByText("Баскетбольные кроссовки")).toBeInTheDocument()
    expect(within(firstCard).getByRole("heading", { name: "Nike KD 18" })).toBeInTheDocument()
    expect(
      screen.getByText("Цена, размер и срок доставки видны до оформления заказа."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/менеджер/i)).toBeNull()
    expect(screen.queryByText("Предварительные данные")).toBeNull()
    expect(document.body.textContent).not.toMatch(/[–—]/u)
    expect(screen.getByLabelText("Согласие на использование cookie")).toHaveTextContent(
      "Сайт использует необходимые файлы cookie для работы витрины и сохранения корзины. Продолжая использование сайта, вы соглашаетесь с Политикой обработки персональных данных.",
    )
    const paymentMethods = screen.getByLabelText("Способы оплаты")
    for (const method of ["МИР", "СБП", "Visa", "Mastercard"]) {
      expect(within(paymentMethods).getByText(method)).toBeInTheDocument()
    }

    while (productLinks().length < publicCatalogProducts.length) {
      await user.click(screen.getByRole("button", { name: /Показать ещё/ }))
    }

    expect(productLinks()).toHaveLength(publicCatalogProducts.length)
    expect(screen.queryByRole("button", { name: /Показать ещё/ })).toBeNull()
    expect(screen.getAllByText("45 000 ₽").length).toBeGreaterThan(0)
    expect(screen.getAllByText("5 000 ₽").length).toBeGreaterThan(0)
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

    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "На главную" })).toHaveAttribute("href", "/")
    expect(screen.queryByRole("link", { name: /Открыть товар:/ })).toBeNull()
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

  it("filters, sorts and resets the catalog deterministically", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      within(screen.getByRole("group", { name: "Категории товара" })).getByRole(
        "button",
        { name: "Волейбольные пары для матча" },
      ),
    )
    expect(productLinks()).toHaveLength(19)
    expect(screen.getByText("Пары для матча и тренировки")).toBeInTheDocument()
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

    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }))
    expect(productLinks()).toHaveLength(CATALOG_PAGE_SIZE)
    expect(window.location.search).toBe("")
  })

  it("recovers from an empty search result", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Поиск по товарам" }),
      "definitely-not-a-product",
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ничего не нашли по этому запросу.",
    )

    await user.click(screen.getByRole("button", { name: /Показать все товары/ }))
    expect(productLinks()).toHaveLength(CATALOG_PAGE_SIZE)
  })

  it("publishes a stable product deep link and renders the full product page", async () => {
    const user = userEvent.setup()
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

    expect(
      screen.getByRole("heading", { level: 1, name: /Ronaldinho #10 Jersey/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^\d{1,3}(?: \d{3})+ ₽$/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Открыть фото в полном размере" })).toBeInTheDocument()
    expect(screen.queryByText(/VITE_BOT_USERNAME|менеджер/i)).toBeNull()
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
      "http://localhost:3000/catalog/asics-sky-elite-ff-3.webp",
    )
    expect(screen.getByText("1/4")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Следующее фото товара" }))

    heroImage = screen.getByRole("img", {
      name: /ASICS SKY ELITE FF 3/,
    })
    expect(heroImage).toHaveAttribute(
      "src",
      expect.stringContaining("asics-sky-elite-ff-3-3.webp"),
    )
    expect(screen.getByText("2/4")).toBeInTheDocument()

    const openPhotoButton = screen.getByRole("button", {
      name: "Открыть фото в полном размере",
    })
    await user.click(openPhotoButton)
    const lightbox = screen.getByRole("dialog", { name: "Полноэкранное фото товара" })
    expect(within(lightbox).getByText("100%")).toBeInTheDocument()
    const closePhotoButton = within(lightbox).getByRole("button", { name: "Закрыть фото" })
    await waitFor(() => expect(closePhotoButton).toHaveFocus())

    const canvas = within(lightbox).getByRole("group", { name: /Фото 2 из 4/ })
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
      within(lightbox).getByRole("group", { name: /Фото 3 из 4/ }),
    ).toBeInTheDocument()
    expect(within(lightbox).getByText("100%")).toBeInTheDocument()

    await user.click(within(lightbox).getByRole("img", { name: /ASICS SKY ELITE FF 3/ }))
    expect(within(lightbox).getByText("200%")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "Полноэкранное фото товара" })).toBeNull()
    await waitFor(() => expect(openPhotoButton).toHaveFocus())

    expect(screen.getAllByRole("button", { name: /Показать фото/ })).toHaveLength(4)
  })

  it("keeps the hero rights-safe and lazily loads catalog photography", () => {
    render(<LandingPage configuredBotUsername={null} />)

    expect(document.querySelector(".hero img")).toBeNull()

    document.querySelectorAll<HTMLImageElement>(".product-card__image").forEach((image) => {
      expect(image).toHaveAttribute("loading", "lazy")
      expect(image).toHaveAttribute("fetchpriority", "auto")
    })
  })

  it("surfaces task-based matches from a plain-language need", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Опишите задачу для подбора" }),
      "пара для зала и мягкое приземление",
    )

    const finder = screen.getByLabelText("Помощь с выбором")
    expect(finder).toHaveTextContent("для матча и тренировки")
    expect(
      within(finder).getByRole("link", { name: /Mizuno WAVE VOLTAGE 2/ }),
    ).toBeInTheDocument()
  })

  it("uses server AI normalization while keeping cards bound to the local catalog", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/api/catalog/recommendations") && options?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            version: "2026-07-31-v2",
            normalized_query: "Nike Air Force 1",
            ai_used: true,
            items: [
              {
                slug: "nike-air-force-1-07-white",
                reason: "Серверный подбор по модели",
              },
            ],
          }),
        }
      }
      return { ok: false, json: async () => null }
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Опишите задачу для подбора" }),
      "белые Nike air force 42 до 18000",
    )

    await waitFor(() => {
      expect(screen.getByText("Серверный подбор по модели")).toBeInTheDocument()
    })
    const finder = screen.getByLabelText("Помощь с выбором")
    expect(
      within(finder).getByRole("link", { name: /Nike Air Force 1 ’07 White/ }),
    ).toHaveAttribute("href", "/product/nike-air-force-1-07-white")
    expect(within(finder).getByText("16 000 ₽")).toBeInTheDocument()
    const recommendationCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/catalog/recommendations"),
    )
    expect(recommendationCall).toBeDefined()
    expect(JSON.parse(String(recommendationCall?.[1]?.body))).toEqual({
      query: "белые Nike air force 42 до 18000",
      limit: 4,
    })
  })

  it("falls back to deterministic local matches without inventing a price", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Опишите задачу для подбора" }),
      "белые Nike air force 42 до 18000",
    )

    const finder = screen.getByLabelText("Помощь с выбором")
    await waitFor(() => {
      expect(
        within(finder).getByRole("link", { name: /Nike Air Force 1 ’07 White/ }),
      ).toHaveAttribute("href", "/product/nike-air-force-1-07-white")
    })
    expect(within(finder).getByText("16 000 ₽")).toBeInTheDocument()
  })

  it("keeps published catalog prices readable when the API is temporarily offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
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

    expect(
      screen.getByRole("heading", { level: 1, name: /Nike G\.T\. Cut Academy/ }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId("order-dock")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Задать вопрос в Telegram" })).toHaveAttribute(
      "href",
      "https://t.me/SelectBuyerBot",
    )
    await waitFor(() => {
      expect(window.location.pathname).toBe("/product/nike-gt-cut-academy")
      expect(window.location.search).toBe("")
    })
  })

  it("keeps product URLs clean while filters stay on the catalog URL", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      within(screen.getByRole("group", { name: "Категории товара" })).getByRole(
        "button",
        { name: "Баскетбольные пары для игры" },
      ),
    )
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

  it("adds a selected product to the site cart and submits checkout", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true,
      status: options?.method === "POST" ? 201 : 200,
      json: async () => options?.method === "POST"
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

    await user.click(await screen.findByRole("button", { name: "44" }))
    const purchaseButton = screen.getByRole("button", { name: /Добавить в заказ/ })
    expect(purchaseButton).toHaveAttribute("data-selected-size", "44")
    expect(purchaseButton).toHaveAttribute("data-display-price", "24 500 ₽")
    expect(purchaseButton).toHaveAccessibleDescription(/Выбран размер 44/)
    await user.click(purchaseButton)

    const cart = screen.getByRole("dialog", { name: "Заказ" })
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
        (call) => call[1]?.method === "POST",
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
    expect(within(cart).getByText("Заказ KB-20260801-TEST")).toBeInTheDocument()
    expect(within(cart).getByText("880 ₽")).toBeInTheDocument()
    expect(within(cart).getByText("предварительный")).toBeInTheDocument()
    expect(within(cart).getByRole("link", { name: "Перейти к оплате" })).toHaveAttribute(
      "href",
      "https://securepay.tbank.ru/test",
    )
  })

  it("keeps the PDP visible but blocks add-to-cart when order creation is disabled", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => checkoutCatalogPayload(undefined, {
        orderCreationEnabled: false,
        onlinePaymentEnabled: false,
      }),
    }))
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")

    render(<LandingPage configuredBotUsername={null} />)

    await user.click(await screen.findByRole("button", { name: "44" }))
    const purchaseButton = await screen.findByRole("button", {
      name: "Оформление временно недоступно",
    })
    expect(purchaseButton).toBeDisabled()
    expect(purchaseButton).toHaveAttribute("data-order-enabled", "false")
    expect(purchaseButton).toHaveAttribute("data-selected-size", "44")
    expect(screen.queryByRole("dialog", { name: "Заказ" })).toBeNull()
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false)
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

    const cart = await screen.findByRole("dialog", { name: "Заказ" })
    expect(
      await within(cart).findByText("Цена и размеры видны. Оформление заказа сейчас отключено."),
    ).toBeInTheDocument()
    expect(
      within(cart).getByRole("button", { name: "Оформление временно недоступно" }),
    ).toBeDisabled()
    expect(within(cart).getAllByText("24 500 ₽")).toHaveLength(2)
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false)
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

    const cart = await screen.findByRole("dialog", { name: "Заказ" })
    expect(
      await within(cart).findByText(/Товар или размер отсутствует в опубликованном каталоге/),
    ).toBeInTheDocument()
    expect(within(cart).getByRole("button", { name: /Оплатить товары/ })).toBeDisabled()
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false)
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
