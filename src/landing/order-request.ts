import type { CatalogProduct } from "../catalog/catalog"

const telegramUsernamePattern = /^[A-Za-z][A-Za-z0-9_]{4,31}$/
const telegramStartPayloadLimit = 64
const liveSearchPayloadPrefix = "live_"

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

export function buildTelegramBotUrl(
  username: string | null,
  startPayload?: string | null,
): string | null {
  const validatedUsername = resolveBotUsername(username)
  if (!validatedUsername) return null
  if (!startPayload) return `https://t.me/${validatedUsername}`
  // Telegram start payloads are capped at 64 URL-safe characters.  The
  // server validates this again and resolves only a known catalogue slug.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(startPayload)) return null
  return `https://t.me/${validatedUsername}?start=${startPayload}`
}

function encodeBase64Url(value: string): string | null {
  try {
    const bytes = new TextEncoder().encode(value)
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
  } catch {
    return null
  }
}

export function buildLiveSearchTelegramBotUrl(
  username: string | null,
  normalizedQuery: string | null,
): string | null {
  const validatedUsername = resolveBotUsername(username)
  const query = typeof normalizedQuery === "string" ? cleanLine(normalizedQuery) : ""
  if (!validatedUsername || query.length < 2 || query.length > 120) return null

  const token = encodeBase64Url(query)
  const payload = token ? `${liveSearchPayloadPrefix}${token}` : ""
  if (!payload || payload.length > telegramStartPayloadLimit) return null

  return `https://t.me/${validatedUsername}?start=${payload}`
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
