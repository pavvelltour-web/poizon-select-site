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

export type LivePoizonSearchStatus = "idle" | "loading" | "ready" | "unavailable"

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
  sku_id: string
  size: string
  currency: "CNY"
  price_cny: number
  quote_rub: number
  rf_delivery: number
  total_rub: number | null
  price_breakdown: LivePoizonPriceBreakdown | null
}

export interface LivePoizonProduct {
  provider_source: "poizon_batch_sync_api"
  provider_product_id: string
  brand: string | null
  name: string
  article: string | null
  kind: "footwear" | "apparel" | "accessory"
  description: string | null
  images: string[]
  offers: LivePoizonOffer[]
  yuan_rate: number
  observed_at: string
  expires_at: string
}

/** One server-synchronised 12-hour price for an owner-published catalogue item. */
export interface StorefrontPoizonPrice {
  slug: string
  source_query: string
  provider_product_id: string
  product_name: string
  price_cny: number
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
  liveSearchStatus: LivePoizonSearchStatus
  liveSearchResults: LivePoizonProduct[]
  liveSearchMessage: string | null
  catalogPricesReady: boolean
  catalogPriceCount: number
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
  getCatalogDisplayPrice: (product: CatalogProduct) => DisplayPrice
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
  submitLiveSearch: () => Promise<void>
  openProduct: (product: CatalogProduct, trigger: HTMLButtonElement) => void
  closeProduct: () => void
  selectProductImage: (index: number) => void
  showPreviousProductImage: () => void
  showNextProductImage: () => void
  setSelectedSize: (size: string) => void
  copyRequest: () => Promise<void>
}
