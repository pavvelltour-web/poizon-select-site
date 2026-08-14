import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { catalogProducts } from "../catalog/catalog"
import * as orderRequest from "./order-request"
import { LandingPage } from "./landing-page"

function productButtons() {
  return screen.getAllByRole("button", { name: /Открыть карточку:/ })
}

function verifiedSizeOffer(
  size: string,
  priceRub: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    sku_id: `sku-${size}`,
    size_eu: size,
    price_rub: priceRub,
    available: true,
    checkout_confirmed: true,
    live_provider_verified: true,
    ...overrides,
  }
}

function publicLiveOffer(overrides: Record<string, unknown> = {}) {
  return {
    offer_ref: "a".repeat(24),
    size: "42",
    eu: "42",
    ru: "41",
    us: "8.5",
    cn: "265",
    available: true,
    price_cny: 760,
    quote_rub: 16_700,
    rf_delivery: 1_000,
    total_rub: 17_700,
    price_breakdown: {
      purchase_rub: 8_588,
      conversion_fee: 343.52,
      first_six_percent_fee: 535.89,
      service_markup: 1_300,
      final_six_percent_fee: 706.04,
      delivery_rub: 1_000,
      total_rub: 17_700,
      markup_tier: "popular_pair",
    },
    ...overrides,
  }
}

function publicLiveProduct(overrides: Record<string, unknown> = {}) {
  const observedAt = new Date(Date.now() - 60_000).toISOString()
  const expiresAt = new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString()
  return {
    product_ref: "b".repeat(24),
    brand: "Nike",
    name: "Air Force 1 '07 White",
    article: "DD8959-100",
    color: "Белый",
    kind: "footwear",
    description: "Белые кроссовки из натуральной кожи.",
    images: ["https://cdn.poizon.com/products/air-force-1.webp"],
    in_stock: true,
    size_context: "Размеры указаны поставщиком.",
    size_chart: null,
    size_image: null,
    offers: [publicLiveOffer()],
    observed_at: observedAt,
    expires_at: expiresAt,
    ...overrides,
  }
}

function readyLiveSearch(results: unknown[]) {
  return {
    status: "ready",
    normalized_query: "Nike Air Force 1",
    clarification: null,
    clarification_options: [],
    results,
    fallback: [],
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, "", "/")
})

