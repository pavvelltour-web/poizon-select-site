import { describe, expect, it } from "vitest"

import { publicCatalogProducts } from "../catalog/catalog"
import {
  addOrIncrementCartLine,
  buildProductSizeOffers,
  buildCheckoutPayload,
  isCatalogSearchResultForProduct,
  parseCatalogSearch,
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
  it("parses a verified live Poizon result without creating a checkout offer", () => {
    const observedAt = new Date(Date.now() - 60_000).toISOString()
    const expiresAt = new Date(Date.now() + 14 * 60_000).toISOString()
    const parsed = parseCatalogSearch({
      status: "ready",
      normalized_query: "Nike Air Force 1 DV0788-104 42",
      results: [
        {
          source: "poizon",
          provider_product_id: "poizon-dv0788-104",
          provider_url: "https://www.poizon.com/product/dv0788-104",
          brand: "Nike",
          name: "Air Force 1 '07 White",
          article: "DV0788-104",
          kind: "footwear",
          images: ["https://cdn.poizon.example/af1.webp"],
          observed_at: observedAt,
          expires_at: expiresAt,
          offers: [
            {
              sku_id: "sku-42",
              size: "42",
              currency: "CNY",
              price_cny: 699,
              quote_rub: 16700,
            },
          ],
        },
      ],
    })

    expect(parsed?.results[0]).toMatchObject({
      providerProductId: "poizon-dv0788-104",
      article: "DV0788-104",
      providerUrl: "https://www.poizon.com/product/dv0788-104",
      offers: [{ skuId: "sku-42", size: "42", priceCny: 699, quoteRub: 16700 }],
    })
    expect(parsed?.fallback).toEqual([])
    expect(
      parseCatalogSearch({
        status: "ready",
        normalized_query: "Nike",
        results: [{ source: "poizon", offers: [{ currency: "RUB" }] }],
      })?.results,
    ).toEqual([])
  })

  it("accepts the equivalent verified Dewu provider contract", () => {
    const observedAt = new Date(Date.now() - 60_000).toISOString()
    const expiresAt = new Date(Date.now() + 14 * 60_000).toISOString()
    const parsed = parseCatalogSearch({
      status: "ready",
      normalized_query: "Nike KD 18",
      results: [{
        source: "dewu",
        provider_product_id: "dewu-kd-18",
        provider_url: "https://www.dewu.com/product/kd-18",
        brand: "Nike",
        name: "KD 18",
        kind: "footwear",
        images: ["https://cdn.poizon.example/kd-18.webp"],
        observed_at: observedAt,
        expires_at: expiresAt,
        offers: [{
          sku_id: "dewu-kd-42",
          size: "42",
          ru: "41",
          currency: "CNY",
          price_cny: 899,
          quote_rub: 24900,
        }],
      }],
    })

    expect(parsed?.results[0]).toMatchObject({
      source: "dewu",
      providerProductId: "dewu-kd-18",
      offers: [{ size: "42", sizeRu: "41" }],
    })
  })

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
    expect(parsed?.items["nike-gt-cut-academy"]?.sizeOffers).toContainEqual(
      expect.objectContaining({
        skuId: "server-43",
        checkoutConfirmed: true,
        liveProviderVerified: false,
      }),
    )
    expect(parseCheckoutCatalog({ version: "v1", prices: { shoe: 1 } })).toBeNull()
  })

  it("accepts a selected live result only when its full identity matches", () => {
    const product = publicCatalogProducts.find(
      (candidate) => candidate.slug === "nike-gt-cut-academy",
    )!
    const observedAt = new Date(Date.now() - 60_000).toISOString()
    const expiresAt = new Date(Date.now() + 14 * 60_000).toISOString()
    const result = parseCatalogSearch({
      status: "ready",
      normalized_query: product.query,
      results: [{
        source: "poizon",
        provider_product_id: "poizon-gt-cut-academy",
        provider_url: "https://www.poizon.com/product/gt-cut-academy",
        brand: "Nike",
        name: "G.T. Cut Academy",
        model: "G.T. Cut Academy",
        article: "GT-CUT-ACADEMY",
        kind: "footwear",
        images: ["https://cdn.poizon.example/gt-cut.webp"],
        observed_at: observedAt,
        expires_at: expiresAt,
        offers: [{
          sku_id: "gt-cut-44",
          size: "44",
          currency: "CNY",
          price_cny: 899,
          quote_rub: 24500,
        }],
      }],
    })!.results[0]!

    expect(isCatalogSearchResultForProduct(product, result)).toBe(true)
    expect(isCatalogSearchResultForProduct(product, { ...result, brand: "Jordan" })).toBe(false)
    expect(isCatalogSearchResultForProduct(product, { ...result, kind: "apparel" })).toBe(false)
    expect(isCatalogSearchResultForProduct(product, { ...result, name: "Air Force 1 '07" })).toBe(false)
    expect(isCatalogSearchResultForProduct(product, { ...result, model: "Air Force 1 '07" })).toBe(false)
    expect(isCatalogSearchResultForProduct(product, { ...result, article: "DV0788-104" })).toBe(false)
  })

  it("maps live per-size quotes and confirms checkout only by exact SKU, EU and RUB", () => {
    const observedAt = new Date(Date.now() - 60_000).toISOString()
    const expiresAt = new Date(Date.now() + 14 * 60_000).toISOString()
    const live = parseCatalogSearch({
      status: "ready",
      normalized_query: "Nike KD 18 basketball volleyball",
      results: [{
        source: "poizon",
        provider_product_id: "poizon-kd-18",
        provider_url: "https://www.poizon.com/product/kd-18",
        brand: "Nike",
        name: "KD 18",
        article: "KD-18",
        kind: "footwear",
        images: ["https://cdn.poizon.example/kd-18.webp"],
        observed_at: observedAt,
        expires_at: expiresAt,
        offers: [
          {
            sku_id: "sku-42",
            size: "42",
            ru: "41.5",
            us: "8.5",
            cn: "265",
            currency: "CNY",
            price_cny: 899,
            quote_rub: 24900,
          },
          {
            sku_id: "sku-43",
            size: "43",
            currency: "CNY",
            price_cny: 959,
            quote_rub: 26900,
          },
        ],
      }],
    })
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
      live!.results[0]!,
      checkout!.items["nike-gt-cut-academy"],
    )

    expect(matrix).toEqual([
      expect.objectContaining({
        skuId: "sku-42",
        sizeEu: "42",
        sizeRu: "41,5",
        priceRub: 24900,
        available: true,
        checkoutConfirmed: true,
      }),
      expect.objectContaining({
        skuId: "sku-43",
        sizeEu: "43",
        sizeRu: "42",
        priceCny: null,
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
