import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react"
import { motion } from "motion/react"

import { formatRub } from "../../catalog/catalog"
import { resolveAssetUrl } from "../landing-data"
import type { StorefrontState } from "../landing-types"

interface CartDrawerProps {
  storefront: StorefrontState
}

export function CartDrawer({ storefront }: CartDrawerProps) {
  if (!storefront.isCartOpen) return null

  const canSubmit =
    storefront.cartLines.length > 0 &&
    storefront.checkoutCustomer.fullName.trim().length >= 2 &&
    storefront.checkoutCustomer.phone.trim().length >= 10 &&
    storefront.checkoutResult.status !== "submitting"

  return (
    <>
      <motion.button
        className="cart-scrim"
        type="button"
        onClick={storefront.closeCart}
        aria-label="Закрыть корзину"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 32 }}
        transition={{ duration: 0.2 }}
      >
        <div className="cart-drawer__head">
          <span>
            <ShoppingBag aria-hidden="true" size={22} />
            <strong id="cart-title">Корзина</strong>
          </span>
          <button type="button" onClick={storefront.closeCart} aria-label="Закрыть корзину">
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        {storefront.cartLines.length === 0 ? (
          <div className="cart-empty">
            <h3>Корзина пустая.</h3>
            <p>Выберите товар, размер и добавьте его в корзину.</p>
            <button type="button" className="button button--primary" onClick={storefront.closeCart}>
              Вернуться к товарам
            </button>
          </div>
        ) : (
          <>
            <div className="cart-lines" aria-label="Товары в корзине">
              {storefront.cartLines.map((line) => (
                <article className="cart-line" key={line.id}>
                  <img src={resolveAssetUrl(line.product.image)} width="96" height="72" alt="" />
                  <div>
                    <strong>
                      {line.product.brand} {line.product.name}
                    </strong>
                    <span>EU {line.size}</span>
                    <em>{formatRub(line.product.orderQuote?.totalRub ?? 0)}</em>
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
                    onClick={() => storefront.removeCartLine(line.id)}
                    aria-label="Удалить товар из корзины"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </article>
              ))}
            </div>

            <form
              className="checkout-form"
              onSubmit={(event) => {
                event.preventDefault()
                void storefront.submitCartCheckout()
              }}
            >
              <div className="checkout-form__total">
                <span>Итого</span>
                <strong>{formatRub(storefront.cartTotalRub)}</strong>
              </div>

              <label>
                <span>ФИО получателя</span>
                <input
                  value={storefront.checkoutCustomer.fullName}
                  onChange={(event) =>
                    storefront.updateCheckoutCustomer("fullName", event.target.value)
                  }
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                <span>Телефон для связи и СДЭК</span>
                <input
                  value={storefront.checkoutCustomer.phone}
                  onChange={(event) =>
                    storefront.updateCheckoutCustomer("phone", event.target.value)
                  }
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
              </label>
              <label>
                <span>Email для чека</span>
                <input
                  value={storefront.checkoutCustomer.email}
                  onChange={(event) =>
                    storefront.updateCheckoutCustomer("email", event.target.value)
                  }
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                />
              </label>

              <p className="checkout-form__consent">
                Нажимая кнопку, вы соглашаетесь с публичной офертой и обработкой
                персональных данных. Чек отправим на email или телефон после оплаты.
              </p>

              <button className="button button--primary" type="submit" disabled={!canSubmit}>
                {storefront.checkoutResult.status === "submitting"
                  ? "Создаём заказ..."
                  : "Оформить и перейти к оплате"}
              </button>

              {storefront.checkoutResult.message ? (
                <p
                  className="checkout-form__status"
                  role={storefront.checkoutResult.status === "failed" ? "alert" : "status"}
                >
                  {storefront.checkoutResult.message}
                </p>
              ) : null}
            </form>
          </>
        )}
      </motion.aside>
    </>
  )
}
