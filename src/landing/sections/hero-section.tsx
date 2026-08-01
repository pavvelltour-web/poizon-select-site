import { ArrowRight, ArrowUpRight, BadgeCheck, ShoppingBag } from "lucide-react"

const heroPaths = [
  {
    href: "/?category=court-shoes#catalog",
    label: "Для зала",
    detail: "Тренировки и игры",
  },
  {
    href: "/?category=volleyball#catalog",
    label: "Волейбол",
    detail: "Пары для матча",
  },
  {
    href: "/?category=basketball#catalog",
    label: "Баскетбол",
    detail: "Пары для движения",
  },
  {
    href: "/?category=recovery#catalog",
    label: "После тренировки",
    detail: "Слайды и сабо",
  },
] as const

export function HeroSection() {
  return (
    <section className="shop-hero" aria-labelledby="hero-title">
      <div className="shop-hero__copy">
        <span className="shop-hero__eyebrow">Оригинальная обувь и одежда</span>
        <h1 id="hero-title">Выберите модель. Остальное видно сразу.</h1>
        <p className="shop-hero__lead">
          Цена, размер и срок доставки видны до оформления заказа.
        </p>
        <div className="hero-actions">
          <a className="button button--primary" href="#catalog">
            <ShoppingBag aria-hidden="true" size={18} />
            Перейти к товарам
          </a>
          <a className="shop-hero__delivery" href="/delivery-returns">
            Доставка и возврат
            <ArrowUpRight aria-hidden="true" size={17} />
          </a>
        </div>
      </div>

      <aside className="hero-paths" aria-label="Быстрый выбор">
        <div className="hero-paths__head">
          <span>Быстрый выбор</span>
          <strong>С чего начать</strong>
        </div>
        <nav className="hero-paths__grid" aria-label="Подбор по задаче">
          {heroPaths.map((path) => (
            <a key={path.href} href={path.href}>
              <span>
                <strong>{path.label}</strong>
                <small>{path.detail}</small>
              </span>
              <ArrowRight aria-hidden="true" size={20} />
            </a>
          ))}
        </nav>
        <div className="hero-paths__note">
          <BadgeCheck aria-hidden="true" size={21} />
          <span>
            <strong>Данные заказа</strong>
            <small>Модель, размер и цена сохраняются в системе.</small>
          </span>
        </div>
      </aside>
    </section>
  )
}
