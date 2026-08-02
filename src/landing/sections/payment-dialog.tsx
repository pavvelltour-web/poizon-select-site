import { CreditCard, X } from "lucide-react"
import { useRef } from "react"

import { formatRub } from "../../catalog/catalog"
import type { StorefrontState } from "../landing-types"
import { useModalDialog } from "../use-modal-dialog"

interface PaymentDialogProps {
  storefront: StorefrontState
}

export function PaymentDialog({ storefront }: PaymentDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const result = storefront.checkoutResult

  useModalDialog({
    dialogRef,
    initialFocusRef: closeButtonRef,
    isOpen: result.status === "created",
    onClose: storefront.closePayment,
  })

  if (result.status !== "created") return null

  return (
    <>
      <button
        className="cart-scrim"
        type="button"
        tabIndex={-1}
        onClick={storefront.closePayment}
        aria-label="Закрыть оплату"
      />
      <aside
        ref={dialogRef}
        className="modal payment-dialog"
        id="payment-dialog"
        data-od-id="payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        tabIndex={-1}
      >
        <div className="modal-shell payment-shell">
          <div className="modal-head">
            <div>
              <p className="dialog-eyebrow">Номер заказа <span>{result.orderNumber ?? "—"}</span></p>
              <h2 id="payment-title">Оплата</h2>
            </div>
            <button
              ref={closeButtonRef}
              className="icon-button modal-close"
              type="button"
              onClick={storefront.closePayment}
              aria-label="Закрыть оплату"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <div className="payment-review" data-od-id="payment-review">
            <span>К оплате</span>
            <strong>{formatRub(result.amounts?.payableNowRub ?? storefront.cartTotalRub)}</strong>
          </div>
          <div className="payment-choice" data-od-id="payment-choice">
            <span className="payment-mark payment-mark--card" aria-hidden="true">
              <CreditCard size={18} />
            </span>
            <div>
              <strong>Защищённая оплата</strong>
              <p>Способ оплаты выбирается на защищённой странице банка.</p>
            </div>
          </div>
          {result.paymentUrl ? (
            <a className="dialog-primary" href={result.paymentUrl} rel="noopener noreferrer">
              Перейти к оплате
            </a>
          ) : (
            <button className="dialog-primary" type="button" disabled>
              Оплата пока недоступна
            </button>
          )}
          <p className="modal-help" aria-live="polite">{result.message}</p>
          {result.delivery ? (
            <p className="modal-help">
              Доставка {formatRub(result.amounts?.deliveryDueLaterRub ?? 0)} оплачивается отдельно после прибытия.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  )
}
