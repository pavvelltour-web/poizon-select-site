import {
  BadgeCheck,
  CircleDot,
  Footprints,
  Search,
  Shirt,
  Sparkles,
  Trophy,
  Waves,
  Zap,
} from "lucide-react"

import {
  catalogCategories,
  formatRub,
  getCatalogPriceRub,
  type CatalogProduct,
  type CatalogSort,
  type ProductKind,
} from "../catalog/catalog"
import type { ActiveCategory, DisplayPrice, TaskMatch, UrlState } from "./landing-types"
import type { LucideIcon } from "lucide-react"
import type { SyntheticEvent } from "react"

export const sortOptions: readonly { id: CatalogSort; label: string }[] = [
  { id: "featured", label: "По подборке" },
  { id: "price-asc", label: "Цена ниже" },
  { id: "price-desc", label: "Цена выше" },
  { id: "name", label: "Бренд A-Z" },
]

export const categoryCopy: Record<ActiveCategory, string> = {
  all: "Обувь и одежда для движения",
  "court-shoes": "Пары для зала и тренировок",
  volleyball: "Пары для матча и тренировки",
  basketball: "Пары для зала и активного движения",
  recovery: "Мягкая обувь после тренировки",
  apparel: "Одежда для тренировок и дороги",
  sneakers: "Базовые пары на каждый день",
}

export const categoryDetails: Record<ActiveCategory, string> = {
  all: "Витрина",
  "court-shoes": "Зал и тренировки",
  volleyball: "На матч",
  basketball: "Для движения",
  recovery: "Восстановление",
  apparel: "Одежда",
  sneakers: "База",
}

export const categoryTone: Record<ActiveCategory, string> = {
  all: "gear",
  "court-shoes": "court",
  sneakers: "street",
  volleyball: "court",
  basketball: "court",
  apparel: "kit",
  recovery: "reset",
}

export const categoryIcons: Record<ActiveCategory, LucideIcon> = {
  all: Sparkles,
  "court-shoes": Zap,
  volleyball: Trophy,
  basketball: CircleDot,
  recovery: Waves,
  apparel: Shirt,
  sneakers: Footprints,
}

export const heroProductSlugs = [
  "asics-sky-elite-ff-3",
  "nike-kd-18",
  "hoka-ora-recovery-slide-3",
] as const

type QuickFilter = {
  label: string
  detail: string
  category: ActiveCategory
  search?: string
  sort?: CatalogSort
  icon: LucideIcon
}

export const quickFilters: readonly QuickFilter[] = [
  {
    label: "Пара для зала",
    detail: "тренировки и игры",
    category: "court-shoes",
    icon: Zap,
  },
  {
    label: "На матч",
    detail: "на матч",
    category: "volleyball",
    icon: Trophy,
  },
  {
    label: "Для движения",
    detail: "тренировка в зале",
    category: "basketball",
    icon: CircleDot,
  },
  {
    label: "После зала",
    detail: "слайды и мягкие пары",
    category: "recovery",
    icon: Waves,
  },
  {
    label: "До 15 тыс.",
    detail: "сначала доступное",
    category: "all",
    sort: "price-asc",
    icon: BadgeCheck,
  },
  {
    label: "Одежда",
    detail: "верх и шорты",
    category: "apparel",
    icon: Shirt,
  },
]

export const taskChips = [
  "пара для зала",
  "на матч",
  "на тренировку",
  "после тренировки",
] as const

export const kindLabels: Record<ProductKind, string> = {
  footwear: "Обувь",
  apparel: "Одежда",
  accessory: "Экипировка",
}

const footwearSizes = [
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
] as const
const apparelSizes = ["XS", "S", "M", "L", "XL", "XXL"] as const
const supportSizes = ["S", "M", "L", "XL"] as const
const oneSize = ["One size"] as const

