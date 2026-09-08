import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { publicCatalogProducts } from "../catalog/catalog"
import { LandingPage } from "./landing-page"
import { CATALOG_PAGE_SIZE } from "./sections/catalog-section"

function completeCatalogPayload() {
  const originals = publicCatalogProducts.slice(0, 29)
  const additions = Array.from({ length: 180 }, (_, index) => ({
    slug: `count-review-model-${index}`,
    brand: "Nike",
    name: `Count review model ${index}`,
    article: `COUNT-REVIEW-${index}`,
    kind: "footwear",
    category: "basketball",
    source: "poizon",
    product_ref: (index + 1).toString(16).padStart(64, "0"),
    images: [`https://cdn.poizon.com/count-review-${index}.jpg`],
  }))
  return {
    version: "catalog-count-presentation-v1",
    catalog_mode: "curated_live_poizon",
    snapshot_hours: 12,
    catalog_count: 209,
    // Catalogue membership is independent of current prices and checkout permission.
    items: [],
    order_creation_enabled: false,
    online_payment_enabled: false,
    catalog_products: additions,
    catalog_statuses: Object.fromEntries([...originals, ...additions].map((product) => [product.slug, {
      status: "unverified", source: "poizon", checked_at: null, expires_at: null,
    }])),
  }
}

function counter() {
  const paragraph = document.querySelector<HTMLParagraphElement>(".catalog-status p")
  expect(paragraph).not.toBeNull()
  return paragraph!
}

function cardLinks() {
  return screen.getAllByRole("link", { name: /^Открыть товар:/ })
    .filter((link) => link.classList.contains("product-card__link"))
}

function showCatalog() {
  window.history.replaceState(null, "", "/catalog")
  return render(<LandingPage configuredBotUsername={null} />)
}

function expectPendingCounter() {
  expect(counter()).toHaveTextContent(/^Загружаем каталог…$/)
  expect(counter()).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByText(/^100 товаров/)).not.toBeInTheDocument()
  expect(screen.queryByText(/^Осталось \d+/)).not.toBeInTheDocument()
  expect(screen.queryByText("Показан весь каталог")).not.toBeInTheDocument()
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("catalogue count before its first API response", () => {
  it("uses a busy loading counter while bundled cards and their pagination remain usable", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
    showCatalog()

    expectPendingCounter()
    expect(cardLinks()).toHaveLength(CATALOG_PAGE_SIZE)
    expect(screen.getByRole("button", { name: `Показать ещё ${CATALOG_PAGE_SIZE}` })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: `Показать ещё ${CATALOG_PAGE_SIZE}` }))
    expect(cardLinks()).toHaveLength(CATALOG_PAGE_SIZE * 2)
    expectPendingCounter()

    while (cardLinks().length < publicCatalogProducts.length) {
      await user.click(screen.getByRole("button", { name: /^Показать ещё / }))
    }
    expect(cardLinks()).toHaveLength(publicCatalogProducts.length)
    expect(screen.queryByRole("button", { name: /^Показать ещё / })).not.toBeInTheDocument()
    expectPendingCounter()
  })

  it("replaces the loading label with the validated complete 209-product count", async () => {
    let finishResponse!: (value: unknown) => void
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { finishResponse = resolve })))
    showCatalog()
    expectPendingCounter()

    await act(async () => finishResponse({ ok: true, json: async () => completeCatalogPayload() }))
    await waitFor(() => expect(counter()).toHaveTextContent(/^209 товаров, показано 24$/))
    expect(counter()).toHaveAttribute("aria-busy", "false")
    expect(cardLinks()).toHaveLength(CATALOG_PAGE_SIZE)
    expect(screen.getByText("Осталось 185")).toBeInTheDocument()
    expect(screen.getByText("Оформление заказов временно недоступно.")).toBeInTheDocument()
  })

  it("settles a rejected first request to the 100-product fallback with the existing failure notice", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    showCatalog()
    expectPendingCounter()

    await waitFor(() => expect(counter()).toHaveTextContent(/^100 товаров, показано 24$/))
    expect(counter()).toHaveAttribute("aria-busy", "false")
    expect(screen.getByRole("alert")).toHaveTextContent("Подтверждённые цены и оформление временно недоступны.")
    expect(cardLinks()).toHaveLength(CATALOG_PAGE_SIZE)
    expect(within(cardLinks()[0]).getByText("Цена уточняется")).toBeInTheDocument()
    expect(screen.getByText("Осталось 76")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: `Показать ещё ${CATALOG_PAGE_SIZE}` })).toBeEnabled()
  })

  it("settles an incomplete ready roster to the existing fallback instead of reporting its unvalidated declared count", async () => {
    const incomplete = completeCatalogPayload()
    incomplete.catalog_products.pop()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => incomplete }))
    showCatalog()
    expectPendingCounter()

    await waitFor(() => expect(counter()).toHaveTextContent(/^100 товаров, показано 24$/))
    expect(counter()).toHaveAttribute("aria-busy", "false")
    expect(screen.queryByText(/^209 товаров/)).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText("Оформление заказов временно недоступно.")).toBeInTheDocument()
    expect(cardLinks()).toHaveLength(CATALOG_PAGE_SIZE)
    expect(within(cardLinks()[0]).getByText("Цена уточняется")).toBeInTheDocument()
    expect(screen.getByText("Осталось 76")).toBeInTheDocument()
  })
})
