import type { CatalogProduct } from "../catalog/catalog"
import type { CatalogSearchResult } from "./cart"

const telegramUsernamePattern = /^[A-Za-z][A-Za-z0-9_]{4,31}$/
const telegramStartPayloadLimit = 64

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

export function buildTelegramBotUrl(username: string | null, startPayload?: string): string | null {
  const validatedUsername = resolveBotUsername(username)
  if (!validatedUsername) return null
  const payload = cleanLine(startPayload || "")
  if (!payload) return `https://t.me/${validatedUsername}`
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(payload)) return null
  return `https://t.me/${validatedUsername}?start=${payload}`
}

/**
 * Keep an off-catalog lookup in the private Telegram order flow.  The payload
 * contains only the normalised customer query; the bot performs its own fresh
 * Poizon lookup and never treats this as a new public storefront card.
 */
export function buildLiveSearchTelegramBotUrl(
  username: string | null,
  query: string | null,
): string | null {
  const validatedUsername = resolveBotUsername(username)
  const normalized = query ? cleanLine(query) : ""
  if (!validatedUsername || normalized.length < 2 || normalized.length > 120) return null
  try {
    const bytes = new TextEncoder().encode(normalized)
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const compact = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")
    const payload = `live_${compact}`
    return payload.length <= telegramStartPayloadLimit
      ? `https://t.me/${validatedUsername}?start=${payload}`
      : null
  } catch {
    return null
  }
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

/**
 * The bot must receive a customer-safe lookup, never a supplier URL, SKU or
 * source price.  Prefer an article because it identifies the exact colourway;
 * fall back to the readable card name and finally the AI-normalised query.
 */
export function buildLiveProductTelegramBotUrl(
  username: string | null,
  product: Pick<CatalogSearchResult, "article" | "brand" | "name">,
  normalizedQuery: string | null,
): string | null {
  const candidates = [
    product.article,
    [product.brand, product.name].filter(Boolean).join(" "),
    normalizedQuery,
  ]

  for (const candidate of candidates) {
    const url = buildLiveSearchTelegramBotUrl(username, candidate ? cleanLine(candidate) : null)
    if (url) return url
  }
  return buildTelegramBotUrl(username)
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
