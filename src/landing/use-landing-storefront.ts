import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  catalogProducts,
  filterCatalog,
  findProductBySlug,
  sortCatalog,
  type CatalogSort,
  type CatalogProduct,
} from "../catalog/catalog"
import {
  fetchVerifiedCatalogPrices,
  type VerifiedCatalogPrice,
} from "./catalog-price-api"
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
import type {
  ActiveCategory,
  LivePoizonClarificationOption,
  LivePoizonOffer,
  LivePoizonPriceBreakdown,
  LivePoizonProduct,
  StorefrontState,
  UrlState,
} from "./landing-types"

export type LandingStorefront = StorefrontState

const LIVE_SEARCH_UNAVAILABLE =
  "Сейчас не удалось получить актуальную цену. Каталог не подменяет цену или наличие."
const LIVE_SEARCH_CLARIFICATION_FALLBACK = "Уточните модель или артикул."
const MAX_LIVE_QUOTE_AGE_MS = 12 * 60 * 60 * 1000
const MAX_FUTURE_OBSERVED_SKEW_MS = 5 * 60 * 1000
const PUBLIC_REFERENCE_PATTERN = /^[a-f0-9]{16,64}$/
const PROVIDER_NAME_PATTERN = /poizon|poison|пойзон|поизон|пойсон/iu
const HAN_CHARACTER_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u
const MAX_RUB_PRICE = 10_000_000

function crmSearchEndpoint(): string | null {
  // VITE_* values are public. Keep this same-origin so browsers call the CRM
  // reverse proxy only, never the Batch Sync provider directly.
  const configured = (import.meta.env.VITE_CRM_API_BASE_URL || "/api").trim()
  if (!configured.startsWith("/") || configured.startsWith("//")) return null
  return `${configured.replace(/\/+$/, "") || "/api"}/catalog/search`
}

function isPriceBreakdown(value: unknown): value is LivePoizonPriceBreakdown {
  if (!value || typeof value !== "object") return false
  const breakdown = value as Record<string, unknown>
  return (
    validRubAmount(breakdown.purchase_rub) &&
    validRubAmount(breakdown.conversion_fee, true) &&
    validRubAmount(breakdown.first_six_percent_fee, true) &&
    validRubAmount(breakdown.service_markup, true) &&
    validRubAmount(breakdown.final_six_percent_fee, true) &&
    validRubAmount(breakdown.delivery_rub, true) &&
    validRubAmount(breakdown.total_rub) &&
    isPublicText(breakdown.markup_tier, 1, 80)
  )
}

function validRubAmount(value: unknown, allowZero = false): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= (allowZero ? 0 : 0.01) &&
    value <= MAX_RUB_PRICE
  )
}

function validCnyAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 100_000
}

function isSafeText(value: unknown, minimum: number, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minimum &&
    value.length <= maximum &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    !PROVIDER_NAME_PATTERN.test(value)
  )
}

function isPublicText(value: unknown, minimum: number, maximum: number): value is string {
  return isSafeText(value, minimum, maximum) && !HAN_CHARACTER_PATTERN.test(value)
}

function isOptionalPublicText(value: unknown, maximum: number): value is string | null {
  return value === null || (typeof value === "string" && isPublicText(value, 1, maximum))
}

function isOptionalSafeText(value: unknown, maximum: number): value is string | null {
  return value === null || (typeof value === "string" && isSafeText(value, 1, maximum))
}

function isAllowedImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === "cdn.poizon.com" &&
      !url.username &&
      !url.password &&
      !url.port
    )
  } catch {
    return false
  }
}

function isCurrentLiveQuote(observedAt: unknown, expiresAt: unknown, nowMs: number): boolean {
  if (typeof observedAt !== "string" || typeof expiresAt !== "string") return false
  const observedMs = Date.parse(observedAt)
  const expiresMs = Date.parse(expiresAt)
  return (
    Number.isFinite(observedMs) &&
    Number.isFinite(expiresMs) &&
    observedMs <= nowMs + MAX_FUTURE_OBSERVED_SKEW_MS &&
    expiresMs > nowMs &&
    expiresMs > observedMs &&
    expiresMs - observedMs <= MAX_LIVE_QUOTE_AGE_MS
  )
}

