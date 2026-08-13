import {
  ArrowUpRight,
  BadgeCheck,
  Backpack,
  CircleDot,
  Dumbbell,
  Footprints,
  Medal,
  Search,
  ShieldCheck,
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
import type { VerifiedCatalogPrice } from "./catalog-price-api"
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
  all: "Вся витрина",
  "court-shoes": "Волейбол, баскетбол и заловая работа",
  sneakers: "Кроссовки, кеды и пары на каждый день",
  volleyball: "Пары и экипировка под волейбольный зал",
  basketball: "Баскетбольные пары, которые берут для зала",
  apparel: "Форма, компрессия, худи и верхний слой",
  protection: "Наколенники, налокотники, тейпы и поддержка",
  balls: "Волейбольные и баскетбольные мячи",
  training: "Резина, бутылки и функциональная база",
  recovery: "Слайды, роллы и восстановление после зала",
  bags: "Сумки, рюкзаки, носки и мелкие вещи",
}

export const categoryDetails: Record<ActiveCategory, string> = {
  all: "Полная база",
  "court-shoes": "Сцепление и стабильность",
  sneakers: "Кроссовки и кеды",
  volleyball: "Прыжок и боковая работа",
  basketball: "Амортизация и контроль",
  apparel: "Форма и слои",
  protection: "Колени, локти, тейпы",
  balls: "Для игры и команды",
  training: "ОФП и база",
  recovery: "После нагрузки",
  bags: "То, что берут с собой",
}

export const categoryTone: Record<ActiveCategory, string> = {
  all: "gear",
  "court-shoes": "jump",
  sneakers: "street",
  volleyball: "jump",
  basketball: "court",
  apparel: "kit",
  protection: "guard",
  balls: "ball",
  training: "train",
  recovery: "reset",
  bags: "carry",
}

export const categoryIcons: Record<ActiveCategory, LucideIcon> = {
  all: Sparkles,
  "court-shoes": Zap,
  sneakers: Footprints,
  volleyball: Trophy,
  basketball: CircleDot,
  apparel: Shirt,
  protection: ShieldCheck,
  balls: CircleDot,
  training: Dumbbell,
  recovery: Waves,
  bags: Backpack,
}

export const heroProductSlugs = [
  "asics-sky-elite-ff-3",
  "nike-kd-18",
  "triggerpoint-grid-foam-roller",
] as const

export const scenarioTiles = [
  {
    id: "court-shoes",
    title: "Игровой день",
    text: "Пары со сцеплением, стабильной боковой работой и мягким приземлением.",
    metric: "37 пар",
    icon: Medal,
  },
  {
    id: "protection",
    title: "Контакт и защита",
    text: "Наколенники, налокотники, тейпы и поддержка для плотных тренировок.",
    metric: "9 позиций",
    icon: ShieldCheck,
  },
  {
    id: "recovery",
    title: "После зала",
    text: "Слайды, роллы и восстановление, чтобы следующая тренировка не начиналась с боли.",
    metric: "10 позиций",
    icon: TimerReset,
  },
] as const

export const editorialIndex = [
  {
    id: "court-shoes",
    code: "Shoes",
    title: "Пара под зал",
    text: "Волейбольные и баскетбольные модели для прыжка, сцепления и боковой работы.",
    icon: Zap,
  },
  {
    id: "protection",
    code: "Guard",
    title: "Защита",
    text: "Колени, локти, тейпы и поддержка для плотных тренировок без лишнего риска.",
    icon: ShieldCheck,
  },
  {
    id: "balls",
    code: "Team",
    title: "Мячи",
    text: "Волейбольные и баскетбольные мячи для команды, зала и регулярной игры.",
    icon: CircleDot,
  },
  {
    id: "recovery",
    code: "Reset",
    title: "Восстановление",
    text: "Слайды, роллы и база после нагрузки, чтобы быстрее вернуться в игру.",
    icon: TimerReset,
  },
] as const

export const quickFilters = [
  {
    label: "Обувь для прыжка",
    detail: "волейбол + зал",
    category: "court-shoes",
    icon: Zap,
  },
  {
    label: "Баскетбол для зала",
    detail: "мягкость и контроль",
    category: "basketball",
    icon: CircleDot,
  },
  {
    label: "Защита колена",
    detail: "наколенники и поддержка",
    category: "protection",
    search: "колен",
    icon: ShieldCheck,
  },
  {
    label: "Мячи",
    detail: "игра и команда",
    category: "balls",
    icon: CircleDot,
  },
  {
    label: "До 10 тыс.",
    detail: "сначала доступное",
    category: "all",
    sort: "price-asc",
    icon: BadgeCheck,
  },
  {
    label: "Сумка и база",
    detail: "то, что берут с собой",
    category: "bags",
    icon: Backpack,
  },
] as const

export const taskChips = [
  "прыжок и мягкое приземление",
  "защита коленей",
  "мяч для команды",
  "восстановление после зала",
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

export function getDisplayPrice(
  _product: CatalogProduct,
  verifiedPrice?: Pick<VerifiedCatalogPrice, "totalRub" | "expiresAt">,
  label = "Цена от",
  valuePrefix = "от ",
): DisplayPrice {
  if (verifiedPrice) {
    const expiresAt = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(verifiedPrice.expiresAt))
    return {
      label,
      value: `${valuePrefix}${formatRub(verifiedPrice.totalRub)}`,
      detail: `зафиксирована до ${expiresAt}`,
    }
  }

  return {
    label: "Цена",
    value: "По запросу",
    detail: "уточним цену и наличие",
  }
}

