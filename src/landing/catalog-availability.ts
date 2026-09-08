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
  if (loadStatus === "loading") return "Проверяем наличие"
  if (loadStatus === "failed") return "Не удалось проверить наличие"
  if (availability?.expiresAt && Date.parse(availability.expiresAt) <= Date.now()) {
    return "Наличие уточняется"
  }
  if (!availability && item && Date.parse(item.expiresAt) <= Date.now()) {
    return "Наличие уточняется"
  }
  if (!availability && item?.availability === "supplier_unavailable" && item.priceStatus === "current") {
    return "Показанных размеров нет в наличии"
  }
  const status = availability?.status ?? (
    item?.availability === "supplier_verified" && item.priceStatus === "current" ? "in_stock" :
      item ? "stock_unknown" : "unverified"
  )
  switch (status) {
    case "out_of_stock": return "Проверенных размеров нет в наличии"
    case "in_stock": return item?.priceStatus === "historical" ? "Наличие уточняется" : "В наличии на Poizon"
    case "price_unavailable": return "Цена уточняется"
    case "source_unavailable": return availability?.reasonCode === "cny_rub_rate_unavailable"
      ? "Цена уточняется" : "Не удалось проверить наличие"
    default: return "Наличие уточняется"
  }
}
