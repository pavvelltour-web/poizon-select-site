import type { CatalogCategory, CatalogProduct, CatalogSort } from "../catalog/catalog"
import type { RefObject } from "react"
import type {
  CartLine,
  CheckoutDelivery,
  CheckoutConsents,
  CheckoutCustomer,
  CheckoutResult,
  CatalogSearchFallback,
  CatalogSearchResponse,
  CatalogPriceMap,
  ProductSizeOffer,
  PublishedCatalogMap,
} from "./cart"

export type ActiveCategory = "all" | CatalogCategory

export interface UrlState {
  category: ActiveCategory
  search: string
  sort: CatalogSort
  productSlug: string | null
  cartOpen: boolean
}

export interface DisplayPrice {
  label: string
  value: string
  detail: string
}

export interface CatalogPriceState {
  status: "loading" | "ready" | "failed"
  lookup: CatalogPriceMap | null
  items: PublishedCatalogMap
  version: string
  personalDataConsentVersion: string | null
  orderCreationEnabled: boolean
  onlinePaymentEnabled: boolean
  error: string | null
}

export interface TaskMatch {
  product: CatalogProduct
  score: number
  reason: string
}

export interface CatalogSearchState {
  status: "idle" | "loading" | "ready" | "failed"
  response: CatalogSearchResponse | null
  fallback: readonly CatalogSearchFallback[]
  error: string | null
}

export type CopyState = "idle" | "copied" | "failed"

export type LivePoizonSearchStatus = "idle" | "loading" | "ready" | "unavailable"

/** Customer-safe data from the verified Batch Sync quote. */
export interface LivePoizonPriceBreakdown {
  purchase_rub: number
  conversion_fee: number
  first_six_percent_fee: number
  service_markup: number
  final_six_percent_fee: number
  delivery_rub: number
  total_rub: number
  markup_tier: string
}

export interface LivePoizonOffer {
  size: string
  eu: string | null
  ru: string | null
  us: string | null
  cn: string | null
  available: boolean | null
  quote_rub: number
  rf_delivery: number
  total_rub: number
  price_breakdown: LivePoizonPriceBreakdown | null
}

export interface LivePoizonProduct {
  product_ref: string
  brand: string | null
  name: string
  article: string | null
  color: string | null
  kind: "footwear" | "apparel" | "accessory"
  description: string | null
  images: string[]
  offers: LivePoizonOffer[]
  observed_at: string
  expires_at: string
}

export interface StorefrontPoizonPrice {
  slug: string
  source_query: string
  product_name: string
  total_rub: number
  observed_at: string
  expires_at: string
}

export interface StorefrontState {
  botUsername: string | null
  botUrl: string | null
  selectedProductBotUrl: string | null
  category: ActiveCategory
  search: string
  sort: CatalogSort
  taskInput: string
  liveSearchQuery: string
  liveSearchNormalizedQuery: string | null
  liveSearchBotUrl: string | null
  liveSearchStatus: LivePoizonSearchStatus
  liveSearchResults: LivePoizonProduct[]
  liveSearchMessage: string | null
  catalogPoizonPrices: Record<string, StorefrontPoizonPrice>
  catalogPoizonPricesReady: boolean
  filteredProducts: CatalogProduct[]
  selectedProduct: CatalogProduct | null
  selectedImage: { src: string; alt: string } | null
  selectedImageIndex: number
  selectedImageDisplayIndex: number
  selectedVisibleGallery: readonly { src: string; alt: string }[]
  selectedSize: string | null
  selectedSizeOptions: readonly string[]
  selectedSizeOffers: readonly ProductSizeOffer[]
  selectedSizeOfferStatus: "idle" | "loading" | "ready" | "failed"
  selectedSizeOfferError: string | null
  selectedProductPrice: DisplayPrice | null
  getPoizonDisplayPrice: (product: CatalogProduct) => DisplayPrice
  catalogPriceState: CatalogPriceState
  cartLines: CartLine[]
  cartCount: number
  cartTotalRub: number
  isCartOpen: boolean
  checkoutCustomer: CheckoutCustomer
  checkoutDelivery: CheckoutDelivery
  checkoutConsents: CheckoutConsents
  checkoutResult: CheckoutResult
  request: string
  copyState: CopyState
  catalogSearch: CatalogSearchState
  taskSearch: CatalogSearchState
  sheetHeadingRef: RefObject<HTMLHeadingElement | null>
  selectCategory: (category: ActiveCategory) => void
  setSearchValue: (search: string) => void
  selectSort: (sort: CatalogSort) => void
  applyQuickFilter: (filter: {
    category: ActiveCategory
    search?: string
    sort?: CatalogSort
  }) => void
  resetCatalog: () => void
  setTaskInput: (task: string) => void
  setLiveSearchQuery: (query: string) => void
  submitLiveSearch: () => Promise<void>
  openProduct: (product: CatalogProduct, trigger: HTMLElement, preferredSize?: string) => void
  closeProduct: () => void
  selectProductImage: (index: number) => void
  showPreviousProductImage: () => void
  showNextProductImage: () => void
  setSelectedSize: (size: string) => void
  addProductToCart: (product: CatalogProduct, size: string) => void
  addSelectedToCart: () => void
  openCart: () => void
  closeCart: () => void
  closePayment: () => void
  removeCartLine: (id: string) => void
  setCartLineQuantity: (id: string, quantity: number) => void
  updateCheckoutCustomer: (field: keyof CheckoutCustomer, value: string) => void
  updateCheckoutDelivery: (field: keyof CheckoutDelivery, value: string) => void
  updateCheckoutConsent: (field: keyof CheckoutConsents, value: boolean) => void
  submitCartCheckout: () => Promise<void>
  refreshPersonalDataConsentVersion: () => Promise<string | null>
  copyRequest: () => Promise<void>
}
