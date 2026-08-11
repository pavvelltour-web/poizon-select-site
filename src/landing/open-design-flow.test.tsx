import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import adapterCss from "../open-design-react.css?raw"
import { LandingPage } from "./landing-page"

const approvedRoot = "/storefront-media/approved/products"

function checkoutCatalogPayload() {
  return {
    version: "2026-08-02-v3",
    personal_data_consent_version: "pd-2026-08",
    order_creation_enabled: true,
    online_payment_enabled: true,
    items: [
      {
        slug: "nike-kd-18",
        name: "KD 18",
        brand: "Nike",
        product_kind: "footwear",
        sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
        price_rub: 31400,
        image_url: `${approvedRoot}/nike-kd-18/01-side.png`,
        fulfillment_mode: "made_to_order",
        availability: "catalog_listed",
        eta_min_days: 10,
        eta_max_days: 18,
        live_provider_verified: true,
        size_offers: [
          {
            sku_id: "kd-18-40",
            size_eu: "40",
            size_ru: "39",
            price_rub: 31400,
            available: true,
            checkout_confirmed: true,
            live_provider_verified: true,
          },
          {
            sku_id: "kd-18-42",
            size_eu: "42",
            size_ru: "41",
            price_rub: 32900,
            available: true,
            checkout_confirmed: true,
            live_provider_verified: true,
          },
        ],
      },
    ],
  }
}

function liveKd18Payload() {
  return {
    status: "ready",
    normalized_query: "Nike KD 18 basketball volleyball",
    clarification: null,
    fallback: [],
    results: [{
      product_ref: "kd-18",
      brand: "Nike",
      name: "KD 18",
      article: "KD-18",
      kind: "footwear",
      description: null,
      images: ["https://cdn.poizon.example/kd-18.webp"],
      observed_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 14 * 60_000).toISOString(),
      offers: [
        {
          size: "40",
          quote_rub: 31400,
          rf_delivery: 1000,
          total_rub: 32400,
          price_breakdown: null,
        },
        {
          size: "42",
          quote_rub: 32900,
          rf_delivery: 1000,
          total_rub: 33900,
          price_breakdown: null,
        },
      ],
    }],
  }
}

function stubCheckoutCatalog() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    return {
      ok: true,
      json: async () => url.endsWith("/api/catalog/search")
        ? liveKd18Payload()
        : checkoutCatalogPayload(),
    }
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("approved Open Design product flow", () => {
  it("keeps the desktop gallery at the approved stable height without stretching", () => {
    expect(adapterCss).toMatch(
      /\.product-sheet \.sheet-media\s*\{[^}]*align-self:\s*start;[^}]*height:\s*min\(838px, calc\(100dvh - 24px\)\);/su,
    )
    expect(adapterCss).toMatch(
      /@media \(max-width: 920px\)[\s\S]*?\.product-sheet \.sheet-media\s*\{[^}]*align-self:\s*stretch;[^}]*height:\s*auto;/u,
    )
    expect(adapterCss).toMatch(
      /\.product-sheet \.size-price-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/u,
    )
    expect(adapterCss).toMatch(
      /\.product-sheet \.size-price-cell\[aria-pressed="true"\],[\s\S]*?\{[^}]*border-color:\s*#111;[^}]*background:\s*var\(--surface\);/u,
    )
    expect(adapterCss).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.product-sheet \.size-price-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/u,
    )
  })

  it("keeps the KD 18 card, selected size and five gallery frames in one product", async () => {
    stubCheckoutCatalog()
    const user = userEvent.setup()
    render(<LandingPage configuredBotUsername="@SelectBuyerBot" />)

    const card = document.querySelector<HTMLElement>('[data-od-id="product-card-nike-kd-18"]')
    expect(card).not.toBeNull()
    const preview = card?.querySelector<HTMLImageElement>(".product-card__image")
    expect(preview?.getAttribute("src")).toContain(`${approvedRoot}/nike-kd-18/01-side.png`)

    await waitFor(() => {
      expect(within(card!).getByRole("button", { name: "40" })).toBeEnabled()
    })
    const selectedSizeTrigger = within(card!).getByRole("button", { name: "40" })
    await user.click(selectedSizeTrigger)

    const dialog = screen.getByRole("dialog", { name: /Nike KD 18/ })
    expect(dialog).toHaveAttribute("id", "product-dialog")
    expect(within(dialog).getByRole("heading", { name: /Nike KD 18/ })).toBeInTheDocument()
    expect(dialog.querySelector(".sheet-gallery-main img")?.getAttribute("src")).toContain(
      `${approvedRoot}/nike-kd-18/01-side.png`,
    )
    expect(dialog.querySelectorAll(".sheet-gallery-thumb")).toHaveLength(5)
    expect(
      dialog.querySelectorAll<HTMLImageElement>(".sheet-gallery-thumb img")[3]?.getAttribute("src"),
    ).toContain(`${approvedRoot}/nike-kd-18/04-rear.png`)
    const selectedSize = await within(dialog).findByRole("button", {
      name: "39 RU, 40 EU. Цену размера уточнит Telegram-бот.",
    })
    expect(selectedSize).toHaveAttribute("aria-pressed", "true")
    expect(within(dialog).getByText("Размер: RU (EU)")).toBeInTheDocument()
    expect(within(dialog).getByText("Гайд размера")).toBeInTheDocument()
    expect(within(dialog).queryByText(/EU - размер предложения/u)).toBeNull()
    expect(within(dialog).queryByText(/RU = EU - 1/u)).toBeNull()
    expect(within(dialog).queryByText(/Посадка зависит/u)).toBeNull()
    expect(within(dialog).getByRole("button", {
      name: "40 RU, 41 EU. Цену размера уточнит Telegram-бот.",
    })).toBeDisabled()
    expect(within(dialog).getByRole("button", {
      name: "34,5 RU, 35.5 EU. Цену размера уточнит Telegram-бот.",
    })).toBeDisabled()

    const nextSize = within(dialog).getByRole("button", {
      name: "41 RU, 42 EU. Цену размера уточнит Telegram-бот.",
    })
    await user.click(nextSize)
    expect(nextSize).toHaveAttribute("aria-pressed", "true")
    expect(within(dialog).getAllByText("Уточнить").length).toBeGreaterThan(1)
    expect(within(dialog).getByRole("link", { name: "Продолжить заказ в Telegram" }))
      .toHaveAttribute("href", "https://t.me/SelectBuyerBot?start=sku_nike-kd-18")

    expect(vi.mocked(fetch).mock.calls.filter(
      ([url, options]) =>
        String(url).endsWith("/api/catalog/search") && options?.method === "POST",
    )).toHaveLength(0)
    expect(document.body).toHaveClass("is-locked")

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: /Nike KD 18/ })).toBeNull()
    expect(document.body).not.toHaveClass("is-locked")
    await waitFor(() => expect(selectedSizeTrigger).toHaveFocus())
  })

  it("opens catalog cards instead of swallowing their canonical product links", async () => {
    stubCheckoutCatalog()
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/catalog")
    render(<LandingPage configuredBotUsername={null} />)

    const kdLink = screen.getByRole("link", { name: /Открыть товар: Nike KD 18/ })
    expect(kdLink).toHaveAttribute("href", "/product/nike-kd-18")
    await user.click(kdLink)

    expect(screen.getByRole("dialog", { name: /Nike KD 18/ })).toBeInTheDocument()
  })
})
