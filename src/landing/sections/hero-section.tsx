import { ArrowUpRight, BadgeCheck, Send, ShoppingBag } from "lucide-react"

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
        <span className="shop-hero__eyebrow">Оригинальная экипировка</span>
        <h1 id="hero-title">
          <span>KICKS</span>
          <span>BASE</span>
        </h1>
        <p className="shop-hero__lead">
          Выберите модель и размер, оплатите на сайте и получите заказ. Цена и условия
          известны до оплаты.
        </p>
        <div className="hero-actions">
          <a className="button button--primary" href="#catalog">
            <ShoppingBag aria-hidden="true" size={18} />
            Перейти к товарам
          </a>
          {storefront.botUrl ? (
            <a
              className="button button--quiet"
              href={storefront.botUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send aria-hidden="true" size={18} />
              Подбор в Telegram
            </a>
          ) : null}
        </div>
        <p className="shop-hero__note">
          <BadgeCheck aria-hidden="true" size={18} />
          Подлинность проверяется до отправки
        </p>
      </div>

      <div className="hero-commerce" aria-label="Популярные товары">
        <div className="hero-commerce__head">
          <div>
            <span>Быстрый выбор</span>
            <h2>Популярные модели</h2>
          </div>
          <a href="#catalog">
            Все товары <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="hero-commerce__grid">
          {storefront.heroProducts.map((product) => {
            const price = getDisplayPrice(product, storefront.catalogPriceState.lookup)

            return (
              <button
                className="hero-pick"
                key={product.slug}
                type="button"
                onClick={(event) => storefront.openProduct(product, event.currentTarget)}
              >
                <span className="hero-pick__image">
                  <img
                    src={resolveAssetUrl(product.image)}
                    width="1200"
                    height="900"
                    alt=""
                    onError={(event) => setImageFallback(event, product.fallbackImage)}
                  />
                </span>
                <span className="hero-pick__body">
                  <span>{getProductBadge(product)}</span>
                  <strong>
                    {product.brand} {product.name}
                  </strong>
                  <small>{price.value}</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
