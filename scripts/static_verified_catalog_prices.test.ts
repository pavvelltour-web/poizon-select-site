import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { JSDOM } from "jsdom"
import { describe, expect, it, vi } from "vitest"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const readerPath = path.join(siteRoot, "site-release", "verified-catalog-prices.js")
const directionHtmlPath = path.join(siteRoot, "site-release", "kicksbase-direction-03-blue-field-v2.html")
const directionScriptPath = path.join(siteRoot, "site-release", "kicksbase-direction-03-blue-field-v2.js")
const now = Date.now()
const observedAt = new Date(now - 60 * 60 * 1000).toISOString()
const expiresAt = new Date(now + 11 * 60 * 60 * 1000).toISOString()

function offer(overrides: Record<string, unknown> = {}) {
  return {
    sku_id: "asics-42",
    size_eu: "42",
    price_rub: 15_900,
    available: true,
    checkout_confirmed: true,
    live_provider_verified: true,
    ...overrides,
  }
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    slug: "asics-sky-elite-ff-3",
    price_rub: 15_900,
    live_provider_verified: true,
    observed_at: observedAt,
    expires_at: expiresAt,
    size_offers: [offer()],
    ...overrides,
  }
}

function payload(items: unknown[]) {
  return {
    catalog_mode: "curated_live_poizon",
    snapshot_hours: 12,
    items,
  }
}

async function loadReader(response: unknown) {
  const source = await readFile(readerPath, "utf8")
  const dom = new JSDOM(
    `<!doctype html><body>
      <article data-catalog-card data-od-id="catalog-product-asics-sky-elite-ff-3">
        <span class="product-price">от 99 999 ₽</span>
        <div class="card-sizes"><div class="card-size-options"><button>43</button></div></div>
      </article>
    </body>`,
    { runScripts: "outside-only", url: "https://kicksbase.local/kicksbase-signal-catalog-v4.html" },
  )
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  })
  Object.assign(dom.window, { fetch: fetchMock })
  dom.window.eval(source)
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { dom, fetchMock }
}

async function flushBrowserWork() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("static verified catalogue price reader", () => {
  it("fetches only the same-origin verified snapshot and renders exact offers", async () => {
    const { dom, fetchMock } = await loadReader(
      payload([
        item({
          size_offers: [
            offer({ sku_id: "asics-42", size_eu: "42", price_rub: 15_900 }),
            offer({ sku_id: "asics-42-5", size_eu: "42.5", price_rub: 16_700 }),
            offer({ sku_id: "asics-43", size_eu: "43", available: false, price_rub: 14_000 }),
          ],
        }),
      ]),
    )
    const card = dom.window.document.querySelector<HTMLElement>("[data-catalog-card]")!
    const price = card.querySelector(".product-price")!
    const sizes = [...card.querySelectorAll<HTMLButtonElement>(".card-size-options button")]

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checkout/orders?mode=catalog",
      expect.objectContaining({ credentials: "omit" }),
    )
    expect(price.textContent).toMatch(/^от 15[\s\u00a0\u202f]900 ₽$/)
    expect(card.dataset.livePrice).toBe("15900")
    expect(sizes.map((button) => button.textContent)).toEqual(["42", "42.5"])
    expect(dom.window.KicksbaseVerifiedCatalogPrices.endpoint).toBe("/api/checkout/orders?mode=catalog")
    dom.window.close()
  })

  it("fails closed for stale snapshots and duplicate SKU or display-size rows", async () => {
    const { dom } = await loadReader(payload([]))
    const reader = dom.window.KicksbaseVerifiedCatalogPrices
    const parsed = reader.parse(
      payload([
        item({
          slug: "ambiguous-offers",
          price_rub: 13_000,
          size_offers: [
            offer({ sku_id: "sku-a", size_eu: "42", price_rub: 13_000 }),
            offer({ sku_id: "sku-b", size_eu: "42", price_rub: 13_000 }),
            offer({ sku_id: "sku-b", size_eu: "43", price_rub: 13_000 }),
            offer({ sku_id: "sku-c", size_eu: "44", price_rub: 13_000 }),
          ],
        }),
        item({
          slug: "expired",
          expires_at: new Date(now - 1).toISOString(),
        }),
      ]),
      now,
    )

    expect(parsed["ambiguous-offers"].sizeOffers).toEqual({
      "44": expect.objectContaining({ skuId: "sku-c", totalRub: 13_000 }),
    })
    expect(parsed.expired).toBeUndefined()
    dom.window.close()
  })

  it("keeps static product sheets and cart on the exact selected verified offer", async () => {
    const [readerSource, directionHtml, directionSource] = await Promise.all([
      readFile(readerPath, "utf8"),
      readFile(directionHtmlPath, "utf8"),
      readFile(directionScriptPath, "utf8"),
    ])
    const dom = new JSDOM(directionHtml, {
      runScripts: "outside-only",
      url: "https://kicksbase.local/kicksbase-direction-03-blue-field-v2.html?product=asics-sky-elite-ff-3",
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => payload([
          item({
            size_offers: [
              offer({ sku_id: "asics-42", size_eu: "42", price_rub: 15_900 }),
              offer({ sku_id: "asics-42-5", size_eu: "42.5", price_rub: 16_700 }),
              offer({ sku_id: "asics-43", size_eu: "43", available: false, price_rub: 14_000 }),
            ],
          }),
        ]),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    Object.assign(dom.window, {
      fetch: fetchMock,
      matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0)
        return 0
      },
    })
    dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true }
    dom.window.HTMLDialogElement.prototype.close = function close() { this.open = false }

    dom.window.eval(readerSource)
    dom.window.eval(directionSource)
    await flushBrowserWork()

    const card = dom.window.document.querySelector<HTMLElement>("[data-od-id='product-card-asics-sky-elite-ff-3']")!
    expect(card.querySelector(".product-price")?.textContent).toMatch(/^от 15[\s\u00a0\u202f]900 ₽$/)
    expect([...card.querySelectorAll<HTMLButtonElement>("[data-card-sizes] button")].map((button) => button.textContent)).toEqual(["42", "42.5"])
    expect(card.textContent).not.toContain("43")

    const sheetSizes = [...dom.window.document.querySelectorAll<HTMLButtonElement>("[data-size-grid] button")]
    expect(sheetSizes.map((button) => button.textContent)).toEqual(["42", "42.5"])
    sheetSizes.find((button) => button.textContent === "42.5")!.click()
    expect(dom.window.document.querySelector("[data-sheet-price]")?.textContent).toMatch(/^16[\s\u00a0\u202f]700 ₽$/)

    dom.window.document.querySelector<HTMLButtonElement>("[data-add-to-cart]")!.click()
    expect(dom.window.document.querySelector("[data-cart-list]")?.textContent).toMatch(/16[\s\u00a0\u202f]700 ₽/)

    await dom.window.KicksbaseVerifiedCatalogPrices.refresh()
    expect(card.querySelector(".product-price")?.textContent).toBe("По запросу")
    expect(dom.window.document.querySelector("[data-cart-list]")?.textContent).toContain("По запросу")
    expect(dom.window.document.querySelector<HTMLButtonElement>("[data-checkout]")?.disabled).toBe(true)
    dom.window.close()
  })
})
