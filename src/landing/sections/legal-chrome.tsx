import { useEffect, useRef, useState } from "react"

interface LegalHeaderProps {
  cartCount: number
  openCart: () => void
}

const logoSrc = "/storefront-media/approved/assets/kicksbase-signal/kicksbase-logo.webp"

export function LegalHeader({ cartCount, openCart }: LegalHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setMenuOpen(false)
      queueMicrotask(() => menuButtonRef.current?.focus())
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [menuOpen])

  return (
    <header className="site-header" data-od-id="legal-header">
      <div className="header-inner shell">
        <a className="brand" href="/" data-od-id="legal-logo" aria-label="KICKSBASE, на главную">
          <img className="brand-logo" src={logoSrc} alt="" width="720" height="720" />
          KICKSBASE
        </a>
        <nav className="header-nav" aria-label="Основная навигация">
          <a href="/catalog">Каталог</a>
          <a href="/#finder">Подобрать</a>
          <a href="/delivery-returns">Доставка и возврат</a>
          <a href="/#about">О нас</a>
        </nav>
        <div className="header-actions">
          <a
            className="header-cart"
            href="/?cart=1"
            data-od-id="cart-button"
            onClick={(event) => {
              event.preventDefault()
              openCart()
            }}
          >
            <strong>Корзина</strong>
            <span className="cart-count">{cartCount}</span>
          </a>
          <button
            className="header-link-button mobile-menu-button"
            type="button"
            id="menu-button"
            ref={menuButtonRef}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((current) => !current)}
          >
            Меню
          </button>
        </div>
      </div>
      <nav
        className="mobile-menu"
        id="mobile-menu"
        aria-label="Мобильная навигация"
        hidden={!menuOpen}
      >
        <a href="/catalog">Каталог</a>
        <a href="/#finder">Подобрать</a>
        <a href="/delivery-returns">Доставка и возврат</a>
        <a href="/#about">О нас</a>
      </nav>
    </header>
  )
}

export function LegalFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <a className="brand" href="/">
            <img className="brand-logo" src={logoSrc} alt="" width="720" height="720" />
            KICKSBASE
          </a>
        </div>
        <div>
          <strong>Покупателям</strong>
          <a href="/catalog">Каталог</a>
          <a href="/delivery-returns">Доставка и возврат</a>
        </div>
        <div>
          <strong>Документы</strong>
          <a href="#offer">Оферта</a>
          <a href="#privacy">Персональные данные</a>
        </div>
      </div>
    </footer>
  )
}
