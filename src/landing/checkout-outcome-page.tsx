import {
  ArrowLeft,
  CircleAlert,
  Clock3,
  LogIn,
  RefreshCcw,
  Send,
  ShieldCheck,
} from "lucide-react"

type CheckoutOutcome = "success" | "fail"

interface CheckoutOutcomePageProps {
  outcome: CheckoutOutcome
  botUrl: string | null
}

function readOrderReference(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const value =
    params.get("OrderId") ||
    params.get("orderId") ||
    params.get("checkout_id")
  if (!value) return null
  const normalized = value.trim()
  return /^[A-Za-z0-9_-]{1,80}$/.test(normalized) ? normalized : null
}

export function CheckoutOutcomePage({
  outcome,
  botUrl,
}: CheckoutOutcomePageProps) {
  const reference = readOrderReference()
  const returnedFromBank = outcome === "success"

  return (
    <article
      className={"checkout-outcome checkout-outcome--" + outcome}
      id="route-main"
      aria-labelledby="checkout-outcome-title"
    >
      <a className="checkout-outcome__back" href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        На главную
      </a>

      <div className="checkout-outcome__layout">
        <section className="checkout-outcome__main">
          <span className="checkout-outcome__icon" aria-hidden="true">
            {returnedFromBank ? <Clock3 size={28} /> : <CircleAlert size={28} />}
          </span>
          <p className="checkout-outcome__label">
            {returnedFromBank ? "Возврат из банка" : "Оплата не завершена"}
          </p>
          <h1 id="checkout-outcome-title">
            {returnedFromBank ? "Проверяем платёж" : "Платёж не подтверждён"}
          </h1>
          <p className="checkout-outcome__lead">
            {returnedFromBank
              ? "Возврат на сайт ещё не означает, что заказ оплачен. Подтверждение приходит отдельно от банка и может занять несколько минут."
              : "Мы не получили подтверждение оплаты. Сначала проверьте заказ: иногда банк обновляет статус с задержкой."}
          </p>

          {reference ? (
            <p className="checkout-outcome__reference">
              Номер операции <strong>{reference}</strong>
            </p>
          ) : null}

          <div className="checkout-outcome__actions">
            <a className="button button--primary" href="/?login=1">
              <LogIn aria-hidden="true" size={18} />
              Проверить заказ
            </a>
            {returnedFromBank ? (
              <a className="button button--quiet" href="/#catalog">
                Вернуться к товарам
              </a>
            ) : (
              <a className="button button--quiet" href="/?cart=1">
                <RefreshCcw aria-hidden="true" size={18} />
                Вернуться в корзину
              </a>
            )}
          </div>
        </section>

        <aside className="checkout-outcome__aside" aria-label="Что делать дальше">
          <div>
            <ShieldCheck aria-hidden="true" size={22} />
            <span>
              <strong>Ориентируйтесь на статус заказа</strong>
              <small>
                Только подтверждённый сервером платёж переводит заказ в работу.
              </small>
            </span>
          </div>
          <div>
            <RefreshCcw aria-hidden="true" size={22} />
            <span>
              <strong>Не оплачивайте повторно сразу</strong>
              <small>
                Сначала откройте заказ и убедитесь, что предыдущая попытка не прошла.
              </small>
            </span>
          </div>
          {botUrl ? (
            <a href={botUrl} target="_blank" rel="noopener noreferrer">
              <Send aria-hidden="true" size={18} />
              Задать вопрос в Telegram
            </a>
          ) : null}
        </aside>
      </div>
    </article>
  )
}
