import { useEffect, useMemo, useRef, useState } from "react"

import {
  publicCatalogProducts,
  CATALOG_PRICE_VERSION,
  filterCatalog,
  findPublicProductBySlug,
  sortCatalog,
  type CatalogSort,
  type CatalogProduct,
} from "../catalog/catalog"
import {
  addOrIncrementCartLine,
  cartTotalRub,
  loadCart,
  saveCart,
  submitCheckout,
  isCheckoutApiError,
  updateCartQuantity,
  type CheckoutConsents,
  type CheckoutCustomer,
  type CheckoutResult,
  type CartLine,
} from "./cart"
import {
  buildOrderRequest,
  buildTelegramBotUrl,
  copyOrderRequest,
  resolveBotUsername,
} from "./order-request"
import {
  findTaskMatches,
  getDisplayPrice,
  getSizeOptions,
  heroProductSlugs,
  isCategory,
  isSort,
  readUrlState,
} from "./landing-data"
import type { ActiveCategory, StorefrontState, UrlState } from "./landing-types"

type CatalogPriceParseResult = {
  lookup: Record<string, number>
  version: string | null
  personalDataConsentVersion: string | null
}

function readPersonalDataConsentVersion(payload: object): string | null {
  if (!("personal_data_consent_version" in payload)) return null
  const value = (payload as { personal_data_consent_version?: unknown })
    .personal_data_consent_version
  return typeof value === "string" && value.trim() ? value.trim() : null
}
function createCheckoutIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  const randomPart = Math.random().toString(36).slice(2, 14)
  return "checkout-" + Date.now().toString(36) + "-" + randomPart
}
function checkoutIntentSignature(
  lines: readonly CartLine[],
  customer: CheckoutCustomer,
): string {
  return JSON.stringify({
    customer: {
      fullName: customer.fullName.trim(),
      phone: customer.phone.trim(),
      email: customer.email.trim().toLowerCase(),
    },
    lines: lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
    })),
  })
}
function parseCatalogPricePayload(payload: unknown): CatalogPriceParseResult | null {
  if (!payload || typeof payload !== "object") return null

  const candidate =
    "prices" in payload && payload.prices && typeof payload.prices === "object"
      ? payload.prices
      : payload

  const dataRows =
    !Array.isArray(candidate) &&
    candidate !== null &&
    "data" in candidate &&
    Array.isArray((candidate as { data?: unknown }).data)
      ? (candidate as { data: unknown[] }).data
      : null

  if (dataRows) {
    const lookup = extractPriceMap(
      dataRows as Array<{
        product_slug?: string
        slug?: string
        code?: string
        price?: unknown
        price_rub?: unknown
        priceRub?: unknown
        amount?: unknown
      }>,
    )
    if (!Object.keys(lookup).length) return null
    return {
      lookup,
      version:
        "version" in payload && typeof (payload as { version?: unknown }).version === "string"
          ? (payload as { version: string }).version
          : null,
      personalDataConsentVersion: readPersonalDataConsentVersion(payload),
    }
  }

  if (Array.isArray(candidate)) {
    const lookup = extractPriceMap(
      candidate as Array<{
        product_slug?: string
        slug?: string
        code?: string
        price?: unknown
        price_rub?: unknown
        priceRub?: unknown
        amount?: unknown
      }>,
    )
    if (!Object.keys(lookup).length) return null
    return {
      lookup,
      version:
        "version" in payload && typeof (payload as { version?: unknown }).version === "string"
          ? (payload as { version: string }).version
          : null,
      personalDataConsentVersion: readPersonalDataConsentVersion(payload),
    }
  }

  if (candidate === null || typeof candidate !== "object") return null
  const lookup = extractPriceMap(Object.entries(candidate as Record<string, unknown>))
  if (!Object.keys(lookup).length) return null
  return {
    lookup,
    version:
      "version" in payload && typeof (payload as { version?: unknown }).version === "string"
        ? (payload as { version: string }).version
        : null,
    personalDataConsentVersion: readPersonalDataConsentVersion(payload),
  }
}