describe("LandingPage", () => {
  it("renders all catalogue items without substituting editorial prices", () => {
    render(<LandingPage configuredBotUsername={null} />)

    expect(screen.getByRole("heading", { name: "KICKSBASE" })).toBeInTheDocument()
    expect(productButtons()).toHaveLength(100)
    expect(screen.getAllByText("По запросу").length).toBeGreaterThanOrEqual(200)
    expect(screen.getAllByText("Цена")).toHaveLength(100)
    expect(screen.queryByText("от 22 100 ₽")).toBeNull()
    expect(screen.queryByText("от 45 тыс. ₽")).toBeNull()
    expect(screen.queryByText("от 4 тыс. ₽")).toBeNull()
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

    await user.selectOptions(screen.getByRole("combobox", { name: "Сортировка" }), ["price-desc"])
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

  it("renders a fresh external quote without substituting the static catalog", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => readyLiveSearch([
        publicLiveProduct({
          offers: [
            publicLiveOffer(),
            publicLiveOffer({
              offer_ref: "c".repeat(24),
              size: "43",
              eu: "43",
              ru: "42",
              us: "9",
              cn: "270",
              available: null,
              price_cny: 800,
              quote_rub: 17_300,
              total_rub: 18_300,
              price_breakdown: {
                ...publicLiveOffer().price_breakdown,
                purchase_rub: 9_040,
                total_rub: 18_300,
              },
            }),
          ],
        }),
      ]),
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск товара" }), "Nike Air Force 1")
    await user.click(screen.getByRole("button", { name: "Найти товар" }))

    await waitFor(() => {
      expect(screen.getByLabelText("Результаты поиска")).toBeInTheDocument()
    })
    const results = screen.getByLabelText("Результаты поиска")
    expect(within(results).getAllByRole("article")).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/catalog/search",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        body: JSON.stringify({ query: "Nike Air Force 1", limit: 4 }),
      }),
    )
    expect(screen.getByRole("img", { name: "Nike Air Force 1 '07 White" })).toHaveAttribute(
      "src",
      "https://cdn.poizon.com/products/air-force-1.webp",
    )
    expect(screen.getByText("Белые кроссовки из натуральной кожи.")).toBeInTheDocument()
    expect(screen.getByText("Цена проверена сейчас")).toBeInTheDocument()
    expect(screen.getByText(/Выбранный размер: RU 41 · EU 42 · US 8\.5 · CN 265 · ¥760/)).toBeInTheDocument()
    expect(screen.getByText(/17\s?700\s?₽/)).toBeInTheDocument()
    expect(screen.getByText("Конвертация 4%")).toBeInTheDocument()
    expect(screen.getByText("Финальная комиссия 6%")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /RU 42 · EU 43 · US 9 · CN 270/ }))

    expect(screen.getByText(/Выбранный размер: RU 42 · EU 43 · US 9 · CN 270 · ¥800/)).toBeInTheDocument()
    expect(screen.getByText(/18\s?300\s?₽/)).toBeInTheDocument()
  }, 10_000)

  it("makes unavailability explicit instead of using a static price", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "unavailable",
          results: [],
          clarification: "Поставщик временно недоступен.",
        }),
      }),
    )
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск товара" }), "Nike Air Force 1")
    await user.click(screen.getByRole("button", { name: "Найти товар" }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Сейчас не удалось получить актуальную цену. Каталог не подменяет цену или наличие.",
    )
    expect(screen.queryByLabelText("Результаты поиска")).toBeNull()
  })

  it("fails closed when a public search response has unsafe references, quotes, or media", async () => {
    const user = userEvent.setup()
    const invalidProducts = [
      publicLiveProduct({ product_ref: "not-a-public-reference" }),
      publicLiveProduct({ offers: [publicLiveOffer({ offer_ref: "not-a-public-reference" })] }),
      publicLiveProduct({ observed_at: "not-a-timestamp" }),
      publicLiveProduct({ images: ["https://cdn.example.invalid/product.webp"] }),
      publicLiveProduct({ description: "中文描述不应进入公开页面" }),
      publicLiveProduct({ description: "Пойзон подтверждает описание товара." }),
      publicLiveProduct({ in_stock: "true" }),
      publicLiveProduct({ offers: [publicLiveOffer({ eu: null })] }),
    ]
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => readyLiveSearch(invalidProducts),
      }),
    )
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск товара" }), "Nike Air Force 1")
    await user.click(screen.getByRole("button", { name: "Найти товар" }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Сейчас не удалось получить актуальную цену. Каталог не подменяет цену или наличие.",
    )
    expect(screen.queryByLabelText("Результаты поиска")).toBeNull()
  }, 10_000)

  it("re-queries a broad model clarification and keeps four products as four cards", async () => {
    const user = userEvent.setup()
    const fourProducts = ["a", "b", "c", "d"].map((character, index) =>
      publicLiveProduct({
        product_ref: character.repeat(24),
        name: `Air Max 95 colour ${index + 1}`,
        offers: [
          publicLiveOffer({
            offer_ref: `${character}${index}`.repeat(12),
            size: `${42 + index}`,
            eu: `${42 + index}`,
          }),
        ],
      }),
    )
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      const body = options?.body ? JSON.parse(String(options.body)) as { query?: string } : null
      if (body?.query === "найк аир макс") {
        return {
          ok: true,
          json: async () => ({
            status: "clarification",
            normalized_query: "Nike Air Max",
            clarification: "Пойзон: какая версия Air Max нужна?",
            clarification_options: [
              { label: "Пойзон Air Max 95", query: "Nike Air Max 95" },
              { label: "Air Max 95", query: "Nike Air Max 95" },
              { label: "Air Max Plus", query: "Nike Air Max Plus" },
            ],
            results: [],
            fallback: [],
          }),
        }
      }
      return { ok: true, json: async () => readyLiveSearch(fourProducts) }
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<LandingPage configuredBotUsername={null} />)

    await user.type(screen.getByRole("searchbox", { name: "Поиск товара" }), "найк аир макс")
    await user.click(screen.getByRole("button", { name: "Найти товар" }))

    expect(await screen.findByText("Уточните модель или артикул.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Air Max 95" })).toBeInTheDocument()
    expect(screen.queryByText(/poizon|poison|пойзон|поизон|пойсон/i)).toBeNull()

    await user.click(screen.getByRole("button", { name: "Air Max 95" }))

    const results = await screen.findByLabelText("Результаты поиска")
    expect(within(results).getAllByRole("article")).toHaveLength(4)
    const searchCalls = fetchMock.mock.calls.filter(
      ([url, options]) => String(url).endsWith("/api/catalog/search") && options?.method === "POST",
    )
    expect(searchCalls).toHaveLength(2)
    expect(JSON.parse(String(searchCalls[1][1]?.body))).toEqual({
      query: "Nike Air Max 95",
      limit: 4,
    })
  }, 10_000)

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
    expect(screen.queryByLabelText("Расчет заказа")).toBeNull()
    expect(within(screen.getByTestId("order-dock")).getAllByText("По запросу").length).toBeGreaterThan(0)
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

  it("shows a verified price only until its CRM snapshot expires, then refreshes fail-closed", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-14T09:00:00.000Z"))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          catalog_mode: "curated_live_poizon",
          snapshot_hours: 12,
          items: [
            {
              slug: "asics-sky-elite-ff-3",
              price_rub: 15_900,
              live_provider_verified: true,
              observed_at: "2026-08-14T08:00:00.000Z",
              expires_at: "2026-08-14T09:00:01.000Z",
              size_offers: [verifiedSizeOffer("42", 15_900)],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          catalog_mode: "curated_live_poizon",
          snapshot_hours: 12,
          items: [],
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    render(<LandingPage configuredBotUsername={null} />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getAllByText("от 15 900 ₽").length).toBeGreaterThan(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_001)
    })
    expect(screen.queryByText("от 15 900 ₽")).toBeNull()
    expect(screen.getAllByText("По запросу")).not.toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("overlays exactly the 19 verified CRM catalogue prices and leaves the rest by request", async () => {
    const observedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const verifiedProducts = catalogProducts.slice(0, 19)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          catalog_mode: "curated_live_poizon",
          snapshot_hours: 12,
          items: [
            ...verifiedProducts.map((product) => ({
              slug: product.slug,
              price_rub: 12_345,
              live_provider_verified: true,
              observed_at: observedAt,
              expires_at: expiresAt,
              size_offers: [verifiedSizeOffer("42", 12_345)],
            })),
            {
              slug: "not-in-the-storefront",
              price_rub: 12_345,
              live_provider_verified: true,
              observed_at: observedAt,
              expires_at: expiresAt,
              size_offers: [verifiedSizeOffer("42", 12_345)],
            },
          ],
        }),
      }),
    )
    render(<LandingPage configuredBotUsername={null} />)

    await waitFor(() => {
      expect(screen.getAllByText("от 12 345 ₽").length).toBeGreaterThanOrEqual(19)
    })
    const cards = productButtons()
    expect(cards).toHaveLength(100)
    for (const card of cards.slice(0, 19)) {
      expect(within(card).getAllByText("от 12 345 ₽").length).toBeGreaterThan(0)
    }
    expect(
      cards.slice(19).filter((card) => within(card).queryAllByText("По запросу").length > 0)
        .length,
    ).toBe(81)
  })

  it("uses the exact verified size offer in the product sheet, never another size", async () => {
    const user = userEvent.setup()
    const observedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          catalog_mode: "curated_live_poizon",
          snapshot_hours: 12,
          items: [
            {
              slug: "asics-sky-elite-ff-3",
              price_rub: 15_900,
              live_provider_verified: true,
              observed_at: observedAt,
              expires_at: expiresAt,
              size_offers: [
                verifiedSizeOffer("42", 15_900),
                verifiedSizeOffer("42.5", 16_700),
                verifiedSizeOffer("43", 14_000, { available: false }),
              ],
            },
          ],
        }),
      }),
    )
    render(<LandingPage configuredBotUsername={null} />)

    await waitFor(() => {
      expect(screen.getAllByText("от 15 900 ₽").length).toBeGreaterThan(0)
    })
    await user.click(
      screen.getByRole("button", { name: /Открыть карточку: ASICS SKY ELITE FF 3/ }),
    )
    const dock = screen.getByTestId("order-dock")
    expect(within(dock).getByRole("button", { name: "42" })).toBeInTheDocument()
    expect(within(dock).getByRole("button", { name: "42.5" })).toBeInTheDocument()
    expect(within(dock).queryByRole("button", { name: "43" })).toBeNull()

    await user.click(within(dock).getByRole("button", { name: "42.5" }))
    expect(within(dock).getAllByText("16 700 ₽").length).toBeGreaterThan(0)
    expect(within(dock).getAllByText("Цена размера").length).toBeGreaterThan(0)
  })

  it("keeps generic size selection by request when the exact slug has no verified offer", async () => {
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername={null} />)

    await user.click(
      screen.getByRole("button", { name: /Открыть карточку: ASICS SKY ELITE FF 3/ }),
    )
    const dock = screen.getByTestId("order-dock")
    await user.click(within(dock).getByRole("button", { name: "42" }))

    expect(within(dock).getAllByText("По запросу").length).toBeGreaterThan(0)
    expect(within(dock).queryByText("от 15 900 ₽")).toBeNull()
  })
})
