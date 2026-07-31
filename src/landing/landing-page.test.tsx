import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import * as orderRequest from "./order-request"
import { LandingPage } from "./landing-page"
import { publicCatalogProducts } from "../catalog/catalog"

function productLinks() {
  return screen
    .getAllByRole("link", { name: /Открыть товар:/ })
    .filter((link) => link.classList.contains("product-card__link"))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("LandingPage", () => {
  it("renders all items with readable prices", () => {
    render(<LandingPage configuredBotUsername={null} />)

    expect(screen.getByRole("heading", { name: "KICKSBASE" })).toBeInTheDocument()
    expect(productLinks()).toHaveLength(publicCatalogProducts.length)
    expect(screen.queryByText("по запросу")).toBeNull()
    expect(screen.getAllByText("24 500 ₽").length).toBeGreaterThan(0)
    expect(screen.getAllByText("45 000 ₽").length).toBeGreaterThan(0)
    expect(screen.getAllByText("5 000 ₽").length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Выберите модель и размер, оплатите/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/менеджер/i)).toBeNull()
    expect(document.body.textContent).not.toMatch(/[–—]/u)
    expect(screen.getByLabelText("Согласие на использование cookie")).toHaveTextContent(
      "Сайт использует необходимые файлы cookie для работы витрины и сохранения корзины. Продолжая использование сайта, вы соглашаетесь с Политикой обработки персональных данных.",
    )
    const paymentMethods = screen.getByLabelText("Способы оплаты")
    for (const method of ["МИР", "СБП", "Visa", "Mastercard"]) {
      expect(within(paymentMethods).getByText(method)).toBeInTheDocument()
    }
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
        { name: /На матч/ },
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
    expect(productLinks()).toHaveLength(publicCatalogProducts.length)
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
    expect(productLinks()).toHaveLength(publicCatalogProducts.length)
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

    await user.click(screen.getByRole("button", { name: "Открыть фото в полном размере" }))
    const lightbox = screen.getByRole("dialog", { name: "Полноэкранное фото товара" })
    expect(within(lightbox).getByText("100%")).toBeInTheDocument()
    await user.click(within(lightbox).getByRole("button", { name: "Увеличить фото" }))
    expect(within(lightbox).getByText("125%")).toBeInTheDocument()
    await user.click(within(lightbox).getByRole("button", { name: "Закрыть фото" }))

    expect(screen.getAllByRole("button", { name: /Показать фото/ })).toHaveLength(4)
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

  it("hydrates a product dialog from a URL and browser back restores catalog context", async () => {
    const user = userEvent.setup()
    window.history.replaceState(
      null,
      "",
      "/?category=basketball&q=nike&sort=price-asc&product=nike-gt-cut-academy",
    )

    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    expect(screen.getByRole("searchbox", { name: "Поиск по товарам" })).toHaveValue(
      "nike",
    )
    expect(screen.getByRole("combobox", { name: "Сортировка" })).toHaveValue(
      "price-asc",
    )
    expect(screen.getByTestId("order-dock")).toBeInTheDocument()
    expect(screen.getByText(/В карточке указана цена товара/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Открыть @SelectBuyerBot" })).toHaveAttribute(
      "href",
      "https://t.me/SelectBuyerBot",
    )

    await user.click(
      screen.getAllByRole("button", { name: "Закрыть карточку товара" })[1],
    )
    await waitFor(() => {
      expect(screen.queryByTestId("order-dock")).not.toBeInTheDocument()
    })
    expect(window.location.search).toBe("?category=basketball&q=nike&sort=price-asc")
  })

  it("keeps product URLs clean while filters stay on the catalog URL", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      within(screen.getByRole("group", { name: "Категории товара" })).getByRole(
        "button",
        { name: /Для движения/ },
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

  it("shows a visible manual fallback when copying fails", async () => {
    const user = userEvent.setup()
    vi.spyOn(orderRequest, "copyOrderRequest").mockResolvedValueOnce(false)
    window.history.replaceState(null, "", "/?product=asics-sky-elite-ff-3")
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(screen.getByRole("button", { name: "Скопировать запрос" }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Выделите текст выше и скопируйте его вручную.",
    )
  })

  it("adds a selected product to the site cart and submits checkout", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        checkout_id: "web-test",
        order_ids: [101],
        status: "payment_unavailable",
        payment_url: null,
        message: "Заказ создан в CRM.",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    window.history.replaceState(null, "", "/product/nike-gt-cut-academy")
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(screen.getByRole("button", { name: "44" }))
    await user.click(screen.getByRole("button", { name: /Добавить в заказ/ }))

    const cart = screen.getByRole("dialog", { name: "Заказ" })
    expect(within(cart).getByText(/Nike G.T. Cut Academy/)).toBeInTheDocument()
    expect(within(cart).getByText("Итого")).toBeInTheDocument()

    await user.type(within(cart).getByLabelText("ФИО получателя"), "Павел Шустров")
    await user.type(
      within(cart).getByLabelText("Телефон для связи и СДЭК"),
      "+79990000000",
    )
    await user.type(within(cart).getByLabelText("Email для чека"), "buyer@example.com")
    await user.click(within(cart).getByRole("checkbox", { name: /публичной оферты/i }))
    await user.click(
      within(cart).getByRole("checkbox", { name: /обработку персональных данных/i }),
    )
    await user.click(within(cart).getByRole("button", { name: "Оплатить 24 500 ₽" }))

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
      /^[\x21-\x7e]{8,128}$/,
    )
    expect(body.customer.full_name).toBe("Павел Шустров")
    expect(body.items[0]).toMatchObject({
      product_slug: "nike-gt-cut-academy",
      size_eu: "44",
      quantity: 1,
      price_rub: 24500,
      price_version: "2026-07-31-v2",
    })
    expect(within(cart).getByText("Заказ создан в CRM.")).toBeInTheDocument()
  })
})
