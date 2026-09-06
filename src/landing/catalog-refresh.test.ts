import { describe, expect, it } from "vitest"

import { getCatalogRefreshSchedule } from "./use-landing-storefront"

const now = Date.parse("2026-08-15T09:00:00.000Z")

describe("storefront catalogue refresh and expiry", () => {
  it("rechecks a healthy complete catalogue once per minute", () => {
    expect(getCatalogRefreshSchedule({
      ready: { expiresAt: "2026-08-15T18:00:00.000Z" },
    }, now)).toEqual({
      delayMs: 60_000,
      expiresAtMs: Date.parse("2026-08-15T18:00:00.000Z"),
    })
  })
  it("refreshes before the minute boundary when evidence expires sooner", () => {
    expect(getCatalogRefreshSchedule({
      later: { expiresAt: "2026-08-15T20:00:00.000Z" },
      earlier: { expiresAt: "2026-08-15T09:00:30.000Z" },
    }, now)).toEqual({
      delayMs: 30_000,
      expiresAtMs: Date.parse("2026-08-15T09:00:30.000Z"),
    })
  })

  it("retries an empty or invalid snapshot in one minute", () => {
    expect(getCatalogRefreshSchedule({}, now)).toEqual({
      delayMs: 60_000,
      expiresAtMs: null,
    })
    expect(getCatalogRefreshSchedule({ broken: { expiresAt: "invalid" } }, now))
      .toEqual({ delayMs: 60_000, expiresAtMs: null })
  })

  it("never keeps an already expired snapshot visible", () => {
    expect(getCatalogRefreshSchedule({
      expired: { expiresAt: "2026-08-15T08:59:59.000Z" },
    }, now).delayMs).toBe(0)
  })
})
