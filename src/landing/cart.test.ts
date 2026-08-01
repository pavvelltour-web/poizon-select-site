import { describe, expect, it } from "vitest"

import { publicCatalogProducts } from "../catalog/catalog"
import {
  addOrIncrementCartLine,
  buildCheckoutPayload,
  parseCheckoutCatalog,
  reconcileCartLines,
} from "./cart"

const catalogPayload = {
  version: "2026-07-31-v2",
  personal_data_consent_version: "pd-2026-08",
  order_creation_enabled: true,
  online_payment_enabled: true,
  items: [
    {
      slug: "nike-gt-cut-academy",
      name: "Server-owned name",
      brand: "Server Brand",
      product_kind: "footwear",
      sizes: ["43", "44"],
      price_rub: 25100,
      image_url: "https://kicksbase.ru/catalog/server.webp",
      fulfillment_mode: "made_to_order",
      availability: "catalog_listed",
      eta_min_days: 10,
      eta_max_days: 18,
      live_provider_verified: false,
    },
  ],
}

describe("checkout catalogue v10", () => {
  it("parses the complete published offer and rejects a prices-only payload", () => {
    const parsed = parseCheckoutCatalog(catalogPayload)

    expect(parsed?.version).toBe("2026-07-31-v2")
    expect(parsed).toMatchObject({
      orderCreationEnabled: true,
      onlinePaymentEnabled: true,
    })
    expect(parsed?.items["nike-gt-cut-academy"]).toMatchObject({
      priceRub: 25100,
      sizes: ["43", "44"],
      fulfillmentMode: "made_to_order",
      liveProviderVerified: false,
    })
    expect(parseCheckoutCatalog({ version: "v1", prices: { shoe: 1 } })).toBeNull()
  })

  it("fails closed when public order and payment capabilities are absent or inconsistent", () => {
    const withoutCapabilities = parseCheckoutCatalog({
      ...catalogPayload,
      order_creation_enabled: undefined,
      online_payment_enabled: undefined,
    })
    const paymentWithoutOrders = parseCheckoutCatalog({
      ...catalogPayload,
      order_creation_enabled: false,
      online_payment_enabled: true,
    })

    expect(withoutCapabilities).toMatchObject({
      orderCreationEnabled: false,
      onlinePaymentEnabled: false,
    })
    expect(paymentWithoutOrders).toMatchObject({
      orderCreationEnabled: false,
      onlinePaymentEnabled: false,
    })
  })

  it("uses server-owned checkout fields and delivery, not local compatibility values", () => {
    const product = publicCatalogProducts.find(
      (candidate) => candidate.slug === "nike-gt-cut-academy",
    )
    expect(product).toBeDefined()
    const parsed = parseCheckoutCatalog(catalogPayload)
    expect(parsed).not.toBeNull()
    const lines = reconcileCartLines(
      addOrIncrementCartLine([], product!, "44"),
      parsed!.items,
    )

    const payload = buildCheckoutPayload(
      lines,
      { fullName: "Павел Шустров", phone: "+79990000000", email: "buyer@example.com" },
      { offerAccepted: true, personalDataAccepted: true },
      {
        method: "cdek_courier",
        city: "Москва",
        postalCode: "119607",
        address: "ул. Лобачевского, 100",
        pvzCode: "",
      },
      parsed!.items,
      parsed!.version,
    )

    expect(payload.items[0]).toMatchObject({
      product_name: "Server-owned name",
      brand: "Server Brand",
      product_kind: "footwear",
      price_rub: 25100,
      image_url: "https://kicksbase.ru/catalog/server.webp",
    })
    expect(payload.delivery).toEqual({
      method: "cdek_courier",
      city: "Москва",
      postal_code: "119607",
      address: "ул. Лобачевского, 100",
      pvz_code: null,
    })
  })

  it("fails closed when a persisted size is not published", () => {
    const product = publicCatalogProducts.find(
      (candidate) => candidate.slug === "nike-gt-cut-academy",
    )!
    const parsed = parseCheckoutCatalog(catalogPayload)!
    const lines = reconcileCartLines(
      addOrIncrementCartLine([], product, "99"),
      parsed.items,
    )

    expect(lines[0].validation).toBe("invalid")
    expect(() =>
      buildCheckoutPayload(
        lines,
        { fullName: "Павел", phone: "+79990000000", email: "buyer@example.com" },
        { offerAccepted: true, personalDataAccepted: true },
        {
          method: "cdek_pvz",
          city: "Москва",
          postalCode: "119607",
          address: "",
          pvzCode: "MSK123",
        },
        parsed.items,
        parsed.version,
      ),
    ).toThrow(/без подтверждения сервера/)
  })
})
