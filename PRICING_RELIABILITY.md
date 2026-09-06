# Current storefront price contract

Updated 2026-09-06. This describes the React storefront on the pricing branch;
the older static-catalog descriptions in README and historical delivery notes
are not a supplier-price contract.

The catalogue's SPU card displays the server-published minimum across eligible
SKU offers as **от**. Choosing a confirmed size displays that SKU's amount.
Price sorting uses those same published amounts. Static market estimates,
category defaults, and locally calculated CNY conversions are not customer prices.

`GET /api/checkout/orders?mode=catalog` keeps its strict priced `items` contract.
It may also return `catalog_statuses`, an object keyed by the existing product
slug. Each status contains `status`, `checked_at`, `expires_at`, and `source:
"poizon"`. Supported outcomes are `in_stock`, `out_of_stock`, `stock_unknown`,
`price_unavailable`, `not_matched`, `not_found`, `source_unavailable`, `stale`,
and `unverified`. Status metadata does not create an amount or checkout permission.

A current, confirmed `out_of_stock` outcome is shown as **Нет в наличии на
Poizon**, including when no price exists. A failed provider request, unmatched
identity, missing product, unknown stock, or stale observation has its own text.
Missing or expired evidence never establishes absence.

Catalogue reads have a 15-second browser deadline; live searches have 65 seconds.
Both retain the same-origin boundary and `credentials: "include"`. Catalogue
prices are invalidated at snapshot expiry. Live result prices and Telegram
handoff actions expire in an open tab, and handoff construction checks expiry
again at the moment of the action.

The baseline catalogue still contains 100 product references. This count is
independent of the number of fresh verified SPU/SKU offers returned by Poizon.
Release acceptance must record both counts from the actual provider-backed API.

The additive `catalog_products` array contains only additional canonical supplier
products: `slug`, `brand`, `name`, nullable `article`, `kind`, `category`, HTTPS
`images`, `source: "poizon"`, and a SHA-256 `product_ref`. The original 100
products and their media remain unchanged. Duplicate slugs or supplier references
are excluded; metadata cannot supply prices, invented size ranges, or checkout
authority. Supplier images must use one of the three existing CSP origins.
Additional products participate in catalogue filters, product links, favourites,
header search, and saved carts. Saved carts wait for canonical metadata before
restoration, preventing unknown supplier products from being silently deleted.

A current price requires explicit `price_status: "current"` on both the item
and SKU, with valid `source_updated_at` and `source_expires_at`. Source expiry
is the server-configured freshness boundary (at most 48 hours after the source
update), separate from the local 12-hour snapshot lifetime. The browser expires
the quote at the earlier boundary. Legacy, missing, or historical evidence is
labelled **Последняя цена**, excluded from current-price sorting, and cannot
confirm stock or checkout. Historical SKU rows display their source date when
available. A priced subset with no available SKU cannot prove the entire SPU is
absent; the full no-stock label requires explicit `catalog_statuses` evidence.
