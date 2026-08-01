import { describe, expect, it } from "vitest"

import { getClampedLightboxOffset } from "./use-product-lightbox"

describe("getClampedLightboxOffset", () => {
  it("clamps pan to the scaled image inside the actual canvas", () => {
    expect(
      getClampedLightboxOffset(
        { x: 900, y: -900 },
        2,
        { width: 800, height: 600 },
        { width: 600, height: 400 },
      ),
    ).toEqual({ x: 200, y: -100 })
  })

  it("does not allow pan when the scaled image still fits the canvas", () => {
    expect(
      getClampedLightboxOffset(
        { x: 120, y: 80 },
        1.25,
        { width: 900, height: 700 },
        { width: 600, height: 400 },
      ),
    ).toEqual({ x: 0, y: 0 })
  })

  it("resets pan at 100 percent or before measurable media is available", () => {
    expect(
      getClampedLightboxOffset(
        { x: 120, y: 80 },
        1,
        { width: 800, height: 600 },
        { width: 600, height: 400 },
      ),
    ).toEqual({ x: 0, y: 0 })
    expect(
      getClampedLightboxOffset(
        { x: 120, y: 80 },
        2,
        { width: 0, height: 0 },
        { width: 0, height: 0 },
      ),
    ).toEqual({ x: 0, y: 0 })
  })
})
