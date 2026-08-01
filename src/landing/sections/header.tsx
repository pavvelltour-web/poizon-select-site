import { LogIn, Search, ShoppingCart, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useModalDialog } from "../use-modal-dialog"

interface HeaderProps {
  cartCount: number
  openCart: () => void
  personalDataConsentVersion: string | null
  refreshPersonalDataConsentVersion: () => Promise<string | null>
}

export function Header({
  cartCount,
  openCart,
  personalDataConsentVersion,
  refreshPersonalDataConsentVersion,
}: HeaderProps) {
  const [loginOpen, setLoginOpen] = useState(() => {
    if (typeof window === "undefined") return false
    const searchParams = new URLSearchParams(window.location.search)
    return searchParams.get("login") === "1" && searchParams.get("cart") !== "1"
  })
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false)
  const [loginStatus, setLoginStatus] = useState<"idle" | "loading" | "error" | "verified">("idle")
  const [loginMessage, setLoginMessage] = useState("")
  const [retryAfter, setRetryAfter] = useState(0)
  const loginTriggerRef = useRef<HTMLButtonElement>(null)
  const loginDialogRef = useRef<HTMLFormElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)

  useModalDialog({
    dialogRef: loginDialogRef,
    initialFocusRef: phoneInputRef,
    isOpen: loginOpen,
    onClose: () => setLoginOpen(false),
    returnFocusRef: loginTriggerRef,
  })

  useEffect(() => {
    if (retryAfter <= 0) return
    const timer = window.setInterval(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [retryAfter])

  const requestCode = async () => {
    if (!personalDataAccepted || phone.trim().length < 10) {
      setLoginStatus("error")
      setLoginMessage("Укажите телефон и подтвердите обработку персональных данных.")
      return
    }
    setLoginStatus("loading")
    setLoginMessage("")
    try {
      const consentVersion =
        personalDataConsentVersion ||
        (await refreshPersonalDataConsentVersion())
      if (!consentVersion) {
        throw new Error("Сервис входа временно недоступен. Попробуйте позже.")
      }
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

  return (
    <>
    <header className="kb-header">
      <a className="kb-brand" href="/" aria-label="KICKSBASE">
        <img src="/brand/kicksbase-logo.webp" width="80" height="80" alt="" />
        <span>
          <strong>KICKSBASE</strong>
          <small>Обувь и одежда</small>
        </span>
      </a>

      <nav className="kb-nav" aria-label="Основная навигация">
        <a href="/#catalog">Каталог</a>
        <a href="/#selection">Подобрать</a>
        <a href="/delivery-returns">Доставка и возврат</a>
      </nav>

      <div className="kb-header__actions">
        <a className="kb-header__search" href="/#catalog" aria-label="Поиск">
          <Search aria-hidden="true" size={17} />
          <span>Поиск</span>
        </a>
        <button
          ref={loginTriggerRef}
          className="kb-header__login"
          type="button"
          aria-label="Войти по SMS"
          onClick={() => setLoginOpen(true)}
        >
          <LogIn aria-hidden="true" size={17} />
          <span>Войти</span>
        </button>
        <button
          className="kb-header__cart"
          type="button"
          aria-label={cartCount > 0 ? `Корзина, товаров: ${cartCount}` : "Корзина"}
          onClick={openCart}
        >
          <ShoppingCart aria-hidden="true" size={17} />
          <span>Корзина</span>
          {cartCount > 0 ? <span className="kb-header__count">{cartCount}</span> : null}
        </button>
      </div>
    </header>
    {loginOpen ? (
      <div className="sms-login" role="dialog" aria-modal="true" aria-labelledby="sms-login-title">
        <button className="sms-login__scrim" type="button" tabIndex={-1} onClick={() => setLoginOpen(false)} aria-label="Закрыть вход" />
        <form
          ref={loginDialogRef}
          className="sms-login__panel"
          tabIndex={-1}
          onSubmit={(event) => {
            event.preventDefault()
            void (challengeId ? verifyCode() : requestCode())
          }}
        >
          <div className="sms-login__head">
            <div>
              <small>Личный кабинет</small>
              <h2 id="sms-login-title">Вход по SMS</h2>
            </div>
            <button type="button" onClick={() => setLoginOpen(false)} aria-label="Закрыть вход">
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <label>
            <span>Телефон</span>
            <input
              ref={phoneInputRef}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={Boolean(challengeId) || loginStatus === "verified"}
              placeholder="+7 999 000-00-00"
              required
            />
          </label>
          {!challengeId ? (
            <label className="sms-login__consent">
              <input
                type="checkbox"
                checked={personalDataAccepted}
                onChange={(event) => setPersonalDataAccepted(event.target.checked)}
              />
              <span>
                Согласен на обработку телефона для сервисного SMS-входа.{" "}
                <a href="/personal-data-consent">Условия согласия</a>.
              </span>
            </label>
          ) : (
            <label>
              <span>Код из SMS</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                required
                autoFocus
              />
            </label>
          )}
          <button className="button button--primary" type="submit" disabled={loginStatus === "loading" || loginStatus === "verified"}>
            {loginStatus === "loading" ? "Подождите..." : challengeId ? "Подтвердить код" : "Получить код"}
          </button>
          {challengeId && loginStatus !== "verified" ? (
            <button className="sms-login__resend" type="button" onClick={() => void requestCode()} disabled={loginStatus === "loading" || retryAfter > 0}>
              {retryAfter > 0 ? "Повторить через " + retryAfter + " с" : "Отправить код ещё раз"}
            </button>
          ) : null}
          {loginMessage ? (
            <p className={"sms-login__message sms-login__message--" + loginStatus} role={loginStatus === "error" ? "alert" : "status"}>
              {loginMessage}
            </p>
          ) : null}
        </form>
      </div>
    ) : null}
    </>
  )
}
