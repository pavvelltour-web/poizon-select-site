import {
  ArrowUpRight,
  BadgeCheck,
  Backpack,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Copy,
  Dumbbell,
  Footprints,
  Medal,
  MoveRight,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Trophy,
  Waves,
  X,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  catalogCategories,
  catalogProducts,
  filterCatalog,
  findProductBySlug,
  formatRub,
  sortCatalog,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogSort,
  type ProductKind,
} from "../catalog/catalog"
import type { CSSProperties, SyntheticEvent } from "react"
import type { LucideIcon } from "lucide-react"
import {
  buildOrderRequest,
  buildTelegramBotUrl,
  copyOrderRequest,
  resolveBotUsername,
} from "./order-request"

type ActiveCategory = "all" | CatalogCategory

interface LandingPageProps {
  configuredBotUsername?: string | null
}

interface UrlState {
  category: ActiveCategory
  search: string
  sort: CatalogSort
  productSlug: string | null
}

const sortOptions: readonly { id: CatalogSort; label: string }[] = [
  { id: "featured", label: "По подборке" },
  { id: "price-asc", label: "Цена ниже" },
  { id: "price-desc", label: "Цена выше" },
  { id: "name", label: "Бренд A-Z" },
]

const categoryCopy: Record<ActiveCategory, string> = {
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

const categoryDetails: Record<ActiveCategory, string> = {
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

const categoryTone: Record<ActiveCategory, string> = {
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

const categoryIcons: Record<ActiveCategory, LucideIcon> = {
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

const heroProductSlugs = [
  "asics-sky-elite-ff-3",
  "nike-kd-18",
  "triggerpoint-grid-foam-roller",
] as const

function resolveAssetUrl(src: string): string {
  if (/^(?:https?:)?\/\//i.test(src) || /^(?:data|blob):/i.test(src)) return src

  const normalizedSrc = src.replace(/^\/+/, "")
  if (typeof window === "undefined") return normalizedSrc

  const currentPath = window.location.pathname || "/"
  const basePath = currentPath.endsWith("/")
    ? currentPath
    : currentPath.replace(/\/[^/]*$/, "/")
  return `${basePath}${normalizedSrc}`
}

function setImageFallback(
  event: SyntheticEvent<HTMLImageElement>,
  fallbackImage: string,
) {
  const fallbackUrl = resolveAssetUrl(fallbackImage)
  if (event.currentTarget.getAttribute("src") === fallbackUrl) return
  event.currentTarget.src = fallbackUrl
}

const scenarioTiles: readonly {
  id: ActiveCategory
  title: string
  text: string
  metric: string
  icon: LucideIcon
}[] = [
  {
    id: "court-shoes",
    title: "Игровой день",
    text: "Пары с цепким сцеплением, стабильной боковой работой и мягким приземлением.",
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

const editorialIndex: readonly {
  id: ActiveCategory
  code: string
  title: string
  text: string
  icon: LucideIcon
}[] = [
  {
    id: "court-shoes",
    code: "01 / Shoes",
    title: "Пара под зал",
    text: "Волейбольные и баскетбольные модели для прыжка, сцепления и боковой работы.",
    icon: Zap,
  },
  {
    id: "protection",
    code: "02 / Guard",
    title: "Защита",
    text: "Колени, локти, тейпы и поддержка для плотных тренировок без лишнего риска.",
    icon: ShieldCheck,
  },
  {
    id: "balls",
    code: "03 / Team",
    title: "Мячи",
    text: "Волейбольные и баскетбольные мячи для команды, зала и регулярной игры.",
    icon: CircleDot,
  },
  {
    id: "recovery",
    code: "04 / Reset",
    title: "Восстановление",
    text: "Слайды, роллы и база после нагрузки, чтобы следующая тренировка не начиналась с боли.",
    icon: TimerReset,
  },
] as const

const quickFilters: readonly {
  label: string
  detail: string
  category: ActiveCategory
  search?: string
  sort?: CatalogSort
  icon: LucideIcon
}[] = [
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
    label: "Сумка + мелочи",
    detail: "то, что берут с собой",
    category: "bags",
    icon: Backpack,
  },
] as const

const kindLabels: Record<ProductKind, string> = {
  footwear: "Обувь",
  apparel: "Одежда",
  accessory: "Аксессуар",
}

const fallbackFromPrices: Record<ProductKind, string> = {
  footwear: "от 7 000 ₽",
  apparel: "от 3 000 ₽",
  accessory: "от 2 500 ₽",
}

function marketPriceToFrom(price: string): string {
  const firstNumber = price.match(/^\d+(?:[.,]\d+)?/)?.[0]
  if (!firstNumber) return `от ${price}`
  if (price.includes("тыс")) return `от ${firstNumber} тыс. ₽`
  return `от ${firstNumber} ₽`
}

function getDisplayPrice(product: CatalogProduct) {
  if (product.orderQuote) {
    return {
      detail: "по формуле",
      label: "Цена от",
      value: `от ${formatRub(product.orderQuote.totalRub)}`,
    }
  }

  if (product.marketPrice) {
    return {
      detail: "ориентир",
      label: "Цена от",
      value: marketPriceToFrom(product.marketPrice),
    }
  }

  return {
    detail: "после уточнения",
    label: "Цена от",
    value: fallbackFromPrices[product.kind],
  }
}

function getProductTags(product: CatalogProduct): string[] {
  const tags: string[] = []
  const note = product.note.toLowerCase()

  if (product.category === "volleyball") tags.push("волейбол")
  if (product.category === "basketball") tags.push("баскетбол для зала")
  if (product.category === "training") tags.push("ОФП")
  if (product.category === "recovery") tags.push("recovery")
  if (product.category === "lifestyle") tags.push("lifestyle")
  if (product.kind !== "footwear") tags.push(kindLabels[product.kind].toLowerCase())
  if (product.sportPriority) tags.push("для зала")
  if (/цеп|grip|traction/.test(note)) tags.push("цепкость")
  if (/амортиз|мягк|cushion/.test(note)) tags.push("амортизация")
  if (/стабил|боков|control/.test(note)) tags.push("стабильность")

  return Array.from(new Set(tags)).slice(0, 3)
}

function getProductBadge(product: CatalogProduct): string {
  const note = product.note.toLowerCase()
  if (product.category === "recovery") return "После зала"
  if (product.category === "basketball") return "Контроль"
  if (product.category === "volleyball") return /прыж|jump/.test(note) ? "Прыжок" : "Зал"
  if (product.kind === "accessory") return /колен|локот|tape|support|strap/.test(note) ? "Защита" : "Комплект"
  if (product.kind === "apparel") return "Форма"
  return "Everyday"
}

function getProductUse(product: CatalogProduct): string {
  const note = product.note.toLowerCase()
  if (/амортиз|мягк|cushion|призем/.test(note)) return "Для мягкого приземления"
  if (/стабил|боков|control|support/.test(note)) return "Для стабильной боковой работы"
  if (/цеп|grip|traction/.test(note)) return "Для цепкого зального покрытия"
  if (/ролл|slide|recovery|восстанов/.test(note)) return "Для восстановления после нагрузки"
  if (/резин|band|офп|силов|functional/.test(note)) return "Для ОФП и тренировочной базы"
  if (product.category === "basketball") return "Для резких смен направления"
  if (product.category === "volleyball") return "Для тренировок и игровых дней"
  if (product.kind === "apparel") return "Для формы, разминки и дороги в зал"
  return "Для комплекта вокруг основной пары"
}

const footwearSizes = [
  "EU 36",
  "EU 37",
  "EU 38",
  "EU 39",
  "EU 40",
  "EU 41",
  "EU 42",
  "EU 43",
  "EU 44",
  "EU 45",
  "EU 46",
] as const

const apparelSizes = ["XS", "S", "M", "L", "XL", "XXL"] as const
const supportSizes = ["S", "M", "L", "XL"] as const
const oneSize = ["One size"] as const

interface TaskMatch {
  product: CatalogProduct
  reason: string
  score: number
}

function getSizeOptions(product: CatalogProduct): readonly string[] {
  if (product.kind === "footwear") return footwearSizes
  if (product.kind === "apparel") return apparelSizes

  const productText = `${product.name} ${product.query}`.toLowerCase()
  if (/knee|elbow|sleeve|support|strap|pad|brace/.test(productText)) {
    return supportSizes
  }

  return oneSize
}

function normalizedText(value: string): string {
  return value.toLocaleLowerCase("ru").replace(/ё/g, "е")
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

  const words = normalizedTask
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3)
  for (const word of words) {
    if (haystack.includes(word)) add(2, "точное совпадение")
  }

  if (/прыг|прыж|jump|волей|зал/.test(normalizedTask)) {
    if (product.category === "volleyball" || product.kind === "footwear") {
      add(10, "прыжок и сцепление")
    }
  }

  if (/баскет|резк|смен|амортиз|cushion|control/.test(normalizedTask)) {
    if (product.category === "basketball" || product.kind === "footwear") {
      add(9, "амортизация и контроль")
    }
  }

  if (/колен|локт|защит|тейп|support|strap|pad|sleeve/.test(normalizedTask)) {
    if (product.category === "protection") add(12, "защита суставов")
  }

  if (/форма|джерси|худи|одеж|layer|jersey|hoodie/.test(normalizedTask)) {
    if (product.kind === "apparel") add(10, "форма и верхний слой")
  }

  if (/мяч|команд|ball|волейбол/.test(normalizedTask)) {
    if (product.category === "balls") add(10, "инвентарь для игры")
  }

  if (/восстанов|ролл|массаж|slide|recovery|после/.test(normalizedTask)) {
    if (product.category === "recovery") add(11, "восстановление после зала")
  }

  if (/резин|офп|тренир|бутыл|band|training|bottle/.test(normalizedTask)) {
    if (product.category === "training") add(9, "тренировочная база")
  }

  if (/сумк|рюкзак|носок|bag|sock|carry/.test(normalizedTask)) {
    if (product.category === "bags") add(9, "сумка и мелочи")
  }

  if (/дешев|бюдж|недорог|до\s?\d|price|cheap/.test(normalizedTask)) {
    if ((product.orderQuote?.totalRub ?? Number.MAX_SAFE_INTEGER) < 15000) {
      add(5, "мягче по бюджету")
    }
  }

  if (product.sportPriority) add(1, "спортивный приоритет")
  if (score <= 0) return null

  return {
    product,
    reason: Array.from(reasons).slice(0, 2).join(" + "),
    score,
  }
}

function findTaskMatches(task: string): TaskMatch[] {
  return catalogProducts
    .map((product) => scoreTaskProduct(product, task))
    .filter((match): match is TaskMatch => match !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const leftPrice = left.product.orderQuote?.totalRub ?? Number.MAX_SAFE_INTEGER
      const rightPrice = right.product.orderQuote?.totalRub ?? Number.MAX_SAFE_INTEGER
      return leftPrice - rightPrice
    })
    .slice(0, 6)
}

function isCategory(value: string | null): value is ActiveCategory {
  return catalogCategories.some((category) => category.id === value)
}

function isSort(value: string | null): value is CatalogSort {
  return sortOptions.some((option) => option.id === value)
}

function readUrlState(): UrlState {
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

export function LandingPage({ configuredBotUsername }: LandingPageProps) {
  const initialState = useMemo(() => readUrlState(), [])
  const [category, setCategory] = useState<ActiveCategory>(initialState.category)
  const [search, setSearch] = useState(initialState.search)
  const [taskPrompt, setTaskPrompt] = useState("")
  const [sort, setSort] = useState<CatalogSort>(initialState.sort)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initialState.productSlug,
  )
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  )
  const sheetHeadingRef = useRef<HTMLHeadingElement>(null)
  const productTriggerRef = useRef<HTMLButtonElement>(null)
  const galleryTouchStartX = useRef<number | null>(null)

  const botUsername = resolveBotUsername(
    configuredBotUsername === undefined
      ? import.meta.env.VITE_BOT_USERNAME
      : configuredBotUsername,
  )
  const botUrl = buildTelegramBotUrl(botUsername)
  const selectedProduct = useMemo(
    () => findProductBySlug(selectedSlug),
    [selectedSlug],
  )
  const selectedProductPrice = selectedProduct ? getDisplayPrice(selectedProduct) : null
  const heroProducts = useMemo(
    () =>
      heroProductSlugs
        .map((slug) => findProductBySlug(slug))
        .filter((product): product is CatalogProduct => product !== null),
    [],
  )
  const selectedGallery = selectedProduct?.gallery ?? []
  const selectedVisibleGallery = selectedGallery.slice(0, 7)
  const selectedImage =
    selectedVisibleGallery[
      Math.min(selectedImageIndex, selectedVisibleGallery.length - 1)
    ] ??
    null
  const selectedImageDisplayIndex =
    selectedVisibleGallery.length === 0
      ? 0
      : Math.min(selectedImageIndex, selectedVisibleGallery.length - 1) + 1
  const selectedSizeOptions = selectedProduct ? getSizeOptions(selectedProduct) : []
  const filteredProducts = useMemo(() => {
    return sortCatalog(filterCatalog(catalogProducts, category, search), sort)
  }, [category, search, sort])
  const taskMatches = useMemo(() => findTaskMatches(taskPrompt), [taskPrompt])
  const request = selectedProduct
    ? buildOrderRequest(selectedProduct, selectedSize)
    : ""

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

    const nextPath = `${url.pathname}${url.search}${url.hash}`
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextPath === currentPath) return

    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", nextPath)
  }

  const selectProductImage = (index: number) => {
    setSelectedImageIndex(() => {
      const count = selectedVisibleGallery.length
      if (count <= 0) return 0
      return Math.max(0, Math.min(index, count - 1))
    })
  }

  const showPreviousProductImage = () => {
    setSelectedImageIndex((index) => {
      const count = selectedVisibleGallery.length
      if (count <= 1) return 0
      return (index - 1 + count) % count
    })
  }

  const showNextProductImage = () => {
    setSelectedImageIndex((index) => {
      const count = selectedVisibleGallery.length
      if (count <= 1) return 0
      return (index + 1) % count
    })
  }

  useEffect(() => {
    const handlePopState = () => {
      const nextState = readUrlState()
      setCategory(nextState.category)
      setSearch(nextState.search)
      setSort(nextState.sort)
      setSelectedSlug(nextState.productSlug)
      setSelectedImageIndex(0)
      setSelectedSize(null)
      setCopyState("idle")
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    const scrollToHashTarget = () => {
      if (window.location.hash !== "#catalog") return
      requestAnimationFrame(() => {
        document.getElementById("catalog")?.scrollIntoView({ block: "start" })
      })
    }

    scrollToHashTarget()
    window.addEventListener("hashchange", scrollToHashTarget)
    return () => window.removeEventListener("hashchange", scrollToHashTarget)
  }, [])

  useEffect(() => {
    if (!selectedSlug || selectedProduct) return
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    setSelectedSize(null)
    writeUrl({ productSlug: null }, "replace")
  })

  useEffect(() => {
    if (!selectedProduct) return
    sheetHeadingRef.current?.focus({ preventScroll: true })
  }, [selectedProduct])

  useEffect(() => {
    if (!selectedProduct) return
    setSelectedImageIndex((index) =>
      Math.min(index, Math.max(0, selectedVisibleGallery.length - 1)),
    )
  }, [selectedProduct, selectedVisibleGallery.length])

  useEffect(() => {
    if (!selectedProduct) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeProduct()
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        showPreviousProductImage()
        return
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        showNextProductImage()
        return
      }

      if (event.key !== "Tab") return

      const dialog = document.querySelector<HTMLElement>(".product-sheet")
      if (!dialog) return

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"))

      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleDialogKeys)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleDialogKeys)
    }
  })

  const selectCategory = (nextCategory: ActiveCategory) => {
    setCategory(nextCategory)
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    setSelectedSize(null)
    setCopyState("idle")
    writeUrl({ category: nextCategory, productSlug: null })
  }

  const updateSearch = (nextSearch: string) => {
    setSearch(nextSearch)
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    setSelectedSize(null)
    writeUrl({ search: nextSearch, productSlug: null })
  }

  const updateSort = (nextSort: CatalogSort) => {
    setSort(nextSort)
    writeUrl({ sort: nextSort })
  }

  const applyQuickFilter = (filter: (typeof quickFilters)[number]) => {
    const nextSearch = filter.search ?? ""
    const nextSort = filter.sort ?? "featured"
    setCategory(filter.category)
    setSearch(nextSearch)
    setSort(nextSort)
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    setSelectedSize(null)
    setCopyState("idle")
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
    setSelectedImageIndex(0)
    setSelectedSize(null)
    setCopyState("idle")
    writeUrl({ category: "all", search: "", sort: "featured", productSlug: null })
  }

  const openProduct = (product: CatalogProduct, trigger: HTMLButtonElement) => {
    productTriggerRef.current = trigger
    setCopyState("idle")
    setSelectedSlug(product.slug)
    setSelectedImageIndex(0)
    setSelectedSize(null)
    writeUrl({ productSlug: product.slug }, "push")
  }

  const closeProduct = () => {
    const trigger = productTriggerRef.current
    setSelectedSlug(null)
    setSelectedImageIndex(0)
    setSelectedSize(null)
    setCopyState("idle")
    writeUrl({ productSlug: null }, "replace")
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    })
  }

  const copyRequest = async () => {
    const copied = await copyOrderRequest(request)
    setCopyState(copied ? "copied" : "failed")
  }

  return (
    <div className={`kb-page ${selectedProduct ? "kb-page--sheet-open" : ""}`}>
      <a className="skip-link" href="#catalog">
        Перейти к каталогу
      </a>

      <header className="kb-header">
        <a className="kb-brand" href="/" aria-label="KICKSBASE">
          <img src="brand/kicksbase-logo.webp" width="80" height="80" alt="" />
          <span>
            <strong>KICKSBASE</strong>
            <small>Заловая экипировка</small>
          </span>
        </a>

        <nav className="kb-nav" aria-label="Основная навигация">
          <a href="#catalog">Каталог</a>
          <a href="#how-it-works">Заказ</a>
          <a href="#trust">Условия</a>
        </nav>

        {botUrl ? (
          <a
            className="kb-header__cta"
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send aria-hidden="true" size={17} />
            Telegram
          </a>
        ) : (
          <a className="kb-header__cta" href="#catalog">
            <ShoppingBag aria-hidden="true" size={17} />
            Выбрать
          </a>
        )}
      </header>

      <main>
        <section className="shop-hero" aria-labelledby="hero-title">
          <div className="shop-hero__copy">
            <p className="eyebrow">POIZON sports edit · Moscow delivery</p>
            <h1 id="hero-title">KICKSBASE</h1>
            <p className="shop-hero__lead">
              Спортивная витрина с расчетом до оплаты: игровые пары, защита,
              форма и восстановление. Выбираете модель, менеджер подтверждает
              размер, продавца, бирки и итог.
            </p>
            <div className="hero-actions">
              <a className="button button--primary" href="#catalog">
                <ShoppingBag aria-hidden="true" size={18} />
                Открыть витрину
              </a>
              {botUrl ? (
                <a
                  className="button button--quiet"
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Send aria-hidden="true" size={18} />
                  Написать менеджеру
                </a>
              ) : null}
            </div>
            <div className="pavel-note">
              <Medal aria-hidden="true" size={18} />
              <span>
                Сначала задача и покрытие. Потом модель, размер, продавец и цвет.
              </span>
            </div>
            <div className="hero-marks" aria-label="Преимущества каталога">
              <span>
                <BadgeCheck aria-hidden="true" size={16} />
                Обувь под зал
              </span>
              <span>
                <BadgeCheck aria-hidden="true" size={16} />
                Расчёт до оплаты
              </span>
              <span>
                <BadgeCheck aria-hidden="true" size={16} />
                Бирки и упаковка
              </span>
            </div>
            <dl className="hero-stats" aria-label="Показатели каталога">
              <div>
                <dt>Позиций</dt>
                <dd>{catalogProducts.length}</dd>
              </div>
              <div>
                <dt>Ракурсов</dt>
                <dd>{catalogProducts.length * 5}</dd>
              </div>
              <div>
                <dt>Категорий</dt>
                <dd>{catalogCategories.length - 1}</dd>
              </div>
            </dl>
          </div>
          <div className="shop-hero__media" aria-hidden="true">
            <div className="hero-product-stage hero-product-stage--atmosphere">
              <img
                src="brand/kicksbase-hero-court-v2.webp"
                width="1792"
                height="1024"
                alt=""
              />
              <span className="hero-product-stage__caption">
                <strong>COURT KIT</strong>
                <em>Pair, protection, recovery</em>
              </span>
            </div>
          </div>
          <div className="hero-board" aria-label="Быстрый выбор экипировки">
            <div className="hero-board__head">
              <span>Buyer’s edit</span>
              <small>3 быстрых входа</small>
            </div>
            {heroProducts.map((product) => {
              const price = getDisplayPrice(product)

              return (
                <button
                  className="hero-pick"
                  key={product.slug}
                  type="button"
                  onClick={(event) => openProduct(product, event.currentTarget)}
                >
                  <img
                    src={resolveAssetUrl(product.image)}
                    width="1200"
                    height="900"
                    alt=""
                    onError={(event) => {
                      setImageFallback(event, product.fallbackImage)
                    }}
                  />
                  <span>
                    <small>{getProductBadge(product)}</small>
                    <strong>{product.brand} {product.name}</strong>
                    <em>{price.value}</em>
                  </span>
                  <MoveRight aria-hidden="true" size={18} />
                </button>
              )
            })}
          </div>
        </section>

        <section className="brand-system" aria-label="Система подбора KICKSBASE">
          <article>
            <span>BASE 01</span>
            <strong>Обувь под движение</strong>
            <p>Прыжок, боковая работа, мягкое приземление и пары, которые волейболисты часто берут из баскетбола.</p>
          </article>
          <article>
            <span>BASE 02</span>
            <strong>Комплект на тренировку</strong>
            <p>Защита, мячи, резина, бутылки, носки и сумки — без лишнего шума, сразу вокруг реального зала.</p>
          </article>
          <article>
            <span>BASE 03</span>
            <strong>Расчет до оплаты</strong>
            <p>В карточке видно цену от, формулу заказа и что менеджер уточнит перед финальным подтверждением.</p>
          </article>
        </section>

        <section className="editorial-index" aria-labelledby="editorial-index-title">
          <div className="editorial-index__copy">
            <p className="eyebrow">Игровой индекс</p>
            <h2 id="editorial-index-title">Собирайте базу от задачи.</h2>
            <p>
              Пара для прыжка, защита, мяч для команды или восстановление после зала.
              Так каталог работает как раздевалка перед тренировкой, а не как склад.
            </p>
          </div>
          <div className="editorial-index__grid" aria-label="Быстрые входы в каталог">
            {editorialIndex.map((item) => {
              const EditorialIcon = item.icon

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectCategory(item.id)}
                  aria-pressed={category === item.id}
                >
                  <span>
                    <small>{item.code}</small>
                    <strong>{item.title}</strong>
                  </span>
                  <em>{item.text}</em>
                  <EditorialIcon aria-hidden="true" size={22} />
                </button>
              )
            })}
          </div>
        </section>

        <section className="catalog-shell" id="catalog" aria-labelledby="catalog-title">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">Каталог</p>
              <h2 id="catalog-title">Выберите экипировку под свою игру.</h2>
            </div>
            <p>
              Разделы собраны по реальным сценариям: прыжок, боковая работа,
              защита коленей, тренировка и восстановление после зала.
            </p>
          </div>

          <div className="ai-finder" aria-label="AI-подбор под задачу">
            <div className="ai-finder__copy">
              <Sparkles aria-hidden="true" size={22} />
              <span>
                <strong>AI-подбор под задачу</strong>
                <em>Опишите игру, покрытие, боль или бюджет, а каталог поднимет подходящие позиции.</em>
              </span>
            </div>
            <label className="ai-finder__input">
              <span className="sr-only">Опишите задачу для AI-подбора</span>
              <Search aria-hidden="true" size={18} />
              <input
                type="search"
                value={taskPrompt}
                onChange={(event) => setTaskPrompt(event.target.value)}
                placeholder="Например: прыжок в волейболе, мягкое приземление, защита коленей..."
                autoComplete="off"
              />
            </label>
            <div className="ai-finder__chips" aria-label="Быстрые задачи">
              {[
                "прыжок и мягкое приземление",
                "защита коленей",
                "мяч для команды",
                "восстановление после зала",
              ].map((task) => (
                <button
                  key={task}
                  type="button"
                  onClick={() => setTaskPrompt(task)}
                >
                  {task}
                </button>
              ))}
            </div>
            {taskPrompt.trim() ? (
              <div className="ai-finder__results" aria-live="polite">
                {taskMatches.length > 0 ? (
                  taskMatches.slice(0, 4).map((match) => {
                    const price = getDisplayPrice(match.product)

                    return (
                      <button
                        key={match.product.slug}
                        type="button"
                        onClick={(event) =>
                          openProduct(match.product, event.currentTarget)
                        }
                      >
                        <img
                          src={resolveAssetUrl(match.product.image)}
                          width="1200"
                          height="900"
                          alt=""
                          onError={(event) => {
                            setImageFallback(event, match.product.fallbackImage)
                          }}
                        />
                        <span>
                          <small>{match.reason}</small>
                          <strong>{match.product.brand} {match.product.name}</strong>
                          <em>{price.value}</em>
                        </span>
                        <MoveRight aria-hidden="true" size={18} />
                      </button>
                    )
                  })
                ) : (
                  <p>Не нашли точного совпадения. Попробуйте указать спорт, покрытие или бюджет.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="scenario-grid" aria-label="Сценарии выбора">
            {scenarioTiles.map((tile) => {
              const ScenarioIcon = tile.icon

              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => selectCategory(tile.id)}
                  aria-pressed={category === tile.id}
                >
                  <span className="scenario-grid__icon" aria-hidden="true">
                    <ScenarioIcon size={22} />
                  </span>
                  <span>
                    <small>{categoryDetails[tile.id]}</small>
                    <strong>{tile.title}</strong>
                    <em>{tile.text}</em>
                  </span>
                  <MoveRight aria-hidden="true" size={18} />
                </button>
              )
            })}
          </div>

          <div className="catalog-toolbar" aria-label="Фильтры каталога">
            <label className="catalog-search">
              <span className="sr-only">Поиск по каталогу</span>
              <Search aria-hidden="true" size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Nike, ASICS, Mizuno, наколенники, мяч..."
                autoComplete="off"
              />
            </label>

            <label className="catalog-sort">
              <SlidersHorizontal aria-hidden="true" size={18} />
              <span className="sr-only">Сортировка</span>
              <select
                value={sort}
                onChange={(event) => updateSort(event.target.value as CatalogSort)}
              >
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="icon-button" type="button" onClick={resetCatalog}>
              <RotateCcw aria-hidden="true" size={18} />
              <span className="sr-only">Сбросить фильтры</span>
            </button>
          </div>

          <div className="quick-refine" aria-label="Быстрые подборки">
            {quickFilters.map((filter) => {
              const QuickIcon = filter.icon
              const pressed =
                category === filter.category &&
                search === (filter.search ?? "") &&
                sort === (filter.sort ?? "featured")

              return (
                <button
                  key={`${filter.category}-${filter.label}`}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => applyQuickFilter(filter)}
                >
                  <QuickIcon aria-hidden="true" size={18} />
                  <span>
                    <strong>{filter.label}</strong>
                    <em>{filter.detail}</em>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="category-row" role="group" aria-label="Категории">
            {catalogCategories.map((item) => {
              const CategoryIcon = categoryIcons[item.id]

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={category === item.id}
                  onClick={() => selectCategory(item.id)}
                  data-tone={categoryTone[item.id]}
                >
                  <span className="category-row__mark" aria-hidden="true" />
                  <span className="category-row__icon" aria-hidden="true">
                    <CategoryIcon size={19} strokeWidth={2.2} />
                  </span>
                  <span className="category-row__content">
                    <span>{item.label}</span>
                    <em>{categoryDetails[item.id]}</em>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="catalog-status" aria-live="polite">
            <span>{categoryCopy[category]}</span>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product, index) => {
                const price = getDisplayPrice(product)
                const tags = getProductTags(product)
                const alternateImage = product.gallery[1]?.src ?? product.image
                const productUse = getProductUse(product)
                const productAccent =
                  product.kind === "footwear"
                    ? "Performance"
                    : product.kind === "apparel"
                      ? "Layer"
                      : "Gear"

                return (
                  <button
                    className="product-card"
                    type="button"
                    key={product.slug}
                    data-category={product.category}
                    style={{ "--card-index": index } as CSSProperties}
                    onClick={(event) => openProduct(product, event.currentTarget)}
                    aria-label={`Открыть карточку: ${product.brand} ${product.name}`}
                  >
                    <span className="product-card__visual">
                      <img
                        className="product-card__image product-card__image--primary"
                        src={resolveAssetUrl(product.image)}
                        width="1200"
                        height="900"
                        loading={index < 8 ? "eager" : "lazy"}
                        decoding="async"
                        alt=""
                        onError={(event) => {
                          setImageFallback(event, product.fallbackImage)
                        }}
                      />
                      <img
                        className="product-card__image product-card__image--alt"
                        src={resolveAssetUrl(alternateImage)}
                        width="1200"
                        height="900"
                        loading="lazy"
                        decoding="async"
                        alt=""
                        onError={(event) => {
                          setImageFallback(event, product.fallbackImage)
                        }}
                      />
                      <span className="product-card__badge">{productAccent}</span>
                      <span className="product-card__category">
                        {product.categoryLabel}
                      </span>
                    </span>
                    <span className="product-card__body">
                      <span className="product-card__topline">
                        <span className="product-card__brand">{product.brand}</span>
                        <span className="product-card__kind">{kindLabels[product.kind]}</span>
                      </span>
                      <strong>{product.name}</strong>
                      <span className="product-card__meta">
                        {productUse}
                      </span>
                      <span className="product-card__tags" aria-hidden="true">
                        {tags.slice(0, 2).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </span>
                      <span className="product-card__bottom">
                        <span>
                          <small>{price.label}</small>
                          <b>{price.value}</b>
                          <em>{price.detail}</em>
                        </span>
                        <span className="product-card__cta">
                          Подробнее
                          <ArrowUpRight aria-hidden="true" size={16} />
                        </span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="catalog-empty" role="status">
              <h3>Ничего не нашли по этому запросу.</h3>
              <p>
                Попробуйте бренд, модель или категорию: ASICS, Mizuno, Nike,
                баскетбол, recovery.
              </p>
              <button type="button" className="button button--quiet" onClick={resetCatalog}>
                <RotateCcw aria-hidden="true" size={18} />
                Показать всю подборку
              </button>
            </div>
          )}
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">Как заказать</p>
            <h2 id="how-title">Заказ без лишней переписки.</h2>
          </div>
          <ol className="steps">
            <li>
              <span>1</span>
              <h3>Выберите товар</h3>
              <p>Откройте карточку, посмотрите ракурсы, назначение и цену от.</p>
            </li>
            <li>
              <span>2</span>
              <h3>Отправьте заявку</h3>
              <p>Сайт соберёт короткое сообщение с моделью и ценой для Telegram.</p>
            </li>
            <li>
              <span>3</span>
              <h3>Получите финальный расчёт</h3>
              <p>Размер, продавец, бирки, упаковка и итоговая сумма фиксируются до оплаты.</p>
            </li>
          </ol>
        </section>

        <section className="trust-section" id="trust" aria-labelledby="trust-title">
          <div className="section-heading">
            <p className="eyebrow">Перед оплатой</p>
            <h2 id="trust-title">Перед оплатой всё должно быть понятно.</h2>
          </div>
          <div className="trust-grid">
            <article>
              <h3>Карточка товара</h3>
              <p>Показываем размер, цвет, продавца, бирки и упаковку по конкретной позиции.</p>
            </article>
            <article>
              <h3>Честный итог</h3>
              <p>Считаем выкуп, комиссию, логистику и доставку до оплаты без внезапных доплат.</p>
            </article>
            <article>
              <h3>Подбор под игру</h3>
              <p>Собираем пару, защиту и инвентарь под зал, нагрузку и бюджет.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="kb-footer">
        <div className="kb-footer__intro">
          <a className="kb-brand" href="/" aria-label="KICKSBASE">
            <img src="brand/kicksbase-logo.webp" width="80" height="80" alt="" />
            <span>
              <strong>KICKSBASE</strong>
              <small>Заловая экипировка</small>
            </span>
          </a>
          <p>
            Витрина для быстрого выбора экипировки под заказ через Telegram. Вы
            выбираете товар и получаете размер, бирки, упаковку и финальную сумму до оплаты.
          </p>
        </div>

        <div className="kb-footer__grid" aria-label="Уточнения по заказу">
          <article>
            <strong>Детали заказа</strong>
            <p>SKU, продавец, размер, цвет и наличие.</p>
          </article>
          <article>
            <strong>Расчет</strong>
            <p>Цена выкупа, комиссия, логистика и итог.</p>
          </article>
          <article>
            <strong>Поддержка</strong>
            <p>Фото товара, бирки и упаковка перед оплатой.</p>
          </article>
        </div>

        <div className="kb-footer__bottom">
          <p>
            Товарные знаки принадлежат их владельцам. Финальное подтверждение по
            заказу всегда делается менеджером перед оплатой.
          </p>
          <a href="#catalog">Открыть каталог</a>
        </div>
      </footer>

      {selectedProduct && (
        <>
          <button
            className="sheet-scrim"
            type="button"
            onClick={closeProduct}
            aria-label="Закрыть карточку товара"
          />
          <aside
            className="product-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-sheet-title"
            data-testid="order-dock"
          >
            <button
              className="product-sheet__close"
              type="button"
              onClick={closeProduct}
              aria-label="Закрыть карточку товара"
            >
              <X aria-hidden="true" size={20} />
            </button>

            <div
              className="product-sheet__media"
              onTouchStart={(event) => {
                galleryTouchStartX.current = event.touches[0]?.clientX ?? null
              }}
              onTouchEnd={(event) => {
                const startX = galleryTouchStartX.current
                galleryTouchStartX.current = null
                const endX = event.changedTouches[0]?.clientX
                if (startX === null || endX === undefined) return
                const deltaX = endX - startX
                if (Math.abs(deltaX) < 42) return
                if (deltaX > 0) showPreviousProductImage()
                else showNextProductImage()
              }}
            >
              <img
                key={selectedImage?.src ?? selectedProduct.fallbackImage}
                src={resolveAssetUrl(selectedImage?.src ?? selectedProduct.fallbackImage)}
                width="1200"
                height="900"
                alt={selectedImage?.alt ?? `${selectedProduct.brand} ${selectedProduct.name}`}
                onError={(event) => {
                  setImageFallback(event, selectedProduct.fallbackImage)
                }}
              />
              <button
                className="product-sheet__nav product-sheet__nav--prev"
                type="button"
                onClick={showPreviousProductImage}
                disabled={selectedVisibleGallery.length <= 1}
                aria-label="Предыдущее фото товара"
              >
                <ChevronLeft aria-hidden="true" size={24} />
              </button>
              <button
                className="product-sheet__nav product-sheet__nav--next"
                type="button"
                onClick={showNextProductImage}
                disabled={selectedVisibleGallery.length <= 1}
                aria-label="Следующее фото товара"
              >
                <ChevronRight aria-hidden="true" size={24} />
              </button>
              <div className="product-sheet__media-meta">
                <span>
                  {selectedImageDisplayIndex}/{selectedVisibleGallery.length}
                </span>
                <strong>{selectedProduct.brand}</strong>
              </div>
              <div className="product-sheet__dots" aria-label="Фото товара">
                {selectedVisibleGallery.map((image, index) => (
                  <button
                    key={`dot-${image.src}-${index}`}
                    type="button"
                    aria-label={`Показать фото ${index + 1}`}
                    aria-current={index === selectedImageIndex}
                    onClick={() => selectProductImage(index)}
                  />
                ))}
              </div>
              <div className="product-sheet__thumbs" aria-label="Галерея товара">
                {selectedVisibleGallery.map((image, index) => (
                  <button
                    key={`${image.src}-${index}`}
                    type="button"
                    aria-label={`Показать фото ${index + 1}`}
                    aria-current={index === selectedImageIndex}
                    onClick={() => selectProductImage(index)}
                  >
                    <img
                      src={resolveAssetUrl(image.src)}
                      width="120"
                      height="90"
                      alt=""
                      onError={(event) => {
                        setImageFallback(event, selectedProduct.fallbackImage)
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="product-sheet__content">
              <p className="eyebrow">
                {selectedProduct.sportPriority ? "Для зала" : kindLabels[selectedProduct.kind]}
              </p>
              <h2 id="product-sheet-title" ref={sheetHeadingRef} tabIndex={-1}>
                {selectedProduct.brand} {selectedProduct.name}
              </h2>
              <p>{selectedProduct.note}</p>

              <div className="product-size" aria-label="Выбор размера">
                <span>
                  <strong>Размер</strong>
                  <em>Выберите перед заявкой, менеджер проверит наличие</em>
                </span>
                <div className="product-size__grid">
                  {selectedSizeOptions.map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={selectedSize === size}
                      onClick={() => {
                        setSelectedSize(size)
                        setCopyState("idle")
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="product-sheet__purchase">
                <span>
                  <small>{selectedProductPrice?.label}</small>
                  <strong>{selectedProductPrice?.value}</strong>
                  <em>{selectedProductPrice?.detail}</em>
                </span>
                {botUrl ? (
                  <a
                    className="button button--primary"
                    href={botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!selectedSize}
                    onClick={(event) => {
                      if (selectedSize) return
                      event.preventDefault()
                    }}
                  >
                    <Send aria-hidden="true" size={18} />
                    {selectedSize ? "Заказать" : "Выберите размер"}
                  </a>
                ) : (
                  <a className="button button--primary" href="#catalog" onClick={closeProduct}>
                    <ShoppingBag aria-hidden="true" size={18} />
                    Выбрать размер
                  </a>
                )}
              </div>

              <dl className="product-facts">
                <div>
                  <dt>Категория</dt>
                  <dd>{selectedProduct.categoryLabel}</dd>
                </div>
                <div>
                  <dt>Тип</dt>
                  <dd>{kindLabels[selectedProduct.kind]}</dd>
                </div>
                <div>
                  <dt>Размер</dt>
                  <dd>{selectedSize ?? "Не выбран"}</dd>
                </div>
                <div>
                  <dt>{selectedProductPrice?.label}</dt>
                  <dd>{selectedProductPrice?.value}</dd>
                </div>
              </dl>

              {selectedProduct.orderQuote ? (
                <dl className="price-breakdown" aria-label="Расчет заказа">
                  <div>
                    <dt>Цена источника</dt>
                    <dd>¥{selectedProduct.orderQuote.priceYuan}</dd>
                  </div>
                  <div>
                    <dt>Курс</dt>
                    <dd>{selectedProduct.orderQuote.yuanRate} ₽/¥</dd>
                  </div>
                  <div>
                    <dt>Выкуп</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.purchaseRub)}</dd>
                  </div>
                  <div>
                    <dt>Оплата {selectedProduct.orderQuote.paymentFeePercent}%</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.paymentFee)}</dd>
                  </div>
                  <div>
                    <dt>Логистика</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.internationalLogistics)}</dd>
                  </div>
                  <div>
                    <dt>Сервис {selectedProduct.orderQuote.serviceFeePercent}%</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.serviceFee)}</dd>
                  </div>
                  <div>
                    <dt>РФ доставка</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.rfDelivery)}</dd>
                  </div>
                  <div>
                    <dt>Итого</dt>
                    <dd>{formatRub(selectedProduct.orderQuote.totalRub)}</dd>
                  </div>
                </dl>
              ) : null}

              <p className="product-sheet__fineprint">
                {selectedProduct.formulaBasis && selectedProduct.orderQuote
                  ? `${selectedProduct.formulaBasis}: ¥${selectedProduct.orderQuote.priceYuan} × ${selectedProduct.orderQuote.yuanRate} ₽ + комиссия оплаты ${selectedProduct.orderQuote.paymentFeePercent}% + международная логистика ${formatRub(selectedProduct.orderQuote.internationalLogistics)} + сервис max(${formatRub(selectedProduct.orderQuote.serviceFeeFloor)}, ${selectedProduct.orderQuote.serviceFeePercent}%). Финальный расчет обновляется после подтверждения размера, наличия и продавца.`
                  : selectedProduct.priceBasis
                    ? `${selectedProduct.priceBasis}. Финальный расчет формируется после подтверждения карточки, размера и продавца.`
                    : "Цена, размер, цвет, наличие, бирки и упаковка подтверждаются по конкретному товару перед оплатой."}
              </p>

              <p className="product-sheet__order-proof">
                После заявки пришлем расчет, фото или скрин товара, доступный размер,
                цвет, продавца, бирки и финальную сумму перед оплатой.
              </p>

              <label className="request-box">
                <span>Запрос менеджеру</span>
                <textarea readOnly value={request} rows={3} />
              </label>

              <div className="product-sheet__actions">
                <button type="button" className="button button--quiet" onClick={copyRequest}>
                  <Copy aria-hidden="true" size={18} />
                  {copyState === "copied" ? "Запрос готов" : "Скопировать запрос"}
                </button>
                {botUrl ? (
                  <a
                    className="button button--primary"
                    href={botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Send aria-hidden="true" size={18} />
                    Открыть @{botUsername}
                  </a>
                ) : (
                  <p className="product-sheet__demo">
                    Ссылка на менеджера появится после подключения Telegram.
                  </p>
                )}
              </div>

              {copyState === "failed" ? (
                <p className="product-sheet__feedback" role="alert">
                  Не удалось скопировать автоматически. Выделите текст выше и скопируйте его вручную.
                </p>
              ) : null}
              <p className="sr-only" aria-live="polite">
                {copyState === "copied" ? "Запрос скопирован в буфер обмена" : ""}
              </p>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
