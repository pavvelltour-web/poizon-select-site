export const catalogCategories = [
  { id: "all", label: "Всё" },
  { id: "court-shoes", label: "Заловая обувь" },
  { id: "sneakers", label: "Кроссовки и кеды" },
  { id: "volleyball", label: "Волейбол" },
  { id: "basketball", label: "Баскетбол" },
  { id: "apparel", label: "Одежда" },
  { id: "protection", label: "Защита" },
  { id: "balls", label: "Мячи" },
  { id: "training", label: "Инвентарь" },
  { id: "recovery", label: "Recovery" },
  { id: "bags", label: "Сумки и мелочи" },
] as const

export type CatalogCategory = Exclude<
  (typeof catalogCategories)[number]["id"],
  "all"
>

export type ProductCategory =
  | "volleyball"
  | "basketball"
  | "training"
  | "recovery"
  | "lifestyle"
  | "apparel"
  | "protection"
  | "balls"
  | "bags"

export type ProductKind = "footwear" | "apparel" | "accessory"
export type CatalogSort = "featured" | "price-asc" | "price-desc" | "name"

export const MARKET_PRICE_BASIS =
  "Редакционный ориентир · рынок РФ 28.07.2026"

export const PRICE_FORMULA_BASIS =
  "Расчет по текущей формуле заказа"

export interface CatalogImage {
  src: string
  alt: string
  source?: string
}

export interface PriceQuote {
  productKind: ProductKind
  priceYuan: number
  yuanRate: number
  purchaseRub: number
  paymentFeePercent: number
  paymentFee: number
  acquiringFeePercent: number
  acquiringFee: number
  internationalLogistics: number
  inboundLogisticsRub: number
  mandatoryFees: number
  reservePercent: number
  reserveFee: number
  usnTaxPercent: number
  usnTax: number
  vatProfile: "vat_exempt" | "vat_included"
  vatPercent: number
  vatAmount: number
  marginTargetPercent: number
  marginFloorPercent: number
  marginPercent: number
  marginAmount: number
  serviceFeePercent: number
  serviceFeeFloor: number
  serviceFee: number
  quoteRub: number
  rfDelivery: number
  totalRub: number
}

export interface CatalogProduct {
  slug: string
  brand: string
  name: string
  category: ProductCategory
  categoryLabel: string
  kind: ProductKind
  sportPriority: boolean
  query: string
  note: string
  marketPrice?: string
  priceBasis?: string
  chinaPriceYuan?: number
  formulaBasis?: string
  image: string
  fallbackImage: string
  gallery: readonly CatalogImage[]
  orderQuote?: PriceQuote
}

type ProductSource = Omit<
  CatalogProduct,
  "fallbackImage" | "formulaBasis" | "gallery" | "image" | "orderQuote"
> & {
  assetSlug?: string
  gallery?: readonly CatalogImage[]
}

const pricingDefaults = {
  yuanRate: 13,
  acquiringFeePercent: 2.5,
  inboundLogisticsRub: 3000,
  mandatoryFees: 0,
  reservePercent: 3,
  usnTaxPercent: 6,
  vatProfile: "vat_exempt" as const,
  vatPercent: 22,
  roundToRub: 100,
  rfDelivery: 0,
} as const

const marginTiers = [
  { max: 8_000, target: 40, floor: 35 },
  { max: 20_000, target: 30, floor: 25 },
  { max: Number.POSITIVE_INFINITY, target: 25, floor: 20 },
] as const

function money(value: number): number {
  return Math.round((value + 1e-9) * 100) / 100
}

function roundUp(value: number, step: number): number {
  return money(Math.ceil((value - 1e-9) / step) * step)
}

function marginTierForLandedCost(landedCost: number) {
  return marginTiers.find((tier) => landedCost <= tier.max) ?? marginTiers.at(-1)!
}

function vatLoadPercent(
  vatProfile: "vat_exempt" | "vat_included",
  vatPercent: number,
): number {
  return vatProfile === "vat_exempt" ? 0 : (vatPercent / (100 + vatPercent)) * 100
}

export function calculateOrderQuote(
  priceYuan: number,
  productKind: ProductKind,
): PriceQuote {
  const purchaseRub = money(priceYuan * pricingDefaults.yuanRate)
  const landedCost = money(
    purchaseRub +
      pricingDefaults.inboundLogisticsRub +
      pricingDefaults.mandatoryFees,
  )
  const tier = marginTierForLandedCost(landedCost)
  const vatLoad = vatLoadPercent(
    pricingDefaults.vatProfile,
    pricingDefaults.vatPercent,
  )
  const quoteRub = roundUp(
    landedCost /
      (1 -
        (tier.target +
          pricingDefaults.acquiringFeePercent +
          pricingDefaults.reservePercent +
          pricingDefaults.usnTaxPercent +
          vatLoad) /
          100),
    pricingDefaults.roundToRub,
  )
  const acquiringFee = money((quoteRub * pricingDefaults.acquiringFeePercent) / 100)
  const reserveFee = money((quoteRub * pricingDefaults.reservePercent) / 100)
  const usnTax = money((quoteRub * pricingDefaults.usnTaxPercent) / 100)
  const vatAmount = money((quoteRub * vatLoad) / 100)
  const marginAmount = money(
    quoteRub -
      purchaseRub -
      pricingDefaults.inboundLogisticsRub -
      pricingDefaults.mandatoryFees -
      acquiringFee -
      reserveFee -
      usnTax -
      vatAmount,
  )
  const totalRub = money(quoteRub + pricingDefaults.rfDelivery)

  return {
    productKind,
    priceYuan,
    yuanRate: pricingDefaults.yuanRate,
    purchaseRub,
    paymentFeePercent: pricingDefaults.acquiringFeePercent,
    paymentFee: acquiringFee,
    acquiringFeePercent: pricingDefaults.acquiringFeePercent,
    acquiringFee,
    internationalLogistics: pricingDefaults.inboundLogisticsRub,
    inboundLogisticsRub: pricingDefaults.inboundLogisticsRub,
    mandatoryFees: money(
      pricingDefaults.mandatoryFees + reserveFee + usnTax + vatAmount,
    ),
    reservePercent: pricingDefaults.reservePercent,
    reserveFee,
    usnTaxPercent: pricingDefaults.usnTaxPercent,
    usnTax,
    vatProfile: pricingDefaults.vatProfile,
    vatPercent: pricingDefaults.vatProfile === "vat_exempt" ? 0 : pricingDefaults.vatPercent,
    vatAmount,
    marginTargetPercent: tier.target,
    marginFloorPercent: tier.floor,
    marginPercent: tier.target,
    marginAmount,
    serviceFeePercent: tier.target,
    serviceFeeFloor: 0,
    serviceFee: marginAmount,
    quoteRub,
    rfDelivery: pricingDefaults.rfDelivery,
    totalRub,
  }
}

