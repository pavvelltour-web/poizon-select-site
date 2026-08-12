import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"

import { publicCatalogProducts, type CatalogProduct } from "../../catalog/catalog"
import { getProductPath, getProductTypeLabel, resolveAssetUrl } from "../landing-data"
import { useModalDialog } from "../use-modal-dialog"

interface HeaderProps {
  cartCount: number
  openCart: () => void
  personalDataConsentVersion: string | null
  refreshPersonalDataConsentVersion: () => Promise<string | null>
  searchValue?: string
  onSearchChange?: (value: string) => void
  favoriteSlugs?: readonly string[]
  onRemoveFavorite?: (slug: string) => void
  onOpenProduct?: (product: CatalogProduct, trigger: HTMLElement) => void
}

const logoSrc = "storefront-media/approved/assets/kicksbase-signal/kicksbase-logo.webp"

export function Header({
  cartCount,
  openCart,
  personalDataConsentVersion,
  refreshPersonalDataConsentVersion,
  searchValue = "",
  onSearchChange,
  favoriteSlugs = [],
  onRemoveFavorite,
  onOpenProduct,
}: HeaderProps) {
  const initialView = useMemo(() => {
    if (typeof window === "undefined") return ""
    return new URLSearchParams(window.location.search).get("view") || ""
  }, [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(initialView === "search")
  const [favoritesOpen, setFavoritesOpen] = useState(initialView === "favorites")
  const [loginOpen, setLoginOpen] = useState(() => {
    if (typeof window === "undefined") return false
    const searchParams = new URLSearchParams(window.location.search)
    return (
      (searchParams.get("login") === "1" || searchParams.get("view") === "login") &&
      searchParams.get("cart") !== "1"
    )
  })
  const [searchQuery, setSearchQuery] = useState(searchValue)
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false)
  const [loginStatus, setLoginStatus] = useState<"idle" | "loading" | "error" | "verified">("idle")
  const [loginMessage, setLoginMessage] = useState("")
  const [retryAfter, setRetryAfter] = useState(0)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const favoritesTriggerRef = useRef<HTMLButtonElement>(null)
  const loginTriggerRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const activeNavRef = useRef<HTMLAnchorElement | null>(null)
  const motionTokenRef = useRef(0)
  const searchDialogRef = useRef<HTMLDialogElement>(null)
  const favoritesDialogRef = useRef<HTMLDialogElement>(null)
  const loginDialogRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const favoritesCloseRef = useRef<HTMLButtonElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)

  useNativeDialog(searchDialogRef, searchOpen)
  useNativeDialog(favoritesDialogRef, favoritesOpen)
  useNativeDialog(loginDialogRef, loginOpen)
  useModalDialog({
    dialogRef: searchDialogRef,
    initialFocusRef: searchInputRef,
    isOpen: searchOpen,
    onClose: () => setSearchOpen(false),
    returnFocusRef: searchTriggerRef,
  })
  useModalDialog({
    dialogRef: favoritesDialogRef,
    initialFocusRef: favoritesCloseRef,
    isOpen: favoritesOpen,
    onClose: () => setFavoritesOpen(false),
    returnFocusRef: favoritesTriggerRef,
  })
  useModalDialog({
    dialogRef: loginDialogRef,
    initialFocusRef: phoneInputRef,
    isOpen: loginOpen,
    onClose: () => setLoginOpen(false),
    returnFocusRef: loginTriggerRef,
  })

  useEffect(() => {
    if (initialView === "cart") openCart()
  }, [initialView, openCart])

  useEffect(() => {
    if (retryAfter <= 0) return
    const timer = window.setInterval(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [retryAfter])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") document.body.classList.add("is-keyboard-nav")
      if (event.key !== "Escape" || !menuOpen) return
      setMenuOpen(false)
      queueMicrotask(() => menuTriggerRef.current?.focus())
    }
    const onPointerDown = () => document.body.classList.remove("is-keyboard-nav")
    document.addEventListener("keydown", onKeyDown, true)
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      document.removeEventListener("keydown", onKeyDown, true)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [menuOpen])

  const placeHighlight = (target: HTMLAnchorElement | null, immediate = false) => {
    const nav = navRef.current
    const highlight = highlightRef.current
    if (!target || !nav || !highlight) return
    const navRect = nav.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const toLeft = targetRect.left - navRect.left
    const toWidth = targetRect.width
    const fromLeft = Number(highlight.dataset.left || toLeft)
    const fromWidth = Number(highlight.dataset.width || toWidth)
    motionTokenRef.current += 1
    const token = motionTokenRef.current
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    if (immediate || reduceMotion || !highlight.dataset.ready) {
      highlight.style.transition = "none"
      highlight.style.left = `${toLeft}px`
      highlight.style.width = `${toWidth}px`
      highlight.dataset.left = String(toLeft)
      highlight.dataset.width = String(toWidth)
      highlight.dataset.ready = "true"
      return
    }

    const bridgeLeft = Math.min(fromLeft, toLeft)
    const bridgeRight = Math.max(fromLeft + fromWidth, toLeft + toWidth)
    highlight.style.transition = "left 90ms cubic-bezier(0.23,1,0.32,1), width 90ms cubic-bezier(0.23,1,0.32,1)"
    highlight.style.left = `${bridgeLeft}px`
    highlight.style.width = `${bridgeRight - bridgeLeft}px`
    window.setTimeout(() => {
      if (token !== motionTokenRef.current) return
      highlight.style.transition = "left 210ms cubic-bezier(0.23,1,0.32,1), width 210ms cubic-bezier(0.23,1,0.32,1)"
      highlight.style.left = `${toLeft}px`
      highlight.style.width = `${toWidth}px`
      highlight.dataset.left = String(toLeft)
      highlight.dataset.width = String(toWidth)
    }, 72)
  }

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLAnchorElement>('[aria-current="page"]')
    activeNavRef.current = active
    const placeActive = () => placeHighlight(activeNavRef.current, true)
    placeActive()
    window.addEventListener("resize", placeActive)
    window.addEventListener("load", placeActive)
    return () => {
      window.removeEventListener("resize", placeActive)
      window.removeEventListener("load", placeActive)
    }
  }, [])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ru")
    if (query.length < 2) return []
    return publicCatalogProducts
      .filter((product) => `${getProductTypeLabel(product)} ${product.brand} ${product.name}`.toLocaleLowerCase("ru").includes(query))
      .slice(0, 6)
  }, [searchQuery])
  const favoriteProducts = useMemo(
    () => favoriteSlugs.flatMap((slug) => {
      const product = publicCatalogProducts.find((item) => item.slug === slug)
      return product ? [product] : []
    }),
    [favoriteSlugs],
  )

  const requestCode = async () => {
    if (!personalDataAccepted || phone.trim().length < 10) {
      setLoginStatus("error")
      setLoginMessage("Укажите телефон и подтвердите обработку персональных данных.")
      return
    }
    setLoginStatus("loading")
    setLoginMessage("")
    try {
      const consentVersion = personalDataConsentVersion || (await refreshPersonalDataConsentVersion())
      if (!consentVersion) throw new Error("Сервис входа временно недоступен. Попробуйте позже.")
      const response = await fetch("/api/auth/sms/request", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          personal_data_accepted: true,
          consent_version: consentVersion,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        challenge_id?: string
        message?: string
        detail?: string
        retry_after_seconds?: number
      }
      if (response.status !== 202 || !payload.challenge_id) {
        throw new Error(payload.detail || payload.message || "Не удалось отправить код. Попробуйте позже.")
      }
      setChallengeId(payload.challenge_id)
      setRetryAfter(payload.retry_after_seconds || 0)
      setLoginStatus("idle")
      setLoginMessage(payload.message || "Код отправлен.")
    } catch (error) {
      setLoginStatus("error")
      setLoginMessage(error instanceof Error ? error.message : "Сервис входа временно недоступен.")
    }
  }

  const verifyCode = async () => {
    if (!challengeId || code.trim().length < 4) return
    setLoginStatus("loading")
    setLoginMessage("")
    try {
      const response = await fetch("/api/auth/sms/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code: code.trim() }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        authenticated?: boolean
        message?: string
        detail?: string
      }
      if (!response.ok || payload.authenticated !== true) {
        throw new Error(payload.detail || payload.message || "Неверный или просроченный код.")
      }
      setLoginStatus("verified")
      setLoginMessage("Вход выполнен.")
    } catch (error) {
      setLoginStatus("error")
      setLoginMessage(error instanceof Error ? error.message : "Не удалось проверить код.")
    }
  }

  const navLinks = [
    ["/#popular", "Каталог", "nav-catalog"],
    ["/#finder", "Подобрать", "nav-finder"],
    ["/#delivery", "Доставка и возврат", "nav-delivery-and-returns"],
    ["/#about", "О нас", "nav-about"],
    ["/#contacts", "Контакты", "nav-contacts"],
  ] as const

  return (
    <>
      <header className="site-header" data-od-id="site-header">
        <div className="header-bar container">
          <button
            ref={menuTriggerRef}
            className="icon-button menu-button"
            type="button"
            data-od-id="menu-button"
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
            title="Меню"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu aria-hidden="true" />
          </button>

          <a className="brand" href="/" data-od-id="brand-link" aria-label="KICKSBASE - главная">
            <img className="brand-mark" src={resolveAssetUrl(logoSrc)} alt="" width="720" height="720" />
            <span className="brand-copy">
              <span className="brand-name">KICKSBASE</span>
              <span className="brand-note">обувь и экипировка</span>
            </span>
          </a>

          <nav
            ref={navRef}
            className="desktop-nav"
            data-od-id="primary-navigation"
            aria-label="Основная навигация"
            onPointerLeave={() => placeHighlight(activeNavRef.current)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) placeHighlight(activeNavRef.current)
            }}
          >
            <span ref={highlightRef} className="nav-highlight" aria-hidden="true" />
            {navLinks.map(([href, label, odId], index) => (
              <a
                key={odId}
                href={href}
                data-od-id={odId}
                aria-current={index === 0 ? "page" : undefined}
                onPointerEnter={(event) => placeHighlight(event.currentTarget)}
                onFocus={(event) => placeHighlight(event.currentTarget)}
                onClick={(event) => {
                  activeNavRef.current?.removeAttribute("aria-current")
                  activeNavRef.current = event.currentTarget
                  event.currentTarget.setAttribute("aria-current", "page")
                  placeHighlight(event.currentTarget)
                }}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="header-actions" data-od-id="header-actions">
            <button
              ref={searchTriggerRef}
              className="icon-button"
              type="button"
              data-od-id="search-button"
              aria-label="Открыть поиск"
              title="Поиск"
              onClick={() => setSearchOpen(true)}
            >
              <Search aria-hidden="true" />
            </button>
            <button
              ref={loginTriggerRef}
              className="icon-button login-button"
              type="button"
              data-od-id="login-button"
              aria-label="Войти по SMS"
              title="Войти"
              onClick={() => setLoginOpen(true)}
            >
              <UserRound aria-hidden="true" />
            </button>
            <button
              ref={favoritesTriggerRef}
              className="icon-button"
              type="button"
              data-od-id="favorites-button"
              aria-label="Открыть избранное"
              title="Избранное"
              onClick={() => setFavoritesOpen(true)}
            >
              <Heart aria-hidden="true" />
              <span className={`action-count ${favoriteProducts.length > 0 ? "is-visible" : ""}`} aria-label="Товаров в избранном">
                {favoriteProducts.length}
              </span>
            </button>
            <button
              className="icon-button"
              type="button"
              data-od-id="cart-button"
              aria-label={cartCount > 0 ? `Корзина, товаров: ${cartCount}` : "Открыть корзину"}
              title="Корзина"
              onClick={openCart}
            >
              <ShoppingBag aria-hidden="true" />
              <span className={`action-count ${cartCount > 0 ? "is-visible" : ""}`} aria-label="Товаров в корзине">
                {cartCount}
              </span>
            </button>
          </div>
        </div>

        <nav
          className={`mobile-menu ${menuOpen ? "is-open" : ""}`}
          data-od-id="mobile-navigation"
          aria-label="Мобильная навигация"
        >
          {navLinks.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>
          ))}
        </nav>
      </header>

      {searchOpen ? (
        <dialog
          ref={searchDialogRef}
          className="modal"
          id="search-dialog"
          data-od-id="search-dialog"
          aria-labelledby="search-dialog-title"
          onCancel={(event) => {
            event.preventDefault()
            setSearchOpen(false)
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false)
          }}
        >
          <div className="modal-shell">
            <div className="modal-head">
              <h2 id="search-dialog-title">Поиск</h2>
              <button className="icon-button modal-close" type="button" onClick={() => setSearchOpen(false)} aria-label="Закрыть поиск"><X aria-hidden="true" /></button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                onSearchChange?.(searchQuery)
                setSearchOpen(false)
                queueMicrotask(() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }))
              }}
            >
              <label>
                <span className="skip-link">Название модели или бренд</span>
                <input
                  ref={searchInputRef}
                  className="text-input"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Nike, ASICS или название модели"
                  autoComplete="off"
                />
              </label>
            </form>
            <p className="modal-help">Введите бренд, модель или тип товара.</p>
            <div className="search-results" aria-live="polite">
              {searchResults.map((product) => (
                <button
                  key={product.slug}
                  className="result-button"
                  type="button"
                  onClick={(event) => {
                    setSearchOpen(false)
                    if (onOpenProduct) onOpenProduct(product, event.currentTarget)
                    else window.location.assign(getProductPath(product))
                  }}
                >
                  <strong>{getProductTypeLabel(product)} {product.brand} {product.name}</strong>
                  <span>Открыть</span>
                </button>
              ))}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 ? <p className="empty-state">Ничего не нашли.</p> : null}
            </div>
          </div>
        </dialog>
      ) : null}

      {favoritesOpen ? (
        <dialog
          ref={favoritesDialogRef}
          className="modal"
          id="favorites-dialog"
          data-od-id="favorites-dialog"
          aria-labelledby="favorites-title"
          onCancel={(event) => {
            event.preventDefault()
            setFavoritesOpen(false)
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setFavoritesOpen(false)
          }}
        >
          <div className="modal-shell">
            <div className="modal-head">
              <div><p className="dialog-eyebrow">Сохранённые модели</p><h2 id="favorites-title" data-od-id="favorites-title">Избранное</h2></div>
              <button ref={favoritesCloseRef} className="icon-button modal-close" type="button" onClick={() => setFavoritesOpen(false)} aria-label="Закрыть избранное"><X aria-hidden="true" /></button>
            </div>
            <div className="favorites-list">
              {favoriteProducts.map((product) => (
                <article className="favorite-row" key={product.slug} data-od-id={`favorite-row-${product.slug}`}>
                  <img src={resolveAssetUrl(product.image)} alt="" width="84" height="63" />
                  <div className="favorite-row-copy"><strong>{product.brand} {product.name}</strong><span>Сохранено в этом браузере</span></div>
                  <span className="favorite-row-actions">
                    <button
                      type="button"
                      data-od-id={`open-favorite-${product.slug}`}
                      onClick={(event) => {
                        setFavoritesOpen(false)
                        if (onOpenProduct) onOpenProduct(product, event.currentTarget)
                        else window.location.assign(getProductPath(product))
                      }}
                    >Открыть</button>
                    <button type="button" data-od-id={`remove-favorite-${product.slug}`} onClick={() => onRemoveFavorite?.(product.slug)}>Удалить</button>
                  </span>
                </article>
              ))}
            </div>
            {favoriteProducts.length === 0 ? <p className="empty-state">В избранном пока нет моделей.</p> : null}
          </div>
        </dialog>
      ) : null}

      {loginOpen ? (
        <dialog
          ref={loginDialogRef}
          className="modal"
          id="login-dialog"
          data-od-id="login-dialog"
          aria-labelledby="sms-login-title"
          onCancel={(event) => {
            event.preventDefault()
            setLoginOpen(false)
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setLoginOpen(false)
          }}
        >
          <form
            className="modal-shell login-form"
            onSubmit={(event) => {
              event.preventDefault()
              void (challengeId ? verifyCode() : requestCode())
            }}
          >
            <div className="modal-head">
              <div><p className="dialog-eyebrow">Личный кабинет</p><h2 id="sms-login-title">Войти по SMS</h2></div>
              <button type="button" className="icon-button modal-close" onClick={() => setLoginOpen(false)} aria-label="Закрыть вход"><X aria-hidden="true" /></button>
            </div>
            <label>
              <span>Телефон</span>
              <input ref={phoneInputRef} className="text-input" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={Boolean(challengeId) || loginStatus === "verified"} placeholder="+7 999 000-00-00" required />
            </label>
            {!challengeId ? (
              <label className="sms-login__consent">
                <input type="checkbox" checked={personalDataAccepted} onChange={(event) => setPersonalDataAccepted(event.target.checked)} />
                <span>Согласен на обработку телефона для сервисного SMS-входа. <a href="/personal-data-consent">Условия согласия</a>.</span>
              </label>
            ) : (
              <label>
                <span>Код из SMS</span>
                <input className="text-input" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} required autoFocus />
              </label>
            )}
            <button className="dialog-primary" type="submit" disabled={loginStatus === "loading" || loginStatus === "verified"}>
              {loginStatus === "loading" ? "Подождите..." : challengeId ? "Подтвердить код" : "Получить код"}
            </button>
            {challengeId && loginStatus !== "verified" ? (
              <button className="sms-login__resend" type="button" onClick={() => void requestCode()} disabled={loginStatus === "loading" || retryAfter > 0}>
                {retryAfter > 0 ? `Повторить через ${retryAfter} с` : "Отправить код ещё раз"}
              </button>
            ) : null}
            {loginMessage ? <p className={`modal-help sms-login__message--${loginStatus}`} role={loginStatus === "error" ? "alert" : "status"}>{loginMessage}</p> : null}
          </form>
        </dialog>
      ) : null}
    </>
  )
}

function useNativeDialog(ref: RefObject<HTMLDialogElement | null>, isOpen: boolean) {
  useEffect(() => {
    const dialog = ref.current
    if (!isOpen || !dialog) return
    if (typeof dialog.showModal === "function") dialog.showModal()
    else dialog.setAttribute("open", "")
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close()
      else dialog.removeAttribute("open")
    }
  }, [isOpen, ref])
}
