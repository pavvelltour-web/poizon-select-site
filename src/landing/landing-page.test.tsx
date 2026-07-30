import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import * as orderRequest from "./order-request"
import { LandingPage } from "./landing-page"
import { publicCatalogProducts } from "../catalog/catalog"

function productButtons() {
  return screen.getAllByRole("button", { name: /Открыть карточку:/ })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("LandingPage", () => {
  it("renders all items with a visible price floor", () => {
    render(<LandingPage configuredBotUsername={null} />)

    expect(screen.getByRole("heading", { name: "KICKSBASE" })).toBeInTheDocument()
    expect(productButtons()).toHaveLength(publicCatalogProducts.length)
    expect(screen.queryByText("по запросу")).toBeNull()
    expect(screen.getAllByText("Цена")).toHaveLength(publicCatalogProducts.length)
    expect(screen.getAllByText("от 24 500 ₽").length).toBeGreaterThan(0)
    expect(screen.getAllByText("от 45 тыс. ₽").length).toBeGreaterThan(0)
    expect(screen.getAllByText("от 4 тыс. ₽").length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Выберите модель, подтвердите размер/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Размер, продавец, бирки/),
    ).toBeInTheDocument()
  })

  it("filters, sorts and resets the catalog deterministically", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      within(screen.getByRole("group", { name: "Сценарии" })).getByRole(
        "button",
        { name: /Игровой день/ },
      ),
    )
    expect(productButtons()).toHaveLength(19)
    expect(screen.getByText("Пары для игровых дней")).toBeInTheDocument()
    expect(window.location.search).toBe("?category=volleyball")

    await user.type(screen.getByRole("searchbox", { name: "Поиск по товарам" }), "nike")
    expect(productButtons()).toHaveLength(2)
    expect(window.location.search).toBe("?category=volleyball&q=nike")

    await user.selectOptions(screen.getByRole("combobox", { name: "Сортировка" }), [
      "price-desc",
    ])
    expect(productButtons()[0]).toHaveAccessibleName(/Nike ZOOM HYPERSET 2/)
    expect(window.location.search).toBe(
      "?category=volleyball&q=nike&sort=price-desc",
    )

    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }))
    expect(productButtons()).toHaveLength(publicCatalogProducts.length)
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
    expect(productButtons()).toHaveLength(publicCatalogProducts.length)
  })

  it("opens a stable product deep link and keeps the bot request clean", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск по товарам" }), "Ronaldinho")
    await user.click(
      screen.getByRole("button", {
        name: /Открыть карточку: Nike Football FC Barcelona Ronaldinho/,
      }),
    )

    expect(window.location.search).toBe(
      "?q=Ronaldinho&product=nike-barcelona-ronaldinho-jersey",
    )
    const dock = screen.getByTestId("order-dock")
    expect(within(dock).getByRole("heading", { name: /Ronaldinho #10 Jersey/ })).toBeInTheDocument()
    expect((within(dock).getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Nike FC Barcelona Ronaldinho number 10 Jersey",
    )
    await user.click(within(dock).getByRole("button", { name: "M" }))
    expect((within(dock).getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Nike FC Barcelona Ronaldinho number 10 Jersey\nРазмер: M",
    )
    expect(
      within(dock).queryByRole("link", { name: /Выбрать размер/ }),
    ).toBeNull()
    expect(
      within(dock).getAllByRole("button", { name: "Скопировать запрос" }),
    ).toHaveLength(1)
    expect(window.location.search).toBe(
      "?q=Ronaldinho&product=nike-barcelona-ronaldinho-jersey",
    )
    expect(within(dock).getByText(/Ссылка на менеджера появится/)).toBeInTheDocument()
    expect(within(dock).queryByText(/VITE_BOT_USERNAME/)).toBeNull()
    expect(within(dock).queryByRole("link", { name: /Открыть @/ })).toBeNull()
  })

  it("lets the product sheet gallery move through every generated angle", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      screen.getByRole("button", {
        name: /Открыть карточку: ASICS SKY ELITE FF 3/,
      }),
    )

    const dock = screen.getByTestId("order-dock")
    let heroImage = within(dock).getByRole("img", {
      name: /ASICS SKY ELITE FF 3/,
    })
    expect(heroImage).toHaveAttribute("src", expect.stringContaining("asics-sky-elite-ff-3.webp"))
    expect(within(dock).getByText("1/5")).toBeInTheDocument()

    await user.click(within(dock).getByRole("button", { name: "Следующее фото товара" }))

    heroImage = within(dock).getByRole("img", {
      name: /ASICS SKY ELITE FF 3/,
    })
    expect(heroImage).toHaveAttribute(
      "src",
      expect.stringContaining("asics-sky-elite-ff-3-2.webp"),
    )
    expect(within(dock).getByText("2/5")).toBeInTheDocument()

    await user.click(within(dock).getByRole("button", { name: "Предыдущее фото товара" }))

    heroImage = within(dock).getByRole("img", {
      name: /ASICS SKY ELITE FF 3/,
    })
    expect(heroImage).toHaveAttribute("src", expect.stringContaining("asics-sky-elite-ff-3.webp"))
    expect(within(dock).getAllByRole("button", { name: /Показать фото/ })).toHaveLength(10)
  })

  it("surfaces task-based matches from a plain-language need", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Опишите задачу для подбора по задаче" }),
      "пара для зала и мягкое приземление",
    )

    const finder = screen.getByLabelText("Подбор по задаче")
    expect(finder).toHaveTextContent(
      "подходит под зал",
    )
    expect(
      within(finder).getByRole("button", { name: /ASICS UPCOURT 6/ }),
    ).toBeInTheDocument()
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
    expect(screen.getByText(/Итоговая цена фиксируется перед оплатой/)).toBeInTheDocument()
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

  it("browser Back closes a pushed product URL without losing filters", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      within(screen.getByRole("group", { name: "Сценарии" })).getByRole(
        "button",
        { name: /Защитная работа/ },
      ),
    )
    await user.type(screen.getByRole("searchbox", { name: "Поиск по товарам" }), "nike")
    await user.click(
      screen.getByRole("button", { name: /Открыть карточку: Nike G.T. Cut Academy/ }),
    )

    expect(window.location.search).toBe("?category=basketball&q=nike&product=nike-gt-cut-academy")

    window.history.back()

    await waitFor(() => {
      expect(screen.queryByTestId("order-dock")).not.toBeInTheDocument()
    })
    expect(screen.getByRole("searchbox", { name: "Поиск по товарам" })).toHaveValue(
      "nike",
    )
    expect(productButtons()).toHaveLength(7)
    expect(window.location.search).toBe("?category=basketball&q=nike")
  })

  it("shows a visible manual fallback when copying fails", async () => {
    const user = userEvent.setup()
    vi.spyOn(orderRequest, "copyOrderRequest").mockResolvedValueOnce(false)
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      screen.getByRole("button", {
        name: /Открыть карточку: ASICS SKY ELITE FF 3/,
      }),
    )
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
        status: "manual_review",
        payment_url: null,
        message: "Заказ создан в CRM.",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      screen.getByRole("button", { name: /Открыть карточку: Nike G.T. Cut Academy/ }),
    )
    await user.click(screen.getByRole("button", { name: "44" }))
    await user.click(screen.getByRole("button", { name: "Добавить в корзину" }))

    const cart = screen.getByRole("dialog", { name: "Корзина" })
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
    await user.click(within(cart).getByRole("button", { name: "Оформить и перейти к оплате" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/checkout/orders",
        expect.objectContaining({ method: "POST" }),
      )
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.customer.full_name).toBe("Павел Шустров")
    expect(body.items[0]).toMatchObject({
      product_slug: "nike-gt-cut-academy",
      size_eu: "44",
      quantity: 1,
    })
    expect(within(cart).getByText("Заказ создан в CRM.")).toBeInTheDocument()
  })
})
