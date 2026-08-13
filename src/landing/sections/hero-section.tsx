import { BadgeCheck, Medal, MoveRight, Send, ShoppingBag } from "lucide-react"

import { catalogCategories, catalogProducts } from "../../catalog/catalog"
import {
  getProductBadge,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"
import type { LandingStorefront } from "../use-landing-storefront"

interface HeroSectionProps {
  storefront: LandingStorefront
}

export function HeroSection({ storefront }: HeroSectionProps) {
  return (
    <section className="shop-hero" aria-labelledby="hero-title">
      <div className="shop-hero__copy">
        <p className="eyebrow">POIZON sports edit · Moscow delivery</p>
        <h1 id="hero-title">KICKSBASE</h1>
        <p className="shop-hero__lead">
          Спортивная витрина с расчетом до оплаты: игровые пары, защита, форма
          и восстановление. Выбираете модель, менеджер подтверждает размер,
          продавца, бирки и итог.
        </p>
        <div className="hero-actions">
          <a className="button button--primary" href="#catalog">
            <ShoppingBag aria-hidden="true" size={18} />
            Открыть витрину
          </a>
          {storefront.botUrl ? (
            <a
              className="button button--quiet"
              href={storefront.botUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send aria-hidden="true" size={18} />
              Написать менеджеру
            </a>
          ) : null}
        </div>
        <div className="pavel-note">
          <Medal aria-hidden="true" size={18} />
          <span>Сначала задача и покрытие. Потом модель, размер, продавец и цвет.</span>
        </div>
        <div className="hero-marks" aria-label="Преимущества каталога">
          {["Обувь под зал", "Расчёт до оплаты", "Бирки и упаковка"].map((item) => (
            <span key={item}>
              <BadgeCheck aria-hidden="true" size={16} />
              {item}
            </span>
          ))}
        </div>
        <dl className="hero-stats" aria-label="Показатели каталога">
          <div>
            <dt>Позиций</dt>
            <dd>{catalogProducts.length}</dd>
          </div>
          <div>
            <dt>Ракурсов</dt>
            <dd>{catalogProducts.length * 5}</dd>
          </div>
          <div>
            <dt>Категорий</dt>
            <dd>{catalogCategories.length - 1}</dd>
          </div>
        </dl>
      </div>

      <div className="shop-hero__media" aria-hidden="true">
        <div className="hero-product-stage hero-product-stage--atmosphere">
          <img src="brand/kicksbase-hero-court-v2.webp" width="1792" height="1024" alt="" />
          <span className="hero-product-stage__caption">
            <strong>COURT KIT</strong>
            <em>Pair, protection, recovery</em>
          </span>
        </div>
      </div>

      <div className="hero-board" aria-label="Быстрый выбор экипировки">
        <div className="hero-board__head">
          <span>Buyer’s edit</span>
          <small>3 быстрых входа</small>
        </div>
        {storefront.heroProducts.map((product) => {
          const price = storefront.getProductPrice(product)

          return (
            <button
              className="hero-pick"
              key={product.slug}
              type="button"
              onClick={(event) => storefront.openProduct(product, event.currentTarget)}
            >
              <img
                src={resolveAssetUrl(product.image)}
                width="1200"
                height="900"
                alt=""
                onError={(event) => setImageFallback(event, product.fallbackImage)}
              />
              <span>
                <small>{getProductBadge(product)}</small>
                <strong>
                  {product.brand} {product.name}
                </strong>
                <em>{price.value}</em>
              </span>
              <MoveRight aria-hidden="true" size={18} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
