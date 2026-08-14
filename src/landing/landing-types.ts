import type { CatalogCategory, CatalogProduct, CatalogSort } from "../catalog/catalog"
import type { RefObject } from "react"

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

export interface TaskMatch {
  product: CatalogProduct
  score: number
  reason: string
}

export type CopyState = "idle" | "copied" | "failed"

export type LivePoizonSearchStatus =
  | "idle"
  | "loading"
  | "clarification"
  | "ready"
  | "unavailable"

/** A bounded model choice returned before a broad search is expanded. */
export interface LivePoizonClarificationOption {
  label: string
  query: string
}

/** Customer-safe subset of the CRM quote; no provider address or secret. */
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
  /** Opaque server-issued reference for this exact size; never a provider SKU. */
  offer_ref: string
  size: string
  eu: string
  ru: string
  us: string
  cn: string
  available: boolean | null
  price_cny: number
  quote_rub: number
  rf_delivery: number
  total_rub: number
  price_breakdown: LivePoizonPriceBreakdown
}

export interface LivePoizonProduct {
  /** Opaque server-issued product reference; never a provider product ID. */
  product_ref: string
  brand: string | null
  name: string
  article: string | null
  color: string | null
  kind: "footwear" | "apparel" | "accessory"
  /** The API may not have translated copy for every item yet. */
  description: string | null
  images: string[]
  in_stock: boolean | null
  size_context: string | null
  size_chart: string | null
  size_image: string | null
  offers: LivePoizonOffer[]
  observed_at: string
  expires_at: string
}

export interface StorefrontState {
  botUsername: string | null
  botUrl: string | null
  category: ActiveCategory
  search: string
  sort: CatalogSort
  taskInput: string
  liveSearchQuery: string
  liveSearchStatus: LivePoizonSearchStatus
  liveSearchResults: LivePoizonProduct[]
  liveSearchMessage: string | null
  liveSearchClarificationOptions: LivePoizonClarificationOption[]
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
  getProductPrice: (product: CatalogProduct) => DisplayPrice
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
  setLiveSearchQuery: (query: string) => void
  submitLiveSearch: (queryOverride?: string) => Promise<void>
  openProduct: (product: CatalogProduct, trigger: HTMLButtonElement) => void
  closeProduct: () => void
  selectProductImage: (index: number) => void
  showPreviousProductImage: () => void
  showNextProductImage: () => void
  setSelectedSize: (size: string) => void
  copyRequest: () => Promise<void>
}
