import { BadgeCheck } from "lucide-react"

interface InfoSectionsProps {
  mode?: "discovery" | "order"
}

export function InfoSections({
  mode = "discovery",
}: InfoSectionsProps) {
  if (mode === "discovery") return null

  if (mode === "order") {
    return (
      <>
        <section className="trust" id="delivery" data-od-id="delivery-and-returns" aria-labelledby="trust-title">
          <div className="trust-grid container">
            <h2 className="trust-title" id="trust-title">Условия — до оформления</h2>
            <div className="trust-card" data-od-id="trust-price">
              <strong>Итоговая цена</strong>
              <p>Стоимость товара и расчёт заказа видны до перехода к оплате.</p>
            </div>
            <div className="trust-card" data-od-id="trust-delivery">
              <strong>Доставка</strong>
              <p>Срок и итоговую стоимость показываем до оплаты. Для большинства позиций ориентир 10–18 дней до Москвы.</p>
            </div>
            <div className="trust-card" data-od-id="trust-returns">
              <strong>Возврат и размер</strong>
              <p>Условия обмена и возврата доступны до выбора размера и оплаты.</p>
            </div>
          </div>
        </section>

        <section className="contacts container" id="contacts" data-od-id="contacts" aria-labelledby="contacts-title">
          <div className="contacts-copy">
            <p className="eyebrow">Связаться с KICKSBASE</p>
            <h2 id="contacts-title" data-od-id="contacts-title">Контакты</h2>
            <p>По вопросам заказа и наличия можно написать напрямую.</p>
          </div>
          <div className="contact-list" data-od-id="contact-list">
            <a className="contact-item" href="mailto:support@kicksbase.ru" data-od-id="contact-email"><span>Почта</span><strong>support@kicksbase.ru</strong></a>
            <a className="contact-item" href="https://t.me/kicksbase_officialbot" target="_blank" rel="noreferrer" data-od-id="contact-telegram-bot"><span>Telegram-бот</span><strong>@kicksbase_officialbot</strong></a>
            <span className="contact-item is-pending" aria-disabled="true" data-od-id="contact-telegram-channel"><span>Telegram-канал</span><strong>Ссылка уточняется</strong></span>
          </div>
        </section>
      </>
    )
  }

  return null
}

export function ProductTrustMarks() {
  return (
    <div className="product-trust-marks" aria-label="Автоматическая проверка заказа">
      {["Размер", "Цвет", "Наличие", "Срок"].map((item) => (
        <span key={item}>
          <BadgeCheck aria-hidden="true" size={15} />
          {item}
        </span>
      ))}
    </div>
  )
}
