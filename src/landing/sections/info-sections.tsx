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
              <span>1</span>
              <h3>Выберите товар</h3>
              <p>Откройте карточку, посмотрите ракурсы, назначение и цену от.</p>
            </li>
            <li>
              <span>2</span>
              <h3>Отправьте заявку</h3>
              <p>Сайт соберёт короткое сообщение с моделью и ценой для Telegram.</p>
            </li>
            <li>
              <span>3</span>
              <h3>Получите финальный расчёт</h3>
              <p>Размер, продавец, бирки, упаковка и итоговая сумма фиксируются до оплаты.</p>
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
              <p>Показываем размер, цвет, продавца, бирки и упаковку по конкретной позиции.</p>
            </article>
            <article>
              <h3>Честный итог</h3>
              <p>Считаем выкуп, комиссию, логистику и доставку до оплаты без внезапных доплат.</p>
            </article>
            <article>
              <h3>Подбор под игру</h3>
              <p>Собираем пару, защиту и инвентарь под зал, нагрузку и бюджет.</p>
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
          <span>BASE 01</span>
          <strong>Обувь под движение</strong>
          <p>Прыжок, боковая работа, мягкое приземление и пары, которые волейболисты часто берут из баскетбола.</p>
        </article>
        <article>
          <span>BASE 02</span>
          <strong>Комплект на тренировку</strong>
          <p>Защита, мячи, резина, бутылки, носки и сумки без лишнего шума, сразу вокруг реального зала.</p>
        </article>
        <article>
          <span>BASE 03</span>
          <strong>Расчет до оплаты</strong>
          <p>В карточке видно цену от, формулу заказа и что менеджер уточнит перед финальным подтверждением.</p>
        </article>
      </section>

      <section className="editorial-index" aria-labelledby="editorial-index-title">
        <div className="editorial-index__copy">
          <p className="eyebrow">Игровой индекс</p>
          <h2 id="editorial-index-title">Собирайте базу от задачи.</h2>
          <p>
            Пара для прыжка, защита, мяч для команды или восстановление после зала.
            Каталог работает как раздевалка перед тренировкой, а не как склад.
          </p>
        </div>
        <div className="editorial-index__grid" aria-label="Быстрые входы в каталог">
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
                  <small>{item.code}</small>
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
      {["Размер", "Продавец", "Бирки", "Упаковка"].map((item) => (
        <span key={item}>
          <BadgeCheck aria-hidden="true" size={15} />
          {item}
        </span>
      ))}
    </div>
  )
}
