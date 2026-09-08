import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { parseCheckoutCatalog } from "./cart"
import { LandingPage } from "./landing-page"

const originalSlug = "nike-kd-18"
const alternateSlug = "nike-kd-18-red-blue-exact-spu"
const originalRef = "a".repeat(64)
const alternateRef = "b".repeat(64)
const alternateImage = "https://cdn.poizon.com/reviewed-kd18-red-blue.jpg"
const sizePrices = [
  ["39", 21_300, "21 300 ₽"],
  ["40", 21_900, "21 900 ₽"],
  ["41", 22_100, "22 100 ₽"],
  ["42", 23_300, "23 300 ₽"],
  ["43", 24_900, "24 900 ₽"],
  ["44", 25_500, "25 500 ₽"],
  ["45", 26_700, "26 700 ₽"],
] as const

function selectionCatalogPayload(checkoutConfirmed = true) {
  const observedAt = new Date(Date.now() - 60_000).toISOString()
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString()
  const variants = [
    { slug: originalSlug, product_ref: originalRef, color_label: "Белый / чёрный" },
    { slug: alternateSlug, product_ref: alternateRef, color_label: "Красный / синий" },
  ]
  const sizeOffer = (slug: string, size: string, amount: number, confirmed: boolean) => ({
    sku_id: `${slug}-${size}`,
    size_eu: size,
    size_ru: String(Number(size) - 1),
    price_rub: amount,
    price_cny: 900,
    price_status: "current",
    source_updated_at: observedAt,
    source_expires_at: expiresAt,
    available: true,
    checkout_confirmed: confirmed,
    live_provider_verified: true,
  })
  const item = (slug: string, name: string, confirmed: boolean, offers: ReturnType<typeof sizeOffer>[]) => ({
    slug,
    name,
    brand: "Nike",
    product_kind: "footwear",
    sizes: offers.map((offer) => offer.size_eu),
    price_rub: Math.min(...offers.map((offer) => offer.price_rub)),
    price_status: "current",
    fulfillment_mode: "made_to_order",
    availability: "supplier_verified",
    eta_min_days: 10,
    eta_max_days: 18,
    live_provider_verified: true,
    display_price_verified: true,
    checkout_ready: confirmed,
    observed_at: observedAt,
    expires_at: expiresAt,
    size_offers: offers,
  })
  return {
    version: "catalog-selection-review-v1",
    catalog_mode: "curated_live_poizon",
    snapshot_hours: 12,
    catalog_count: 2,
    order_creation_enabled: true,
    online_payment_enabled: false,
    items: [
      item(originalSlug, "KD 18", checkoutConfirmed, sizePrices.map(([size, price]) =>
        sizeOffer(originalSlug, size, price, checkoutConfirmed))),
      item(alternateSlug, "KD 18 Red Blue", true, [
        sizeOffer(alternateSlug, "40", 31_100, true),
        sizeOffer(alternateSlug, "42", 33_900, true),
      ]),
    ],
    catalog_products: [{
      slug: alternateSlug,
      brand: "Nike",
      name: "KD 18 Red Blue",
      article: "REVIEWED-ALTERNATE-SPU",
      kind: "footwear",
      category: "basketball",
      images: [alternateImage],
      source: "poizon",
      product_ref: alternateRef,
    }],
    catalog_statuses: Object.fromEntries(variants.map((variant) => [variant.slug, {
      status: "in_stock", source: "poizon", checked_at: observedAt, expires_at: expiresAt,
    }])),
    catalog_colorways: Object.fromEntries(variants.map((variant) => [variant.slug, {
      family_id: "reviewed-kd18-family-v1",
      model_name: "Nike KD 18",
      color_label: variant.color_label,
      product_ref: variant.product_ref,
      variants,
    }])),
  }
}

function showCatalog(payload: ReturnType<typeof selectionCatalogPayload>, path = "/catalog") {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload })
  vi.stubGlobal("fetch", fetchMock)
  window.history.replaceState(null, "", path)
  render(<LandingPage configuredBotUsername={null} />)
  return fetchMock
}