export function getProductTags(product: CatalogProduct): string[] {
  const tags: string[] = []
  const note = product.note.toLowerCase()

  if (product.sportPriority) tags.push("спорт")
  if (product.category === "volleyball") tags.push("волейбол")
  if (product.category === "basketball") tags.push("баскетбол для зала")
  if (product.category === "training") tags.push("ОФП")
  if (product.category === "recovery") tags.push("recovery")
  if (product.category === "lifestyle") tags.push("lifestyle")
  if (/колен|knee|защит/.test(note)) tags.push("защита")
  if (/прыж|jump|bounce/.test(note)) tags.push("прыжок")
  if (/мяч|ball/.test(note)) tags.push("игра")
  if (tags.length < 2) tags.push(kindLabels[product.kind].toLowerCase())

  return [...new Set(tags)].slice(0, 3)
}

export function getProductBadge(product: CatalogProduct): string {
  const note = product.note.toLowerCase()
  if (product.category === "recovery") return "После зала"
  if (product.category === "basketball") return "Контроль"
  if (product.category === "volleyball") return /прыж|jump/.test(note) ? "Прыжок" : "Зал"
  if (product.category === "protection") return "Защита"
  if (product.category === "balls") return "Команда"
  return product.sportPriority ? "Спорт" : "Lifestyle"
}

export function getProductUse(product: CatalogProduct): string {
  const note = product.note.toLowerCase()
  if (/колен|knee/.test(note)) return "Для защиты коленей и контакта"
  if (/мяч|ball/.test(note)) return "Для игры, команды и регулярного зала"
  if (/roll|foam|recover|восстанов/.test(note)) return "Для восстановления после нагрузки"
  if (/bag|сумк|backpack/.test(note)) return "Для формы, обуви и мелочей"
  if (product.category === "basketball") return "Для резких смен направления"
  if (product.category === "volleyball") return "Для тренировок и игровых дней"
  return product.note
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

function scoreTaskProduct(
  product: CatalogProduct,
  task: string,
  verifiedPrices: Readonly<Record<string, VerifiedCatalogPrice>>,
): TaskMatch | null {
  const normalizedTask = normalizedText(task)
  if (!normalizedTask.trim()) return null

  const haystack = productSearchText(product)
  const reasons = new Set<string>()
  let score = 0

  const add = (points: number, reason: string) => {
    score += points
    reasons.add(reason)
  }

  const words = normalizedTask
    .split(/[^a-zа-я0-9]+/i)
    .filter((word) => word.length >= 3)
  for (const word of words) {
    if (haystack.includes(word)) add(3, `совпадение: ${word}`)
  }

  if (/волей|прыж|jump|зал|сцеп|приземл/.test(normalizedTask)) {
    if (product.category === "volleyball" || product.kind === "footwear") {
      add(14, "прыжок и сцепление")
    }
  }
  if (/баскет|crossover|cut|аморт|контрол/.test(normalizedTask)) {
    if (product.category === "basketball" || product.kind === "footwear") {
      add(12, "амортизация и контроль")
    }
  }
  if (/колен|локт|защит|сустав|contact/.test(normalizedTask)) {
    if (product.category === "protection") add(12, "защита суставов")
  }
  if (/мяч|команд|игр|ball/.test(normalizedTask)) {
    if (product.category === "balls") add(10, "инвентарь для игры")
  }
  if (/recover|восстанов|после|ролл|slide/.test(normalizedTask)) {
    if (product.category === "recovery") add(11, "восстановление после зала")
  }
  if (/резин|бутыл|трениров|офп/.test(normalizedTask)) {
    if (product.category === "training") add(9, "тренировочная база")
  }
  if (/сумк|рюкзак|носок|bag/.test(normalizedTask)) {
    if (product.category === "bags") add(9, "сумка и мелочи")
  }
  if (/бюджет|дешев|до\s?\d|недорог/.test(normalizedTask)) {
    const price = verifiedPrices[product.slug]?.totalRub ?? Number.MAX_SAFE_INTEGER
    if (price < 12_000) add(8, "ближе к низкому бюджету")
  }

  if (score <= 0) return null
  return { product, score, reason: [...reasons].slice(0, 2).join(" + ") }
}

export function findTaskMatches(
  products: readonly CatalogProduct[],
  task: string,
  verifiedPrices: Readonly<Record<string, VerifiedCatalogPrice>> = {},
): TaskMatch[] {
  return products
    .map((product) => scoreTaskProduct(product, task, verifiedPrices))
    .filter((match): match is TaskMatch => match !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const leftPrice = verifiedPrices[left.product.slug]?.totalRub ?? Number.MAX_SAFE_INTEGER
      const rightPrice = verifiedPrices[right.product.slug]?.totalRub ?? Number.MAX_SAFE_INTEGER
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
    ? "Performance"
    : product.kind === "apparel"
      ? "Layer"
      : "Gear"

export { ArrowUpRight, Search }
