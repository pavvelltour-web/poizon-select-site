import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import * as orderRequest from "./order-request"
import { LandingPage } from "./landing-page"

function productButtons() {
  return screen.getAllByRole("button", { name: /Открыть карточку:/ })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, "", "/")
})

describe("LandingPage", () => {
  it("renders all items with a visible price floor", () => {
    render(<LandingPage configuredBotUsername={null} />)

    expect(screen.getByRole("heading", { name: "KICKSBASE" })).toBeInTheDocument()
    expect(productButtons()).toHaveLength(100)
    expect(screen.queryByText("по запросу")).toBeNull()
    expect(screen.getAllByText("Цена от")).toHaveLength(100)
    expect(screen.getAllByText("от 22 100 ₽").length).toBeGreaterThan(0)
    expect(screen.getAllByText("от 45 тыс. ₽").length).toBeGreaterThan(0)
    expect(screen.getAllByText("от 4 тыс. ₽").length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Перед оплатой всё должно быть понятно/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Бирки и упаковка/),
    ).toBeInTheDocument()
  })

  it("filters, sorts and resets the catalog deterministically", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      within(screen.getByRole("group", { name: "Категории" })).getByRole(
        "button",
        { name: /Волейбол/ },
      ),
    )
    expect(productButtons()).toHaveLength(23)
    expect(screen.getByText("Пары и экипировка под волейбольный зал")).toBeInTheDocument()
    expect(window.location.search).toBe("?category=volleyball")

    await user.type(screen.getByRole("searchbox", { name: "Поиск по каталогу" }), "nike")
    expect(productButtons()).toHaveLength(3)
    expect(window.location.search).toBe("?category=volleyball&q=nike")

    await user.selectOptions(screen.getByRole("combobox", { name: "Сортировка" }), [
      "price-desc",
    ])
    expect(productButtons()[0]).toHaveAccessibleName(/Nike ZOOM HYPERSET 2/)
    expect(window.location.search).toBe(
      "?category=volleyball&q=nike&sort=price-desc",
    )

    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }))
    expect(productButtons()).toHaveLength(100)
    expect(window.location.search).toBe("")
  })

  it("recovers from an empty search result", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(
      screen.getByRole("searchbox", { name: "Поиск по каталогу" }),
      "definitely-not-a-product",
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ничего не нашли по этому запросу.",
    )

    await user.click(screen.getByRole("button", { name: /Показать всю подборку/ }))
    expect(productButtons()).toHaveLength(100)
  })

  it("opens a stable product deep link and keeps the bot request clean", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск по каталогу" }), "Ronaldinho")
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
      "прыжок и мягкое приземление",
    )

    const finder = screen.getByLabelText("Подбор по задаче")
    expect(finder).toHaveTextContent(
      "прыжок и сцепление",
    )
    expect(
      within(finder).getByRole("button", { name: /ASICS SKY ELITE FF 3/ }),
    ).toBeInTheDocument()
  })

  it("renders a fresh CRM Poizon quote without substituting the static catalog", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ready",
        results: [
          {
            provider_source: "poizon_batch_sync_api",
            provider_product_id: "af1-white",
            brand: "Nike",
            name: "Air Force 1 '07 White",
            article: "DD8959-100",
            kind: "footwear",
            yuan_rate: 11.3,
            offers: [
              {
                sku_id: "af1-42",
                size: "42",
                currency: "CNY",
                price_cny: 760,
                quote_rub: 11473.46,
                rf_delivery: 1000,
                total_rub: 12473.46,
                price_breakdown: {
                  purchase_rub: 8588,
                  conversion_fee: 343.52,
                  first_six_percent_fee: 535.89,
                  service_markup: 1300,
                  final_six_percent_fee: 706.04,
                  delivery_rub: 1000,
                  total_rub: 12473.46,
                  markup_tier: "popular_pair",
                },
              },
            ],
          },
        ],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск в Poizon" }), "Nike Air Force 1")
    await user.click(screen.getByRole("button", { name: "Найти в Poizon" }))

    await waitFor(() => {
      expect(screen.getByLabelText("Результаты живого поиска Poizon")).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/catalog/search",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        body: JSON.stringify({ query: "Nike Air Force 1", limit: 4 }),
      }),
    )
    expect(screen.getByText("Цена Poizon сейчас")).toBeInTheDocument()
    expect(screen.getByText(/12\s?473\s?₽/)).toBeInTheDocument()
    expect(screen.getByText("Конвертация 4%")).toBeInTheDocument()
    expect(screen.getByText("Финальная комиссия 6%")).toBeInTheDocument()
  })

  it("makes unavailability explicit instead of using a static price", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "unavailable",
          results: [],
          clarification: "Живой каталог Poizon временно недоступен.",
        }),
      }),
    )
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск в Poizon" }), "Nike Air Force 1")
    await user.click(screen.getByRole("button", { name: "Найти в Poizon" }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Живой каталог Poizon временно недоступен.",
    )
    expect(screen.queryByLabelText("Результаты живого поиска Poizon")).toBeNull()
  })

  it("hydrates a product dialog from a URL and browser back restores catalog context", async () => {
    const user = userEvent.setup()
    window.history.replaceState(
      null,
      "",
      "/?category=basketball&q=nike&sort=price-asc&product=nike-gt-cut-academy",
    )

    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    expect(screen.getByRole("searchbox", { name: "Поиск по каталогу" })).toHaveValue(
      "nike",
    )
    expect(screen.getByRole("combobox", { name: "Сортировка" })).toHaveValue(
      "price-asc",
    )
    expect(screen.getByTestId("order-dock")).toBeInTheDocument()
    expect(screen.getByLabelText("Расчет заказа")).toBeInTheDocument()
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
      within(screen.getByRole("group", { name: "Категории" })).getByRole(
        "button",
        { name: /Баскетбол/ },
      ),
    )
    await user.type(screen.getByRole("searchbox", { name: "Поиск по каталогу" }), "nike")
    await user.click(
      screen.getByRole("button", { name: /Открыть карточку: Nike G.T. Cut Academy/ }),
    )

    expect(window.location.search).toBe("?category=basketball&q=nike&product=nike-gt-cut-academy")

    window.history.back()

    await waitFor(() => {
      expect(screen.queryByTestId("order-dock")).not.toBeInTheDocument()
    })
    expect(screen.getByRole("searchbox", { name: "Поиск по каталогу" })).toHaveValue(
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
})
