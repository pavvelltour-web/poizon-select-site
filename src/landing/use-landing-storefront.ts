import { useEffect, useMemo, useRef, useState } from "react"

import {
  publicCatalogProducts,
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
  const [cartLines, setCartLines] = useState<CartLine[]>([])
  const [isCartOpen, setCartOpen] = useState(false)
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
  const productTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sheetHeadingRef = useRef<HTMLHeadingElement | null>(null)

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
    ? getDisplayPrice(selectedProduct)
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
  const taskMatches = useMemo(
    () => findTaskMatches(publicCatalogProducts, taskInput).slice(0, 3),
    [taskInput],
  )
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0)
  const currentCartTotalRub = cartTotalRub(cartLines)

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

  useEffect(() => {
    setCartLines(loadCart(publicCatalogProducts))
  }, [])

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

  const addSelectedToCart = () => {
    if (!selectedProduct || !selectedSize) return
    setCartLines((lines) =>
      addOrIncrementCartLine(lines, selectedProduct, selectedSize),
    )
    setCheckoutResult({
      status: "idle",
      message: "",
      orderIds: [],
      paymentUrl: null,
    })
    setCartOpen(true)
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
        message: "Подтвердите условия оферты и обработку персональных данных.",
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
    try {
      const result = await submitCheckout(
        apiBaseUrl,
        cartLines,
        checkoutCustomer,
        checkoutConsents,
      )
      setCheckoutResult({
        status: "created",
        message: result.message,
        orderIds: result.order_ids,
        paymentUrl: result.payment_url,
      })
      if (result.payment_url) {
        window.location.assign(result.payment_url)
      }
    } catch (error) {
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
    addSelectedToCart,
    openCart,
    closeCart,
    removeCartLine,
    setCartLineQuantity,
    updateCheckoutCustomer,
    updateCheckoutConsent,
    submitCartCheckout,
    copyRequest,
  }
}