function extractPriceMap(
  rows:
    | Array<{
        product_slug?: string
        slug?: string
        code?: string
        price?: unknown
        price_rub?: unknown
        priceRub?: unknown
        amount?: unknown
      }>
    | Array<[string, unknown]>,
): Record<string, number> {
  const lookup: Record<string, number> = {}
  for (const item of rows) {
    if (Array.isArray(item)) {
      const [slug, value] = item
      if (typeof slug !== "string" || !slug.trim()) continue
      const amount = typeof value === "number" ? value : Number(value)
      if (Number.isFinite(amount) && amount > 0) lookup[slug.trim()] = amount
      continue
    }

    const candidate = item
    const slug =
      candidate.product_slug ??
      candidate.slug ??
      candidate.code ??
      ""
    const priceCandidate =
      candidate.price ??
      candidate.price_rub ??
      candidate.priceRub ??
      candidate.amount
    if (!slug) continue
    const amount = typeof priceCandidate === "number" ? priceCandidate : Number(priceCandidate)
    if (Number.isFinite(amount) && amount > 0) lookup[slug] = amount
  }
  return lookup
}

function buildPriceCatalogUrls(apiBaseUrl: string): string[] {
  const endpoint = `${apiBaseUrl || ""}`.replace(/\/$/, "")
  return endpoint
    ? [`${endpoint}/api/checkout/prices`, `${endpoint}/api/checkout/orders?mode=prices`]
    : ["/api/checkout/prices", "/api/checkout/orders?mode=prices"]
}

async function loadCatalogPricesFromApi(
  apiBaseUrl: string,
  cancelled: () => boolean,
): Promise<CatalogPriceParseResult | null> {
  const requestedUrls = buildPriceCatalogUrls(apiBaseUrl)

  for (const pricesUrl of requestedUrls) {
    if (cancelled()) return null
    try {
      const response = await fetch(pricesUrl, { credentials: "include" })
      if (!response.ok) continue
      const payload = await response.json().catch(() => null)
      const parsed = parseCatalogPricePayload(payload)
      if (!parsed) continue
      if (Object.keys(parsed.lookup).length === 0) continue
      return {
        lookup: parsed.lookup,
        version: parsed.version || CATALOG_PRICE_VERSION,
        personalDataConsentVersion: parsed.personalDataConsentVersion,
      }
    } catch {
      // Keep local fallback until a valid price response arrives.
    }
  }

  return null
}

export type LandingStorefront = StorefrontState