async function loadedOriginalCard() {
  await waitFor(() => expect(screen.getAllByRole("link", { name: /^Открыть товар:/ })).toHaveLength(2))
  const link = screen.getByRole("link", { name: /^Открыть товар: Nike KD 18\. Цена/ })
  const card = link.closest("article")!
  expect(card).toBeInTheDocument()
  return { link, card }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("catalogue colour and exact size selection", () => {
  it("shows reciprocal exact colour links on both cards and the product sheet, with every current size price", async () => {
    const user = userEvent.setup()
    showCatalog(selectionCatalogPayload())
    const { link, card } = await loadedOriginalCard()
    const colours = within(card).getByRole("navigation", { name: "Цвета Nike KD 18" })
    expect(within(colours).getByRole("link", { name: "Цвет: Белый / чёрный" }))
      .toHaveAttribute("href", `/product/${originalSlug}`)
    expect(within(colours).getByRole("link", { name: "Цвет: Белый / чёрный" }))
      .toHaveAttribute("aria-current", "page")
    expect(within(colours).getByRole("link", { name: "Цвет: Красный / синий" }))
      .toHaveAttribute("href", `/product/${alternateSlug}`)
    expect(within(colours).getByRole("link", { name: "Цвет: Красный / синий" }))
      .not.toHaveAttribute("aria-current")
    const alternateCard = screen.getByRole("link", { name: /^Открыть товар: Nike KD 18 Red Blue\. Цена/ }).closest("article")!
    expect(within(alternateCard).getByRole("link", { name: "Цвет: Красный / синий" }))
      .toHaveAttribute("aria-current", "page")
    expect(within(card).getAllByRole("link", { name: /^Размер \d/ })).toHaveLength(sizePrices.length)
    for (const [size, , price] of sizePrices) {
      const sizeLink = within(card).getByRole("link", { name: `Размер ${size}, ${price}` })
      expect(sizeLink).toHaveAttribute("href", `/product/${originalSlug}`)
      expect(sizeLink).toHaveTextContent(price)
    }

    await user.click(link)
    const dialog = await screen.findByRole("dialog", { name: /Nike KD 18$/ })
    const sheetColours = within(dialog).getByRole("navigation", { name: "Цвета Nike KD 18" })
    expect(within(sheetColours).getByRole("link", { name: "Цвет: Белый / чёрный" }))
      .toHaveAttribute("aria-current", "page")
    expect(within(sheetColours).getByRole("link", { name: "Цвет: Красный / синий" }))
      .toHaveAttribute("href", `/product/${alternateSlug}`)
    for (const [size, , price] of sizePrices) {
      const sizeButton = within(dialog).getByRole("button", { name: `${Number(size) - 1} RU, ${size} EU, ${price}, в наличии` })
      expect(sizeButton).toBeEnabled()
      expect(sizeButton).toHaveTextContent(price)
    }
  })

  it("resolves the alternate full product URL to its own gallery, current colour and exact prices", async () => {
    showCatalog(selectionCatalogPayload(), `/product/${alternateSlug}`)
    const dialog = await screen.findByRole("dialog", { name: /Nike KD 18 Red Blue$/ })
    expect(within(dialog).getByRole("heading", { name: /Nike KD 18 Red Blue$/ })).toBeInTheDocument()
    expect(within(dialog).getByRole("img", { name: "Nike KD 18 Red Blue, фото 1" }))
      .toHaveAttribute("src", alternateImage)
    const colours = within(dialog).getByRole("navigation", { name: "Цвета Nike KD 18 Red Blue" })
    expect(within(colours).getByRole("link", { name: "Цвет: Красный / синий" }))
      .toHaveAttribute("aria-current", "page")
    expect(within(colours).getByRole("link", { name: "Цвет: Белый / чёрный" }))
      .toHaveAttribute("href", `/product/${originalSlug}`)
    expect(within(dialog).getByRole("button", { name: "39 RU, 40 EU, 31 100 ₽, в наличии" })).toBeEnabled()
    expect(within(dialog).getByRole("button", { name: "41 RU, 42 EU, 33 900 ₽, в наличии" })).toBeEnabled()
    expect(within(dialog).queryByRole("button", { name: /21 300 ₽/ })).not.toBeInTheDocument()
  })

  it.each(["expired", "unknown"])("hides the colour group on cards and the sheet when sibling availability is %s", async (state) => {
    const user = userEvent.setup()
    const payload = selectionCatalogPayload()
    if (state === "expired") payload.catalog_statuses[alternateSlug].expires_at = new Date(Date.now() - 1).toISOString()
    else payload.catalog_statuses[alternateSlug].status = "stock_unknown"
    showCatalog(payload)
    const { link, card } = await loadedOriginalCard()
    expect(within(card).queryByRole("navigation", { name: /^Цвета / })).not.toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: /^Цвета / })).not.toBeInTheDocument()
    await user.click(link)
    const dialog = await screen.findByRole("dialog", { name: /Nike KD 18$/ })
    expect(within(dialog).queryByRole("navigation", { name: /^Цвета / })).not.toBeInTheDocument()
  })

  it("does not create colour links from similar product names without the reviewed reciprocal mapping", async () => {
    const payload = selectionCatalogPayload()
    payload.catalog_colorways = {}
    showCatalog(payload)
    await loadedOriginalCard()
    expect(screen.queryByRole("navigation", { name: /^Цвета / })).not.toBeInTheDocument()
  })

  it("hides historical amounts and dates on cards and the sheet while keeping size and purchase actions disabled", async () => {
    const user = userEvent.setup()
    const payload = selectionCatalogPayload()
    payload.items[0].price_status = "historical"
    payload.items[0].size_offers.forEach((offer) => {
      offer.price_status = "historical"
      offer.source_updated_at = "2020-01-01T00:00:00Z"
      offer.source_expires_at = "2020-01-02T00:00:00Z"
    })
    showCatalog(payload)
    const { link, card } = await loadedOriginalCard()
    expect(within(card).getByText("Цена уточняется")).toBeInTheDocument()
    expect(within(card).queryByRole("link", { name: /^Размер \d/ })).not.toBeInTheDocument()
    await user.click(link)
    const dialog = await screen.findByRole("dialog", { name: /Nike KD 18$/ })
    for (const [size, , price] of sizePrices) {
      expect(within(card).queryByText(price, { exact: false })).not.toBeInTheDocument()
      expect(within(dialog).queryByText(price, { exact: false })).not.toBeInTheDocument()
      expect(within(dialog).getByRole("button", { name: `${Number(size) - 1} RU, ${size} EU, цена уточняется, наличие уточняется` }))
        .toBeDisabled()
    }
    expect(dialog).not.toHaveTextContent(/Последняя|историч|01\.01\.2020|2020-01-01/iu)
    expect(within(dialog).getByRole("button", { name: "Недоступно для заказа" })).toBeDisabled()
  })

  it("lets a current in-stock size be selected at its exact price without granting unconfirmed checkout", async () => {
    const user = userEvent.setup()
    const payload = selectionCatalogPayload(false)
    const parsed = parseCheckoutCatalog(payload)!
    expect(parsed.orderCreationEnabled).toBe(true)
    expect(parsed.items[originalSlug].checkoutReady).toBe(false)
    expect(parsed.items[originalSlug].sizeOffers.every((offer) => offer.available && !offer.checkoutConfirmed)).toBe(true)
    const fetchMock = showCatalog(payload)
    const { card } = await loadedOriginalCard()
    await user.click(within(card).getByRole("link", { name: "Размер 45, 26 700 ₽" }))
    const dialog = await screen.findByRole("dialog", { name: /Nike KD 18$/ })
    const preferredSize = within(dialog).getByRole("button", { name: "44 RU, 45 EU, 26 700 ₽, в наличии" })
    expect(preferredSize).toBeEnabled()
    await waitFor(() => expect(preferredSize).toHaveAttribute("aria-pressed", "true"))
    expect(within(dialog).queryByText("Актуальных предложений по размерам нет.")).not.toBeInTheDocument()
    expect(within(dialog).getByText("Оформление этого размера временно недоступно.")).toBeInTheDocument()
    const purchase = within(dialog).getByRole("button", { name: "Недоступно для заказа" })
    expect(purchase).toHaveAttribute("data-selected-size", "45")
    expect(purchase).toHaveAttribute("data-display-price", "26 700 ₽")
    expect(purchase).toBeDisabled()

    const anotherSize = within(dialog).getByRole("button", { name: "43 RU, 44 EU, 25 500 ₽, в наличии" })
    await user.click(anotherSize)
    expect(anotherSize).toHaveAttribute("aria-pressed", "true")
    expect(preferredSize).toHaveAttribute("aria-pressed", "false")
    expect(purchase).toHaveAttribute("data-selected-size", "44")
    expect(purchase).toHaveAttribute("data-display-price", "25 500 ₽")
    expect(purchase).toBeDisabled()
    await user.click(purchase)
    expect(JSON.parse(localStorage.getItem("kicksbase-cart-v1") ?? "[]")).toEqual([])
    expect(fetchMock.mock.calls.every(([url, options]) =>
      String(url).includes("mode=catalog") && options?.method !== "POST")).toBe(true)
  })
})
