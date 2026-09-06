import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchCatalogSearch, fetchCheckoutCatalog } from "./cart"

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("bounded catalogue requests", () => {
  it.each(["catalog", "search"])("times out stalled %s requests", async (kind) => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    })))
    const promise = kind === "catalog" ? fetchCheckoutCatalog("") : fetchCatalogSearch("", "Nike")
    const rejection = expect(promise).rejects.toThrow("Poizon не ответил вовремя")
    await vi.advanceTimersByTimeAsync(kind === "catalog" ? 15_000 : 65_000)
    await rejection
  })

  it("preserves caller cancellation instead of reporting a provider timeout", async () => {
    const controller = new AbortController()
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    })))
    const promise = fetchCheckoutCatalog("", controller.signal)
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: "AbortError" })
  })
})
