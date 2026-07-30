export function Footer() {
  return (
    <footer className="kb-footer">
      <div className="kb-footer__intro">
        <a className="kb-brand" href="/" aria-label="KICKSBASE">
          <img src="brand/kicksbase-logo.webp" width="80" height="80" alt="" />
          <span>
            <strong>KICKSBASE</strong>
            <small>Обувь и одежда</small>
          </span>
        </a>
        <p>
          Витрина для выбора оригинальной обуви и одежды. Вы выбираете товар,
          менеджер подтверждает размер, цвет, наличие и итоговую сумму до оплаты.
        </p>
      </div>

      <div className="kb-footer__grid" aria-label="Уточнения по заказу">
        <article>
          <strong>Продавец</strong>
          <p>ИП Шустров Павел Павлович. ИНН 772919270272. ОГРНИП 323774600547884.</p>
        </article>
        <article>
          <strong>Контакты</strong>
          <p>Поддержка в Telegram. Email и телефон будут опубликованы после подтверждения.</p>
        </article>
        <article>
          <strong>Документы</strong>
          <p>
            <a href="#legal-offer">Оферта</a>,{" "}
            <a href="#privacy-policy">персональные данные</a>,{" "}
            <a href="#delivery-returns">доставка и возврат</a>.
          </p>
        </article>
      </div>

      <div className="kb-footer__legal" id="legal-offer">
        <article id="privacy-policy">
          <strong>Данные и cookies</strong>
          <p>
            Сайт использует только необходимые cookies для работы витрины. На
            формах заказа согласие на обработку персональных данных должно быть
            отдельным и пустым по умолчанию.
          </p>
        </article>
        <article id="delivery-returns">
          <strong>Доставка и возврат</strong>
          <p>
            Заказы из Китая идут до Москвы, затем отправляются СДЭК. Для товара
            в наличии в России действует отдельный возврат. Для заказа из Китая
            менеджер сначала определяет законный сценарий, затем может предложить
            перепродажу или Kikki-баланс как дополнительный вариант.
          </p>
        </article>
      </div>

      <div className="kb-footer__bottom">
        <p>
          Товарные знаки принадлежат их владельцам. Финальное подтверждение по
          заказу всегда делает менеджер перед оплатой.
        </p>
        <a href="#catalog">Открыть товары</a>
      </div>
    </footer>
  )
}
