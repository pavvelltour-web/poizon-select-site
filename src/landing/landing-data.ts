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
import type { CatalogPriceMap } from "./cart"
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
  all: "Весь ассортимент",
  "court-shoes": "Для зала и тренировки",
  volleyball: "Пары для матча и тренировки",
  basketball: "Баскетбол",
  recovery: "Восстановление",
  apparel: "Одежда для тренировок",
  sneakers: "Базовые пары",
}
export const categoryDetails: Record<ActiveCategory, string> = {
  all: "Обувь и одежда",
  "court-shoes": "Тренировки",
  volleyball: "Турниры и отработка",
  basketball: "Турниры и отработка",
  recovery: "Восстановление",
  apparel: "Одежда",
  sneakers: "Базовые",
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
    label: "Кроссовки для зала",
    detail: "тренировки и матчевые дни",
    category: "court-shoes",
    icon: Zap,
  },
  {
    label: "Волейбольные пары",
    detail: "бег и смена направления",
    category: "volleyball",
    icon: Trophy,
  },
  {
    label: "Баскетбольные пары",
    detail: "для динамики и ускорения",
    category: "basketball",
    icon: CircleDot,
  },
  {
    label: "Для восстановления",
    detail: "после тренировки и для отдыха",
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
  "для зала",
  "для волейбола",
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

  return new URL(`/${normalizedSrc}`, window.location.origin).toString()
}

export function setImageFallback(
  event: SyntheticEvent<HTMLImageElement>,
  fallbackImage: string,
) {
  const fallbackUrl = resolveAssetUrl(fallbackImage)
  if (event.currentTarget.getAttribute("src") === fallbackUrl) return
  event.currentTarget.src = fallbackUrl
}
function getCatalogLinePrice(
  product: CatalogProduct,
  catalogPriceLookup: CatalogPriceMap | null = null,
): number {
  if (!catalogPriceLookup) return getCatalogPriceRub(product)
  const override = catalogPriceLookup[product.slug]
  if (!Number.isFinite(override) || override <= 0) return getCatalogPriceRub(product)
  return override
}
export function getDisplayPrice(
  product: CatalogProduct,
  catalogPriceLookup: CatalogPriceMap | null = null,
): DisplayPrice {
  return {
    label: "Цена",
    value: formatRub(getCatalogLinePrice(product, catalogPriceLookup)),
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

export function getSizeRangeLabel(product: CatalogProduct): string {
  const sizes = getSizeOptions(product)
  if (sizes.length === 1) return sizes[0] ?? "Один размер"
  return `${sizes[0]}-${sizes.at(-1)}`
}

export function getProductPath(product: CatalogProduct): string {
  return `/product/${encodeURIComponent(product.slug)}`
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

function scoreTaskProduct(
  product: CatalogProduct,
  task: string,
  catalogPriceLookup: CatalogPriceMap | null = null,
): TaskMatch | null {
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
  const budgetMatch = normalizedTask.match(
    /(?:бюджет(?:ом)?|до)\s*([1-9]\d{3,5})/u,
  )
  const budgetRub = budgetMatch?.[1]
    ? Number.parseInt(budgetMatch[1], 10)
    : null
  if (budgetRub) {
    const price = getCatalogLinePrice(product, catalogPriceLookup)
    if (price <= budgetRub) add(10)
    else add(-8)
  } else if (/бюджет|дешев|недорог/.test(normalizedTask)) {
    const price = getCatalogLinePrice(product, catalogPriceLookup)
    if (price < 12_000) add(8)
  }

  const requestedSize = normalizedTask.match(/(?:^|\s)(3[5-9]|4[0-8])(?:[.,]5)?(?:\s|$)/u)?.[1]
  if (requestedSize && getSizeOptions(product).includes(requestedSize)) add(5)

  if (/бел(?:ый|ая|ое|ые|ого|ую)|white/u.test(normalizedTask)) {
    if (/white|бел/u.test(haystack)) add(7)
  }
  if (/черн|black/u.test(normalizedTask)) {
    if (/black|черн/u.test(haystack)) add(7)
  }

  const stopWords = new Set(["для", "под", "пара", "пары", "нужна", "надо"])
  const words = normalizedTask
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
  for (const word of words) {
    if (haystack.includes(word)) add(word.length >= 5 ? 5 : 3)
  }

  if (score <= 0) return null
  const reason =
    product.category === "recovery"
      ? "для восстановления"
      : product.category === "volleyball"
        ? "для матча и тренировки"
        : product.category === "basketball"
          ? "для баскетбола"
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
  catalogPriceLookup: CatalogPriceMap | null = null,
): TaskMatch[] {
  return products
    .map((product) => scoreTaskProduct(product, task, catalogPriceLookup))
    .filter((match): match is TaskMatch => match !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const leftPrice = getCatalogLinePrice(left.product, catalogPriceLookup)
      const rightPrice = getCatalogLinePrice(right.product, catalogPriceLookup)
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
