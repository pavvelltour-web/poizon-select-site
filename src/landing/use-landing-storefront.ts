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
  fetchCatalogRecommendations,
  fetchCheckoutCatalog,
  loadCart,
  reconcileCartLines,
  saveCart,
  submitCheckout,
  isCheckoutApiError,
  updateCartQuantity,
  type CheckoutConsents,
  type CheckoutCustomer,
  type CheckoutDelivery,
  type CheckoutResult,
  type CartLine,
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
  heroProductSlugs,
  isCategory,
  isSort,
  readUrlState,
} from "./landing-data"
import type { ActiveCategory, StorefrontState, UrlState } from "./landing-types"

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
    error: null as string | null,
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
  const selectedSizeOptions = selectedProduct
    ? catalogPriceState.items[selectedProduct.slug]?.availability === "catalog_listed"
      ? catalogPriceState.items[selectedProduct.slug]?.sizes ?? []
      : []
    : []
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

  const refreshCatalogPrices = async (signal?: AbortSignal) => {
    try {
      const nextPriceState = await fetchCheckoutCatalog(apiBaseUrl, signal)
      setCatalogPriceState({
        status: "ready",
        lookup: nextPriceState.lookup,
        items: nextPriceState.items,
        version: nextPriceState.version,
        personalDataConsentVersion: nextPriceState.personalDataConsentVersion,
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
    const controller = new AbortController()
    void refreshCatalogPrices(controller.signal)
    return () => controller.abort()
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
        const recommendations = await fetchCatalogRecommendations(
          apiBaseUrl,
          query,
          controller.signal,
        )
        const matches = recommendations
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

  const addProductToCart = (product: CatalogProduct, size: string) => {
    const offer = catalogPriceState.items[product.slug]
    if (
      catalogPriceState.status !== "ready" ||
      !offer ||
      offer.availability !== "catalog_listed" ||
      !offer.sizes.includes(size)
    ) {
      setCheckoutResult(
        emptyCheckoutResult(
          "failed",
          catalogPriceState.status === "loading"
            ? "Проверяем цену и размеры на сервере. Добавление станет доступно после загрузки каталога."
            : "Этот товар или размер сейчас не опубликован для заказа.",
        ),
      )
      setCartOpen(true)
      return
    }
    setCartLines((lines) => addOrIncrementCartLine(lines, product, size, "valid"))
    setCheckoutResult(emptyCheckoutResult("idle", ""))
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
      cartLines.some((line) => line.validation !== "valid")
    ) {
      setCheckoutResult(
        emptyCheckoutResult(
          "failed",
          "Заказ заблокирован: цена, товар и размер должны быть подтверждены серверным каталогом.",
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
    checkoutDelivery,
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
    updateCheckoutDelivery,
    updateCheckoutConsent,
    submitCartCheckout,
    refreshPersonalDataConsentVersion,
    copyRequest,
  }
}
