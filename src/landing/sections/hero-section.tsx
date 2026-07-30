import { BadgeCheck, Medal, MoveRight, Send, ShoppingBag } from "lucide-react"

import {
  getDisplayPrice,
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
        <h1 id="hero-title">KICKSBASE</h1>
        <p className="shop-hero__lead">
          Оригинальная обувь и одежда для спортсменов, которым важны размер,
          качество и понятная цена.
        </p>
        <div className="hero-actions">
          <a className="button button--primary" href="#catalog">
            <ShoppingBag aria-hidden="true" size={18} />
            Выбрать товар
          </a>
          {storefront.botUrl ? (
            <a
              className="button button--quiet"
              href={storefront.botUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send aria-hidden="true" size={18} />
              Открыть Telegram
            </a>
          ) : null}
        </div>
        <div className="pavel-note">
          <Medal aria-hidden="true" size={18} />
          <span>Выберите модель и размер, оплатите заказ на защищённой странице.</span>
        </div>
        <div className="hero-marks" aria-label="Преимущества каталога">
          {["Подбор под задачу", "Цена до оплаты", "Автоматический заказ"].map((item) => (
            <span key={item}>
              <BadgeCheck aria-hidden="true" size={16} />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="shop-hero__media">
        <div className="hero-product-stage hero-product-stage--atmosphere">
          <img src="brand/kicksbase-hero-court-v2.webp" width="1792" height="1024" alt="" />
        </div>
        <div className="hero-board" aria-label="Быстрый выбор товара">
          <div className="hero-board__head">
            <span>Быстрый выбор</span>
            <small>3 товара</small>
          </div>
          {storefront.heroProducts.map((product) => {
            const price = getDisplayPrice(product)

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
      </div>
    </section>
  )
}
