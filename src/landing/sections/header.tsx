import { Send, ShoppingBag, ShoppingCart } from "lucide-react"

interface HeaderProps {
  botUrl: string | null
  cartCount: number
  openCart: () => void
}

export function Header({ botUrl, cartCount, openCart }: HeaderProps) {
  return (
    <header className="kb-header">
      <a className="kb-brand" href="./" aria-label="KICKSBASE">
        <img src="brand/kicksbase-logo.webp" width="80" height="80" alt="" />
        <span>
          <strong>KICKSBASE</strong>
          <small>Обувь и одежда</small>
        </span>
      </a>

      <nav className="kb-nav" aria-label="Основная навигация">
        <a href="#catalog">Товары</a>
        <a href="#how-it-works">Заказ</a>
        <a href="#trust">Условия</a>
      </nav>

      <div className="kb-header__actions">
        <button className="kb-header__cart" type="button" onClick={openCart}>
          <ShoppingCart aria-hidden="true" size={17} />
          Корзина
          {cartCount > 0 ? <span>{cartCount}</span> : null}
        </button>
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
      </div>
    </header>
  )
}
