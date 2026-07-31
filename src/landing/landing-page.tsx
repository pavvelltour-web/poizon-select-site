import { AnimatePresence } from "motion/react"
import { useEffect, useState } from "react"

import { CatalogSection } from "./sections/catalog-section"
import { CartDrawer } from "./sections/cart-drawer"
import { Footer } from "./sections/footer"
import { Header } from "./sections/header"
import { HeroSection } from "./sections/hero-section"
import { InfoSections } from "./sections/info-sections"
import { ProductSheet } from "./sections/product-sheet"
import { useLandingStorefront } from "./use-landing-storefront"

interface LandingPageProps {
  configuredBotUsername?: string | null
}

export function LandingPage({ configuredBotUsername }: LandingPageProps) {
  const storefront = useLandingStorefront(configuredBotUsername)

  return (
    <div
      className={`kb-page ${storefront.selectedProduct ? "kb-page--sheet-open" : ""}`}
    >
      <a className="skip-link" href="#catalog">
        Перейти к каталогу
      </a>

      <Header
        botUrl={storefront.botUrl}
        cartCount={storefront.cartCount}
        openCart={storefront.openCart}
      />

      <main>
        <HeroSection storefront={storefront} />
        <CatalogSection storefront={storefront} />
        <InfoSections mode="order" />
      </main>

      <Footer />
      <CookieNotice />

      <AnimatePresence>
        {storefront.selectedProduct ? (
          <ProductSheet key="product-sheet" storefront={storefront} />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {storefront.isCartOpen ? (
          <CartDrawer key="cart-drawer" storefront={storefront} />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function CookieNotice() {
  const [isVisible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(localStorage.getItem("kicksbase-cookie-notice") !== "accepted")
  }, [])

  if (!isVisible) return null

  return (
    <div className="cookie-notice" role="region" aria-label="Согласие на использование cookie">
      <p>
        Сайт использует необходимые файлы cookie для работы витрины и сохранения корзины.
        Продолжая использование сайта, вы соглашаетесь с{" "}
        <a href="#privacy-policy">Политикой обработки персональных данных</a>.
      </p>
      <button
        type="button"
        className="button button--primary"
        onClick={() => {
          localStorage.setItem("kicksbase-cookie-notice", "accepted")
          setVisible(false)
        }}
      >
        Понятно
      </button>
    </div>
  )
}
