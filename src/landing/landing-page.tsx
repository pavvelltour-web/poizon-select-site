import { AnimatePresence } from "motion/react"

import { CatalogSection } from "./sections/catalog-section"
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

      <Header botUrl={storefront.botUrl} />

      <main>
        <HeroSection storefront={storefront} />
        <InfoSections
          category={storefront.category}
          selectCategory={storefront.selectCategory}
        />
        <CatalogSection storefront={storefront} />
        <InfoSections mode="order" />
      </main>

      <Footer />

      <AnimatePresence>
        {storefront.selectedProduct ? (
          <ProductSheet key="product-sheet" storefront={storefront} />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
