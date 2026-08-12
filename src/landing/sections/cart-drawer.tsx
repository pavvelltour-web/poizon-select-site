import { AlertCircle, CreditCard, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react"
import { motion } from "motion/react"
import { useRef } from "react"

import { formatRub } from "../../catalog/catalog"
import { getEffectiveLinePrice } from "../cart"
import { resolveAssetUrl, setImageFallback } from "../landing-data"
import type { StorefrontState } from "../landing-types"
import { useModalDialog } from "../use-modal-dialog"

interface CartDrawerProps {
  storefront: StorefrontState
}

export function CartDrawer({ storefront }: CartDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useModalDialog({
    dialogRef: drawerRef,
    initialFocusRef: closeButtonRef,
    isOpen: storefront.isCartOpen,
    onClose: storefront.closeCart,
  })

  if (!storefront.isCartOpen) return null

  const email = storefront.checkoutCustomer.email.trim()
  const delivery = storefront.checkoutDelivery
  const destinationIsValid = delivery.method === "cdek_pvz"
    ? delivery.pvzCode.trim().length > 0
    : delivery.address.trim().length > 0
  const deliveryIsValid =
    delivery.city.trim().length >= 2 &&
    /^\d{6}$/.test(delivery.postalCode.trim()) &&
    destinationIsValid
  const catalogIsReady = storefront.catalogPriceState.status === "ready"
  const orderCreationEnabled = storefront.catalogPriceState.orderCreationEnabled
  const onlinePaymentEnabled = storefront.catalogPriceState.onlinePaymentEnabled
  const cartHasConfirmedPrices = storefront.cartLines.length > 0 && storefront.cartLines.every(
    (line) => getEffectiveLinePrice(
      line.product,
      storefront.catalogPriceState.lookup,
      storefront.catalogPriceState.items,
      line.size,
    ) !== null,
  )
  const hasInvalidLines = storefront.cartLines.some((line) => line.validation !== "valid")
  const canSubmit =
    catalogIsReady &&
    orderCreationEnabled &&
    cartHasConfirmedPrices &&
    !hasInvalidLines &&
    storefront.cartLines.length > 0 &&
    storefront.checkoutCustomer.fullName.trim().length >= 2 &&
    storefront.checkoutCustomer.phone.replace(/\D/g, "").length >= 10 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    deliveryIsValid &&
    storefront.checkoutConsents.offerAccepted &&
    storefront.checkoutConsents.personalDataAccepted &&
    storefront.checkoutResult.status !== "submitting"

  return (
    <>
      <motion.button
        className="cart-scrim"
        type="button"
        tabIndex={-1}
        onClick={storefront.closeCart}
        aria-label="Закрыть заказ"
      />
      <motion.aside
        ref={drawerRef}
        id="cart-dialog"
        className="modal cart-drawer"
        data-od-id="cart-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        tabIndex={-1}
      >
        <div className="modal-shell cart-drawer__shell">
        <div className="modal-head cart-drawer__head">
          <span>
            <ShoppingBag aria-hidden="true" size={22} />
            <strong id="cart-title">Корзина</strong>
          </span>
          <button ref={closeButtonRef} type="button" onClick={storefront.closeCart} aria-label="Закрыть заказ">
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        {storefront.cartLines.length === 0 ? (
          <div className="cart-empty">
            {storefront.checkoutResult.message ? (
              <p className="checkout-form__status" role="alert">
                {storefront.checkoutResult.message}
              </p>
            ) : null}
            <h3>В заказе пока нет товаров.</h3>
            <p>Выберите товар и размер.</p>
            <button type="button" className="button button--primary" onClick={storefront.closeCart}>
              Вернуться к товарам
            </button>
          </div>
        ) : (
          <>
            <div className="cart-list cart-lines" aria-label="Товары в заказе">
              <p
                className={`cart-catalog-status cart-catalog-status--${storefront.catalogPriceState.status}`}
                role={storefront.catalogPriceState.status === "failed" ? "alert" : "status"}
              >
                <AlertCircle aria-hidden="true" size={17} />
                {storefront.catalogPriceState.status === "ready" && !orderCreationEnabled
                  ? "Подтверждённая 12-часовая цена получена, но оформление заказа сейчас отключено."
                  : storefront.catalogPriceState.status === "ready" && !onlinePaymentEnabled
                    ? "Заказ можно оформить. Онлайн-оплата пока недоступна."
                    : storefront.catalogPriceState.status === "ready"
                      ? "Цена и размеры зафиксированы на 12 часов. Заказ будет передан в CRM."
                  : storefront.catalogPriceState.status === "loading"
                    ? "Проверяем цену и размеры на сервере. До проверки оформить заказ нельзя."
                    : "Серверный каталог недоступен. Оформление заказа временно заблокировано."}
              </p>

              {storefront.cartLines.map((line, index) => {
                const linePrice = getEffectiveLinePrice(
                  line.product,
                  storefront.catalogPriceState.lookup,
                  storefront.catalogPriceState.items,
                  line.size,
                )
                return (
                  <article
                    className={`cart-item cart-line cart-line--${line.validation}`}
                    key={line.id}
                    data-od-id={`cart-item-${index}`}
                  >
                    <div className="cart-item-media"><img
                      src={resolveAssetUrl(line.product.image)}
                      width="96"
                      height="72"
                      alt=""
                      loading="lazy"
                      onError={(event) => setImageFallback(event, line.product.fallbackImage)}
                    /></div>
                    <div className="cart-item-copy">
                      <strong>{line.product.brand} {line.product.name}</strong>
                      <span>EU {line.size}</span>
                      <em>
                        {linePrice === null ? "Уточняется" : formatRub(linePrice)}
                        {linePrice === null && !catalogIsReady ? " · цена не подтверждена" : ""}
                      </em>
                      {line.validation === "invalid" ? (
                        <small className="cart-line__error">
                          Товар или размер отсутствует в опубликованном каталоге. Удалите позицию.
                        </small>
                      ) : null}
                    </div>
                    <div className="cart-line__controls" aria-label="Количество">
                      <button
                        type="button"
                        onClick={() => storefront.setCartLineQuantity(line.id, line.quantity - 1)}
                        aria-label="Уменьшить количество"
                      >
                        <Minus aria-hidden="true" size={14} />
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => storefront.setCartLineQuantity(line.id, line.quantity + 1)}
                        aria-label="Увеличить количество"
                      >
                        <Plus aria-hidden="true" size={14} />
                      </button>
                    </div>
                    <button
                      className="cart-line__remove"
                      type="button"
                      data-od-id={`remove-cart-item-${index}`}
                      onClick={() => storefront.removeCartLine(line.id)}
                      aria-label="Удалить товар из заказа"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </article>
                )
              })}
            </div>

            <form
              className="checkout-form"
              onSubmit={(event) => {
                event.preventDefault()
                void storefront.submitCartCheckout()
              }}
            >
              <div className="cart-total checkout-form__total">
                <span>Товары сейчас</span>
                <strong>{cartHasConfirmedPrices ? formatRub(storefront.cartTotalRub) : "Уточняется"}</strong>
                <small>Цена и размеры подтверждены на 12 часов. Доставка не добавляется к этому итогу повторно.</small>
              </div>

              <section className="payment-methods" data-od-id="payment-methods" aria-labelledby="payment-methods-title">
                <p id="payment-methods-title">Оплата на следующем шаге</p>
                <div className="payment-method-list">
                  <span className="payment-method" aria-label="Система быстрых платежей">
                    <span className="payment-mark payment-mark--sbp" aria-hidden="true"><img src={resolveAssetUrl("storefront-media/approved/assets/brand/sbp-sign-official.png")} alt="" /></span>
                    <span>СБП</span>
                  </span>
                  <span className="payment-method" aria-label="Банковская карта">
                    <span className="payment-mark payment-mark--card" aria-hidden="true"><CreditCard size={18} /></span>
                    <span>Банковская карта</span>
                  </span>
                </div>
              </section>

              <label>
                <span>ФИО получателя</span>
                <input
                  value={storefront.checkoutCustomer.fullName}
                  onChange={(event) => storefront.updateCheckoutCustomer("fullName", event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                <span>Телефон для связи и СДЭК</span>
                <input
                  value={storefront.checkoutCustomer.phone}
                  onChange={(event) => storefront.updateCheckoutCustomer("phone", event.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
              </label>
              <label>
                <span>Email для чека</span>
                <input
                  aria-label="Email для чека"
                  aria-describedby="checkout-email-help"
                  value={storefront.checkoutCustomer.email}
                  onChange={(event) => storefront.updateCheckoutCustomer("email", event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  required
                />
                <small id="checkout-email-help">На этот адрес придёт электронный чек.</small>
              </label>

              <fieldset className="checkout-delivery">
                <legend>Доставка СДЭК</legend>
                <div className="checkout-delivery__methods">
                  <label>
                    <input
                      type="radio"
                      name="delivery-method"
                      value="cdek_pvz"
                      checked={delivery.method === "cdek_pvz"}
                      onChange={(event) => storefront.updateCheckoutDelivery("method", event.target.value)}
                    />
                    <span>В пункт выдачи</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="delivery-method"
                      value="cdek_courier"
                      checked={delivery.method === "cdek_courier"}
                      onChange={(event) => storefront.updateCheckoutDelivery("method", event.target.value)}
                    />
                    <span>Курьером</span>
                  </label>
                </div>
                <div className="checkout-delivery__grid">
                  <label>
                    <span>Город</span>
                    <input
                      value={delivery.city}
                      onChange={(event) => storefront.updateCheckoutDelivery("city", event.target.value)}
                      autoComplete="address-level2"
                      required
                    />
                  </label>
                  <label>
                    <span>Почтовый индекс</span>
                    <input
                      value={delivery.postalCode}
                      onChange={(event) => storefront.updateCheckoutDelivery("postalCode", event.target.value.replace(/\D/g, "").slice(0, 6))}
                      autoComplete="postal-code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                    />
                  </label>
                </div>
                {delivery.method === "cdek_pvz" ? (
                  <label>
                    <span>Код ПВЗ СДЭК из карточки пункта</span>
                    <input
                      value={delivery.pvzCode}
                      onChange={(event) => storefront.updateCheckoutDelivery("pvzCode", event.target.value)}
                      placeholder="Например, MSK123"
                      autoComplete="off"
                      required
                    />
                  </label>
                ) : (
                  <label>
                    <span>Адрес доставки</span>
                    <input
                      value={delivery.address}
                      onChange={(event) => storefront.updateCheckoutDelivery("address", event.target.value)}
                      autoComplete="street-address"
                      required
                    />
                  </label>
                )}
              </fieldset>

              <label className="checkout-form__check">
                <input
                  type="checkbox"
                  checked={storefront.checkoutConsents.offerAccepted}
                  onChange={(event) => storefront.updateCheckoutConsent("offerAccepted", event.target.checked)}
                />
                <span>Принимаю условия <a href="/offer">публичной оферты</a>.</span>
              </label>
              <label className="checkout-form__check">
                <input
                  type="checkbox"
                  checked={storefront.checkoutConsents.personalDataAccepted}
                  onChange={(event) => storefront.updateCheckoutConsent("personalDataAccepted", event.target.checked)}
                />
                <span>
                  Даю отдельное согласие на <a href="/personal-data-consent">обработку персональных данных</a>.
                </span>
              </label>

              <button className="dialog-primary button button--primary" type="submit" disabled={!canSubmit}>
                {storefront.checkoutResult.status === "submitting"
                  ? "Создаём заказ..."
                  : !catalogIsReady
                    ? "Проверяем каталог"
                    : !orderCreationEnabled
                      ? "Оформление временно недоступно"
                      : onlinePaymentEnabled
                        ? `Оплатить товары ${formatRub(storefront.cartTotalRub)}`
                        : `Оформить заказ ${formatRub(storefront.cartTotalRub)}`}
              </button>

              {storefront.checkoutResult.message ? (
                <div
                  className="checkout-form__status"
                  role={storefront.checkoutResult.status === "failed" ? "alert" : "status"}
                >
                  <p>{storefront.checkoutResult.message}</p>
                  {storefront.checkoutResult.orderNumber ? (
                    <strong>Заказ {storefront.checkoutResult.orderNumber}</strong>
                  ) : null}
                  {storefront.checkoutResult.amounts && storefront.checkoutResult.delivery ? (
                    <>
                      <dl className="checkout-result-amounts">
                        <div>
                          <dt>Товары сейчас</dt>
                          <dd>{formatRub(storefront.checkoutResult.amounts.payableNowRub)}</dd>
                        </div>
                        <div>
                          <dt>Доставка отдельно</dt>
                          <dd>{formatRub(storefront.checkoutResult.amounts.deliveryDueLaterRub)}</dd>
                        </div>
                        <div>
                          <dt>Расчёт доставки</dt>
                          <dd>
                            {storefront.checkoutResult.delivery.quoteStatus === "live"
                              ? "актуальный"
                              : "предварительный"}
                          </dd>
                        </div>
                      </dl>
                      {storefront.checkoutResult.paymentUrl ? (
                        <a
                          className="button button--primary checkout-result__pay"
                          href={storefront.checkoutResult.paymentUrl}
                          rel="noopener noreferrer"
                        >
                          Перейти к оплате
                        </a>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </form>
          </>
        )}
        </div>
      </motion.aside>
    </>
  )
}
