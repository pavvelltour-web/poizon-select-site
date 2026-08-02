import { useEffect, useMemo, useRef, useState } from "react"

import {
  publicCatalogProducts,
  CATALOG_PRICE_VERSION,
  filterCatalog,
  findPublicProductBySlug,
  formatRub,
  sortCatalog,
  type CatalogSort,
  type CatalogProduct,
} from "../catalog/catalog"
import {
  addOrIncrementCartLine,
  buildProductSizeOffers,
  cartTotalRub,
  fetchCatalogSearch,
  fetchCheckoutCatalog,
  loadCart,
  reconcileCartLines,
  saveCart,
  submitCheckout,
  isCheckoutApiError,
  getPublishedSizeOffer,
  updateCartQuantity,
  type CheckoutConsents,
  type CheckoutCustomer,
  type CheckoutDelivery,
  type CheckoutResult,
  type CartLine,
  type CatalogSearchFallback,
  type PublishedCatalogMap,
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
  getProductPath,
  getSizeOptions,
  isCategory,
  isSort,
  readUrlState,
} from "./landing-data"
import type {
  ActiveCategory,
  CatalogSearchState,
  StorefrontState,
  UrlState,
} from "./landing-types"

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
  delivery: CheckoutDelivery,
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
    delivery,
  })
}

function emptyCatalogSearchState(): CatalogSearchState {
  return { status: "idle", response: null, fallback: [], error: null }
}