export function formatRub(amount: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\u00a0/g, " ")} ₽`
}

function projectGallery(product: ProductSource): CatalogImage[] {
  const assetSlug = product.assetSlug ?? product.slug
  const frames = [
    `catalog/${assetSlug}.webp`,
    `catalog/gallery/${assetSlug}-2.webp`,
    `catalog/gallery/${assetSlug}-3.webp`,
    `catalog/gallery/${assetSlug}-4.webp`,
    `catalog/gallery/${assetSlug}-5.webp`,
  ]

  return frames.map((src, index) => ({
    src,
    alt: `${product.brand} ${product.name} · ракурс ${index + 1}`,
    source: "Project-generated studio reference",
  }))
}

const sportProducts: readonly ProductSource[] = [
  {
    slug: "asics-sky-elite-ff-3",
    brand: "ASICS",
    name: "SKY ELITE FF 3",
    category: "volleyball",
    categoryLabel: "Волейбол · прыжок",
    kind: "footwear",
    sportPriority: true,
    query: "ASICS SKY ELITE FF 3 volleyball",
    note: "Флагманский low · для атакующих игроков",
    marketPrice: "17,5–20,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 980,
  },
  {
    slug: "asics-sky-elite-ff-mt-3",
    brand: "ASICS",
    name: "SKY ELITE FF MT 3",
    category: "volleyball",
    categoryLabel: "Волейбол · mid",
    kind: "footwear",
    sportPriority: true,
    query: "ASICS SKY ELITE FF MT 3 volleyball",
    note: "Средняя высота · прыжок и фиксация",
    marketPrice: "20–22,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 1080,
  },
  {
    slug: "asics-metarise-2",
    brand: "ASICS",
    name: "METARISE 2",
    category: "volleyball",
    categoryLabel: "Волейбол · премиум",
    kind: "footwear",
    sportPriority: true,
    query: "ASICS METARISE 2 1051A089 volleyball",
    note: "Премиальная модель · приоритет для доигровщика",
    marketPrice: "24–34 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 1500,
  },
  {
    slug: "asics-netburner-ballistic-ff-4",
    brand: "ASICS",
    name: "NETBURNER BALLISTIC FF 4",
    category: "volleyball",
    categoryLabel: "Волейбол · стабильность",
    kind: "footwear",
    sportPriority: true,
    query: "ASICS NETBURNER BALLISTIC FF 4 volleyball",
    note: "Быстрые перемещения · боковая устойчивость",
    marketPrice: "10,5–17,6 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "asics-gel-tactic-13",
    brand: "ASICS",
    name: "GEL-TACTIC 13",
    category: "volleyball",
    categoryLabel: "Волейбол · универсальная",
    kind: "footwear",
    sportPriority: true,
    query: "ASICS GEL-TACTIC 13 volleyball",
    note: "Универсальный зал · средний ценовой сегмент",
    marketPrice: "14–16 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 760,
  },
  {
    slug: "mizuno-wave-lightning-z8",
    brand: "Mizuno",
    name: "WAVE LIGHTNING Z8",
    category: "volleyball",
    categoryLabel: "Волейбол · скорость",
    kind: "footwear",
    sportPriority: true,
    query: "Mizuno WAVE LIGHTNING Z8 volleyball",
    note: "Лёгкий low · быстрый разбег и смена направления",
    marketPrice: "12,5–15,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "mizuno-wave-lightning-z8-mid",
    brand: "Mizuno",
    name: "WAVE LIGHTNING Z8 MID",
    category: "volleyball",
    categoryLabel: "Волейбол · mid",
    kind: "footwear",
    sportPriority: true,
    query: "Mizuno WAVE LIGHTNING Z8 MID volleyball",
    note: "Скорость low-линейки · более высокая посадка",
    marketPrice: "13,3–19 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "mizuno-wave-momentum-elite-mid",
    brand: "Mizuno",
    name: "WAVE MOMENTUM ELITE MID",
    category: "volleyball",
    categoryLabel: "Волейбол · амортизация",
    kind: "footwear",
    sportPriority: true,
    query: "Mizuno WAVE MOMENTUM ELITE MID volleyball",
    note: "Амортизация приземлений · средняя высота",
    marketPrice: "15,5–18 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "mizuno-wave-momentum-pro",
    brand: "Mizuno",
    name: "WAVE MOMENTUM PRO",
    category: "volleyball",
    categoryLabel: "Волейбол · баланс",
    kind: "footwear",
    sportPriority: true,
    query: "Mizuno WAVE MOMENTUM PRO volleyball",
    note: "Комфорт и устойчивость · средний сегмент",
    marketPrice: "11,5–13,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "mizuno-wave-luminous-3",
    brand: "Mizuno",
    name: "WAVE LUMINOUS 3",
    category: "volleyball",
    categoryLabel: "Волейбол · универсальная",
    kind: "footwear",
    sportPriority: true,
    query: "Mizuno WAVE LUMINOUS 3 volleyball",
    note: "Универсальная амортизация · тренировки и игры",
    marketPrice: "12,7–15 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "mizuno-wave-voltage-2",
    brand: "Mizuno",
    name: "WAVE VOLTAGE 2",
    category: "volleyball",
    categoryLabel: "Волейбол · доступная",
    kind: "footwear",
    sportPriority: true,
    query: "Mizuno WAVE VOLTAGE 2 volleyball",
    note: "Доступный вход · любительские тренировки",
    marketPrice: "9–13 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "nike-zoom-hyperset-2",
    brand: "Nike",
    name: "ZOOM HYPERSET 2",
    category: "volleyball",
    categoryLabel: "Волейбол · премиум",
    kind: "footwear",
    sportPriority: true,
    query: "Nike ZOOM HYPERSET 2 volleyball",
    note: "Импортная модель · верхний ценовой сегмент",
    marketPrice: "24–25 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 1180,
  },
  {
    slug: "nike-hyperace-3-se",
    brand: "Nike",
    name: "HYPERACE 3 SE",
    category: "volleyball",
    categoryLabel: "Волейбол · универсальная",
    kind: "footwear",
    sportPriority: true,
    query: "Nike HYPERACE 3 SE volleyball",
    note: "Универсальная линия · размер обязательно сверить",
    marketPrice: "18,9–21 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "adidas-crazyflight-6-mid",
    brand: "adidas",
    name: "CRAZYFLIGHT 6 / MID",
    category: "volleyball",
    categoryLabel: "Волейбол · импорт",
    kind: "footwear",
    sportPriority: true,
    query: "adidas CRAZYFLIGHT 6 MID volleyball",
    note: "Тестовый импортный слот · low или mid",
    marketPrice: "16–25 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "nike-metcon-10",
    brand: "Nike",
    name: "METCON 10",
    category: "training",
    categoryLabel: "Тренировки · силовые",
    kind: "footwear",
    sportPriority: true,
    query: "Nike METCON 10 training",
    note: "Силовой зал · устойчивая платформа",
    marketPrice: "21–24 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "reebok-nano-x5",
    brand: "Reebok",
    name: "NANO X5",
    category: "training",
    categoryLabel: "Тренировки · функциональные",
    kind: "footwear",
    sportPriority: true,
    query: "Reebok NANO X5 training",
    note: "Функциональный тренинг · широкий сценарий",
    marketPrice: "10–13,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "adidas-dropset-3",
    brand: "adidas",
    name: "DROPSET 3",
    category: "training",
    categoryLabel: "Тренировки · зал",
    kind: "footwear",
    sportPriority: true,
    query: "adidas DROPSET 3 training",
    note: "Силовые упражнения · стабильность в зале",
    marketPrice: "13–16 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "under-armour-tribase-reign-6",
    brand: "Under Armour",
    name: "TRIBASE REIGN 6",
    category: "training",
    categoryLabel: "Тренировки · стабильность",
    kind: "footwear",
    sportPriority: true,
    query: "Under Armour TRIBASE REIGN 6 training",
    note: "Устойчивая база · работа с нагрузкой",
    marketPrice: "10–12,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "hoka-ora-recovery-slide-3",
    brand: "HOKA",
    name: "ORA RECOVERY SLIDE 3",
    category: "recovery",
    categoryLabel: "Восстановление · слайды",
    kind: "footwear",
    sportPriority: true,
    query: "HOKA ORA RECOVERY SLIDE 3",
    note: "После тренировки · мягкий recovery-сценарий",
    marketPrice: "5,5–7,7 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "nike-calm-slide",
    brand: "Nike",
    name: "CALM SLIDE",
    category: "recovery",
    categoryLabel: "Восстановление · слайды",
    kind: "footwear",
    sportPriority: true,
    query: "Nike CALM SLIDE",
    note: "Массовый recovery-сегмент · размер сверить",
    marketPrice: "3,8–7,7 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "nike-dri-fit-volleyball-jersey",
    brand: "Nike",
    name: "Dri-FIT Volleyball Jersey",
    category: "volleyball",
    categoryLabel: "Волейбол · джерси",
    kind: "apparel",
    sportPriority: true,
    query: "Nike Dri-FIT volleyball jersey blue",
    note: "Игровой верх · точный состав сверить",
    marketPrice: "2,1–4,6 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "mizuno-volleyball-practice-tee",
    brand: "Mizuno",
    name: "Volleyball Practice Tee",
    category: "volleyball",
    categoryLabel: "Волейбол · футболка",
    kind: "apparel",
    sportPriority: true,
    query: "Mizuno volleyball practice tee",
    note: "Тренировочная футболка · свободное движение",
    marketPrice: "2,1–4,6 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "asics-actibreeze-match-top",
    brand: "ASICS",
    name: "ACTIBREEZE Match Top",
    category: "volleyball",
    categoryLabel: "Волейбол · пляж",
    kind: "apparel",
    sportPriority: true,
    query: "ASICS ACTIBREEZE match sleeveless top",
    note: "Лёгкий верх · пляжные и жаркие тренировки",
    marketPrice: "3–6 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "adidas-crazyflight-shorts",
    brand: "adidas",
    name: "Crazyflight Match Shorts",
    category: "volleyball",
    categoryLabel: "Волейбол · шорты",
    kind: "apparel",
    sportPriority: true,
    query: "adidas volleyball match shorts",
    note: "Игровые шорты · длину и посадку сверить",
    marketPrice: "1,7–2,6 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "nike-pro-compression-shorts",
    brand: "Nike",
    name: "Pro Compression Shorts",
    category: "training",
    categoryLabel: "Тренировки · компрессия",
    kind: "apparel",
    sportPriority: true,
    query: "Nike Pro compression shorts men",
    note: "Базовый слой · под игровые шорты",
    marketPrice: "2,5–5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "under-armour-heatgear-top",
    brand: "Under Armour",
    name: "HeatGear Compression Top",
    category: "training",
    categoryLabel: "Тренировки · лонгслив",
    kind: "apparel",
    sportPriority: true,
    query: "Under Armour HeatGear compression long sleeve men",
    note: "Компрессионный лонгслив · базовый слой",
    marketPrice: "3,5–7,2 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "adidas-own-the-run-shorts",
    brand: "adidas",
    name: "Own The Run Shorts",
    category: "training",
    categoryLabel: "Тренировки · шорты",
    kind: "apparel",
    sportPriority: true,
    query: "adidas Own The Run shorts men",
    note: "Бег и ОФП · лёгкая ткань",
    marketPrice: "3–6 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "on-performance-tights",
    brand: "On",
    name: "Performance Tights",
    category: "training",
    categoryLabel: "Тренировки · тайтсы",
    kind: "apparel",
    sportPriority: true,
    query: "On Performance Tights men",
    note: "ОФП и прохладная погода · тайтсы",
    marketPrice: "6–10 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "nike-therma-fit-training-hoodie",
    brand: "Nike",
    name: "Therma-FIT Training Hoodie",
    category: "recovery",
    categoryLabel: "Восстановление · худи",
    kind: "apparel",
    sportPriority: true,
    query: "Nike Therma-FIT training hoodie men",
    note: "Разминка и дорога после тренировки",
    marketPrice: "4–8 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
  {
    slug: "adidas-zne-track-jacket",
    brand: "adidas",
    name: "Z.N.E. Track Jacket",
    category: "recovery",
    categoryLabel: "Восстановление · олимпийка",
    kind: "apparel",
    sportPriority: true,
    query: "adidas Z.N.E. full zip track jacket men",
    note: "Разминка, дорога и восстановление",
    marketPrice: "8–14 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
  },
] as const

const existingProducts: readonly ProductSource[] = [
  {
    slug: "asics-gel-1130-black-pure-silver",
    brand: "ASICS",
    name: "GEL-1130 Black / Pure Silver",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "ASICS GEL-1130 Black Pure Silver 1201A906-001",
    note: "Ретро-раннер · серебристые детали",
  },
  {
    slug: "asics-gel-nyc-cream-oyster-grey",
    brand: "ASICS",
    name: "GEL-NYC Cream / Oyster Grey",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "ASICS GEL-NYC Cream Oyster Grey 1201A789-103",
    note: "Многослойный верх · нейтральная палитра",
  },
  {
    slug: "asics-gel-kayano-14-white-midnight",
    brand: "ASICS",
    name: "GEL-KAYANO 14 White / Midnight",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "ASICS GEL-KAYANO 14 White Midnight 1202A056-109",
    note: "Технологичный силуэт · сетка и металл",
  },
  {
    slug: "salomon-xt-6-white-lunar-rock",
    brand: "Salomon",
    name: "XT-6 White / Lunar Rock",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "Salomon XT-6 White Lunar Rock L41252900",
    note: "Трейловый силуэт · городская пара",
  },
  {
    slug: "new-balance-9060-rain-cloud",
    brand: "New Balance",
    name: "9060 Rain Cloud",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "New Balance 9060 Rain Cloud U9060GRY",
    note: "Объёмная подошва · серый монохром",
  },
  {
    slug: "new-balance-2002r-protection-pack",
    brand: "New Balance",
    name: "2002R Protection Pack Rain Cloud",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "New Balance 2002R Protection Pack Rain Cloud M2002RDA",
    note: "Необработанные края · сложная фактура",
  },
  {
    slug: "new-balance-530-white-silver-navy",
    brand: "New Balance",
    name: "530 White / Silver / Navy",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "New Balance 530 White Silver Navy MR530SG",
    note: "Лёгкий ретро-раннер · на каждый день",
  },
  {
    slug: "new-balance-1906r-silver-metallic",
    brand: "New Balance",
    name: "1906R Silver Metallic",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "New Balance 1906R Silver Metallic M1906RER",
    note: "Сетчатый верх · техничные накладки",
  },
  {
    slug: "nike-zoom-vomero-5-photon-dust",
    brand: "Nike",
    name: "Zoom Vomero 5 Photon Dust",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "Nike Zoom Vomero 5 Photon Dust HF7723-001",
    note: "Слоистая конструкция · мягкая амортизация",
  },
  {
    slug: "nike-air-max-95-black-anthracite",
    brand: "Nike SB",
    name: "Air Max 95 Black / Anthracite",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "Nike SB Air Max 95 Black Anthracite HF7545-002",
    note: "Культовый градиент · тёмная расцветка",
  },
  {
    slug: "nike-air-force-1-07-white",
    brand: "Nike",
    name: "Air Force 1 ’07 White",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "Nike Air Force 1 07 White CW2288-111",
    note: "Белая кожа · базовый силуэт",
  },
  {
    slug: "nike-dunk-low-panda",
    brand: "Nike",
    name: "Dunk Low Retro White / Black",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "Nike Dunk Low Retro White Black Panda DD1391-100",
    note: "Контрастная классика · расцветка Panda",
  },
  {
    slug: "air-jordan-4-black-cat",
    brand: "Jordan",
    name: "Air Jordan 4 Retro Black Cat",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "Air Jordan 4 Retro Black Cat FV5029-010",
    note: "Чёрный монохром · баскетбольная классика",
  },
  {
    slug: "air-jordan-5-wolf-grey",
    brand: "Jordan",
    name: "Air Jordan 5 Retro Wolf Grey",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "Air Jordan 5 Retro Wolf Grey DD0587-002",
    note: "Серый нубук · прозрачные детали",
  },
  {
    slug: "air-jordan-1-low-white-black",
    brand: "Jordan",
    name: "Air Jordan 1 Low White / Black",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кроссовки",
    kind: "footwear",
    sportPriority: false,
    query: "Air Jordan 1 Low White Black 553558-132",
    note: "Низкий профиль · универсальный контраст",
  },
  {
    slug: "adidas-samba-og-white-black",
    brand: "adidas",
    name: "Samba OG White / Core Black",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кеды",
    kind: "footwear",
    sportPriority: false,
    query: "adidas Samba OG White Core Black B75806",
    note: "Кожаный верх · каучуковая подошва",
  },
  {
    slug: "adidas-gazelle-indoor-green",
    brand: "adidas",
    name: "Gazelle Indoor Collegiate Green",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кеды",
    kind: "footwear",
    sportPriority: false,
    query: "adidas Gazelle Indoor Collegiate Green JI2062",
    note: "Замша · насыщенный зелёный",
  },
  {
    slug: "adidas-campus-00s-core-black",
    brand: "adidas",
    name: "Campus 00s Core Black",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кеды",
    kind: "footwear",
    sportPriority: false,
    query: "adidas Campus 00s Core Black HQ8708",
    note: "Объёмный язык · эстетика нулевых",
  },
  {
    slug: "converse-chuck-70-high-black",
    brand: "Converse",
    name: "Chuck 70 High Black",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кеды",
    kind: "footwear",
    sportPriority: false,
    query: "Converse Chuck 70 High Black 162050C",
    note: "Плотный канвас · высокая посадка",
  },
  {
    slug: "vans-old-skool-36-black-white",
    brand: "Vans",
    name: "Old Skool Black / White",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кеды",
    kind: "footwear",
    sportPriority: false,
    query: "Vans Old Skool Black White VN000D3HY28",
    note: "Замша и канвас · скейт-классика",
  },
  {
    slug: "nike-mind-001-slide-black",
    brand: "Nike",
    name: "Mind 001 × Fragment Black",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · слайды",
    kind: "footwear",
    sportPriority: false,
    query: "Nike Mind 001 Fragment Black IQ8502-001",
    note: "Минималистичный слайд · фактурная стелька",
  },
  {
    slug: "timberland-field-boot-beef-broccoli",
    brand: "Timberland",
    name: "Waterproof Field Boot Beef & Broccoli",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · ботинки",
    kind: "footwear",
    sportPriority: false,
    query: "Timberland Waterproof Field Boot Beef and Broccoli",
    note: "Водостойкая кожа · outdoor-силуэт",
  },
  {
    slug: "essentials-hoodie-light-oatmeal",
    brand: "Fear of God Essentials",
    name: "Hoodie Light Oatmeal",
    category: "apparel",
    categoryLabel: "Одежда · худи",
    kind: "apparel",
    sportPriority: false,
    query: "Fear of God Essentials Hoodie Light Oatmeal",
    note: "Свободный крой · базовый оттенок",
  },
  {
    slug: "north-face-1996-nuptse-black",
    brand: "The North Face",
    name: "1996 Retro Nuptse Black",
    category: "apparel",
    categoryLabel: "Одежда · куртка",
    kind: "apparel",
    sportPriority: false,
    query: "The North Face 1996 Retro Nuptse Jacket Black NF0A3C8D",
    note: "Пуховая куртка · городской объём",
  },
  {
    slug: "supreme-mm6-zip-hoodie-black",
    brand: "Supreme × MM6",
    name: "Box Logo Zip Hoodie Black",
    category: "apparel",
    categoryLabel: "Одежда · zip-худи",
    kind: "apparel",
    sportPriority: false,
    query: "Supreme MM6 Maison Margiela Box Logo Zip Up Hoodie Black",
    note: "Коллаборация · zip-худи",
  },
  {
    slug: "jordan-nigel-sylvester-bike-air-jersey",
    brand: "Jordan × Nigel Sylvester",
    name: "Bike Air Jersey",
    category: "apparel",
    categoryLabel: "Одежда · джерси",
    kind: "apparel",
    sportPriority: false,
    query: "Jordan Nigel Sylvester Bike Air Jersey",
    note: "Спортивная графика · свободный силуэт",
  },
  {
    slug: "nike-barcelona-ronaldinho-jersey",
    brand: "Nike Football",
    name: "FC Barcelona Ronaldinho #10 Jersey",
    category: "apparel",
    categoryLabel: "Одежда · джерси",
    kind: "apparel",
    sportPriority: false,
    query: "Nike FC Barcelona Ronaldinho number 10 Jersey",
    note: "Футбольная классика · номер 10",
  },
  {
    slug: "kith-adidas-messi-tee",
    brand: "Kith × adidas Football",
    name: "Lionel Messi Graphic Tee",
    category: "apparel",
    categoryLabel: "Одежда · футболка",
    kind: "apparel",
    sportPriority: false,
    query: "Kith adidas Football Lionel Messi Graphic Tee ADKU4264",
    note: "Футбольная коллекция · графический принт",
  },
  {
    slug: "nike-hoops-elite-backpack",
    brand: "Nike",
    name: "Hoops Elite Backpack Black",
    category: "bags",
    categoryLabel: "Сумки и мелочи · рюкзак",
    kind: "accessory",
    sportPriority: false,
    query: "Nike Hoops Elite Backpack Black Anthracite Metallic Silver DX9786-010",
    note: "Вместительный рюкзак · спортивные отделения",
  },
  {
    slug: "new-era-yankees-59fifty-black",
    brand: "New Era",
    name: "New York Yankees 59FIFTY Black",
    category: "bags",
    categoryLabel: "Сумки и мелочи · кепка",
    kind: "accessory",
    sportPriority: false,
    query: "New Era New York Yankees 59FIFTY Black 60955984",
    note: "Фиксированная посадка · чёрный цвет",
  },
] as const

const expandedProducts: readonly ProductSource[] = [
  {
    slug: "asics-upcourt-6",
    brand: "ASICS",
    name: "UPCOURT 6",
    category: "volleyball",
    categoryLabel: "Волейбол · доступная",
    kind: "footwear",
    sportPriority: true,
    query: "ASICS UPCOURT 6 volleyball 1071A104",
    note: "Легкая базовая пара для тренировок в зале · хороший вход для любителей",
    marketPrice: "7–10 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 420,
  },
  {
    slug: "asics-rote-japan-lyte-ff-3",
    brand: "ASICS",
    name: "ROTE JAPAN LYTE FF 3",
    category: "volleyball",
    categoryLabel: "Волейбол · скорость",
    kind: "footwear",
    sportPriority: true,
    query: "ASICS ROTE JAPAN LYTE FF 3 volleyball 1053A054",
    note: "Легкая клубная модель · быстрые перемещения и работа на реакции",
    marketPrice: "13–18 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 820,
  },
  {
    slug: "mizuno-wave-momentum-3",
    brand: "Mizuno",
    name: "WAVE MOMENTUM 3",
    category: "volleyball",
    categoryLabel: "Волейбол · амортизация",
    kind: "footwear",
    sportPriority: true,
    query: "Mizuno WAVE MOMENTUM 3 volleyball",
    note: "Комфортная пара для прыжков и долгих игровых сессий · не дубль Momentum Pro",
    marketPrice: "15–22 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 980,
  },
  {
    slug: "mizuno-cyclone-speed-5",
    brand: "Mizuno",
    name: "CYCLONE SPEED 5",
    category: "volleyball",
    categoryLabel: "Волейбол · начальный зал",
    kind: "footwear",
    sportPriority: true,
    query: "Mizuno CYCLONE SPEED 5 volleyball V1GA2580",
    note: "Гибкая flat-sole модель для новичков и любительских тренировок",
    marketPrice: "7–11 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 460,
  },
  {
    slug: "adidas-stabil-16-indoor",
    brand: "adidas",
    name: "STABIL 16 Indoor",
    category: "volleyball",
    categoryLabel: "Волейбол · indoor stability",
    kind: "footwear",
    sportPriority: true,
    query: "adidas STABIL 16 Indoor volleyball handball",
    note: "Зальная indoor-пара для волейбола и гандбола · стабильность на боковых движениях",
    marketPrice: "14–21 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 900,
  },
  {
    slug: "anta-kai-1",
    brand: "ANTA",
    name: "KAI 1",
    category: "basketball",
    categoryLabel: "Баскетбол для зала · контроль",
    kind: "footwear",
    sportPriority: true,
    query: "ANTA KAI 1 Kyrie Irving basketball",
    note: "Цепкая guard-пара · альтернатива Nike для зала",
    marketPrice: "14–22 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 780,
  },
  {
    slug: "li-ning-wade-808-4-ultra",
    brand: "Li-Ning",
    name: "Wade 808 4 Ultra",
    category: "basketball",
    categoryLabel: "Баскетбол для зала · быстрый старт",
    kind: "footwear",
    sportPriority: true,
    query: "Li-Ning Wade 808 4 Ultra basketball",
    note: "Стабильность и контроль с drop-in BOOM · сильный китайский performance-сегмент",
    marketPrice: "16–24 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 980,
  },
  {
    slug: "adidas-harden-volume-9",
    brand: "adidas",
    name: "Harden Volume 9",
    category: "basketball",
    categoryLabel: "Баскетбол для зала · амортизация",
    kind: "footwear",
    sportPriority: true,
    query: "adidas Harden Volume 9 basketball",
    note: "Boost и Lightstrike · для игроков, которым нужна мягче посадка и уверенный стоп",
    marketPrice: "15–23 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 920,
  },
  {
    slug: "new-balance-two-wxy-v5",
    brand: "New Balance",
    name: "TWO WXY v5",
    category: "basketball",
    categoryLabel: "Баскетбол для зала · универсальная",
    kind: "footwear",
    sportPriority: true,
    query: "New Balance TWO WXY v5 basketball",
    note: "Позиционно-универсальная пара · FuelCell и Fresh Foam X для зала",
    marketPrice: "12–18 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 760,
  },
  {
    slug: "nike-aone",
    brand: "Nike",
    name: "A'One",
    category: "basketball",
    categoryLabel: "Баскетбол для зала · женская посадка",
    kind: "footwear",
    sportPriority: true,
    query: "Nike A'One Aja Wilson basketball",
    note: "Сигнатура A'ja Wilson · хороший слот для женской волейбольной аудитории",
    marketPrice: "13–19 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 760,
  },
  {
    slug: "nike-free-metcon-6",
    brand: "Nike",
    name: "Free Metcon 6",
    category: "training",
    categoryLabel: "Тренировки · гибрид",
    kind: "footwear",
    sportPriority: true,
    query: "Nike Free Metcon 6 training",
    note: "ОФП, прыжковые связки, HIIT и легкая силовая · мягче и гибче Metcon 10",
    marketPrice: "10–16 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 620,
  },
  {
    slug: "puma-fuse-3",
    brand: "PUMA",
    name: "Fuse 3.0",
    category: "training",
    categoryLabel: "Тренировки · силовая база",
    kind: "footwear",
    sportPriority: true,
    query: "PUMA Fuse 3.0 training",
    note: "Стабильная low-to-ground платформа · бюджетная альтернатива Metcon/Nano",
    marketPrice: "8–13 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 520,
  },
  {
    slug: "oofos-ooahh-slide",
    brand: "OOFOS",
    name: "OOHH Slide",
    category: "recovery",
    categoryLabel: "Восстановление · слайды",
    kind: "footwear",
    sportPriority: true,
    query: "OOFOS OOHH Slide recovery sandal",
    note: "Классический recovery-слайд после зала · премиум-дополнение к Nike Calm",
    marketPrice: "6–10 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 360,
  },
  {
    slug: "crocs-mellow-recovery-slide",
    brand: "Crocs",
    name: "Mellow Recovery Slide",
    category: "recovery",
    categoryLabel: "Восстановление · мягкие слайды",
    kind: "footwear",
    sportPriority: true,
    query: "Crocs Mellow Recovery Slide",
    note: "Массовый recovery-сценарий · мягкая пена и понятный размерный спрос",
    marketPrice: "4,5–8 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 260,
  },
  {
    slug: "adidas-handball-spezial-core-black",
    brand: "adidas",
    name: "Handball Spezial Core Black",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · кеды",
    kind: "footwear",
    sportPriority: false,
    query: "adidas Handball Spezial Core Black DB3021",
    note: "Архивный indoor-силуэт · не дубль Samba/Gazelle и хорошо ложится в sport retail",
    marketPrice: "9–15 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 620,
  },
  {
    slug: "new-balance-1000-black",
    brand: "New Balance",
    name: "1000 Black",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · ретро runner",
    kind: "footwear",
    sportPriority: false,
    query: "New Balance 1000 black M1000",
    note: "Y2K-retro runner · логичное расширение после 1906R/2002R/9060",
    marketPrice: "14–22 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 860,
  },
  {
    slug: "asics-gel-kayano-20-glacier-grey",
    brand: "ASICS",
    name: "GEL-KAYANO 20 Glacier Grey",
    category: "lifestyle",
    categoryLabel: "Лайфстайл · tech runner",
    kind: "footwear",
    sportPriority: false,
    query: "ASICS GEL-KAYANO 20 Glacier Grey",
    note: "Свежий sportstyle-акцент · техничнее GEL-1130 и не повторяет KAYANO 14",
    marketPrice: "16–24 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 980,
  },
  {
    slug: "nike-vapor-elite-volleyball-kneepads",
    brand: "Nike",
    name: "Vapor Elite Volleyball Kneepads",
    category: "protection",
    categoryLabel: "Защита · наколенники",
    kind: "accessory",
    sportPriority: true,
    query: "Nike Vapor Elite Volleyball Kneepads",
    note: "Премиальные наколенники для матчей · понятный допродажный товар к обуви",
    marketPrice: "4–7,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 280,
  },
  {
    slug: "mizuno-vs1-ultra-kneepad",
    brand: "Mizuno",
    name: "VS-1 Ultra Kneepad",
    category: "protection",
    categoryLabel: "Защита · наколенники",
    kind: "accessory",
    sportPriority: true,
    query: "Mizuno VS-1 Ultra Kneepad volleyball",
    note: "Защита для либеро и защитных игроков · профильная альтернатива Nike",
    marketPrice: "3,5–6,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 220,
  },
  {
    slug: "molten-v5m5000-flistatec",
    brand: "Molten",
    name: "V5M5000 Flistatec",
    category: "balls",
    categoryLabel: "Мячи · волейбол",
    kind: "accessory",
    sportPriority: true,
    query: "Molten V5M5000 Flistatec volleyball",
    note: "Матчевый мяч Flistatec · якорный аксессуар для волейбольного спроса",
    marketPrice: "8–13 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 520,
  },
]

const equipmentProducts: readonly ProductSource[] = [
  {
    slug: "theraband-resistance-band-set",
    brand: "TheraBand",
    name: "Resistance Band Set",
    category: "training",
    categoryLabel: "Тренировки · резина",
    kind: "accessory",
    sportPriority: true,
    query: "TheraBand Resistance Band Set training",
    note: "Набор резины для разминки плеч, прыжковой подготовки и домашнего ОФП",
    marketPrice: "1,5–3,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 90,
  },
  {
    slug: "nike-resistance-band-heavy",
    brand: "Nike",
    name: "Resistance Band Heavy",
    category: "training",
    categoryLabel: "Тренировки · силовая резина",
    kind: "accessory",
    sportPriority: true,
    query: "Nike Resistance Band Heavy training",
    note: "Плотная резина для активации, приседаний, тяги и разминки перед залом",
    marketPrice: "2–4,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 160,
  },
  {
    slug: "triggerpoint-grid-foam-roller",
    brand: "TriggerPoint",
    name: "GRID Foam Roller",
    category: "recovery",
    categoryLabel: "Восстановление · ролл",
    kind: "accessory",
    sportPriority: true,
    query: "TriggerPoint GRID Foam Roller",
    note: "Жесткий ролл для икр, квадрицепса и спины после игровых тренировок",
    marketPrice: "3,5–7 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 220,
  },
  {
    slug: "hyperice-vyper-go-roller",
    brand: "Hyperice",
    name: "Vyper Go Roller",
    category: "recovery",
    categoryLabel: "Восстановление · виброролл",
    kind: "accessory",
    sportPriority: true,
    query: "Hyperice Vyper Go Roller",
    note: "Премиальный ролл для восстановления, команды и домашней recovery-зоны",
    marketPrice: "11–18 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 820,
  },
  {
    slug: "rocktape-kinesiology-tape-black",
    brand: "RockTape",
    name: "Kinesiology Tape Black",
    category: "recovery",
    categoryLabel: "Восстановление · тейп",
    kind: "accessory",
    sportPriority: true,
    query: "RockTape Kinesiology Tape Black",
    note: "Кинезио тейп для игровой недели, плеча, колена и голеностопа",
    marketPrice: "1,2–2,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 75,
  },
  {
    slug: "mueller-jumpers-knee-strap",
    brand: "Mueller",
    name: "Jumper's Knee Strap",
    category: "recovery",
    categoryLabel: "Восстановление · коленный ремень",
    kind: "accessory",
    sportPriority: true,
    query: "Mueller Jumper's Knee Strap",
    note: "Компактная поддержка под колено для прыжковых нагрузок и тренировочного режима",
    marketPrice: "1,5–3,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 120,
  },
  {
    slug: "mcdavid-hex-knee-pads",
    brand: "McDavid",
    name: "HEX Knee Pads",
    category: "protection",
    categoryLabel: "Защита · наколенники",
    kind: "accessory",
    sportPriority: true,
    query: "McDavid HEX Knee Pads",
    note: "Мягкая HEX-защита для падений, зала и игроков, которым нужна гибкость",
    marketPrice: "3,5–6,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 220,
  },
  {
    slug: "bauerfeind-sports-knee-support",
    brand: "Bauerfeind",
    name: "Sports Knee Support",
    category: "protection",
    categoryLabel: "Защита · поддержка колена",
    kind: "accessory",
    sportPriority: true,
    query: "Bauerfeind Sports Knee Support",
    note: "Компрессионная поддержка для тренировок, восстановления и аккуратной нагрузки",
    marketPrice: "8–14 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 620,
  },
  {
    slug: "mcdavid-hex-elbow-pads",
    brand: "McDavid",
    name: "HEX Elbow Pads",
    category: "protection",
    categoryLabel: "Защита · налокотники",
    kind: "accessory",
    sportPriority: true,
    query: "McDavid HEX Elbow Pads",
    note: "Налокотники для защиты при падениях, приемах и интенсивных тренировках",
    marketPrice: "3–6 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 210,
  },
  {
    slug: "nike-essential-volleyball-elbow-pads",
    brand: "Nike",
    name: "Essential Volleyball Elbow Pads",
    category: "protection",
    categoryLabel: "Защита · налокотники",
    kind: "accessory",
    sportPriority: true,
    query: "Nike Essential Volleyball Elbow Pads",
    note: "Легкая защита локтей для приема, защиты и тренировок на паркете",
    marketPrice: "2,5–5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 170,
  },
  {
    slug: "mizuno-arm-sleeves",
    brand: "Mizuno",
    name: "Arm Sleeves",
    category: "protection",
    categoryLabel: "Защита · рукава",
    kind: "accessory",
    sportPriority: true,
    query: "Mizuno Arm Sleeves volleyball",
    note: "Компрессионные рукава для зала, подачи и защиты предплечья",
    marketPrice: "2–4 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 150,
  },
  {
    slug: "nike-everyday-cushion-crew-socks-6pk",
    brand: "Nike",
    name: "Everyday Cushion Crew Socks 6PK",
    category: "bags",
    categoryLabel: "Сумки и мелочи · носки",
    kind: "accessory",
    sportPriority: true,
    query: "Nike Everyday Cushion Crew Socks 6 Pack",
    note: "Базовые плотные носки для тренировок, матчей и ежедневного комплекта",
    marketPrice: "2,5–5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 170,
  },
  {
    slug: "stance-icon-crew-socks",
    brand: "Stance",
    name: "Icon Crew Socks",
    category: "bags",
    categoryLabel: "Сумки и мелочи · носки",
    kind: "accessory",
    sportPriority: true,
    query: "Stance Icon Crew Socks",
    note: "Акцентные crew-носки для зала и повседневной пары",
    marketPrice: "1,5–3 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 100,
  },
  {
    slug: "molten-v5m4500-volleyball",
    brand: "Molten",
    name: "V5M4500 Volleyball",
    category: "balls",
    categoryLabel: "Мячи · волейбол",
    kind: "accessory",
    sportPriority: true,
    query: "Molten V5M4500 Volleyball",
    note: "Тренировочный мяч для секций, любительских команд и регулярной игры",
    marketPrice: "6–10 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 390,
  },
  {
    slug: "mikasa-v200w-volleyball",
    brand: "Mikasa",
    name: "V200W Volleyball",
    category: "balls",
    categoryLabel: "Мячи · волейбол",
    kind: "accessory",
    sportPriority: true,
    query: "Mikasa V200W Volleyball",
    note: "Матчевый волейбольный мяч с высоким узнаваемым спросом",
    marketPrice: "8–13 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 520,
  },
  {
    slug: "wilson-evo-nxt-basketball",
    brand: "Wilson",
    name: "Evo NXT Basketball",
    category: "balls",
    categoryLabel: "Мячи · баскетбол",
    kind: "accessory",
    sportPriority: true,
    query: "Wilson Evo NXT Basketball",
    note: "Игровой баскетбольный мяч для зала, разминки и командной экипировки",
    marketPrice: "7–12 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 480,
  },
  {
    slug: "nike-brasilia-training-duffel",
    brand: "Nike",
    name: "Brasilia Training Duffel",
    category: "bags",
    categoryLabel: "Сумки и мелочи · сумка",
    kind: "accessory",
    sportPriority: true,
    query: "Nike Brasilia Training Duffel",
    note: "Вместительная сумка под форму, пару, защиту и воду на тренировку",
    marketPrice: "4–8 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 320,
  },
  {
    slug: "adidas-tiro-league-duffel",
    brand: "adidas",
    name: "Tiro League Duffel",
    category: "bags",
    categoryLabel: "Сумки и мелочи · сумка",
    kind: "accessory",
    sportPriority: true,
    query: "adidas Tiro League Duffel",
    note: "Командная сумка для тренировок, выездов и базового спортивного комплекта",
    marketPrice: "3,5–7 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 280,
  },
  {
    slug: "camelbak-podium-chill-bottle",
    brand: "CamelBak",
    name: "Podium Chill Bottle",
    category: "training",
    categoryLabel: "Тренировки · бутылка",
    kind: "accessory",
    sportPriority: true,
    query: "CamelBak Podium Chill Bottle",
    note: "Термобутылка для зала, игровых дней и тренировок с высокой нагрузкой",
    marketPrice: "1,5–3,5 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 110,
  },
  {
    slug: "nike-hyperfuel-water-bottle",
    brand: "Nike",
    name: "HyperFuel Water Bottle",
    category: "training",
    categoryLabel: "Тренировки · бутылка",
    kind: "accessory",
    sportPriority: true,
    query: "Nike HyperFuel Water Bottle",
    note: "Легкая бутылка для тренировки, матча и сумки на каждый заловый день",
    marketPrice: "1,5–3 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 90,
  },
]

const catalogProductSource = [
  ...sportProducts,
  ...expandedProducts,
  ...equipmentProducts,
  ...existingProducts,
] as const

const performanceBasketballOverrides: Record<string, Partial<ProductSource>> = {
  "nike-metcon-10": {
    slug: "nike-gt-cut-academy",
    brand: "Nike",
    name: "G.T. Cut Academy",
    category: "basketball",
    categoryLabel: "Баскетбол для волейбола · скорость",
    kind: "footwear",
    sportPriority: true,
    query: "Nike G.T. Cut Academy basketball volleyball",
    note: "Быстрая низкая пара · хороший выбор для либеро, связующих и доигровщиков",
    marketPrice: "12–17 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 760,
  },
  "reebok-nano-x5": {
    slug: "nike-sabrina-3",
    brand: "Nike",
    name: "Sabrina 3",
    category: "basketball",
    categoryLabel: "Баскетбол для волейбола · контроль",
    kind: "footwear",
    sportPriority: true,
    query: "Nike Sabrina 3 basketball volleyball",
    note: "Легкая guard-пара · цепкая подошва и стабильность на резких сменах направления",
    marketPrice: "16–22 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 980,
  },
  "adidas-dropset-3": {
    slug: "nike-lebron-nxxt-genisus",
    brand: "Nike",
    name: "LeBron NXXT Genisus",
    category: "basketball",
    categoryLabel: "Баскетбол для волейбола · амортизация",
    kind: "footwear",
    sportPriority: true,
    query: "Nike LeBron NXXT Genisus basketball volleyball",
    note: "Более мощная амортизация · для тяжелых игроков и частых прыжков",
    marketPrice: "18–25 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 1120,
  },
  "under-armour-tribase-reign-6": {
    slug: "nike-kd-18",
    brand: "Nike",
    name: "KD 18",
    category: "basketball",
    categoryLabel: "Баскетбол для волейбола · баланс",
    kind: "footwear",
    sportPriority: true,
    query: "Nike KD 18 basketball volleyball",
    note: "Баланс сцепления и мягкости · универсально для зала, если нужна амортизация",
    marketPrice: "18–26 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 1180,
  },
  "air-jordan-4-black-cat": {
    slug: "jordan-luka-4",
    brand: "Jordan",
    name: "Luka 4",
    category: "basketball",
    categoryLabel: "Баскетбол для волейбола · стабильность",
    kind: "footwear",
    sportPriority: true,
    query: "Jordan Luka 4 basketball volleyball",
    note: "Стабильная платформа · для боковых перемещений и уверенной посадки",
    marketPrice: "17–24 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 1020,
  },
  "air-jordan-5-wolf-grey": {
    slug: "nike-ja-3",
    brand: "Nike",
    name: "Ja 3",
    category: "basketball",
    categoryLabel: "Баскетбол для волейбола · взрыв",
    kind: "footwear",
    sportPriority: true,
    query: "Nike Ja 3 basketball volleyball",
    note: "Быстрый guard-силуэт · резкое ускорение и плотная посадка",
    marketPrice: "15–22 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 940,
  },
  "air-jordan-1-low-white-black": {
    slug: "way-of-wade-all-city-12",
    brand: "Li-Ning",
    name: "Way of Wade All City 12",
    category: "basketball",
    categoryLabel: "Баскетбол для волейбола · цепкость",
    kind: "footwear",
    sportPriority: true,
    query: "Li-Ning Way of Wade All City 12 basketball volleyball",
    note: "Популярный performance-вариант · часто берут как заловую альтернативу волейболу",
    marketPrice: "14–22 тыс. ₽",
    priceBasis: MARKET_PRICE_BASIS,
    chinaPriceYuan: 880,
  },
}

function mergeGalleryImages(
  sourceGallery: readonly CatalogImage[],
  fallbackGallery: readonly CatalogImage[],
): readonly CatalogImage[] {
  const bySource = new Map<string, CatalogImage>()
  for (const image of [...sourceGallery, ...fallbackGallery]) {
    if (bySource.has(image.src)) continue
    bySource.set(image.src, image)
  }
  return [...bySource.values()].slice(0, 5)
}

const catalogGalleryOrders: Record<string, readonly number[]> = {
  "oofos-ooahh-slide": [1, 0, 2, 3, 4],
  "nike-sabrina-3": [0, 1, 3, 2, 4],
  "nike-kd-18": [0, 1, 3, 2, 4],
}

function applyGalleryOrder(
  slug: string,
  gallery: readonly CatalogImage[],
): readonly CatalogImage[] {
  const order = catalogGalleryOrders[slug]
  if (!order) return gallery

  const seen = new Set<number>()
  const reordered = order
    .map((index) => {
      const image = gallery[index]
      if (image) {
        seen.add(index)
      }
      return image
    })
    .filter((entry): entry is CatalogImage => Boolean(entry))

  for (let index = 0; index < gallery.length; index += 1) {
    if (!seen.has(index)) {
      reordered.push(gallery[index]!)
    }
  }

  return reordered
}

const requestPriceGuides: Record<string, string> = {
  "asics-gel-1130-black-pure-silver": "11–16 тыс. ₽",
  "asics-gel-nyc-cream-oyster-grey": "14–21 тыс. ₽",
  "asics-gel-kayano-14-white-midnight": "15–23 тыс. ₽",
  "salomon-xt-6-white-lunar-rock": "17–26 тыс. ₽",
  "new-balance-9060-rain-cloud": "14–22 тыс. ₽",
  "new-balance-2002r-protection-pack": "16–28 тыс. ₽",
  "new-balance-530-white-silver-navy": "10–15 тыс. ₽",
  "new-balance-1906r-silver-metallic": "13–20 тыс. ₽",
  "nike-zoom-vomero-5-photon-dust": "13–21 тыс. ₽",
  "nike-air-max-95-black-anthracite": "20–34 тыс. ₽",
  "nike-air-force-1-07-white": "11–16 тыс. ₽",
  "nike-dunk-low-panda": "12–18 тыс. ₽",
  "adidas-samba-og-white-black": "12–18 тыс. ₽",
  "adidas-gazelle-indoor-green": "12–19 тыс. ₽",
  "adidas-campus-00s-core-black": "10–16 тыс. ₽",
  "converse-chuck-70-high-black": "8–13 тыс. ₽",
  "vans-old-skool-36-black-white": "7–12 тыс. ₽",
  "nike-mind-001-slide-black": "14–24 тыс. ₽",
  "timberland-field-boot-beef-broccoli": "16–27 тыс. ₽",
  "essentials-hoodie-light-oatmeal": "9–16 тыс. ₽",
  "north-face-1996-nuptse-black": "28–45 тыс. ₽",
  "supreme-mm6-zip-hoodie-black": "45–80 тыс. ₽",
  "jordan-nigel-sylvester-bike-air-jersey": "12–22 тыс. ₽",
  "nike-barcelona-ronaldinho-jersey": "14–26 тыс. ₽",
  "kith-adidas-messi-tee": "12–20 тыс. ₽",
  "nike-hoops-elite-backpack": "8–14 тыс. ₽",
  "new-era-yankees-59fifty-black": "4–8 тыс. ₽",
}

function withFallbackGallery(product: ProductSource): CatalogProduct {
  const fallbackImage = `catalog/${product.assetSlug ?? product.slug}.webp`
  const sourceGallery = product.gallery ?? []
  const orderedGallery = applyGalleryOrder(product.slug, sourceGallery)
  const fallbackGallery = projectGallery(product)
  const gallery = mergeGalleryImages(orderedGallery, fallbackGallery)
  const orderQuote =
    product.chinaPriceYuan === undefined
      ? undefined
      : calculateOrderQuote(product.chinaPriceYuan, product.kind)

  return {
    ...product,
    fallbackImage,
    formulaBasis: product.chinaPriceYuan ? PRICE_FORMULA_BASIS : undefined,
    gallery,
    image: gallery[0]?.src ?? fallbackImage,
    orderQuote,
  }
}

export const catalogProducts: readonly CatalogProduct[] = catalogProductSource.map(
  (product) =>
    withFallbackGallery({
      ...product,
      ...performanceBasketballOverrides[product.slug],
      ...(requestPriceGuides[product.slug]
        ? {
            marketPrice: requestPriceGuides[product.slug],
            priceBasis: MARKET_PRICE_BASIS,
          }
        : {}),
    }),
)

export function filterCatalog(
  products: readonly CatalogProduct[],
  category: "all" | CatalogCategory,
  search: string,
): CatalogProduct[] {
  const normalizedSearch = search.trim().toLocaleLowerCase("ru")

  return products.filter((product) => {
    if (category !== "all" && !matchesCatalogCategory(product, category)) {
      return false
    }
    if (!normalizedSearch) return true

    return [
      product.brand,
      product.name,
      product.query,
      product.categoryLabel,
      product.kind,
      product.note,
      product.marketPrice ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase("ru")
      .includes(normalizedSearch)
  })
}

function textIncludes(product: CatalogProduct, pattern: RegExp): boolean {
  return pattern.test(`${product.brand} ${product.name} ${product.categoryLabel} ${product.note}`)
}

function matchesCatalogCategory(
  product: CatalogProduct,
  category: CatalogCategory,
): boolean {
  if (category === "court-shoes") {
    return product.kind === "footwear" && product.sportPriority
  }
  if (category === "sneakers") {
    return product.kind === "footwear" && product.category === "lifestyle"
  }
  if (
    category === "volleyball" ||
    category === "basketball" ||
    category === "recovery"
  ) {
    return product.category === category
  }
  if (category === "apparel") {
    return product.kind === "apparel"
  }
  if (category === "protection") {
    return (
      product.category === "protection" ||
      (product.kind === "accessory" &&
        textIncludes(product, /наколен|налокот|sleeve|support|strap|tape|тейп/i))
    )
  }
  if (category === "balls") {
    return (
      product.category === "balls" ||
      (product.kind === "accessory" &&
        textIncludes(product, /мяч|volleyball|basketball|molten|mikasa|wilson/i))
    )
  }
  if (category === "training") {
    return product.category === "training" || textIncludes(product, /resistance|band|bottle|резин/i)
  }
  if (category === "bags") {
    return product.category === "bags" || textIncludes(product, /bag|backpack|duffel|нос|кепк|cap|сумк|рюкзак/i)
  }
  return false
}

function priceRank(product: CatalogProduct): number {
  if (product.orderQuote) return product.orderQuote.totalRub / 1000
  if (!product.marketPrice) return Number.POSITIVE_INFINITY

  const [rawValue] = product.marketPrice.match(/\d+(?:[,.]\d+)?/u) ?? []
  if (!rawValue) return Number.POSITIVE_INFINITY

  return Number.parseFloat(rawValue.replace(",", "."))
}

export function sortCatalog(
  products: readonly CatalogProduct[],
  sort: CatalogSort,
): CatalogProduct[] {
  const indexedProducts = products.map((product, index) => ({ product, index }))

  indexedProducts.sort((left, right) => {
    if (sort === "featured") return left.index - right.index
    if (sort === "name") {
      const byBrand = left.product.brand.localeCompare(right.product.brand, "ru")
      if (byBrand !== 0) return byBrand
      return left.product.name.localeCompare(right.product.name, "ru")
    }

    const leftPrice = priceRank(left.product)
    const rightPrice = priceRank(right.product)
    const pricedDelta =
      Number.isFinite(leftPrice) === Number.isFinite(rightPrice)
        ? 0
        : Number.isFinite(leftPrice)
          ? -1
          : 1
    if (pricedDelta !== 0) return pricedDelta

    const priceDelta =
      sort === "price-asc" ? leftPrice - rightPrice : rightPrice - leftPrice
    return priceDelta || left.index - right.index
  })

  return indexedProducts.map(({ product }) => product)
}

export function findProductBySlug(slug: string | null): CatalogProduct | null {
  if (!slug) return null

  return catalogProducts.find((product) => product.slug === slug) ?? null
}



