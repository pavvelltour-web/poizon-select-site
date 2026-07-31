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
        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">Как заказать</p>
            <h2 id="how-title">Три шага до заказа.</h2>
          </div>
          <ol className="steps">
            <li>
              <span aria-hidden="true">1</span>
              <h3>Выберите товар</h3>
              <p>Откройте карточку, посмотрите фото, назначение и цену.</p>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <h3>Выберите размер</h3>
              <p>Добавьте товар в заказ и укажите удобный способ связи.</p>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <h3>Оплатите заказ</h3>
              <p>Перейдите к оплате на защищённой странице банка.</p>
            </li>
          </ol>
        </section>

        <section className="trust-section" id="trust" aria-labelledby="trust-title">
          <div className="section-heading">
            <p className="eyebrow">Перед оплатой</p>
            <h2 id="trust-title">Всё важное видно до оплаты.</h2>
          </div>
          <div className="trust-grid">
            <article>
              <h3>Карточка товара</h3>
              <p>Фото, размерная сетка и понятная цена находятся в одном месте.</p>
            </article>
            <article>
              <h3>Цена и доставка</h3>
              <p>Цена товара указана в карточке. Доставка рассчитывается отдельно.</p>
            </article>
            <article>
              <h3>Подбор</h3>
              <p>Опишите задачу: поиск покажет подходящие модели.</p>
            </article>
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