function catalogFallback(product: CatalogProduct): CatalogSearchFallback {
  return {
    source: "catalog",
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    image: product.image,
    navigationUrl: getProductPath(product),
    availability: "unverified",
  }
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
  const [catalogSearch, setCatalogSearch] = useState<CatalogSearchState>(
    emptyCatalogSearchState,
  )
  const [taskSearch, setTaskSearch] = useState<CatalogSearchState>(
    emptyCatalogSearchState,
  )
  const [selectedSizeOfferState, setSelectedSizeOfferState] = useState<{
    status: "idle" | "loading" | "ready" | "failed"
    productSlug: string | null
    result: import("./cart").CatalogSearchResult | null
    error: string | null
  }>({ status: "idle", productSlug: null, result: null, error: null })
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
  const [checkoutDelivery, setCheckoutDelivery] = useState<CheckoutDelivery>({
    method: "cdek_courier",
    city: "",
    postalCode: "",
    address: "",
    pvzCode: "",
  })
  const [checkoutConsents, setCheckoutConsents] = useState<CheckoutConsents>({
    offerAccepted: false,
    personalDataAccepted: false,
  })
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult>({
    status: "idle",
    message: "",
    orderNumber: null,
    orderIds: [],
    paymentUrl: null,
    amounts: null,
    delivery: null,
  })
  const [catalogPriceState, setCatalogPriceState] = useState({
    status: "loading" as "loading" | "ready" | "failed",
    lookup: null as Record<string, number> | null,
    items: {} as PublishedCatalogMap,
    version: CATALOG_PRICE_VERSION,
    personalDataConsentVersion: null as string | null,
    orderCreationEnabled: false,
    onlinePaymentEnabled: false,
    error: null as string | null,
  })
  const productTriggerRef = useRef<HTMLElement | null>(null)
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
  const selectedLiveResult = selectedProduct &&
    selectedSizeOfferState.productSlug === selectedProduct.slug
    ? selectedSizeOfferState.result
    : null
  const selectedSizeOffers = useMemo(
    () => selectedProduct
      ? buildProductSizeOffers(
        getSizeOptions(selectedProduct),
        selectedProduct.brand,
        selectedLiveResult,
        catalogPriceState.items[selectedProduct.slug],
      )
      : [],
    [catalogPriceState.items, selectedLiveResult, selectedProduct],
  )
  const selectedSizeOptions = selectedSizeOffers
    .filter((offer) => offer.available)
    .map((offer) => offer.sizeEu)
  const selectedLiveOffer = selectedSize
    ? selectedSizeOffers.find((offer) => offer.sizeEu === selectedSize) ?? null
    : null
  const liveDisplayPrice = selectedLiveOffer?.priceRub ?? Math.min(
    ...selectedSizeOffers.flatMap((offer) => offer.priceRub ? [offer.priceRub] : []),
  )
  const selectedProductPrice = selectedProduct
    ? Number.isFinite(liveDisplayPrice)
      ? {
        label: selectedLiveOffer ? "Цена размера" : "Цена от",
        value: formatRub(liveDisplayPrice),
        detail: "СДЭК рассчитывается отдельно",
      }
      : getDisplayPrice(selectedProduct, catalogPriceState.lookup)
    : null
  const selectedImageDisplayIndex =
    selectedVisibleGallery.length === 0 ? 0 : selectedImageIndex + 1
  const filteredProducts = useMemo(
    () => sortCatalog(filterCatalog(publicCatalogProducts, category, search), sort),
    [category, search, sort],
  )
  const request = selectedProduct
    ? buildOrderRequest(selectedProduct, selectedSize ?? undefined)
    : ""
  const catalogFallbacks = useMemo(
    () =>
      sortCatalog(filterCatalog(publicCatalogProducts, category, search), sort)
        .slice(0, 4)
        .map(catalogFallback),
    [category, search, sort],
  )
  const taskFallbacks = useMemo(
    () =>
      findTaskMatches(publicCatalogProducts, taskInput)
        .slice(0, 4)
        .map((match) => catalogFallback(match.product)),
    [taskInput],
  )
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0)
  const currentCartTotalRub = cartTotalRub(
    cartLines,
    catalogPriceState.lookup,
    catalogPriceState.items,
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

  const refreshCatalogPrices = async (signal?: AbortSignal) => {
    try {
      const nextPriceState = await fetchCheckoutCatalog(apiBaseUrl, signal)
      setCatalogPriceState({
        status: "ready",
        lookup: nextPriceState.lookup,
        items: nextPriceState.items,
        version: nextPriceState.version,
        personalDataConsentVersion: nextPriceState.personalDataConsentVersion,
        orderCreationEnabled: nextPriceState.orderCreationEnabled,
        onlinePaymentEnabled: nextPriceState.onlinePaymentEnabled,
        error: null,
      })
      setCartLines((lines) => reconcileCartLines(lines, nextPriceState.items))
      return nextPriceState
    } catch (error) {
      if (signal?.aborted) return null
      setCatalogPriceState((current) => ({
        ...current,
        status: "failed",
        lookup: null,
        items: {},
        orderCreationEnabled: false,
        onlinePaymentEnabled: false,
        error: error instanceof Error ? error.message : "Каталог заказа недоступен.",
      }))
      setCartLines((lines) => lines.map((line) => ({ ...line, validation: "pending" })))
      return null
    }
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
    setCopyState("idle")
  }, [selectedSlug])

  useEffect(() => {
    setCartLines(loadCart(publicCatalogProducts))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refreshCatalogPrices(controller.signal)
    return () => controller.abort()
  }, [apiBaseUrl])

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedSizeOfferState({
        status: "idle",
        productSlug: null,
        result: null,
        error: null,
      })
      return
    }

    setSelectedSizeOfferState({
      // The product sheet uses server-owned checkout offers.  It must not
      // trigger a supplier lookup just because a customer opens a card.
      status: "ready",
      productSlug: selectedProduct.slug,
      result: null,
      error: null,
    })
  }, [selectedProduct])

  useEffect(() => {
    if (!["ready", "failed"].includes(selectedSizeOfferState.status)) return
    setSelectedSizeState((current) => current && selectedSizeOffers.some(
      (offer) => offer.available && offer.sizeEu === current,
    ) ? current : null)
  }, [selectedSizeOfferState.status, selectedSizeOffers])

  useEffect(() => {
    const query = search.trim()
    if (query.length < 2) {
      setCatalogSearch(emptyCatalogSearchState())
      return
    }

    const controller = new AbortController()
    setCatalogSearch({ status: "loading", response: null, fallback: [], error: null })
    const timer = window.setTimeout(() => {
      void fetchCatalogSearch(apiBaseUrl, query, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return
          setCatalogSearch({
            status: "ready",
            response,
            fallback:
              response.status === "catalog" || response.status === "unavailable"
                ? response.fallback.length > 0
                  ? response.fallback
                  : response.status === "unavailable"
                    ? catalogFallbacks
                    : []
                : [],
            error: null,
          })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          setCatalogSearch({
            status: "failed",
            response: null,
            fallback: catalogFallbacks,
            error: error instanceof Error ? error.message : "Поиск временно недоступен.",
          })
        })
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [apiBaseUrl, catalogFallbacks, search])

  useEffect(() => {
    const query = taskInput.trim()
    if (query.length < 2) {
      setTaskSearch(emptyCatalogSearchState())
      return
    }

    const controller = new AbortController()
    setTaskSearch({ status: "loading", response: null, fallback: [], error: null })
    const timer = window.setTimeout(() => {
      void fetchCatalogSearch(apiBaseUrl, query, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return
          setTaskSearch({
            status: "ready",
            response,
            fallback:
              response.status === "catalog" || response.status === "unavailable"
                ? response.fallback.length > 0
                  ? response.fallback
                  : response.status === "unavailable"
                    ? taskFallbacks
                    : []
                : [],
            error: null,
          })
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          setTaskSearch({
            status: "failed",
            response: null,
            fallback: taskFallbacks,
            error: error instanceof Error ? error.message : "Поиск временно недоступен.",
          })
        })
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [apiBaseUrl, taskFallbacks, taskInput])

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

  const openProduct = (product: CatalogProduct, trigger: HTMLElement, preferredSize?: string) => {
    productTriggerRef.current = trigger
    setSelectedSlug(product.slug)
    setSelectedSizeState(preferredSize ?? null)
  }

  function closeProduct() {
    setSelectedSlug(null)
    setSelectedSizeState(null)
    if (/^\/product\/[^/]+\/?$/u.test(window.location.pathname)) {
      window.history.pushState(null, "", "/")
      window.dispatchEvent(new PopStateEvent("popstate"))
    }
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
    if (!selectedSizeOffers.some((offer) => offer.available && offer.sizeEu === size)) return
    setSelectedSizeState(size)
    setCopyState("idle")
  }

  const emptyCheckoutResult = (
    status: CheckoutResult["status"],
    message: string,
  ): CheckoutResult => ({
    status,
    message,
    orderNumber: null,
    orderIds: [],
    paymentUrl: null,
    amounts: null,
    delivery: null,
  })

  const addProductToCart = (
    product: CatalogProduct,
    size: string,
    openAfterAdd = true,
  ) => {
    const offer = catalogPriceState.items[product.slug]
    const confirmedSizeOffer = getPublishedSizeOffer(offer, size)
    if (
      catalogPriceState.status !== "ready" ||
      !offer ||
      offer.availability !== "catalog_listed" ||
      !confirmedSizeOffer
    ) {
      setCheckoutResult(
        emptyCheckoutResult(
          "failed",
          catalogPriceState.status === "loading"
            ? "Проверяем цену и размеры на сервере. Добавление станет доступно после загрузки каталога."
            : "Live-цена размера ещё не подтверждена сервером заказа. Отправьте запрос менеджеру.",
        ),
      )
      setCartOpen(openAfterAdd)
      return
    }
    if (!catalogPriceState.orderCreationEnabled) {
      setCheckoutResult(
        emptyCheckoutResult(
          "failed",
          "Оформление заказа временно недоступно. Цена и карточка товара остаются видны.",
        ),
      )
      setCartOpen(openAfterAdd)
      return
    }
    setCartLines((lines) => addOrIncrementCartLine(lines, product, size, "valid"))
    setCheckoutResult(emptyCheckoutResult("idle", ""))
    setCartOpen(openAfterAdd)
  }

  const addSelectedToCart = () => {
    if (!selectedProduct || !selectedSize) return
    addProductToCart(selectedProduct, selectedSize, false)
  }

  const openCart = () => {
    setSelectedSlug(null)
    setSelectedSizeState(null)
    setCartOpen(true)
  }
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
  ) => setCheckoutCustomer((customer) => ({ ...customer, [field]: value }))
  const updateCheckoutDelivery = (
    field: keyof CheckoutDelivery,
    value: string,
  ) => {
    setCheckoutDelivery((delivery) => ({ ...delivery, [field]: value }))
    checkoutAttemptRef.current = null
  }
  const updateCheckoutConsent = (
    field: keyof CheckoutConsents,
    value: boolean,
  ) => setCheckoutConsents((consents) => ({ ...consents, [field]: value }))

  const submitCartCheckout = async () => {
    if (cartLines.length === 0) return
    if (
      catalogPriceState.status !== "ready" ||
      !catalogPriceState.orderCreationEnabled ||
      cartLines.some((line) => line.validation !== "valid")
    ) {
      setCheckoutResult(
        emptyCheckoutResult(
          "failed",
          catalogPriceState.status === "ready" &&
            !catalogPriceState.orderCreationEnabled
            ? "Оформление заказа временно отключено. Попробуйте позже."
            : "Заказ заблокирован: цена, товар и размер должны быть подтверждены серверным каталогом.",
        ),
      )
      return
    }
    if (!checkoutConsents.offerAccepted || !checkoutConsents.personalDataAccepted) {
      setCheckoutResult(
        emptyCheckoutResult(
          "failed",
          "Подтвердите условия оферты и обработку персональных данных.",
        ),
      )
      return
    }

    const city = checkoutDelivery.city.trim()
    const postalCode = checkoutDelivery.postalCode.trim()
    const destination = checkoutDelivery.method === "cdek_pvz"
      ? checkoutDelivery.pvzCode.trim()
      : checkoutDelivery.address.trim()
    if (city.length < 2 || !/^\d{6}$/.test(postalCode) || !destination) {
      setCheckoutResult(
        emptyCheckoutResult(
          "failed",
          checkoutDelivery.method === "cdek_pvz"
            ? "Укажите город, шестизначный индекс и код пункта СДЭК."
            : "Укажите город, шестизначный индекс и адрес доставки.",
        ),
      )
      return
    }

    setCheckoutResult(emptyCheckoutResult("submitting", "Создаём заказ и рассчитываем СДЭК…"))
    const intentSignature = checkoutIntentSignature(
      cartLines,
      checkoutCustomer,
      checkoutDelivery,
    )
    if (
      checkoutAttemptRef.current === null ||
      checkoutAttemptRef.current.signature !== intentSignature
    ) {
      checkoutAttemptRef.current = {
        signature: intentSignature,
        key: createCheckoutIdempotencyKey(),
      }
    }

    try {
      const result = await submitCheckout(
        apiBaseUrl,
        cartLines,
        checkoutCustomer,
        checkoutConsents,
        checkoutDelivery,
        checkoutAttemptRef.current.key,
        catalogPriceState.items,
        catalogPriceState.version,
      )
      setCheckoutResult({
        status: "created",
        message: result.message,
        orderNumber: result.orderNumber,
        orderIds: result.orderIds,
        paymentUrl: result.paymentUrl,
        amounts: result.amounts,
        delivery: result.delivery,
      })
      setCartOpen(false)
    } catch (error) {
      if (isCheckoutApiError(error) && error.status === 409) {
        await refreshCatalogPrices()
        checkoutAttemptRef.current = null
      }
      setCheckoutResult(
        emptyCheckoutResult(
          "failed",
          error instanceof Error
            ? error.message
            : "Не удалось создать заказ. Проверьте данные и попробуйте ещё раз.",
        ),
      )
    }
  }

  const copyRequest = async () => {
    const copied = await copyOrderRequest(request)
    setCopyState(copied ? "copied" : "failed")
  }

  const closePayment = () => {
    setCheckoutResult(emptyCheckoutResult("idle", ""))
  }

  return {
    botUsername,
    botUrl,
    category,
    search,
    sort,
    taskInput,
    catalogPriceState,
    filteredProducts,
    selectedProduct,
    selectedImage,
    selectedImageIndex,
    selectedImageDisplayIndex,
    selectedVisibleGallery,
    selectedSize,
    selectedSizeOptions,
    selectedSizeOffers,
    selectedSizeOfferStatus: selectedSizeOfferState.status,
    selectedSizeOfferError: selectedSizeOfferState.error,
    selectedProductPrice,
    cartLines,
    cartCount,
    cartTotalRub: currentCartTotalRub,
    isCartOpen,
    checkoutCustomer,
    checkoutDelivery,
    checkoutConsents,
    checkoutResult,
    request,
    copyState,
    catalogSearch,
    taskSearch,
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
    closePayment,
    removeCartLine,
    setCartLineQuantity,
    updateCheckoutCustomer,
    updateCheckoutDelivery,
    updateCheckoutConsent,
    submitCartCheckout,
    refreshPersonalDataConsentVersion,
    copyRequest,
  }
}
