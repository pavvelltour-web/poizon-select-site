export function Footer() {
  return (
    <footer className="kb-footer">
      <div className="kb-footer__intro">
        <a className="kb-brand" href="/" aria-label="KICKSBASE">
          <img src="brand/kicksbase-logo.webp" width="80" height="80" alt="" />
          <span>
            <strong>KICKSBASE</strong>
            <small>Заловая экипировка</small>
          </span>
        </a>
        <p>
          Витрина для быстрого выбора экипировки под заказ через Telegram. Вы
          выбираете товар и получаете размер, бирки, упаковку и финальную сумму до оплаты.
        </p>
      </div>

      <div className="kb-footer__grid" aria-label="Уточнения по заказу">
        <article>
          <strong>Детали заказа</strong>
          <p>SKU, продавец, размер, цвет и наличие.</p>
        </article>
        <article>
          <strong>Расчет</strong>
          <p>Цена выкупа, комиссия, логистика и итог.</p>
        </article>
        <article>
          <strong>Поддержка</strong>
          <p>Фото товара, бирки и упаковка перед оплатой.</p>
        </article>
      </div>

      <div className="kb-footer__bottom">
        <p>
          Товарные знаки принадлежат их владельцам. Финальное подтверждение по
          заказу всегда делает менеджер перед оплатой.
        </p>
        <a href="#catalog">Открыть каталог</a>
      </div>
    </footer>
  )
}