function isLiveOffer(value: unknown): value is LivePoizonOffer {
  if (!value || typeof value !== "object") return false
  const offer = value as Record<string, unknown>
  return (
    typeof offer.offer_ref === "string" &&
    PUBLIC_REFERENCE_PATTERN.test(offer.offer_ref) &&
    isSafeText(offer.size, 1, 32) &&
    isSafeText(offer.eu, 0, 32) &&
    isSafeText(offer.ru, 0, 32) &&
    isSafeText(offer.us, 0, 32) &&
    isSafeText(offer.cn, 0, 32) &&
    (typeof offer.available === "boolean" || offer.available === null) &&
    validCnyAmount(offer.price_cny) &&
    validRubAmount(offer.quote_rub) &&
    validRubAmount(offer.rf_delivery, true) &&
    validRubAmount(offer.total_rub) &&
    isPriceBreakdown(offer.price_breakdown)
  )
}

function isLiveProduct(value: unknown, nowMs = Date.now()): value is LivePoizonProduct {
  if (!value || typeof value !== "object") return false
  const product = value as Record<string, unknown>
  const offers = Array.isArray(product.offers) ? product.offers : []
  const offerRefs = new Set<string>()
  const sizeLabels = new Set<string>()
  for (const offer of offers) {
    if (!isLiveOffer(offer)) return false
    if (offerRefs.has(offer.offer_ref) || sizeLabels.has(offer.size)) return false
    offerRefs.add(offer.offer_ref)
    sizeLabels.add(offer.size)
  }
  return (
    typeof product.product_ref === "string" &&
    PUBLIC_REFERENCE_PATTERN.test(product.product_ref) &&
    isOptionalPublicText(product.brand, 120) &&
    isPublicText(product.name, 2, 240) &&
    isOptionalPublicText(product.article, 160) &&
    isOptionalSafeText(product.color, 160) &&
    (product.kind === "footwear" || product.kind === "apparel" || product.kind === "accessory") &&
    isPublicText(product.description, 2, 3_000) &&
    Array.isArray(product.images) &&
    product.images.length > 0 &&
    product.images.length <= 12 &&
    product.images.every(isAllowedImageUrl) &&
    (typeof product.in_stock === "boolean" || product.in_stock === null) &&
    isOptionalSafeText(product.size_context, 320) &&
    isOptionalSafeText(product.size_chart, 2_000) &&
    (product.size_image === null || isAllowedImageUrl(product.size_image)) &&
    offers.length > 0 &&
    isCurrentLiveQuote(product.observed_at, product.expires_at, nowMs)
  )
}

function parseLiveProducts(value: unknown, nowMs = Date.now()): LivePoizonProduct[] {
  if (!Array.isArray(value)) return []
  const products: LivePoizonProduct[] = []
  const references = new Set<string>()
  const ambiguousReferences = new Set<string>()
  for (const item of value) {
    if (!isLiveProduct(item, nowMs) || ambiguousReferences.has(item.product_ref)) continue
    if (references.has(item.product_ref)) {
      const duplicateIndex = products.findIndex((product) => product.product_ref === item.product_ref)
      if (duplicateIndex >= 0) products.splice(duplicateIndex, 1)
      references.delete(item.product_ref)
      ambiguousReferences.add(item.product_ref)
      continue
    }
    references.add(item.product_ref)
    products.push(item)
    if (products.length === 4) break
  }
  return products
}

function isLiveClarificationOption(value: unknown): value is LivePoizonClarificationOption {
  if (!value || typeof value !== "object") return false
  const option = value as Record<string, unknown>
  return isPublicText(option.label, 1, 80) && isPublicText(option.query, 2, 160)
}

function parseLiveClarificationOptions(value: unknown): LivePoizonClarificationOption[] {
  if (!Array.isArray(value)) return []
  const seenQueries = new Set<string>()
  return value
    .filter(isLiveClarificationOption)
    .filter((option) => {
      if (seenQueries.has(option.query)) return false
      seenQueries.add(option.query)
      return true
    })
    .slice(0, 4)
}

function safeClarification(value: unknown): string {
  return isPublicText(value, 2, 320) ? value.trim() : LIVE_SEARCH_CLARIFICATION_FALLBACK
}

