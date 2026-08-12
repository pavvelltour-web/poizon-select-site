import { resolveAssetUrl } from "../landing-data"

export function HeroSection() {
  return (
    <div className="hero-wrap container">
      <section className="hero" data-od-id="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Кроссовки и экипировка</p>
          <h1 id="hero-title" data-od-id="hero-title">Выберите пару под свой запрос.</h1>
          <p className="hero-lead">Подберите модель по задаче, размеру и бюджету до перехода к оплате.</p>
          <a className="hero-action" href="#finder" data-od-id="hero-primary-cta">Подобрать модель</a>
        </div>
        <div className="hero-media hero-media--scene" data-od-id="hero-product-stage">
          <img
            src={resolveAssetUrl("brand/kicksbase-hero.webp")}
            alt="Волейбольная экипировка KICKSBASE"
            width="1600"
            height="1200"
            fetchPriority="high"
          />
        </div>
      </section>
    </div>
  )
}
