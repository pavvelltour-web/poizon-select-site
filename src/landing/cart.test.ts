import { describe, expect, it } from "vitest"

import { publicCatalogProducts } from "../catalog/catalog"
import {
  addOrIncrementCartLine,
  buildProductSizeOffers,
  buildCheckoutPayload,
  parseCatalogSearch,
  parseCheckoutCatalog,
  reconcileCartLines,
} from "./cart"

const catalogPayload = {
  version: "2026-08-02-v3",
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
      size_offers: [
        {
          sku_id: "server-43",
          size_eu: "43",
          size_ru: "42",
          price_rub: 25100,
          available: true,
          checkout_confirmed: true,
          live_provider_verified: false,
        },
        {
          sku_id: "server-44",
          size_eu: "44",
          size_ru: "43",
          price_rub: 25100,
          available: true,
          checkout_confirmed: true,
          live_provider_verified: false,
        },
      ],
    },
  ],
}

describe("checkout catalogue v10", () => {
  it("parses a published catalog response without presenting a live provider quote", () => {
    const parsed = parseCatalogSearch({
      status: "catalog",
      normalized_query: "Nike Air Force",
      results: [],
      fallback: [{
        source: "catalog",
        slug: "nike-air-force-1-07-white",
        name: "Air Force 1 ’07 White",
        brand: "Nike",
        image: "https://kicksbase.ru/catalog/nike-air-force-1-07-white.webp",
        navigation_url: "https://kicksbase.ru/product/nike-air-force-1-07-white",
        availability: "unverified",
      }],
    })

    expect(parsed).toMatchObject({
      status: "catalog",
      normalizedQuery: "Nike Air Force",
      results: [],
      fallback: [{ slug: "nike-air-force-1-07-white" }],
    })
  })

  it("parses the public Poizon search DTO without supplier IDs, URLs or CNY", () => {
    const observedAt = new Date(Date.now() - 60_000).toISOString()
    const expiresAt = new Date(Date.now() + 14 * 60_000).toISOString()
    const parsed = parseCatalogSearch({
      status: "ready",
      normalized_query: "Nike Air Force 1 DV0788-104 42",
      results: [
        {
          product_ref: "air-force-1-07-white",
          brand: "Nike",
          name: "Air Force 1 '07 White",
          article: "DV0788-104",
          color: "White / University Red",
          kind: "footwear",
          description: "Белые кроссовки из натуральной кожи.",
          images: ["https://cdn.poizon.example/af1.webp"],
          in_stock: true,
          size_context: "Размеры указаны в системе Poizon.",
          size_chart: "Сверьте длину стопы с таблицей производителя.",
          size_image: "javascript:alert('unsafe')",
          observed_at: observedAt,
          expires_at: expiresAt,
          offers: [
            {
              size: "42",
              eu: "42",
              ru: "41",
              us: "8.5",
              cn: "265",
              available: true,
              quote_rub: 16700,
              rf_delivery: 1000,
              total_rub: 17700,
              price_breakdown: null,
              sku_id: "private-sku-that-must-not-reach-ui",
              price_cny: 699,
            },
            {
              size: "43",
              eu: "43",
              ru: "42",
              us: "9",
              cn: "270",
              available: false,
              quote_rub: 17200,
              rf_delivery: 1000,
              total_rub: 18200,
              price_breakdown: null,
            },
          ],
        },
      ],
    })

    expect(parsed?.results[0]).toMatchObject({
      productRef: "air-force-1-07-white",
      article: "DV0788-104",
      color: "White / University Red",
      description: "Белые кроссовки из натуральной кожи.",
      inStock: true,
      sizeContext: "Размеры указаны в системе Poizon.",
      sizeChart: "Сверьте длину стопы с таблицей производителя.",
      sizeImage: null,
      offers: [{ size: "42", totalRub: 17700 }, { size: "43", totalRub: 18200 }],
    })
    expect(parsed?.results[0]).not.toHaveProperty("providerProductId")
    expect(parsed?.results[0]).not.toHaveProperty("providerUrl")
    expect(parsed?.results[0]?.offers[0]).not.toHaveProperty("skuId")
    expect(parsed?.results[0]?.offers[0]).not.toHaveProperty("priceCny")
    expect(parsed?.fallback).toEqual([])
    expect(
      parseCatalogSearch({
        status: "ready",
        normalized_query: "Nike",
        results: [{ product_ref: "broken", offers: [{ total_rub: 12000 }] }],
      })?.results,
    ).toEqual([])
  })

  it("parses the complete published offer and rejects a prices-only payload", () => {
    const parsed = parseCheckoutCatalog(catalogPayload)

    expect(parsed?.version).toBe("2026-08-02-v3")
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
    expect(parsed?.items["nike-gt-cut-academy"]?.sizeOffers).toContainEqual(
      expect.objectContaining({
        skuId: "server-43",
        checkoutConfirmed: true,
        liveProviderVerified: false,
      }),
    )
    expect(parseCheckoutCatalog({ version: "v1", prices: { shoe: 1 } })).toBeNull()
  })

  it("accepts the disabled live-Poizon-only checkout response as an empty snapshot", () => {
    const parsed = parseCheckoutCatalog({
      catalog_mode: "live_poizon_only",
      version: "live-poizon-only-v1",
      order_creation_enabled: false,
      online_payment_enabled: false,
      items: [],
      prices: {},
    })

    expect(parsed).toEqual({
      items: {},
      lookup: {},
      version: "live-poizon-only-v1",
      personalDataConsentVersion: null,
      orderCreationEnabled: false,
      onlinePaymentEnabled: false,
    })
  })

  it("keeps the size matrix separate from live search metadata", () => {
    const checkout = parseCheckoutCatalog({
      ...catalogPayload,
      items: [{
        ...catalogPayload.items[0],
        sizes: ["42", "43", "44"],
        live_provider_verified: false,
        size_offers: [
          {
            sku_id: "sku-42",
            size_eu: "42",
            size_ru: "41",
            price_rub: 24900,
            available: true,
            checkout_confirmed: true,
            live_provider_verified: false,
          },
          {
            sku_id: "sku-43",
            size_eu: "43",
            price_rub: 27000,
            available: true,
            checkout_confirmed: true,
            live_provider_verified: false,
          },
        ],
      }],
    })

    const matrix = buildProductSizeOffers(
      ["42", "43", "44"],
      "Nike",
      checkout!.items["nike-gt-cut-academy"],
    )

    expect(matrix).toEqual([
      expect.objectContaining({
        skuId: "sku-42",
        sizeEu: "42",
        sizeRu: "41",
        priceRub: 24900,
        available: true,
        checkoutConfirmed: true,
      }),
      expect.objectContaining({
        skuId: "sku-43",
        sizeEu: "43",
        sizeRu: "42",
        priceRub: 27000,
        available: true,
        checkoutConfirmed: true,
      }),
      expect.objectContaining({
        skuId: null,
        sizeEu: "44",
        sizeRu: "43",
        priceRub: null,
        available: false,
        checkoutConfirmed: false,
      }),
    ])
  })

  it("uses a confirmed server size offer despite an unverified live provider", () => {
    const product = publicCatalogProducts.find(
      (candidate) => candidate.slug === "nike-gt-cut-academy",
    )!
    const parsed = parseCheckoutCatalog({
      ...catalogPayload,
      items: [{
        ...catalogPayload.items[0],
        live_provider_verified: false,
        size_offers: [{
          sku_id: "sku-44",
          size_eu: "44",
          price_rub: 26900,
          available: true,
          checkout_confirmed: true,
          live_provider_verified: false,
        }],
      }],
    })!
    const lines = reconcileCartLines(addOrIncrementCartLine([], product, "44"), parsed.items)
    const payload = buildCheckoutPayload(
      lines,
      { fullName: "Павел", phone: "+79990000000", email: "" },
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
    )

    expect(payload.items[0]).toMatchObject({
      sku_id: "sku-44",
      size_eu: "44",
      price_rub: 26900,
    })
  })

  it("fails closed when a server offer is available but not checkout-confirmed", () => {
    const product = publicCatalogProducts.find(
      (candidate) => candidate.slug === "nike-gt-cut-academy",
    )!
    const parsed = parseCheckoutCatalog({
      ...catalogPayload,
      items: [{
        ...catalogPayload.items[0],
        size_offers: [{
          sku_id: "unconfirmed-44",
          size_eu: "44",
          price_rub: 26900,
          available: true,
          checkout_confirmed: false,
          live_provider_verified: true,
        }],
      }],
    })!
    const lines = reconcileCartLines(addOrIncrementCartLine([], product, "44"), parsed.items)

    expect(parsed.items[product.slug]?.sizeOffers[0]).toMatchObject({
      checkoutConfirmed: false,
      liveProviderVerified: true,
    })
    expect(lines[0]?.validation).toBe("invalid")
    expect(() =>
      buildCheckoutPayload(
        lines,
        { fullName: "Павел", phone: "+79990000000", email: "" },
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

  it("requires one exact confirmed server offer for each cart size", () => {
    const product = publicCatalogProducts.find(
      (candidate) => candidate.slug === "nike-gt-cut-academy",
    )!
    const nonExactSize = parseCheckoutCatalog({
      ...catalogPayload,
      items: [{
        ...catalogPayload.items[0],
        sizes: ["44", "44.0"],
        size_offers: [{
          sku_id: "server-44-point-0",
          size_eu: "44.0",
          price_rub: 25100,
          available: true,
          checkout_confirmed: true,
        }],
      }],
    })!
    const duplicateSize = parseCheckoutCatalog({
      ...catalogPayload,
      items: [{
        ...catalogPayload.items[0],
        sizes: ["44"],
        size_offers: ["server-44-a", "server-44-b"].map((sku_id) => ({
          sku_id,
          size_eu: "44",
          price_rub: 25100,
          available: true,
          checkout_confirmed: true,
        })),
      }],
    })!

    expect(
      reconcileCartLines(addOrIncrementCartLine([], product, "44"), nonExactSize.items)[0]?.validation,
    ).toBe("invalid")
    expect(
      reconcileCartLines(addOrIncrementCartLine([], product, "44"), duplicateSize.items)[0]?.validation,
    ).toBe("invalid")
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
      sku_id: "server-44",
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
