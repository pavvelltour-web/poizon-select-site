import { describe, expect, it } from "vitest"

import { catalogProducts } from "../catalog/catalog"
import {
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

  it("creates the exact one-line bot search query without an envelope", () => {
    const request = buildOrderRequest(catalogProducts[0])

    expect(request).toBe("ASICS SKY ELITE FF 3 volleyball")
    expect(request).not.toContain("\n")
    expect(request).not.toContain("Поисковый запрос:")
    expect(request).not.toMatch(/[<>]/)
  })

  it("keeps all 100 catalog handoffs unique, one-line and bot-ready", () => {
    const requests = catalogProducts.map(buildOrderRequest)

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
