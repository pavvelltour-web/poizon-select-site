import {
  BadgeCheck,
  CircleDot,
  Footprints,
  Medal,
  Search,
  Shirt,
  Sparkles,
  TimerReset,
  Trophy,
  Waves,
  Zap,
} from "lucide-react"

import {
  catalogCategories,
  formatRub,
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
  all: "Все опубликованные пары и одежда",
  "court-shoes": "Пары для зала и тренировок",
  volleyball: "Пары для игровых дней",
  basketball: "Пары для приема, защиты и боковой работы",
  recovery: "Слайды и мягкие пары после зала",
  apparel: "Одежда для тренировок и дороги",
  sneakers: "Базовые пары на каждый день",
}

export const categoryDetails: Record<ActiveCategory, string> = {
  all: "Публичная витрина",
  "court-shoes": "Зал и тренировки",
  volleyball: "Матч и тренировка",
  basketball: "Защитная работа",
  recovery: "После зала",
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

export const scenarioTiles = [
  {
    id: "court-shoes",
    title: "Пара для зала",
    text: "Для тренировок, перемещений и уверенной посадки.",
    icon: Medal,
  },
  {
    id: "basketball",
    title: "Защитная работа",
    text: "Пары, которые берут для приема и резких смен направления.",
    icon: CircleDot,
  },
  {
    id: "recovery",
    title: "После зала",
    text: "Мягкие пары на дорогу домой и восстановительный день.",
    icon: TimerReset,
  },
] as const

export const editorialIndex = [
  {
    id: "court-shoes",
    title: "Пара под зал",
    text: "Начните с покрытия и задачи. Менеджер проверит размер, цвет и наличие.",
    icon: Zap,
  },
  {
    id: "basketball",
    title: "Защитная работа",
    text: "Пары для приема, боковых перемещений и плотной посадки.",
    icon: CircleDot,
  },
  {
    id: "apparel",
    title: "Одежда",
    text: "Футболки, шорты, худи и верхний слой для тренировок.",
    icon: Shirt,
  },
  {
    id: "recovery",
    title: "После зала",
    text: "Слайды и мягкие пары для восстановления после нагрузки.",
    icon: TimerReset,
  },
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
    label: "Игровой день",
    detail: "быстро выбрать пару",
    category: "volleyball",
    icon: Trophy,
  },
  {
    label: "Защитная работа",
    detail: "прием и боковые движения",
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
  "игровой день",
  "защитная работа",
  "восстановление после зала",
] as const

export const kindLabels: Record<ProductKind, string> = {
  footwear: "Обувь",
  apparel: "Одежда",
  accessory: "Экипировка",
}

const fallbackFromPrices: Record<ProductKind, string> = {
  footwear: "от 22 тыс. ₽",
  apparel: "от 4 тыс. ₽",
  accessory: "от 3 тыс. ₽",
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

function marketPriceToFrom(price: string): string {
  const firstNumber = price.match(/^\d+(?:[.,]\d+)?/)?.[0]
  if (!firstNumber) return price
  return `от ${firstNumber.replace(".", ",")} тыс. ₽`
}

export function getDisplayPrice(product: CatalogProduct): DisplayPrice {
  if (product.orderQuote) {
    return {
      label: "Цена",
      value: `от ${formatRub(product.orderQuote.totalRub)}`,
      detail: "итог до оплаты, СДЭК отдельно",
    }
  }

  if (product.marketPrice) {
    return {
      label: "Цена",
      value: marketPriceToFrom(product.marketPrice),
      detail: product.priceBasis ?? "ориентир",
    }
  }

  return {
    label: "Цена",
    value: fallbackFromPrices[product.kind],
    detail: "уточним по размеру",
  }
}

export function getProductTags(product: CatalogProduct): string[] {
  return [getProductBadge(product), kindLabels[product.kind]]
}

export function getProductBadge(product: CatalogProduct): string {
  if (product.category === "recovery") return "После зала"
  if (product.category === "basketball") return "Защитная работа"
  if (product.category === "volleyball") return "Игровой день"
  if (product.category === "apparel") return "Одежда"
  if (product.category === "training") return "Тренировка"
  return product.kind === "footwear" ? "Пара" : kindLabels[product.kind]
}

export function getProductUse(product: CatalogProduct): string {
  const note = product.note.toLowerCase()
  if (/roll|foam|recover|восстанов/.test(note)) return "Для восстановления после нагрузки"
  if (product.category === "basketball") return "Для защитной работы и смен направления"
  if (product.category === "volleyball") return "Для тренировок и игровых дней"
  if (product.kind === "apparel") return "Для тренировок, дороги и повседневного слоя"
  return product.note
}

export function getProductScenario(product: CatalogProduct): string {
  if (product.category === "basketball") return "Защитная работа"
  if (product.category === "volleyball") return "Игровой день"
  if (product.category === "recovery") return "После зала"
  if (product.category === "apparel") return "Одежда"
  if (product.category === "training") return "Тренировка"
  if (product.category === "lifestyle") return "Базовая пара"
  return kindLabels[product.kind]
}

export function getSourcingMode(product: CatalogProduct): string {
  return product.orderQuote ? "Из Китая до Москвы" : "Наличие уточнит менеджер"
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
  const reasons = new Set<string>()
  let score = 0

  const add = (points: number, reason: string) => {
    score += points
    reasons.add(reason)
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
      add(14, "подходит под зал")
    }
    if (product.category === "volleyball") add(5, "мягкое приземление")
    if (product.category === "basketball") add(3, "боковая работа")
  }
  if (/мягк|приземл|прыж/.test(normalizedTask) && product.category === "volleyball") {
    add(14, "мягкое приземление")
  }
  if (/баскет|защит|прием|приём|crossover|cut|аморт|контрол|боков/.test(normalizedTask)) {
    if (product.category === "basketball" || product.kind === "footwear") {
      add(12, "защитная работа")
    }
  }
  if (asksRecovery) {
    if (product.category === "recovery") add(11, "после зала")
  }
  if (/бюджет|дешев|до\s?\d|недорог/.test(normalizedTask)) {
    const price = product.orderQuote?.totalRub ?? Number.MAX_SAFE_INTEGER
    if (price < 12_000) add(8, "ближе к низкому бюджету")
  }

  const stopWords = new Set(["для", "под", "пара", "пары", "нужна", "надо"])
  const words = normalizedTask
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
  for (const word of words) {
    if (haystack.includes(word)) add(3, `совпадение: ${word}`)
  }

  if (score <= 0) return null
  return { product, score, reason: [...reasons].slice(0, 2).join(" + ") }
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
      const leftPrice = left.product.orderQuote?.totalRub ?? Number.MAX_SAFE_INTEGER
      const rightPrice = right.product.orderQuote?.totalRub ?? Number.MAX_SAFE_INTEGER
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
