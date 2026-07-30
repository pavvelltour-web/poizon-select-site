import { BadgeCheck } from "lucide-react"

import { editorialIndex } from "../landing-data"
import type { ActiveCategory } from "../landing-types"

interface InfoSectionsProps {
  category?: ActiveCategory
  mode?: "discovery" | "order"
  selectCategory?: (category: ActiveCategory) => void
}

export function InfoSections({
  category,
  mode = "discovery",
  selectCategory,
}: InfoSectionsProps) {
  if (mode === "order") {
    return (
      <>
        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">Как заказать</p>
            <h2 id="how-title">Заказ без лишней переписки.</h2>
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
              <p>Добавьте товар в корзину и укажите удобный способ связи.</p>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <h3>Подтвердите заказ</h3>
              <p>Менеджер проверит размер, цвет, наличие и срок до оплаты.</p>
            </li>
          </ol>
        </section>

        <section className="trust-section" id="trust" aria-labelledby="trust-title">
          <div className="section-heading">
            <p className="eyebrow">Перед оплатой</p>
            <h2 id="trust-title">Перед оплатой всё должно быть понятно.</h2>
          </div>
          <div className="trust-grid">
            <article>
              <h3>Карточка товара</h3>
              <p>Фото, размерная сетка и понятная цена — в одном месте.</p>
            </article>
            <article>
              <h3>Честный итог</h3>
              <p>Цена товара показана в карточке; доставку СДЭК сообщим отдельно.</p>
            </article>
            <article>
              <h3>Подбор</h3>
              <p>Подскажем пару для зала, матча, тренировки или восстановления.</p>
            </article>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <section className="brand-system" aria-label="Система подбора KICKSBASE">
        <article>
          <strong>Обувь для движения</strong>
          <p>Пары для зала, тренировок, матчей и восстановления.</p>
        </article>
        <article>
          <strong>Одежда для тренировок</strong>
          <p>Футболки, шорты, худи и верхний слой.</p>
        </article>
        <article>
          <strong>Прозрачная покупка</strong>
          <p>Размер, цвет, наличие и срок подтверждаются перед оплатой.</p>
        </article>
      </section>

      <section className="editorial-index" aria-labelledby="editorial-index-title">
        <div className="editorial-index__copy">
          <h2 id="editorial-index-title">Найдите свой вариант.</h2>
          <p>
            Для зала, матча, тренировки, восстановления или на каждый день.
            Если товара нет, подберём альтернативу.
          </p>
        </div>
        <div className="editorial-index__grid" aria-label="Быстрые входы в товары">
          {editorialIndex.map((item) => {
            const EditorialIcon = item.icon

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCategory?.(item.id)}
                aria-pressed={category === item.id}
              >
                <span>
                  <strong>{item.title}</strong>
                </span>
                <em>{item.text}</em>
                <EditorialIcon aria-hidden="true" size={22} />
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

export function ProductTrustMarks() {
  return (
    <div className="product-trust-marks" aria-label="Что проверяет менеджер">
      {["Размер", "Цвет", "Наличие", "Срок"].map((item) => (
        <span key={item}>
          <BadgeCheck aria-hidden="true" size={15} />
          {item}
        </span>
      ))}
    </div>
  )
}
