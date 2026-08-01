import type { CatalogCategory, CatalogProduct, CatalogSort } from "../catalog/catalog"
import type { RefObject } from "react"
import type {
  CartLine,
  CheckoutDelivery,
  CheckoutConsents,
  CheckoutCustomer,
  CheckoutResult,
  CatalogPriceMap,
  PublishedCatalogMap,
} from "./cart"

export type ActiveCategory = "all" | CatalogCategory

export interface UrlState {
  category: ActiveCategory
  search: string
  sort: CatalogSort
  productSlug: string | null
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
  error: string | null
}

export interface TaskMatch {
  product: CatalogProduct
  score: number
  reason: string
}

export type CopyState = "idle" | "copied" | "failed"

export interface StorefrontState {
  botUsername: string | null
  botUrl: string | null
  category: ActiveCategory
  search: string
  sort: CatalogSort
  taskInput: string
  heroProducts: CatalogProduct[]
  filteredProducts: CatalogProduct[]
  selectedProduct: CatalogProduct | null
  selectedImage: { src: string; alt: string } | null
  selectedImageIndex: number
  selectedImageDisplayIndex: number
  selectedVisibleGallery: readonly { src: string; alt: string }[]
  selectedSize: string | null
  selectedSizeOptions: readonly string[]
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
  taskMatches: TaskMatch[]
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
  openProduct: (product: CatalogProduct, trigger: HTMLButtonElement) => void
  closeProduct: () => void
  selectProductImage: (index: number) => void
  showPreviousProductImage: () => void
  showNextProductImage: () => void
  setSelectedSize: (size: string) => void
  addProductToCart: (product: CatalogProduct, size: string) => void
  addSelectedToCart: () => void
  openCart: () => void
  closeCart: () => void
  removeCartLine: (id: string) => void
  setCartLineQuantity: (id: string, quantity: number) => void
  updateCheckoutCustomer: (field: keyof CheckoutCustomer, value: string) => void
  updateCheckoutDelivery: (field: keyof CheckoutDelivery, value: string) => void
  updateCheckoutConsent: (field: keyof CheckoutConsents, value: boolean) => void
  submitCartCheckout: () => Promise<void>
  refreshPersonalDataConsentVersion: () => Promise<string | null>
  copyRequest: () => Promise<void>
}
