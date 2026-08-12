import type { CatalogProduct } from "../catalog/catalog"
import type { CatalogSearchOffer, CatalogSearchResult } from "./cart"

const telegramUsernamePattern = /^[A-Za-z][A-Za-z0-9_]{4,31}$/

function cleanLine(value: string): string {
  return value
    .replace(/\p{Cc}/gu, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function resolveBotUsername(value: unknown): string | null {
  if (typeof value !== "string") return null

  const username = value.trim().replace(/^@/, "")
  if (!telegramUsernamePattern.test(username)) return null
  if (!username.toLocaleLowerCase("en").endsWith("bot")) return null

  return username
}

export function buildTelegramBotUrl(username: string | null): string | null {
  const validatedUsername = resolveBotUsername(username)
  if (!validatedUsername) return null

  return `https://t.me/${validatedUsername}`
}

export function buildOrderRequest(
  product: CatalogProduct,
  selectedSize?: unknown,
): string {
  // This string crosses the site → Telegram bot trust boundary. Keep it to
  // the exact catalog query: the bot can accept it immediately in the idle
  // state and the provider identity matcher is not polluted by UI prose.
  const query = cleanLine(product.query)
  const size = typeof selectedSize === "string" ? cleanLine(selectedSize) : ""

  return size ? `${query}\nРазмер: ${size}` : query
}

export function buildLiveOrderRequest(
  product: Pick<CatalogSearchResult, "article" | "brand" | "name" | "color" | "expiresAt">,
  offer: Pick<CatalogSearchOffer, "size" | "sizeEu" | "sizeRu" | "priceCny" | "totalRub">,
): string {
  const name = cleanLine([product.brand, product.name].filter(Boolean).join(" "))
  const article = product.article ? cleanLine(product.article) : ""
  const color = product.color ? cleanLine(product.color) : ""
  const lines = [name]

  if (article) lines.push(`Артикул: ${article}`)
  if (color) lines.push(`Цвет: ${color}`)
  lines.push(`Размер: ${cleanLine(offer.sizeEu ?? offer.size)}${offer.sizeRu ? ` (RU ${cleanLine(offer.sizeRu)})` : ""}`)
  lines.push(`Цена: ¥${offer.priceCny}`)
  lines.push(`Итоговая цена: ${offer.totalRub} ₽`)
  lines.push(`Действует до: ${cleanLine(product.expiresAt)}`)

  return lines.join("\n")
}

export async function copyOrderRequest(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // The safe DOM fallback below also works in local HTTP demos.
    }
  }

  if (typeof document === "undefined") return false

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.readOnly = true
  textarea.setAttribute("aria-hidden", "true")
  textarea.className = "copy-buffer"
  document.body.append(textarea)
  textarea.select()

  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}
