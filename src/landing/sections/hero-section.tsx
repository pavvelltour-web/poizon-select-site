import { ArrowUpRight, ShoppingBag } from "lucide-react"

import {
  getDisplayPrice,
  getProductPath,
  getProductTypeLabel,
  resolveAssetUrl,
  setImageFallback,
} from "../landing-data"
import type { LandingStorefront } from "../use-landing-storefront"

interface HeroSectionProps {
  storefront: LandingStorefront
}

export function HeroSection({ storefront }: HeroSectionProps) {
  const featuredProduct = storefront.heroProducts[0] ?? null
  const featuredPrice = featuredProduct
    ? getDisplayPrice(featuredProduct, storefront.catalogPriceState.lookup)
    : null
  const featuredOffer = featuredProduct
    ? storefront.catalogPriceState.items[featuredProduct.slug]
    : null
  const featuredPriceIsPublished =
    storefront.catalogPriceState.status === "ready" &&
    featuredOffer?.availability === "catalog_listed"
  const featuredPriceValue = featuredPrice?.value ?? ""
  const featuredPriceNote = storefront.catalogPriceState.status === "loading"
    ? "Проверяем цену и наличие"
    : featuredPriceIsPublished
      ? "Цена товара"
      : "Заказ временно недоступен"

  return (
    <section className="shop-hero" aria-labelledby="hero-title">
      <div className="shop-hero__copy">
        <span className="shop-hero__eyebrow">KICKSBASE · спортивная витрина</span>
        <h1 id="hero-title">Выберите модель. Остальное видно сразу.</h1>
        <p className="shop-hero__lead">
          Цена, доступные размеры и срок доставки собраны рядом с товаром до перехода
          к оплате.
        </p>
        <div className="hero-actions">
          <a className="button button--primary" href="#catalog">
            <ShoppingBag aria-hidden="true" size={18} />
            Смотреть каталог
          </a>
          <a className="shop-hero__delivery" href="/delivery-returns">
            Условия доставки
            <ArrowUpRight aria-hidden="true" size={17} />
          </a>
        </div>
      </div>

      {featuredProduct && featuredPrice ? (
        <div className="hero-feature" aria-label="Выбранная модель">
          <a
            className="hero-feature__stage"
            href={getProductPath(featuredProduct)}
            aria-label={`Открыть товар: ${featuredProduct.brand} ${featuredProduct.name}`}
          >
            <img
              src={resolveAssetUrl(featuredProduct.image)}
              width="1200"
              height="900"
              alt={`${featuredProduct.brand} ${featuredProduct.name}`}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={(event) => setImageFallback(event, featuredProduct.fallbackImage)}
            />
          </a>
          <div className="hero-feature__caption">
            <span>
              <small>{getProductTypeLabel(featuredProduct)}</small>
              <strong>{featuredProduct.brand} {featuredProduct.name}</strong>
            </span>
            <span className="hero-feature__price">
              <b>{featuredPriceValue}</b>
              <small>{featuredPriceNote}</small>
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
