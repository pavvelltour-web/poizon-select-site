import { resolveAssetUrl } from "../landing-data"

const logoSrc = "storefront-media/approved/assets/kicksbase-signal/kicksbase-logo.webp"

export function Footer() {
  return (
    <footer className="site-footer" id="about" data-od-id="site-footer">
      <div className="footer-grid container">
        <div>
          <a className="brand" href="/" aria-label="KICKSBASE - главная">
            <img className="brand-mark" src={resolveAssetUrl(logoSrc)} alt="" width="720" height="720" />
            <span className="brand-copy"><span className="brand-name">KICKSBASE</span></span>
          </a>
          <p className="footer-copy">Оригинальная экипировка для зала, тренировок и восстановления. На каждой странице показываем цену, размеры и срок поставки.</p>
          <div className="sr-only" aria-label="Способы оплаты">
            <span>МИР</span><span>СБП</span><span>Visa</span><span>Mastercard</span>
          </div>
        </div>
        <nav className="footer-links" aria-label="Юридическая информация">
          <a href="/delivery-returns">Доставка и возврат</a>
          <a href="/offer">Публичная оферта</a>
          <a href="/privacy">Политика данных</a>
          <a href="/personal-data-consent">Согласие</a>
          <a href="/#contacts">Контакты</a>
        </nav>
      </div>
    </footer>
  )
}