export function useLandingStorefront(
  configuredBotUsername?: string | null,
): StorefrontState {
  const initialState = useMemo(readUrlState, [])
  const [category, setCategory] = useState<ActiveCategory>(initialState.category)
  const [search, setSearch] = useState(initialState.search)
  const [sort, setSort] = useState<CatalogSort>(initialState.sort)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initialState.productSlug,
  )
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedSize, setSelectedSizeState] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const [taskInput, setTaskInputState] = useState("")
  const [remoteTaskMatches, setRemoteTaskMatches] = useState<
    StorefrontState["taskMatches"] | null
  >(null)
  const [cartLines, setCartLines] = useState<CartLine[]>([])
  const [isCartOpen, setCartOpen] = useState(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("cart") === "1"
  })
  const [checkoutCustomer, setCheckoutCustomer] = useState<CheckoutCustomer>({
    fullName: "",
    phone: "",
    email: "",
  })
  const [checkoutConsents, setCheckoutConsents] = useState<CheckoutConsents>({
    offerAccepted: false,
    personalDataAccepted: false,
  })
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult>({
    status: "idle",
    message: "",
    orderIds: [],
    paymentUrl: null,
  })
  const [catalogPriceState, setCatalogPriceState] = useState({
    lookup: null as Record<string, number> | null,
    version: CATALOG_PRICE_VERSION,
    personalDataConsentVersion: null as string | null,
  })
  const productTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sheetHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const checkoutAttemptRef = useRef<{ signature: string; key: string } | null>(null)

  const botUsername = resolveBotUsername(
    configuredBotUsername ?? import.meta.env.VITE_BOT_USERNAME,
  )
  const botUrl = buildTelegramBotUrl(botUsername)
  const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim() || ""

  const selectedProduct = findPublicProductBySlug(selectedSlug)
  const selectedVisibleGallery = selectedProduct?.gallery.slice(0, 5) ?? []
  const selectedImage =
    selectedVisibleGallery[selectedImageIndex] ??
    selectedVisibleGallery[0] ??
    (selectedProduct
      ? { src: selectedProduct.fallbackImage, alt: selectedProduct.name }
      : null)
  const selectedProductPrice = selectedProduct
    ? getDisplayPrice(selectedProduct, catalogPriceState.lookup)
    : null
  const selectedSizeOptions = selectedProduct ? getSizeOptions(selectedProduct) : []
  const selectedImageDisplayIndex =
    selectedVisibleGallery.length === 0 ? 0 : selectedImageIndex + 1
  const filteredProducts = useMemo(
    () => sortCatalog(filterCatalog(publicCatalogProducts, category, search), sort),
    [category, search, sort],
  )
  const heroProducts = useMemo(
    () =>
      heroProductSlugs
        .map((slug) => publicCatalogProducts.find((product) => product.slug === slug))
        .filter((product): product is CatalogProduct => product !== undefined),
    [],
  )
  const request = selectedProduct
    ? buildOrderRequest(selectedProduct, selectedSize ?? undefined)
    : ""
  const localTaskMatches = useMemo(
    () =>
      findTaskMatches(publicCatalogProducts, taskInput, catalogPriceState.lookup).slice(
        0,
        3,
      ),
    [taskInput, catalogPriceState.lookup],
  )
  const taskMatches = remoteTaskMatches ?? localTaskMatches
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0)
  const currentCartTotalRub = cartTotalRub(cartLines, catalogPriceState.lookup)

  const writeUrl = (
    nextState: Partial<UrlState>,
    mode: "push" | "replace" = "replace",
  ) => {
    if (typeof window === "undefined") return

    const nextCategory = nextState.category ?? category
    const nextSearch = nextState.search ?? search
    const nextSort = nextState.sort ?? sort
    const nextProductSlug =
      nextState.productSlug === undefined ? selectedSlug : nextState.productSlug
    const url = new URL(window.location.href)

    if (nextCategory === "all") url.searchParams.delete("category")
    else url.searchParams.set("category", nextCategory)
    if (nextSearch.trim()) url.searchParams.set("q", nextSearch.trim())
    else url.searchParams.delete("q")
    if (nextSort === "featured") url.searchParams.delete("sort")
    else url.searchParams.set("sort", nextSort)
    if (nextProductSlug) url.searchParams.set("product", nextProductSlug)
    else url.searchParams.delete("product")

    const nextHref = `${url.pathname}${url.search}${url.hash}`
    if (nextHref === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      return
    }

    if (mode === "push") window.history.pushState(null, "", nextHref)
    else window.history.replaceState(null, "", nextHref)
  }

  const refreshCatalogPrices = async (options: { isCancelled?: () => boolean } = {}) => {
    const nextPriceState = await loadCatalogPricesFromApi(
      apiBaseUrl,
      options.isCancelled ?? (() => false),
    )
    if (!nextPriceState) return null
    if (options.isCancelled?.()) return null
    setCatalogPriceState({
      lookup: nextPriceState.lookup,
      version: nextPriceState.version || CATALOG_PRICE_VERSION,
      personalDataConsentVersion: nextPriceState.personalDataConsentVersion,
    })
    return nextPriceState
  }

  const refreshPersonalDataConsentVersion = async () => {
    const nextState = await refreshCatalogPrices()
    return nextState?.personalDataConsentVersion ?? null
  }

  useEffect(() => {
    const syncFromHistory = () => {
      const nextState = readUrlState()
      setCategory(nextState.category)
      setSearch(nextState.search)
      setSort(nextState.sort)
      setSelectedSlug(nextState.productSlug)
    }

    window.addEventListener("popstate", syncFromHistory)
    return () => window.removeEventListener("popstate", syncFromHistory)
  }, [])

  useEffect(() => {
    setSelectedImageIndex(0)
    setSelectedSizeState(null)
    setCopyState("idle")
  }, [selectedSlug])

  useEffect(() => {
    if (!selectedProduct) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    sheetHeadingRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProduct()
      if (event.key === "ArrowLeft") showPreviousProductImage()
      if (event.key === "ArrowRight") showNextProductImage()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [selectedProduct, selectedVisibleGallery.length])

  useEffect(() => {
    setCartLines(loadCart(publicCatalogProducts))
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadCatalogPrices = async () => refreshCatalogPrices({ isCancelled: () => cancelled })
    void loadCatalogPrices()
    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  useEffect(() => {
    const query = taskInput.trim()
    if (query.length < 2) {
      setRemoteTaskMatches(null)
      return
    }

    setRemoteTaskMatches(null)
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const endpoint = `${apiBaseUrl || ""}`.replace(/\/$/, "")
        const response = await fetch(`${endpoint}/api/catalog/recommendations`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, limit: 4 }),
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = (await response.json().catch(() => null)) as {
          items?: unknown
        } | null
        if (!payload || !Array.isArray(payload.items)) return
        const matches = payload.items
          .slice(0, 4)
          .map((item, index) => {
            if (!item || typeof item !== "object") return null
            const slug = "slug" in item && typeof item.slug === "string" ? item.slug : ""
            const reason =
              "reason" in item && typeof item.reason === "string"
                ? item.reason.slice(0, 80)
                : "Подходит под запрос"
            const product = findPublicProductBySlug(slug)
            return product ? { product, reason, score: 100 - index } : null
          })
          .filter(
            (match): match is StorefrontState["taskMatches"][number] => match !== null,
          )
        if (matches.length > 0) setRemoteTaskMatches(matches)
      } catch {
        // The deterministic in-browser matcher remains available offline.
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [apiBaseUrl, taskInput])

  useEffect(() => {
    saveCart(cartLines)
  }, [cartLines])

  const selectCategory = (nextCategory: ActiveCategory) => {
    setCategory(nextCategory)
    setSelectedSlug(null)
    writeUrl({ category: nextCategory, productSlug: null })
  }

  const setSearchValue = (nextSearch: string) => {
    setSearch(nextSearch)
    setSelectedSlug(null)
    writeUrl({ search: nextSearch, productSlug: null })
  }

  const selectSort = (nextSort: CatalogSort) => {
    if (!isSort(nextSort)) return
    setSort(nextSort)
    writeUrl({ sort: nextSort })
  }

  const applyQuickFilter = (filter: {
    category: ActiveCategory
    search?: string
    sort?: CatalogSort
  }) => {
    if (!isCategory(filter.category)) return
    const nextSearch = filter.search ?? ""
    const nextSort = filter.sort ?? "featured"
    setCategory(filter.category)
    setSearch(nextSearch)
    setSort(nextSort)
    setSelectedSlug(null)
    writeUrl({
      category: filter.category,
      search: nextSearch,
      sort: nextSort,
      productSlug: null,
    })
  }

  const resetCatalog = () => {
    setCategory("all")
    setSearch("")
    setSort("featured")
    setSelectedSlug(null)
    writeUrl({ category: "all", search: "", sort: "featured", productSlug: null })
  }

  const setTaskInput = (task: string) => setTaskInputState(task)

  const openProduct = (product: CatalogProduct, trigger: HTMLButtonElement) => {
    productTriggerRef.current = trigger
    setSelectedSlug(product.slug)
    writeUrl({ productSlug: product.slug }, "push")
  }

  function closeProduct() {
    setSelectedSlug(null)
    writeUrl({ productSlug: null }, "replace")
    queueMicrotask(() => productTriggerRef.current?.focus())
  }

  function selectProductImage(index: number) {
    if (selectedVisibleGallery.length === 0) return
    setSelectedImageIndex(
      Math.max(0, Math.min(index, selectedVisibleGallery.length - 1)),
    )
  }

  function showPreviousProductImage() {
    if (selectedVisibleGallery.length <= 1) return
    setSelectedImageIndex((index) =>
      index === 0 ? selectedVisibleGallery.length - 1 : index - 1,
    )
  }

  function showNextProductImage() {
    if (selectedVisibleGallery.length <= 1) return
    setSelectedImageIndex((index) =>
      index + 1 >= selectedVisibleGallery.length ? 0 : index + 1,
    )
  }

  const setSelectedSize = (size: string) => {
    setSelectedSizeState(size)
    setCopyState("idle")
  }

  const addProductToCart = (product: CatalogProduct, size: string) => {
    setCartLines((lines) =>
      addOrIncrementCartLine(lines, product, size),
    )
    setCheckoutResult({
      status: "idle",
      message: "",
      orderIds: [],
      paymentUrl: null,
    })
    setCartOpen(true)
  }

  const addSelectedToCart = () => {
    if (!selectedProduct || !selectedSize) return
    addProductToCart(selectedProduct, selectedSize)
  }

  const openCart = () => setCartOpen(true)
  const closeCart = () => setCartOpen(false)
  const removeCartLine = (id: string) => {
    setCartLines((lines) => lines.filter((line) => line.id !== id))
  }
  const setCartLineQuantity = (id: string, quantity: number) => {
    setCartLines((lines) => updateCartQuantity(lines, id, quantity))
  }
  const updateCheckoutCustomer = (
    field: keyof CheckoutCustomer,
    value: string,
  ) => {
    setCheckoutCustomer((customer) => ({ ...customer, [field]: value }))
  }
  const updateCheckoutConsent = (
    field: keyof CheckoutConsents,
    value: boolean,
  ) => {
    setCheckoutConsents((consents) => ({ ...consents, [field]: value }))
  }

  const submitCartCheckout = async () => {
    if (cartLines.length === 0) return
    if (!checkoutConsents.offerAccepted || !checkoutConsents.personalDataAccepted) {
      setCheckoutResult({
        status: "failed",
        message: "Подтвердите условия оферты и обработки персональных данных.",
        orderIds: [],
        paymentUrl: null,
      })
      return
    }
    setCheckoutResult({
      status: "submitting",
      message: "Создаём заказ и готовим оплату...",
      orderIds: [],
      paymentUrl: null,
    })

    const intentSignature = checkoutIntentSignature(cartLines, checkoutCustomer)
    if (
      checkoutAttemptRef.current === null ||
      checkoutAttemptRef.current.signature !== intentSignature
    ) {
      checkoutAttemptRef.current = {
        signature: intentSignature,
        key: createCheckoutIdempotencyKey(),
      }
    }
    const idempotencyKey = checkoutAttemptRef.current.key

    const trySubmit = async (lookup: Record<string, number> | null, version: string) =>
      submitCheckout(
        apiBaseUrl,
        cartLines,
        checkoutCustomer,
        checkoutConsents,
        idempotencyKey,
        lookup,
        version,
      )

    try {
      const firstResult = await trySubmit(
        catalogPriceState.lookup,
        catalogPriceState.version,
      )
      setCheckoutResult({
        status: "created",
        message: firstResult.message,
        orderIds: firstResult.order_ids,
        paymentUrl: firstResult.payment_url,
      })
      if (firstResult.payment_url) {
        window.location.assign(firstResult.payment_url)
      }
    } catch (error) {
      if (isCheckoutApiError(error) && error.status === 409) {
        const refreshed = await refreshCatalogPrices()
        if (!refreshed) {
          setCheckoutResult({
            status: "failed",
            message: error.message || "Цена обновилась. Обновите страницу и повторите попытку.",
            orderIds: [],
            paymentUrl: null,
          })
          return
        }
        const fallbackLookup = refreshed?.lookup ?? catalogPriceState.lookup
        const fallbackVersion = refreshed?.version || catalogPriceState.version
        setCheckoutResult({
          status: "submitting",
          message: "Цена обновлена, повторно отправляем заказ...",
          orderIds: [],
          paymentUrl: null,
        })

        try {
          const retryResult = await trySubmit(fallbackLookup, fallbackVersion)
          setCheckoutResult({
            status: "created",
            message: retryResult.message,
            orderIds: retryResult.order_ids,
            paymentUrl: retryResult.payment_url,
          })
          if (retryResult.payment_url) {
            window.location.assign(retryResult.payment_url)
          }
          return
        } catch (retryError) {
          setCheckoutResult({
            status: "failed",
            message:
              retryError instanceof Error
                ? retryError.message
                : "Не удалось создать заказ. Попробуйте ещё раз.",
            orderIds: [],
            paymentUrl: null,
          })
          return
        }
      }

      setCheckoutResult({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось создать заказ. Попробуйте ещё раз.",
        orderIds: [],
        paymentUrl: null,
      })
    }
  }

  const copyRequest = async () => {
    const copied = await copyOrderRequest(request)
    setCopyState(copied ? "copied" : "failed")
  }

  return {
    botUsername,
    botUrl,
    category,
    search,
    sort,
    taskInput,
    heroProducts,
    catalogPriceState,
    filteredProducts,
    selectedProduct,
    selectedImage,
    selectedImageIndex,
    selectedImageDisplayIndex,
    selectedVisibleGallery,
    selectedSize,
    selectedSizeOptions,
    selectedProductPrice,
    cartLines,
    cartCount,
    cartTotalRub: currentCartTotalRub,
    isCartOpen,
    checkoutCustomer,
    checkoutConsents,
    checkoutResult,
    request,
    copyState,
    taskMatches,
    sheetHeadingRef,
    selectCategory,
    setSearchValue,
    selectSort,
    applyQuickFilter,
    resetCatalog,
    setTaskInput,
    openProduct,
    closeProduct,
    selectProductImage,
    showPreviousProductImage,
    showNextProductImage,
    setSelectedSize,
    addProductToCart,
    addSelectedToCart,
    openCart,
    closeCart,
    removeCartLine,
    setCartLineQuantity,
    updateCheckoutCustomer,
    updateCheckoutConsent,
    submitCartCheckout,
    refreshPersonalDataConsentVersion,
    copyRequest,
  }
}