function sortStorefrontProducts(
  products: readonly CatalogProduct[],
  sort: CatalogSort,
  verifiedPrices: Readonly<Record<string, VerifiedCatalogPrice>>,
): CatalogProduct[] {
  if (sort !== "price-asc" && sort !== "price-desc") return sortCatalog(products, sort)

  return products
    .map((product, index) => ({ product, index, price: verifiedPrices[product.slug]?.totalRub }))
    .sort((left, right) => {
      const leftIsPriced = Number.isFinite(left.price)
      const rightIsPriced = Number.isFinite(right.price)
      if (leftIsPriced !== rightIsPriced) return leftIsPriced ? -1 : 1
      if (!leftIsPriced || !rightIsPriced) return left.index - right.index
      const delta = sort === "price-asc" ? left.price! - right.price! : right.price! - left.price!
      return delta || left.index - right.index
    })
    .map(({ product }) => product)
}

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
  const [liveSearchQuery, setLiveSearchQueryState] = useState("")
  const [liveSearchStatus, setLiveSearchStatus] = useState<
    "idle" | "loading" | "clarification" | "ready" | "unavailable"
  >("idle")
  const [liveSearchResults, setLiveSearchResults] = useState<LivePoizonProduct[]>([])
  const [liveSearchMessage, setLiveSearchMessage] = useState<string | null>(null)
  const [liveSearchClarificationOptions, setLiveSearchClarificationOptions] = useState<
    LivePoizonClarificationOption[]
  >([])
  const [verifiedCatalogPrices, setVerifiedCatalogPrices] = useState<
    Readonly<Record<string, VerifiedCatalogPrice>>
  >({})
  const [catalogPriceRefresh, setCatalogPriceRefresh] = useState(0)
  const productTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sheetHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const liveSearchAbortRef = useRef<AbortController | null>(null)
  const liveSearchRequestIdRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let refreshTimer: number | undefined
    void fetchVerifiedCatalogPrices(controller.signal).then((prices) => {
      if (controller.signal.aborted) return
      setVerifiedCatalogPrices(prices)

      const nextExpiryMs = Math.min(
        ...Object.values(prices)
          .map((price) => Date.parse(price.expiresAt))
          .filter(Number.isFinite),
      )
      if (!Number.isFinite(nextExpiryMs)) return
      refreshTimer = window.setTimeout(() => {
        // Never keep a visible amount after its server-verified window ends.
        setVerifiedCatalogPrices({})
        setCatalogPriceRefresh((current) => current + 1)
      }, Math.max(0, nextExpiryMs - Date.now()))
    })
    return () => {
      controller.abort()
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
    }
  }, [catalogPriceRefresh])

  const botUsername = resolveBotUsername(
    configuredBotUsername ?? import.meta.env.VITE_BOT_USERNAME,
  )
  const botUrl = buildTelegramBotUrl(botUsername)

  const selectedProduct = findProductBySlug(selectedSlug)
  const selectedVisibleGallery = selectedProduct?.gallery.slice(0, 5) ?? []
  const selectedImage =
    selectedVisibleGallery[selectedImageIndex] ??
    selectedVisibleGallery[0] ??
    (selectedProduct
      ? { src: selectedProduct.fallbackImage, alt: selectedProduct.name }
      : null)
  const getProductPrice = useCallback(
    (product: CatalogProduct) => getDisplayPrice(product, verifiedCatalogPrices[product.slug]),
    [verifiedCatalogPrices],
  )
  const selectedVerifiedPrice = selectedProduct
    ? verifiedCatalogPrices[selectedProduct.slug]
    : undefined
  const selectedSizeOffer =
    selectedProduct && selectedSize
      ? selectedVerifiedPrice?.sizeOffers[selectedSize]
      : undefined
  const selectedProductPrice = selectedProduct
    ? selectedSize
      ? getDisplayPrice(selectedProduct, selectedSizeOffer, "Цена размера", "")
      : getProductPrice(selectedProduct)
    : null
  const selectedSizeOptions = selectedProduct
    ? selectedVerifiedPrice
      ? Object.keys(selectedVerifiedPrice.sizeOffers)
      : getSizeOptions(selectedProduct)
    : []
  const selectedImageDisplayIndex =
    selectedVisibleGallery.length === 0 ? 0 : selectedImageIndex + 1
  const filteredProducts = useMemo(
    () =>
      sortStorefrontProducts(
        filterCatalog(catalogProducts, category, search),
        sort,
        verifiedCatalogPrices,
      ),
    [category, search, sort, verifiedCatalogPrices],
  )
  const heroProducts = useMemo(
    () =>
      heroProductSlugs
        .map((slug) => catalogProducts.find((product) => product.slug === slug))
        .filter((product): product is CatalogProduct => product !== undefined),
    [],
  )
  const request = selectedProduct
    ? buildOrderRequest(selectedProduct, selectedSize ?? undefined)
    : ""
  const taskMatches = useMemo(
    () => findTaskMatches(catalogProducts, taskInput, verifiedCatalogPrices).slice(0, 3),
    [taskInput, verifiedCatalogPrices],
  )

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

  useEffect(
    () => () => {
      liveSearchAbortRef.current?.abort()
    },
    [],
  )

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

  const setLiveSearchQuery = (query: string) => {
    setLiveSearchQueryState(query)
    if (liveSearchStatus !== "idle") {
      setLiveSearchStatus("idle")
      setLiveSearchMessage(null)
      setLiveSearchResults([])
      setLiveSearchClarificationOptions([])
    }
  }

  const submitLiveSearch = useCallback(async (queryOverride?: string) => {
    const query = (queryOverride ?? liveSearchQuery).trim().replace(/\s+/g, " ")
    if (queryOverride) setLiveSearchQueryState(query)
    const endpoint = crmSearchEndpoint()
    if (query.length < 2) {
      setLiveSearchResults([])
      setLiveSearchStatus("unavailable")
      setLiveSearchMessage("Введите название или артикул минимум из двух символов.")
      setLiveSearchClarificationOptions([])
      return
    }
    if (!endpoint) {
      setLiveSearchResults([])
      setLiveSearchStatus("unavailable")
      setLiveSearchMessage(LIVE_SEARCH_UNAVAILABLE)
      setLiveSearchClarificationOptions([])
      return
    }

    liveSearchAbortRef.current?.abort()
    const controller = new AbortController()
    liveSearchAbortRef.current = controller
    const requestId = liveSearchRequestIdRef.current + 1
    liveSearchRequestIdRef.current = requestId
    setLiveSearchResults([])
    setLiveSearchClarificationOptions([])
    setLiveSearchStatus("loading")
    setLiveSearchMessage(null)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "omit",
        signal: controller.signal,
        body: JSON.stringify({ query, limit: 4 }),
      })
      const payload: unknown = await response.json()
      if (requestId !== liveSearchRequestIdRef.current) return
      const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null
      const results = parseLiveProducts(data?.results)
      if (response.ok && data?.status === "ready" && results.length > 0) {
        setLiveSearchResults(results)
        setLiveSearchStatus("ready")
        return
      }
      if (response.ok && data?.status === "clarification") {
        setLiveSearchStatus("clarification")
        setLiveSearchMessage(safeClarification(data?.clarification))
        setLiveSearchClarificationOptions(parseLiveClarificationOptions(data?.clarification_options))
        return
      }
      setLiveSearchResults([])
      setLiveSearchStatus("unavailable")
      // Provider clarification is not public copy. Keep the customer-facing
      // message neutral and do not leak an upstream name or implementation.
      setLiveSearchMessage(LIVE_SEARCH_UNAVAILABLE)
    } catch {
      if (controller.signal.aborted || requestId !== liveSearchRequestIdRef.current) return
      setLiveSearchResults([])
      setLiveSearchStatus("unavailable")
      setLiveSearchMessage(LIVE_SEARCH_UNAVAILABLE)
      setLiveSearchClarificationOptions([])
    }
  }, [liveSearchQuery])

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
    liveSearchQuery,
    liveSearchStatus,
    liveSearchResults,
    liveSearchMessage,
    liveSearchClarificationOptions,
    heroProducts,
    filteredProducts,
    selectedProduct,
    selectedImage,
    selectedImageIndex,
    selectedImageDisplayIndex,
    selectedVisibleGallery,
    selectedSize,
    selectedSizeOptions,
    selectedProductPrice,
    getProductPrice,
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
    setLiveSearchQuery,
    submitLiveSearch,
    openProduct,
    closeProduct,
    selectProductImage,
    showPreviousProductImage,
    showNextProductImage,
    setSelectedSize,
    copyRequest,
  }
}
