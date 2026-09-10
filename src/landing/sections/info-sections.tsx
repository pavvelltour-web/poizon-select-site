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
              <p>Международная доставка 1500 ₽ включена в товар. Онлайн-оплата доступна только после рабочего расчёта перевозчика и точного тарифа по РФ. Ориентир из Китая до Москвы — 10–18 дней, предельный срок — 60 дней с оплаты.</p>
            </div>
            <div className="trust-card" data-od-id="trust-returns">
              <strong>Возврат и размер</strong>
              <p>Стандартный товар — возврат до передачи и в течение 7 дней после получения независимо от места закупки. Отдельная услуга не уменьшает положенный по закону возврат стоимости товара.</p>
            </div>
          </div>
        </section>

        <section className="contacts container" id="contacts" data-od-id="contacts" aria-labelledby="contacts-title">
          <div className="contacts-copy">
            <p className="eyebrow">Связаться с KICKSBASE</p>
            <h2 id="contacts-title" data-od-id="contacts-title">Контакты</h2>
            <p>По заказам пишите на почту; Telegram-бот используйте для каталога и общих вопросов без номера оформленного заказа, адреса, паспорта, ИНН и платёжных реквизитов.</p>
          </div>
          <div className="contact-list" data-od-id="contact-list">
            <a className="contact-item" href="mailto:support@kicksbase.ru" data-od-id="contact-email"><span>Почта</span><strong>support@kicksbase.ru</strong></a>
            <a className="contact-item" href="https://t.me/kicksbase_officialbot" target="_blank" rel="noreferrer" data-od-id="contact-telegram-bot"><span>Telegram каталог-бот</span><strong>@kicksbase_officialbot</strong></a>
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
