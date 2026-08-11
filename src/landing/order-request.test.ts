import { describe, expect, it } from "vitest"

import { catalogProducts } from "../catalog/catalog"
import {
  buildLiveProductTelegramBotUrl,
  buildLiveSearchTelegramBotUrl,
  buildOrderRequest,
  buildTelegramBotUrl,
  resolveBotUsername,
} from "./order-request"

describe("Telegram order handoff", () => {
  it("accepts only a plausible public bot username", () => {
    expect(resolveBotUsername("@MyBuyerBot")).toBe("MyBuyerBot")
    expect(resolveBotUsername("buyer_bot")).toBe("buyer_bot")
    expect(resolveBotUsername("regular_user")).toBeNull()
    expect(resolveBotUsername("bad/namebot")).toBeNull()
    expect(resolveBotUsername("https://t.me/namebot")).toBeNull()
    expect(resolveBotUsername(undefined)).toBeNull()
  })

  it("builds only an HTTPS Telegram URL from a validated username", () => {
    expect(buildTelegramBotUrl("MyBuyerBot")).toBe(
      "https://t.me/MyBuyerBot",
    )
    expect(buildTelegramBotUrl(null)).toBeNull()
    expect(buildTelegramBotUrl("../outside")).toBeNull()
    expect(buildTelegramBotUrl("https://evil.test/namebot")).toBeNull()
  })

  it("hands a bounded live Poizon query to the bot through Telegram start", () => {
    expect(buildLiveSearchTelegramBotUrl("MyBuyerBot", "Nike Air Force 1")).toBe(
      "https://t.me/MyBuyerBot?start=live_TmlrZSBBaXIgRm9yY2UgMQ",
    )
    expect(buildLiveSearchTelegramBotUrl("MyBuyerBot", "x".repeat(120))).toBeNull()
    expect(buildLiveSearchTelegramBotUrl(null, "Nike Air Force 1")).toBeNull()
  })

  it("creates the exact one-line bot search query without an envelope", () => {
    const request = buildOrderRequest(catalogProducts[0])

    expect(request).toBe("ASICS SKY ELITE FF 3 volleyball")
    expect(request).not.toContain("\n")
    expect(request).not.toContain("Поисковый запрос:")
    expect(request).not.toMatch(/[<>]/)
  })

  it("adds a selected size as a clean second line", () => {
    const request = buildOrderRequest(catalogProducts[0], "EU 43")

    expect(request).toBe("ASICS SKY ELITE FF 3 volleyball\nРазмер: EU 43")
    expect(request).not.toMatch(/[<>]/)
  })

  it("uses the article for the live Telegram handoff without source details", () => {
    const href = buildLiveProductTelegramBotUrl("MyBuyerBot", {
      brand: "Nike",
      name: "Air Force 1 '07 White",
      article: "DV0788-104",
    }, "Nike Air Force 1")

    expect(href).toBe("https://t.me/MyBuyerBot?start=live_RFYwNzg4LTEwNA")
    expect(href).not.toContain("poizon.com")
    expect(href).not.toContain("sku")
    expect(href).not.toContain("%C2%A5")
  })

  it("keeps all 100 catalog handoffs unique, one-line and bot-ready", () => {
    const requests = catalogProducts.map((product) => buildOrderRequest(product))

    expect(new Set(requests).size).toBe(100)
    for (const [index, request] of requests.entries()) {
      expect(request).toBe(catalogProducts[index].query)
      expect(request).toMatch(/^[^\r\n:]{3,300}$/u)
      expect(request).not.toMatch(/[\p{Cc}<>]/u)
    }
  })

  it("removes markup delimiters and control characters from catalog text", () => {
    const request = buildOrderRequest({
      ...catalogProducts[0],
      brand: "<b>ASICS</b>\u0000",
      query: "GEL-1130<script>\u0007",
    })

    expect(request).toBe("GEL-1130script")
    expect(request).not.toContain("<")
    expect(request).not.toContain(">")
    expect(request).not.toContain("\u0000")
    expect(request).not.toContain("\u0007")
  })
})
