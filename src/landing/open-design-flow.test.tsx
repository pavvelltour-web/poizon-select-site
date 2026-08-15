import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { catalogProducts, type CatalogProduct } from "../catalog/catalog"
import designCss from "../open-design.css?raw"
import adapterCss from "../open-design-react.css?raw"
import { getProductGalleryAngleLabel } from "./landing-data"
import { LandingPage } from "./landing-page"
import { ProductCard } from "./sections/product-card"

const approvedRoot = "/storefront-media/approved/products"
const catalogRoot = "/catalog"

const mediaRegressionBatch = [
  ...catalogProducts.filter((product) => product.kind === "footwear").slice(0, 6),
  ...catalogProducts.filter((product) => product.kind === "apparel").slice(0, 6),
] as const

const pdpAngleLabels: Record<string, string> = {
  "alternate-front": "\u0420\u0430\u043a\u0443\u0440\u0441 \u0441\u043f\u0435\u0440\u0435\u0434\u0438",
  "opposite-side": "\u041f\u0440\u043e\u0442\u0438\u0432\u043e\u043f\u043e\u043b\u043e\u0436\u043d\u044b\u0439 \u0431\u043e\u043a\u043e\u0432\u043e\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c",
  front: "\u0412\u0438\u0434 \u0441\u043f\u0435\u0440\u0435\u0434\u0438",
  rear: "\u0412\u0438\u0434 \u0441\u0437\u0430\u0434\u0438",
  side: "\u0411\u043e\u043a\u043e\u0432\u043e\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c",
  sole: "\u041f\u043e\u0434\u043e\u0448\u0432\u0430",
  "three-quarter": "\u0421\u043f\u0435\u0440\u0435\u0434\u0438, \u0442\u0440\u0438 \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0438",
  detail: "\u0414\u0435\u0442\u0430\u043b\u044c",
  top: "\u0412\u0438\u0434 \u0441\u0432\u0435\u0440\u0445\u0443",
}

function renderCatalogCard(product: CatalogProduct) {
  return render(
    <ProductCard
      catalogPriceLookup={null}
      catalogStatus="loading"
      featured={false}
      index={0}
      product={product}
      publishedOffer={null}
    />,
  )
}

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
        availability: "supplier_verified",
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
      images: ["https://cdn.poizon.example/kd-18.webp"],
      observed_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 14 * 60_000).toISOString(),
      offers: [
        {
          offer_ref: "kd-18-40",
          size: "40",
          ru: "39",
          us: "7",
          cn: "250",
          price_cny: 1099,
          total_rub: 31400,
        },
        {
          offer_ref: "kd-18-42",
          size: "42",
          ru: "41",
          us: "8.5",
          cn: "265",
          price_cny: 1159,
          total_rub: 32900,
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
  it("keeps the first six footwear and apparel SKU card media in the approved order", () => {
    expect(mediaRegressionBatch).toHaveLength(12)

    for (const product of mediaRegressionBatch) {
      const hoverImageIndex = product.kind === "footwear" ? 2 : 1
      const { container, unmount } = renderCatalogCard(product)
      const hoverFrame = container.querySelector(".product-pair")

      expect(product.gallery, product.slug).toHaveLength(5)
      expect(
        new Set(product.gallery.map((image) => image.src)).size,
        `${product.slug}: frame two must not duplicate another gallery image`,
      ).toBe(5)
      expect(product.gallery[1]?.src, `${product.slug}: frame two`).not.toBe(product.gallery[0]?.src)
      expect(hoverFrame, product.slug).toHaveAttribute(
        "data-hover-frame",
        String(hoverImageIndex + 1),
      )
      expect(container.querySelector(".product-pair img"), product.slug).toBeNull()
      fireEvent.focus(container.querySelector(".product-card__link")!)
      const hoverImage = container.querySelector<HTMLImageElement>(".product-pair img")
      expect(hoverImage, product.slug).toHaveAttribute(
        "src",
        expect.stringContaining(`catalog/thumbs/${product.slug}-${hoverImageIndex + 1}-640.webp`),
      )

      for (const [index, frame] of product.gallery.entries()) {
        expect(frame.angle, `${product.slug}: frame ${index + 1} angle`).toBeTruthy()
        expect(
          getProductGalleryAngleLabel(product, index),
          `${product.slug}: PDP caption for frame ${index + 1}`,
        ).toBe(pdpAngleLabels[frame.angle!])
      }

      unmount()
    }
  })

  it("uses the same complete stage for primary and hover product media", () => {
    expect(designCss).toMatch(
      /\.product-media > img\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*contain;/su,
    )
    expect(designCss).toMatch(
      /\.product-pair\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/su,
    )
  })

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
    render(<LandingPage configuredBotUsername={null} />)

    const card = document.querySelector<HTMLElement>('[data-od-id="product-card-nike-kd-18"]')
    expect(card).not.toBeNull()
    const preview = card?.querySelector<HTMLImageElement>(".product-card__image")
    expect(preview?.getAttribute("src")).toContain(`${catalogRoot}/thumbs/nike-kd-18-1-640.webp`)

    await waitFor(() => {
      expect(within(card!).getByRole("button", { name: "40" })).toBeEnabled()
    })
    const selectedSizeTrigger = within(card!).getByRole("button", { name: "40" })
    await user.click(selectedSizeTrigger)

    const dialog = screen.getByRole("dialog", { name: /Nike KD 18/ })
    expect(dialog).toHaveAttribute("id", "product-dialog")
    expect(within(dialog).getByRole("heading", { name: /Nike KD 18/ })).toBeInTheDocument()
    expect(dialog.querySelector(".sheet-gallery-main img")?.getAttribute("src")).toContain(
      `${catalogRoot}/nike-kd-18.webp`,
    )
    expect(dialog.querySelectorAll(".sheet-gallery-thumb")).toHaveLength(5)
    expect(
      dialog.querySelectorAll<HTMLImageElement>(".sheet-gallery-thumb img")[3]?.getAttribute("src"),
    ).toContain(`${catalogRoot}/gallery/nike-kd-18-4.webp`)
    const selectedSize = await within(dialog).findByRole("button", {
      name: "39 RU, 40 EU, 31 400 ₽",
    })
    expect(selectedSize).toHaveAttribute("aria-pressed", "true")
    expect(within(dialog).getByText("Размер: RU (EU)")).toBeInTheDocument()
    expect(within(dialog).getByText("Гайд размера")).toBeInTheDocument()
    expect(within(dialog).queryByText(/EU - размер предложения/u)).toBeNull()
    expect(within(dialog).queryByText(/RU = EU - 1/u)).toBeNull()
    expect(within(dialog).queryByText(/Посадка зависит/u)).toBeNull()
    expect(within(dialog).getByRole("button", {
      name: "40 RU, 41 EU, нет в наличии",
    })).toBeDisabled()
    expect(within(dialog).getByRole("button", {
      name: "34,5 RU, 35.5 EU, нет в наличии",
    })).toBeDisabled()

    const nextSize = within(dialog).getByRole("button", {
      name: "41 RU, 42 EU, 32 900 ₽",
    })
    await user.click(nextSize)
    expect(nextSize).toHaveAttribute("aria-pressed", "true")
    expect(within(dialog).getAllByText("32 900 ₽").length).toBeGreaterThan(1)
    expect(within(dialog).getByRole("button", { name: "Добавить в заказ" })).toBeEnabled()

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
