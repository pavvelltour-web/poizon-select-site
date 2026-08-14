/*
 * Public, fail-closed price reader for the static production release.
 *
 * Editorial catalogue copy and media live in this release. RUB prices do not:
 * they are rendered only from a current, checkout-confirmed 12-hour CRM
 * snapshot. The browser never receives or calls a supplier endpoint.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/checkout/orders?mode=catalog";
  var REQUEST_TIMEOUT_MS = 8000;
  var MAX_PRICE_RUB = 10000000;
  var SNAPSHOT_WINDOW_MS = 12 * 60 * 60 * 1000;
  var MAX_FUTURE_OBSERVED_SKEW_MS = 5 * 60 * 1000;
  var SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var SKU_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,160}$/;
  var prices = {};
  var subscribers = [];
  var refreshTimer = null;
  var activeController = null;

  function finitePositivePrice(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 && value < MAX_PRICE_RUB;
  }

  function exactRub(value) {
    return Math.round(value * 100) / 100;
  }

  function validTimestamp(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function parseOffer(value, observedAt, expiresAt) {
    if (!value || typeof value !== "object") return null;
    var offer = value;
    var skuId = typeof offer.sku_id === "string" ? offer.sku_id.trim() : "";
    var size = typeof offer.size_eu === "string" ? offer.size_eu.trim() : "";
    if (
      !skuId ||
      !SKU_ID_PATTERN.test(skuId) ||
      !size ||
      size.length > 32 ||
      offer.available !== true ||
      offer.checkout_confirmed !== true ||
      offer.live_provider_verified !== true ||
      !finitePositivePrice(offer.price_rub)
    ) return null;
    return {
      skuId: skuId,
      size: size,
      totalRub: exactRub(offer.price_rub),
      observedAt: observedAt,
      expiresAt: expiresAt
    };
  }

  function parseItem(value, nowMs) {
    if (!value || typeof value !== "object") return null;
    var item = value;
    var slug = typeof item.slug === "string" ? item.slug.trim() : "";
    if (
      !slug ||
      !SLUG_PATTERN.test(slug) ||
      item.live_provider_verified !== true ||
      !finitePositivePrice(item.price_rub) ||
      !validTimestamp(item.observed_at) ||
      !validTimestamp(item.expires_at) ||
      !Array.isArray(item.size_offers)
    ) return null;

    var observedMs = Date.parse(item.observed_at);
    var expiresMs = Date.parse(item.expires_at);
    if (
      observedMs > expiresMs ||
      observedMs > nowMs + MAX_FUTURE_OBSERVED_SKEW_MS ||
      expiresMs <= nowMs ||
      expiresMs - observedMs > SNAPSHOT_WINDOW_MS
    ) return null;

    // Count the entire eligible response before publishing any offer. This is
    // deliberately order-independent: duplicate SKU/size rows are unsafe.
    var parsedOffers = item.size_offers.map(function (offer) {
      return parseOffer(offer, item.observed_at, item.expires_at);
    }).filter(function (offer) { return offer !== null; });
    var skuCounts = new Map();
    var sizeCounts = new Map();
    parsedOffers.forEach(function (offer) {
      skuCounts.set(offer.skuId, (skuCounts.get(offer.skuId) || 0) + 1);
      sizeCounts.set(offer.size, (sizeCounts.get(offer.size) || 0) + 1);
    });
    var sizeOffers = {};
    parsedOffers.forEach(function (offer) {
      if (skuCounts.get(offer.skuId) !== 1 || sizeCounts.get(offer.size) !== 1) return;
      sizeOffers[offer.size] = offer;
    });
    var sizes = Object.keys(sizeOffers);
    if (!sizes.length) return null;
    var minimumOfferRub = Math.min.apply(null, sizes.map(function (size) { return sizeOffers[size].totalRub; }));
    if (exactRub(item.price_rub) !== minimumOfferRub) return null;

    return {
      slug: slug,
      totalRub: exactRub(item.price_rub),
      observedAt: item.observed_at,
      expiresAt: item.expires_at,
      sizeOffers: sizeOffers
    };
  }

  function parse(payload, nowMs) {
    if (!payload || typeof payload !== "object") return {};
    if (payload.catalog_mode !== "curated_live_poizon" || payload.snapshot_hours !== 12 || !Array.isArray(payload.items)) return {};
    var parsed = {};
    var ambiguousSlugs = new Set();
    payload.items.forEach(function (item) {
      var price = parseItem(item, nowMs == null ? Date.now() : nowMs);
      if (!price || ambiguousSlugs.has(price.slug)) return;
      if (parsed[price.slug]) {
        delete parsed[price.slug];
        ambiguousSlugs.add(price.slug);
        return;
      }
      parsed[price.slug] = price;
    });
    return parsed;
  }

  function formatRub(value) {
    return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
  }

  function slugFromCatalogCard(card) {
    var id = card.dataset.odId || "";
    return id.indexOf("catalog-product-") === 0 ? id.slice("catalog-product-".length) : "";
  }

  function makeCatalogSizeButton(slug, size, label, all) {
    var button = document.createElement("button");
    button.className = all ? "card-size-button card-size-button--all" : "card-size-button";
    button.type = "button";
    button.textContent = label;
    button.dataset.odId = "catalog-size-" + slug + "-" + (all ? "all" : size.replace(/\./g, "-"));
    button.setAttribute("aria-label", all ? "Открыть все подтверждённые размеры" : "Открыть подтверждённый размер " + size);
    button.addEventListener("click", function () {
      var target = "kicksbase-direction-03-blue-field-v2.html?product=" + encodeURIComponent(slug);
      if (!all) target += "&size=" + encodeURIComponent(size);
      window.location.href = target;
    });
    return button;
  }

  function renderCatalogCardSizes(card, record) {
    var sizeOptions = card.querySelector(".card-sizes .card-size-options");
    if (!sizeOptions) return;
    sizeOptions.style.position = "relative";
    sizeOptions.style.zIndex = "1";
    sizeOptions.textContent = "";
    if (!record) return;
    var slug = slugFromCatalogCard(card);
    if (!slug) return;
    var sizes = Object.keys(record.sizeOffers);
    sizes.slice(0, 3).forEach(function (size) {
      sizeOptions.appendChild(makeCatalogSizeButton(slug, size, size, false));
    });
    if (sizes.length > 3) sizeOptions.appendChild(makeCatalogSizeButton(slug, "", "Все", true));
  }

  function renderStaticCatalog(currentPrices) {
    Array.prototype.slice.call(document.querySelectorAll("[data-catalog-card]")).forEach(function (card) {
      var record = currentPrices[slugFromCatalogCard(card)];
      var price = card.querySelector(".product-price");
      if (price) price.textContent = record ? "от " + formatRub(record.totalRub) : "По запросу";
      if (record) card.dataset.livePrice = String(record.totalRub);
      else delete card.dataset.livePrice;
      renderCatalogCardSizes(card, record);
    });
    var sort = document.getElementById("catalog-sort-select");
    if (sort && typeof window.Event === "function") sort.dispatchEvent(new Event("change"));
  }

  function scheduleRefresh(currentPrices) {
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    refreshTimer = null;
    var expirations = Object.keys(currentPrices).map(function (slug) {
      return Date.parse(currentPrices[slug].expiresAt);
    }).filter(Number.isFinite);
    if (!expirations.length) return;
    var delay = Math.max(0, Math.min.apply(null, expirations) - Date.now()) + 10;
    refreshTimer = window.setTimeout(function () {
      setPrices({});
      refresh();
    }, delay);
  }

  function notify() {
    renderStaticCatalog(prices);
    subscribers.slice().forEach(function (listener) { listener(prices); });
  }

  function setPrices(nextPrices) {
    prices = nextPrices;
    scheduleRefresh(prices);
    notify();
  }

  function refresh() {
    if (activeController) activeController.abort();
    activeController = typeof AbortController === "function" ? new AbortController() : null;
    var controller = activeController;
    var timeout = window.setTimeout(function () {
      if (controller) controller.abort();
    }, REQUEST_TIMEOUT_MS);
    return fetch(ENDPOINT, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).then(function (payload) {
      if (controller !== activeController) return prices;
      setPrices(payload ? parse(payload) : {});
      return prices;
    }).catch(function () {
      if (controller === activeController) setPrices({});
      return prices;
    }).finally(function () {
      window.clearTimeout(timeout);
      if (controller === activeController) activeController = null;
    });
  }

  window.KicksbaseVerifiedCatalogPrices = {
    endpoint: ENDPOINT,
    getPrices: function () { return prices; },
    parse: parse,
    refresh: refresh,
    subscribe: function (listener) {
      if (typeof listener !== "function") return function () {};
      subscribers.push(listener);
      listener(prices);
      return function () {
        subscribers = subscribers.filter(function (candidate) { return candidate !== listener; });
      };
    }
  };

  // Static catalogue cards must start as an explicit request before networking.
  notify();
  refresh();
})();
