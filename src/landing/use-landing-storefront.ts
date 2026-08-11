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
  LivePoizonOffer,
  LivePoizonPriceBreakdown,
  LivePoizonProduct,
  StorefrontState,
  UrlState,
} from "./landing-types"

export type LandingStorefront = StorefrontState

const LIVE_SEARCH_UNAVAILABLE =
  "Живая цена Poizon сейчас недоступна. Статический каталог не подменяет цену или наличие поставщика."

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
    typeof breakdown.purchase_rub === "number" &&
    typeof breakdown.conversion_fee === "number" &&
    typeof breakdown.first_six_percent_fee === "number" &&
    typeof breakdown.service_markup === "number" &&
    typeof breakdown.final_six_percent_fee === "number" &&
    typeof breakdown.delivery_rub === "number" &&
    typeof breakdown.total_rub === "number" &&
    typeof breakdown.markup_tier === "string"
  )
}

function isLiveOffer(value: unknown): value is LivePoizonOffer {
  if (!value || typeof value !== "object") return false
  const offer = value as Record<string, unknown>
  return (
    typeof offer.sku_id === "string" &&
    typeof offer.size === "string" &&
    offer.currency === "CNY" &&
    typeof offer.price_cny === "number" &&
    typeof offer.quote_rub === "number" &&
    typeof offer.rf_delivery === "number" &&
    (typeof offer.total_rub === "number" || offer.total_rub === null) &&
    (offer.price_breakdown === null || isPriceBreakdown(offer.price_breakdown))
  )
}

function isLiveProduct(value: unknown): value is LivePoizonProduct {
  if (!value || typeof value !== "object") return false
  const product = value as Record<string, unknown>
  return (
    product.provider_source === "poizon_batch_sync_api" &&
    typeof product.provider_product_id === "string" &&
    (typeof product.brand === "string" || product.brand === null) &&
    typeof product.name === "string" &&
    (typeof product.article === "string" || product.article === null) &&
    (product.kind === "footwear" || product.kind === "apparel" || product.kind === "accessory") &&
    Array.isArray(product.offers) &&
    product.offers.every(isLiveOffer) &&
    typeof product.yuan_rate === "number"
  )
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
    "idle" | "loading" | "ready" | "unavailable"
  >("idle")
  const [liveSearchResults, setLiveSearchResults] = useState<LivePoizonProduct[]>([])
  const [liveSearchMessage, setLiveSearchMessage] = useState<string | null>(null)
  const productTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sheetHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const liveSearchAbortRef = useRef<AbortController | null>(null)
  const liveSearchRequestIdRef = useRef(0)

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
  const selectedProductPrice = selectedProduct
    ? getDisplayPrice(selectedProduct)
    : null
  const selectedSizeOptions = selectedProduct ? getSizeOptions(selectedProduct) : []
  const selectedImageDisplayIndex =
    selectedVisibleGallery.length === 0 ? 0 : selectedImageIndex + 1
  const filteredProducts = useMemo(
    () => sortCatalog(filterCatalog(catalogProducts, category, search), sort),
    [category, search, sort],
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
    () => findTaskMatches(catalogProducts, taskInput).slice(0, 3),
    [taskInput],
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
    }
  }

  const submitLiveSearch = useCallback(async () => {
    const query = liveSearchQuery.trim().replace(/\s+/g, " ")
    const endpoint = crmSearchEndpoint()
    if (query.length < 2) {
      setLiveSearchResults([])
      setLiveSearchStatus("unavailable")
      setLiveSearchMessage("Введите название или артикул минимум из двух символов.")
      return
    }
    if (!endpoint) {
      setLiveSearchResults([])
      setLiveSearchStatus("unavailable")
      setLiveSearchMessage(LIVE_SEARCH_UNAVAILABLE)
      return
    }

    liveSearchAbortRef.current?.abort()
    const controller = new AbortController()
    liveSearchAbortRef.current = controller
    const requestId = liveSearchRequestIdRef.current + 1
    liveSearchRequestIdRef.current = requestId
    setLiveSearchResults([])
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
      const results = Array.isArray(data?.results) ? data.results.filter(isLiveProduct) : []
      if (response.ok && data?.status === "ready" && results.length > 0) {
        setLiveSearchResults(results)
        setLiveSearchStatus("ready")
        return
      }
      setLiveSearchResults([])
      setLiveSearchStatus("unavailable")
      setLiveSearchMessage(
        typeof data?.clarification === "string" && data.clarification.trim()
          ? data.clarification
          : LIVE_SEARCH_UNAVAILABLE,
      )
    } catch {
      if (controller.signal.aborted || requestId !== liveSearchRequestIdRef.current) return
      setLiveSearchResults([])
      setLiveSearchStatus("unavailable")
      setLiveSearchMessage(LIVE_SEARCH_UNAVAILABLE)
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