export function resolveAssetUrl(src: string): string {
  if (/^(?:https?:)?\/\//i.test(src) || /^(?:data|blob):/i.test(src)) return src

  const normalizedSrc = src.replace(/^\/+/, "")
  if (typeof window === "undefined") return normalizedSrc

  const currentPath = window.location.pathname || "/"
  const basePath = currentPath.endsWith("/")
    ? currentPath
    : currentPath.replace(/\/[^/]*$/, "/")
  return new URL(`${basePath}${normalizedSrc}`, window.location.href).toString()
}

export function setImageFallback(
  event: SyntheticEvent<HTMLImageElement>,
  fallbackImage: string,
) {
  const fallbackUrl = resolveAssetUrl(fallbackImage)
  if (event.currentTarget.getAttribute("src") === fallbackUrl) return
  event.currentTarget.src = fallbackUrl
}

export function getDisplayPrice(product: CatalogProduct): DisplayPrice {
  return {
    label: "Цена",
    value: formatRub(getCatalogPriceRub(product)),
    detail: "СДЭК рассчитывается отдельно",
  }
}

export function getProductTags(product: CatalogProduct): string[] {
  return [getProductBadge(product), kindLabels[product.kind]]
}

export function getProductBadge(product: CatalogProduct): string {
  if (product.category === "recovery") return "После зала"
  if (product.category === "basketball") return "Для движения"
  if (product.category === "volleyball") return "На матч"
  if (product.category === "apparel") return "Одежда"
  if (product.category === "training") return "Тренировка"
  return product.kind === "footwear" ? "Пара" : kindLabels[product.kind]
}

export function getProductUse(product: CatalogProduct): string {
  if (product.category === "recovery") return "Для отдыха после тренировки"
  if (product.category === "basketball") return "Для движения в зале и тренировок"
  if (product.category === "volleyball") return "Для матча и тренировки"
  if (product.kind === "apparel") return "Для тренировок, дороги и повседневного слоя"
  if (product.kind === "accessory") return "Для тренировки и дороги"
  return "Для повседневного движения"
}

export function getProductScenario(product: CatalogProduct): string {
  if (product.category === "basketball") return "Для движения"
  if (product.category === "volleyball") return "На матч"
  if (product.category === "recovery") return "После зала"
  if (product.category === "apparel") return "Одежда"
  if (product.category === "training") return "Тренировка"
  if (product.category === "lifestyle") return "Базовая пара"
  return kindLabels[product.kind]
}

export function getSourcingMode(product: CatalogProduct): string {
  return product.orderQuote ? "Из Китая до Москвы" : "Под заказ из Китая"
}

export function getSizeOptions(product: CatalogProduct): readonly string[] {
  if (product.kind === "apparel") return apparelSizes
  if (product.kind === "accessory") {
    const productText = `${product.name} ${product.query}`.toLowerCase()
    if (/knee|elbow|support|guard|sleeve|защит|наколен/.test(productText)) {
      return supportSizes
    }
    return oneSize
  }
  return footwearSizes
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е")
}

function productSearchText(product: CatalogProduct): string {
  return normalizedText(
    [
      product.brand,
      product.name,
      product.query,
      product.note,
      product.category,
      product.categoryLabel,
      product.kind,
    ].join(" "),
  )
}

function scoreTaskProduct(product: CatalogProduct, task: string): TaskMatch | null {
  const normalizedTask = normalizedText(task)
  if (!normalizedTask.trim()) return null

  const haystack = productSearchText(product)
  let score = 0

  const add = (points: number) => {
    score += points
  }

  const asksRecovery = /recover|восстанов|после|slide|слайд/.test(normalizedTask)
  const asksHall = /волей|пара|зал|трениров|матч|игров|приземл/.test(
    normalizedTask,
  )

  if (asksHall) {
    if (
      product.kind === "footwear" &&
      product.sportPriority &&
      (asksRecovery || product.category !== "recovery")
    ) {
      add(14)
    }
    if (product.category === "volleyball") add(5)
    if (product.category === "basketball") add(3)
  }
  if (/мягк|приземл|прыж/.test(normalizedTask) && product.category === "volleyball") {
    add(14)
  }
  if (/баскет|защит|прием|приём|crossover|cut|аморт|контрол|боков/.test(normalizedTask)) {
    if (product.category === "basketball" || product.kind === "footwear") {
      add(12)
    }
  }
  if (asksRecovery) {
    if (product.category === "recovery") add(11)
  }
  if (/бюджет|дешев|до\s?\d|недорог/.test(normalizedTask)) {
    if (getCatalogPriceRub(product) < 12_000) add(8)
  }

  const stopWords = new Set(["для", "под", "пара", "пары", "нужна", "надо"])
  const words = normalizedTask
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
  for (const word of words) {
    if (haystack.includes(word)) add(3)
  }

  if (score <= 0) return null
  const reason =
    product.category === "recovery"
      ? "после тренировки"
      : product.category === "volleyball"
        ? "для матча и тренировки"
        : product.category === "basketball"
          ? "для движения в зале"
          : product.kind === "apparel"
            ? "одежда"
            : product.kind === "footwear"
              ? "для зала"
              : "для тренировки"
  return { product, score, reason }
}

export function findTaskMatches(
  products: readonly CatalogProduct[],
  task: string,
): TaskMatch[] {
  return products
    .map((product) => scoreTaskProduct(product, task))
    .filter((match): match is TaskMatch => match !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const leftPrice = getCatalogPriceRub(left.product)
      const rightPrice = getCatalogPriceRub(right.product)
      return leftPrice - rightPrice
    })
}

export function isCategory(value: string | null): value is ActiveCategory {
  return catalogCategories.some((category) => category.id === value)
}

export function isSort(value: string | null): value is CatalogSort {
  return sortOptions.some((option) => option.id === value)
}

export function readUrlState(): UrlState {
  if (typeof window === "undefined") {
    return { category: "all", search: "", sort: "featured", productSlug: null }
  }

  const params = new URLSearchParams(window.location.search)
  const category = params.get("category")
  const sort = params.get("sort")

  return {
    category: isCategory(category) ? category : "all",
    search: params.get("q") ?? "",
    sort: isSort(sort) ? sort : "featured",
    productSlug: params.get("product"),
  }
}

export const productAccentLabel = (product: CatalogProduct) =>
  product.kind === "footwear"
    ? "Пара"
    : product.kind === "apparel"
      ? "Одежда"
      : "Товар"

export { Search }
