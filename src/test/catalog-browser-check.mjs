// Standalone Chromium acceptance check. Requires a saved public catalogue response;
// every API request is intercepted, so this test cannot create orders or call suppliers.
// CATALOG_FIXTURE=<absolute.json> PLAYWRIGHT_MODULE=<optional absolute index.mjs> node src/test/catalog-browser-check.mjs
import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright")
assert(process.env.CATALOG_FIXTURE, "Provide the public catalogue fixture path")
const fixture = JSON.parse(await readFile(process.env.CATALOG_FIXTURE, "utf8"))
const target = process.env.CATALOG_PREVIEW_URL || "http://127.0.0.1:4183"
assert(new URL(target).hostname === "127.0.0.1", "Only the isolated localhost preview is allowed")
const out = path.resolve("tmp/catalog-ui-browser")
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "chrome", headless: true })
const report = { fixtureCount: fixture.catalog_count, capturedAt: new Date().toISOString(), geometry: [], responsive: [], errors: [] }
let mutations = 0

async function prepare(context) {
  await context.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== "GET" && !url.pathname.endsWith("/catalog/search")) mutations++
    await route.fulfill({ json: url.searchParams.get("mode") === "catalog" ? fixture
      : { status: "unavailable", normalized_query: "", results: [], fallback: [] } })
  })
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }
    }
    const grid = document.querySelector("#catalog-product-grid")
    return {
      page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      grid: [grid.scrollWidth, grid.scrollHeight],
      cards: [...grid.querySelectorAll(".product-card")].map(rect),
      transforms: [...grid.querySelectorAll(".product-card")].map((el) => getComputedStyle(el).transform),
    }
  })
}

function sameDimensions(before, after) {
  assert.deepEqual(after.page, before.page, "Document scroll dimensions changed")
  assert.deepEqual(after.grid, before.grid, "Catalogue scroll dimensions changed")
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await prepare(context)
  const page = await context.newPage()
  page.on("pageerror", (error) => report.errors.push(error.message))
  await page.goto(`${target}/catalog`)
  await page.getByText(new RegExp(`^${fixture.catalog_count} товаров`)).waitFor()
  await page.getByRole("button", { name: "Понятно", exact: true }).click()
  const cards = page.locator("#catalog-product-grid .product-card")
  assert.equal(await cards.count(), 24)
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const index of [0, 1, 3, 20, 23]) {
      await page.mouse.move(0, 0)
      await cards.nth(index).scrollIntoViewIfNeeded()
      await page.waitForTimeout(230)
      const before = await geometry(page)
      await cards.nth(index).locator(".product-card__link").hover()
      await page.waitForTimeout(230)
      const after = await geometry(page)
      sameDimensions(before, after)
      assert(Math.abs(after.cards[index].width / before.cards[index].width - 1.025) < 0.002, "Hovered card must scale slightly")
      before.cards.forEach((rect, other) => {
        if (other !== index) assert.deepEqual(after.cards[other], rect, `Neighbour ${other} moved`)
      })
      report.geometry.push({ width, index, before, after })
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await cards.first().scrollIntoViewIfNeeded()
  await cards.first().locator(".product-card__link").hover()
  await page.waitForTimeout(230)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(out, "desktop-hover.png") })
  await page.mouse.move(0, 0)
  await page.waitForTimeout(230)
  const beforeFocus = await geometry(page)
  await cards.first().locator(".product-card__link").focus()
  await page.waitForTimeout(230)
  assert(await cards.first().locator(".card-sizes").isVisible(), "Keyboard users must reach sizes")
  sameDimensions(beforeFocus, await geometry(page))
  await page.keyboard.press("Tab")
  assert(await page.evaluate(() => document.activeElement !== document.body), "Keyboard focus must stay usable")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await cards.first().locator(".product-card__link").hover()
  assert.equal(await cards.first().evaluate((el) => getComputedStyle(el).transform), "none")
  report.reducedMotion = "no scaling"
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.mouse.move(0, 0)
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560, 3840]) {
    await page.setViewportSize({ width, height: 900 })
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }))
    assert.equal(dimensions.scroll, dimensions.viewport, `Horizontal overflow at ${width}`)
    report.responsive.push(dimensions)
  }
  await context.close()

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await prepare(mobile)
  const phone = await mobile.newPage()
  phone.on("pageerror", (error) => report.errors.push(error.message))
  await phone.goto(`${target}/catalog`)
  await phone.getByText(new RegExp(`^${fixture.catalog_count} товаров`)).waitFor()
  await phone.getByRole("button", { name: "Понятно", exact: true }).tap()
  const phoneCard = phone.locator("#catalog-product-grid .product-card").first()
  await phoneCard.scrollIntoViewIfNeeded()
  assert.equal(await phoneCard.evaluate((el) => getComputedStyle(el).transform), "none")
  assert.equal(await phoneCard.locator(".card-sizes").isVisible(), false)
  await phone.screenshot({ path: path.join(out, "mobile-catalog.png") })
  await phoneCard.locator(".product-card__link").tap()
  await phone.getByRole("dialog", { name: /.+/ }).waitFor()
  const currentOffers = (item) => item.price_status === "current" ? item.size_offers.filter((offer) =>
    offer.price_status === "current" && offer.available === true && Date.parse(offer.source_expires_at) > Date.now()) : []
  const expected = [...fixture.items].sort((a, b) => currentOffers(b).length - currentOffers(a).length)[0]
  const slug = expected.slug
  await phone.goto(`${target}/product/${slug}`)
  const dialog = phone.getByRole("dialog", { name: /.+/ })
  await dialog.waitFor()
  for (const offer of currentOffers(expected)) {
    const cell = dialog.locator(`[data-od-id="sheet-size-${slug}-${offer.size_eu.replaceAll(".", "-")}"]`)
    await cell.waitFor({ state: "attached" })
    assert.equal(await cell.count(), 1, `Missing size ${offer.size_eu}`)
    const displayedAmount = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(offer.price_rub).replace(/\s/g, "")
    assert((await cell.innerText()).replace(/\s/g, "").includes(displayedAmount), `Missing exact displayed price for ${offer.size_eu}`)
  }
  assert.equal(await dialog.getByText(/Последняя цена|дата источника|\d\d\.\d\d\.20\d\d/).count(), 0)
  if (!fixture.order_creation_enabled) assert(await dialog.locator(".add-button").isDisabled())
  await dialog.locator(".size-price-grid").scrollIntoViewIfNeeded()
  await phone.evaluate(() => document.fonts.ready)
  await phone.screenshot({ path: path.join(out, "mobile-product.png") })
  report.mobile = { slug, sizeCells: await dialog.locator(".size-price-cell").count(), availableSizePrices: currentOffers(expected).length, touchOpen: true }
  assert.equal(mutations, 0, "The check must never submit an order or change account state")
  assert.deepEqual(report.errors, [], "Unexpected browser errors")
  await mobile.close()
  report.passed = true
} finally {
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ passed: report.passed, geometryChecks: report.geometry.length, widths: report.responsive.length, mobile: report.mobile, mutations, output: out }))
