import { Send, ShoppingBag } from "lucide-react"

interface HeaderProps {
  botUrl: string | null
}

export function Header({ botUrl }: HeaderProps) {
  return (
    <header className="kb-header">
      <a className="kb-brand" href="./" aria-label="KICKSBASE">
        <img src="brand/kicksbase-logo.webp" width="80" height="80" alt="" />
        <span>
          <strong>KICKSBASE</strong>
          <small>Заловая экипировка</small>
        </span>
      </a>

      <nav className="kb-nav" aria-label="Основная навигация">
        <a href="#catalog">Каталог</a>
        <a href="#how-it-works">Заказ</a>
        <a href="#trust">Условия</a>
      </nav>

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
    </header>
  )
}
