import type { PublishedCatalogItem } from "./cart"

export type CatalogAvailabilityStatus =
  | "in_stock" | "out_of_stock" | "stock_unknown" | "price_unavailable"
  | "not_matched" | "not_found" | "source_unavailable" | "stale" | "unverified"

export interface CatalogAvailability {
  status: CatalogAvailabilityStatus
  checkedAt: string | null
  expiresAt: string | null
  source: "poizon"
  reasonCode?: "cny_rub_rate_unavailable"
}

export type CatalogAvailabilityMap = Record<string, CatalogAvailability>

const statuses: readonly string[] = [
  "in_stock", "out_of_stock", "stock_unknown", "price_unavailable", "not_matched",
  "not_found", "source_unavailable", "stale", "unverified",
]

export function parseCatalogAvailability(value: unknown): CatalogAvailabilityMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const result: CatalogAvailabilityMap = {}
  for (const [slug, raw] of Object.entries(value)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) || !raw || typeof raw !== "object") continue
    const item = raw as Record<string, unknown>
    if (item.source !== "poizon" || typeof item.status !== "string" || !statuses.includes(item.status)) continue
    const checkedAt = typeof item.checked_at === "string" && Number.isFinite(Date.parse(item.checked_at))
      ? item.checked_at : null
    const expiresAt = typeof item.expires_at === "string" && Number.isFinite(Date.parse(item.expires_at))
      ? item.expires_at : null
    const checked = Date.parse(checkedAt ?? "")
    const expires = Date.parse(expiresAt ?? "")
    const fresh = checked <= Date.now() + 5 * 60_000 && expires > Date.now() &&
      expires > checked && expires - checked <= 12 * 60 * 60_000
    const status = ["in_stock", "out_of_stock"].includes(item.status) && !fresh
      ? "stale" : item.status as CatalogAvailabilityStatus
    result[slug] = {
      status, checkedAt, expiresAt, source: "poizon",
      ...(item.reason_code === "cny_rub_rate_unavailable" ? { reasonCode: item.reason_code } : {}),
    }
  }
  return result
}

export function catalogAvailabilityLabel(
  item: PublishedCatalogItem | null | undefined,
  availability: CatalogAvailability | null | undefined,
  loadStatus: "loading" | "ready" | "failed",
): string {
  if (loadStatus === "loading") return "Проверяем наличие на Poizon"
  if (loadStatus === "failed") return "Poizon временно недоступен"
  if (availability?.expiresAt && Date.parse(availability.expiresAt) <= Date.now()) {
    return "Данные Poizon устарели"
  }
  if (!availability && item?.availability === "supplier_unavailable" && item.priceStatus === "current") {
    return "Показанных размеров нет в наличии на Poizon"
  }
  const status = availability?.status ?? (
    item?.availability === "supplier_verified" && item.priceStatus === "current" ? "in_stock" :
      item ? "stock_unknown" : "unverified"
  )
  switch (status) {
    case "out_of_stock": return "Проверенные размеры отсутствуют на Poizon"
    case "in_stock": return "В наличии на Poizon"
    case "stock_unknown": return "Наличие на Poizon не подтверждено"
    case "price_unavailable": return "Цена Poizon не подтверждена"
    case "not_matched": return "Точное совпадение на Poizon не подтверждено"
    case "not_found": return "Товар не найден на Poizon"
    case "source_unavailable": return availability?.reasonCode === "cny_rub_rate_unavailable"
      ? "Курс ЦБ недоступен" : "Poizon временно недоступен"
    case "stale": return "Данные Poizon устарели"
    default: return "Наличие на Poizon не проверено"
  }
}
