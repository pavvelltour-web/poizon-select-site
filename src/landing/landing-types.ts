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

export interface StorefrontState {
  botUsername: string | null
  botUrl: string | null
  category: ActiveCategory
  search: string
  sort: CatalogSort
  taskInput: string
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
