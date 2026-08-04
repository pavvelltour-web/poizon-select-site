    (function () {
      var formatPrice = new Intl.NumberFormat("ru-RU");
      var galleryAngles = ["Боковой профиль", "Вид спереди", "Ракурс 3/4", "Вид сзади", "Подошва"];

      function hoverFrameSource(slug) {
        var file = slug === "nike-aone"
          ? "nike-aone-front-pair-bg-v2.png"
          : slug + "-front-pair-bg.png";
        return "assets/blue-field-v2/hover/" + file;
      }

      function gallerySources(slug) {
        var resolvedLabels = galleryAngles;
        return [
          { label: resolvedLabels[0], src: "assets/blue-field-v2/" + slug + "-stage.png" },
          { label: resolvedLabels[1], src: hoverFrameSource(slug) },
          { label: resolvedLabels[2], src: "assets/blue-field-v2/gallery/normalized/" + slug + "-3.png" },
          { label: resolvedLabels[3], src: "assets/blue-field-v2/gallery/normalized/" + slug + "-4.png" },
          { label: resolvedLabels[4], src: "assets/blue-field-v2/gallery/normalized/" + slug + "-5.png" }
        ];
      }

      var cards = Array.prototype.slice.call(document.querySelectorAll("[data-product]"));
      var products = cards.map(function (card) {
        return {
          element: card,
          id: card.dataset.odId.replace(/^product-card-/, ""),
          kind: card.dataset.productKind || "footwear",
          type: card.dataset.type,
          brand: card.dataset.brand,
          name: card.dataset.name,
          price: Number(card.dataset.price),
          category: card.dataset.category,
          categoryLabel: card.dataset.categoryLabel,
          description: card.dataset.description,
          use: card.dataset.use,
          supply: card.dataset.supply,
          image: card.dataset.image,
          gallery: gallerySources(card.dataset.gallerySlug),
          sizes: card.dataset.sizes.split(",")
        };
      });

      function productLabel(product) {
        return product.type + " " + product.brand + " " + product.name;
      }

      document.addEventListener("pointerdown", function () {
        document.body.classList.remove("is-keyboard-nav");
      }, true);
      document.addEventListener("keydown", function (event) {
        if (event.key === "Tab") document.body.classList.add("is-keyboard-nav");
      }, true);

      function openDialog(dialog) {
        if (!dialog || dialog.open) return;
        dialog.showModal();
        document.body.classList.add("is-locked");
      }

      function closeDialog(dialog) {
        if (!dialog || !dialog.open) return;
        dialog.close();
      }

      document.querySelectorAll("[data-dialog-open]").forEach(function (button) {
        button.addEventListener("click", function () {
          openDialog(document.getElementById(button.dataset.dialogOpen));
        });
      });

      document.querySelectorAll("[data-dialog-close]").forEach(function (button) {
        button.addEventListener("click", function () {
          closeDialog(button.closest("dialog"));
        });
      });

      document.querySelectorAll("dialog").forEach(function (dialog) {
        dialog.addEventListener("close", function () {
          if (!document.querySelector("dialog[open]")) document.body.classList.remove("is-locked");
        });
        dialog.addEventListener("click", function (event) {
          if (event.target === dialog) closeDialog(dialog);
        });
      });

      var menuToggle = document.querySelector("[data-menu-toggle]");
      var mobileMenu = document.querySelector("[data-mobile-menu]");
      menuToggle.addEventListener("click", function () {
        var open = mobileMenu.classList.toggle("is-open");
        menuToggle.setAttribute("aria-expanded", String(open));
        menuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      });
      mobileMenu.querySelectorAll("a, button").forEach(function (item) {
        item.addEventListener("click", function () {
          mobileMenu.classList.remove("is-open");
          menuToggle.setAttribute("aria-expanded", "false");
        });
      });
      document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape" || !mobileMenu.classList.contains("is-open")) return;
        mobileMenu.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.focus();
      });

      var desktopNav = document.querySelector(".desktop-nav");
      var highlight = desktopNav.querySelector(".nav-highlight");
      var navLinks = Array.prototype.slice.call(desktopNav.querySelectorAll("a"));
      var activeLink = desktopNav.querySelector('[aria-current="page"]') || navLinks[0];
      var motionToken = 0;
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

      function placeHighlight(target, immediate) {
        if (!target) return;
        var navRect = desktopNav.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        var toLeft = targetRect.left - navRect.left;
        var toWidth = targetRect.width;
        var fromLeft = Number(highlight.dataset.left || toLeft);
        var fromWidth = Number(highlight.dataset.width || toWidth);
        motionToken += 1;
        var token = motionToken;

        if (immediate || reduceMotion.matches || !highlight.dataset.ready) {
          highlight.style.transition = "none";
          highlight.style.left = toLeft + "px";
          highlight.style.width = toWidth + "px";
          highlight.dataset.left = String(toLeft);
          highlight.dataset.width = String(toWidth);
          highlight.dataset.ready = "true";
          return;
        }

        var bridgeLeft = Math.min(fromLeft, toLeft);
        var bridgeRight = Math.max(fromLeft + fromWidth, toLeft + toWidth);
        highlight.style.transition = "left 90ms cubic-bezier(0.23,1,0.32,1), width 90ms cubic-bezier(0.23,1,0.32,1)";
        highlight.style.left = bridgeLeft + "px";
        highlight.style.width = bridgeRight - bridgeLeft + "px";

        window.setTimeout(function () {
          if (token !== motionToken) return;
          highlight.style.transition = "left 210ms cubic-bezier(0.23,1,0.32,1), width 210ms cubic-bezier(0.23,1,0.32,1)";
          highlight.style.left = toLeft + "px";
          highlight.style.width = toWidth + "px";
          highlight.dataset.left = String(toLeft);
          highlight.dataset.width = String(toWidth);
        }, 72);
      }

      navLinks.forEach(function (link) {
        link.addEventListener("pointerenter", function () { placeHighlight(link, false); });
        link.addEventListener("focus", function () { placeHighlight(link, false); });
        link.addEventListener("click", function () {
          activeLink.removeAttribute("aria-current");
          activeLink = link;
          activeLink.setAttribute("aria-current", "page");
          placeHighlight(activeLink, false);
        });
      });
      desktopNav.addEventListener("pointerleave", function () { placeHighlight(activeLink, false); });
      desktopNav.addEventListener("focusout", function (event) {
        if (!desktopNav.contains(event.relatedTarget)) placeHighlight(activeLink, false);
      });
      window.addEventListener("resize", function () { placeHighlight(activeLink, true); });
      window.addEventListener("load", function () { placeHighlight(activeLink, true); });
      placeHighlight(activeLink, true);

      var productDialog = document.getElementById("product-dialog");
      var sheetImage = productDialog.querySelector("[data-sheet-image]");
      var sheetName = productDialog.querySelector("[data-sheet-name]");
      var sheetCategory = productDialog.querySelector("[data-sheet-category]");
      var sheetDescription = productDialog.querySelector("[data-sheet-description]");
      var sheetSpecs = productDialog.querySelector("[data-sheet-specs]");
      var sheetPrice = productDialog.querySelector("[data-sheet-price]");
      var sheetSupply = productDialog.querySelector("[data-sheet-supply]");
      var sheetGalleryThumbs = productDialog.querySelector("[data-sheet-gallery-thumbs]");
      var sheetPhotoCaption = productDialog.querySelector("[data-sheet-photo-caption]");
      var addButton = productDialog.querySelector("[data-add-to-cart]");
      var sizeGrid = productDialog.querySelector("[data-size-grid]");
      var sizeButtons = [];
      var selectedProduct = null;
      var selectedSize = null;

      function selectSheetSize(button) {
        selectedSize = button.textContent;
        sizeButtons.forEach(function (item) {
          item.setAttribute("aria-pressed", String(item === button));
        });
        addButton.disabled = false;
        addButton.textContent = "Добавить в корзину";
      }

      function renderSheetSizes(product, preferredSize) {
        sizeGrid.innerHTML = "";
        sizeButtons = product.sizes.map(function (size) {
          var button = document.createElement("button");
          button.className = "size-button";
          button.type = "button";
          button.textContent = size;
          button.dataset.odId = "sheet-size-" + product.id + "-" + size.replace(".", "-");
          button.setAttribute("aria-pressed", "false");
          button.setAttribute("aria-label", "Выбрать размер EU " + size);
          button.addEventListener("click", function () { selectSheetSize(button); });
          sizeGrid.appendChild(button);
          return button;
        });
        if (preferredSize) {
          var preferredButton = sizeButtons.find(function (button) { return button.textContent === preferredSize; });
          if (preferredButton) selectSheetSize(preferredButton);
        }
      }

      function renderSheetSpecs(product) {
        var specs = [
          ["Тип", product.type],
          ["Назначение", product.categoryLabel]
        ].filter(function (item) { return Boolean(item[1]); });
        sheetSpecs.innerHTML = "";
        specs.forEach(function (item) {
          var row = document.createElement("div");
          var term = document.createElement("dt");
          var value = document.createElement("dd");
          term.textContent = item[0];
          value.textContent = item[1];
          row.appendChild(term);
          row.appendChild(value);
          sheetSpecs.appendChild(row);
        });
      }

      function showSheetGalleryImage(product, index, button) {
        var image = product.gallery[index];
        sheetImage.src = image.src;
        sheetImage.alt = productLabel(product) + " — " + image.label;
        sheetPhotoCaption.textContent = image.label;
        Array.prototype.slice.call(sheetGalleryThumbs.children).forEach(function (item) {
          item.setAttribute("aria-current", String(item === button));
        });
      }

      function renderSheetGallery(product) {
        sheetGalleryThumbs.innerHTML = "";
        product.gallery.forEach(function (image, index) {
          var button = document.createElement("button");
          button.className = "sheet-gallery-thumb";
          button.type = "button";
          button.dataset.odId = "gallery-" + product.id + "-" + (index + 1);
          button.setAttribute("aria-label", image.label + ", ракурс " + (index + 1) + " из " + product.gallery.length);
          button.setAttribute("aria-current", String(index === 0));
          var thumbnail = document.createElement("img");
          thumbnail.src = image.src;
          thumbnail.alt = "";
          thumbnail.loading = "lazy";
          button.appendChild(thumbnail);
          button.addEventListener("click", function () { showSheetGalleryImage(product, index, button); });
          sheetGalleryThumbs.appendChild(button);
        });
        showSheetGalleryImage(product, 0, sheetGalleryThumbs.firstElementChild);
      }

      function openProduct(product, preferredSize) {
        selectedProduct = product;
        selectedSize = null;
        sheetName.textContent = productLabel(product);
        sheetCategory.textContent = product.categoryLabel;
        sheetDescription.textContent = product.description;
        sheetPrice.textContent = formatPrice.format(product.price) + " ₽";
        sheetSupply.textContent = product.supply;
        renderSheetGallery(product);
        renderSheetSpecs(product);
        addButton.disabled = true;
        addButton.textContent = "Выберите размер";
        renderSheetSizes(product, preferredSize);
        openDialog(productDialog);
      }

      function addCardPairPreview(card, hoverImage) {
        var media = card.querySelector(".product-media");
        var source = media && media.querySelector(":scope > img");
        if (!source || media.querySelector(".product-pair")) return;
        var pair = document.createElement("span");
        pair.className = "product-pair";
        pair.setAttribute("aria-hidden", "true");
        var image = source.cloneNode(false);
        image.className = "product-pair-view";
        image.src = hoverImage || source.src;
        image.alt = "";
        image.loading = "lazy";
        pair.appendChild(image);
        media.appendChild(pair);
      }

      function cardHoverImage(product) {
        var kind = (product.kind || "").toLocaleLowerCase("ru");
        var type = (product.type || "").toLocaleLowerCase("ru");
        if (kind.includes("footwear") || kind.includes("кроссов")) return product.gallery[1] && product.gallery[1].src;
        if (type.includes("одеж") || type.includes("майк") || type.includes("шорт")) return product.gallery[0] && product.gallery[0].src;
        return product.gallery[0] && product.gallery[0].src;
      }

      function compactPurchaseMeta(card) {
        var info = card.querySelector(".product-info");
        var price = info && info.querySelector(".product-price");
        var supply = info && info.querySelector(".product-supply");
        if (!info || !price || !supply || price.parentElement.classList.contains("product-price-row")) return;
        var row = document.createElement("span");
        row.className = "product-price-row";
        info.insertBefore(row, price);
        row.appendChild(price);
        row.appendChild(supply);
      }

      products.forEach(function (product) {
        addCardPairPreview(product.element, cardHoverImage(product));
        compactPurchaseMeta(product.element);
        var openCardButton = product.element.querySelector("[data-product-open]");
        openCardButton.dataset.odId = "open-product-" + product.id;
        openCardButton.addEventListener("click", function () {
          openProduct(product);
        });
        product.element.querySelector("[data-favorite]").dataset.odId = "favorite-product-" + product.id;
        var cardSizes = product.element.querySelector("[data-card-sizes]");
        [product.sizes[2], product.sizes[4], product.sizes[6]].filter(Boolean).forEach(function (size) {
          var button = document.createElement("button");
          button.className = "card-size-button";
          button.type = "button";
          button.textContent = size;
          button.dataset.odId = "size-" + product.id + "-" + size.replace(".", "-");
          button.setAttribute("aria-label", "Открыть " + productLabel(product) + ", размер EU " + size);
          button.addEventListener("click", function () {
            openProduct(product, size);
          });
          cardSizes.appendChild(button);
        });
        var allSizes = document.createElement("button");
        allSizes.className = "card-size-button card-size-button--all";
        allSizes.type = "button";
        allSizes.textContent = "Все";
        allSizes.dataset.odId = "size-" + product.id + "-all";
        allSizes.setAttribute("aria-label", "Открыть все размеры: " + productLabel(product));
        allSizes.addEventListener("click", function () { openProduct(product); });
        cardSizes.appendChild(allSizes);
      });

      var favoritesDialog = document.getElementById("favorites-dialog");
      var favoritesList = document.querySelector("[data-favorites-list]");
      var favoritesEmpty = document.querySelector("[data-favorites-empty]");
      var favoritesCount = document.querySelector("[data-favorites-count]");
      var favoritesStoreKey = "kicksbase:blue-field:favorites";
      var favoriteKeys = new Set();

      function productKey(product) {
        return product.brand + "::" + product.name;
      }

      try {
        var savedFavorites = JSON.parse(localStorage.getItem(favoritesStoreKey) || "[]");
        if (Array.isArray(savedFavorites)) favoriteKeys = new Set(savedFavorites);
      } catch (_) {}

      function saveFavorites() {
        try { localStorage.setItem(favoritesStoreKey, JSON.stringify(Array.from(favoriteKeys))); } catch (_) {}
      }

      function renderFavorites() {
        var savedProducts = products.filter(function (product) { return favoriteKeys.has(productKey(product)); });
        favoritesCount.textContent = String(savedProducts.length);
        favoritesCount.classList.toggle("is-visible", savedProducts.length > 0);
        favoritesEmpty.hidden = savedProducts.length > 0;
        favoritesList.innerHTML = "";

        products.forEach(function (product) {
          var active = favoriteKeys.has(productKey(product));
          var button = product.element.querySelector("[data-favorite]");
          button.setAttribute("aria-pressed", String(active));
          button.setAttribute("aria-label", (active ? "Убрать " : "Добавить ") + productLabel(product) + (active ? " из избранного" : " в избранное"));
        });

        savedProducts.forEach(function (product) {
          var row = document.createElement("article");
          row.className = "favorite-row";
          row.dataset.odId = "favorite-row-" + product.id;
          var image = document.createElement("img");
          image.src = product.image;
          image.alt = productLabel(product) + ", боковой профиль";
          var copy = document.createElement("div");
          copy.className = "favorite-row-copy";
          var name = document.createElement("strong");
          name.textContent = productLabel(product);
          var meta = document.createElement("span");
          meta.textContent = formatPrice.format(product.price) + " ₽ · " + product.supply;
          copy.appendChild(name);
          copy.appendChild(meta);
          var actions = document.createElement("div");
          actions.className = "favorite-row-actions";
          var openButton = document.createElement("button");
          openButton.type = "button";
          openButton.textContent = "Открыть";
          openButton.dataset.odId = "open-favorite-" + product.id;
          openButton.addEventListener("click", function () {
            closeDialog(favoritesDialog);
            openProduct(product);
          });
          var removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.textContent = "Убрать";
          removeButton.dataset.odId = "remove-favorite-" + product.id;
          removeButton.setAttribute("aria-label", "Убрать " + productLabel(product) + " из избранного");
          removeButton.addEventListener("click", function () {
            favoriteKeys.delete(productKey(product));
            saveFavorites();
            renderFavorites();
          });
          actions.appendChild(openButton);
          actions.appendChild(removeButton);
          row.appendChild(image);
          row.appendChild(copy);
          row.appendChild(actions);
          favoritesList.appendChild(row);
        });
      }

      products.forEach(function (product) {
        product.element.querySelector("[data-favorite]").addEventListener("click", function () {
          var key = productKey(product);
          if (favoriteKeys.has(key)) favoriteKeys.delete(key);
          else favoriteKeys.add(key);
          saveFavorites();
          renderFavorites();
        });
      });
      renderFavorites();

      var cart = [];
      var cartCount = document.querySelector("[data-cart-count]");
      var cartList = document.querySelector("[data-cart-list]");
      var cartEmpty = document.querySelector("[data-cart-empty]");
      var cartTotal = document.querySelector("[data-cart-total]");
      var cartTotalValue = document.querySelector("[data-cart-total-value]");
      var checkoutButton = document.querySelector("[data-checkout]");
      var paymentMethods = document.querySelector("[data-payment-methods]");
      var paymentMethodButtons = Array.prototype.slice.call(document.querySelectorAll("[data-payment-method]"));
      var paymentDialog = document.getElementById("payment-dialog");
      var paymentOrder = paymentDialog.querySelector("[data-payment-order]");
      var paymentTotal = paymentDialog.querySelector("[data-payment-total]");
      var paymentMethodName = paymentDialog.querySelector("[data-payment-method-name]");
      var paymentMark = paymentDialog.querySelector("[data-payment-mark]");
      var paymentStatus = paymentDialog.querySelector("[data-payment-status]");
      var startPaymentButton = paymentDialog.querySelector("[data-start-payment]");
      var selectedPaymentMethod = "sbp";

      function paymentMethodLabel() {
        return selectedPaymentMethod === "sbp" ? "СБП" : "банковской картой";
      }

      function renderPaymentMethods() {
        paymentMethodButtons.forEach(function (button) {
          button.setAttribute("aria-pressed", String(button.dataset.paymentMethod === selectedPaymentMethod));
        });
      }

      paymentMethodButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          selectedPaymentMethod = button.dataset.paymentMethod;
          renderPaymentMethods();
        });
      });

      function paymentOrderNumber() {
        var now = new Date();
        var date = [now.getFullYear() % 100, now.getMonth() + 1, now.getDate()].map(function (part) {
          return String(part).padStart(2, "0");
        }).join("");
        var suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        return "KB-" + date + "-" + suffix;
      }

      function paymentMarkContent(method) {
        if (method === "sbp") return '<img src="assets/brand/sbp-sign-official.png" alt="">';
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18M7 15h4"></path></svg>';
      }

      function preparePayment(total) {
        paymentOrder.textContent = paymentOrderNumber();
        paymentTotal.textContent = formatPrice.format(total) + " ₽";
        paymentMethodName.textContent = selectedPaymentMethod === "sbp" ? "СБП" : "Банковская карта";
        paymentMark.className = "payment-mark payment-mark--" + selectedPaymentMethod;
        paymentMark.innerHTML = paymentMarkContent(selectedPaymentMethod);
        startPaymentButton.textContent = "Продолжить с " + paymentMethodLabel();
        startPaymentButton.disabled = false;
        paymentStatus.textContent = "Проверьте сумму и способ оплаты перед переходом.";
      }

      function renderCart() {
        cartCount.textContent = String(cart.length);
        cartCount.classList.toggle("is-visible", cart.length > 0);
        cartEmpty.hidden = cart.length > 0;
        cartTotal.hidden = cart.length === 0;
        paymentMethods.hidden = cart.length === 0;
        checkoutButton.disabled = cart.length === 0;
        cartList.innerHTML = "";
        var total = 0;
        cart.forEach(function (item, index) {
          total += item.price;
          var row = document.createElement("article");
          row.className = "cart-item";
          row.dataset.odId = "cart-item-" + index;
          var media = document.createElement("div");
          media.className = "cart-item-media";
          var image = document.createElement("img");
          image.src = item.image;
          image.alt = productLabel(item) + ", боковой профиль";
          image.loading = "lazy";
          media.appendChild(image);
          var copy = document.createElement("div");
          copy.className = "cart-item-copy";
          var title = document.createElement("strong");
          title.textContent = productLabel(item);
          var description = document.createElement("span");
          description.className = "cart-item-description";
          description.textContent = item.description;
          var meta = document.createElement("span");
          meta.className = "cart-item-meta";
          meta.textContent = "Размер EU " + item.size;
          var aside = document.createElement("div");
          aside.className = "cart-item-aside";
          var price = document.createElement("strong");
          price.className = "cart-item-price";
          price.textContent = formatPrice.format(item.price) + " ₽";
          var remove = document.createElement("button");
          remove.className = "cart-remove";
          remove.type = "button";
          remove.dataset.odId = "remove-cart-item-" + index;
          remove.setAttribute("aria-label", "Удалить " + productLabel(item) + " из корзины");
          remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v5M14 11v5M8 7l1-2h6l1 2M7 7l.8 12h8.4L17 7"></path></svg>';
          remove.addEventListener("click", function () {
            cart.splice(index, 1);
            renderCart();
          });
          copy.appendChild(title);
          copy.appendChild(description);
          copy.appendChild(meta);
          aside.appendChild(price);
          aside.appendChild(remove);
          row.appendChild(media);
          row.appendChild(copy);
          row.appendChild(aside);
          cartList.appendChild(row);
        });
        cartTotalValue.textContent = formatPrice.format(total) + " ₽";
        renderPaymentMethods();
      }

      addButton.addEventListener("click", function () {
        if (!selectedProduct || !selectedSize) return;
        cart.push({
          type: selectedProduct.type,
          brand: selectedProduct.brand,
          name: selectedProduct.name,
          price: selectedProduct.price,
          size: selectedSize,
          image: selectedProduct.image,
          description: selectedProduct.description
        });
        renderCart();
        addButton.disabled = true;
        addButton.textContent = "Добавлено";
        window.setTimeout(function () {
          if (!selectedProduct || !selectedSize) return;
          addButton.disabled = false;
          addButton.textContent = "Добавить в корзину";
        }, 1100);
      });
      checkoutButton.addEventListener("click", function () {
        if (!cart.length) return;
        var total = cart.reduce(function (sum, item) { return sum + item.price; }, 0);
        preparePayment(total);
        closeDialog(document.getElementById("cart-dialog"));
        openDialog(paymentDialog);
      });
      startPaymentButton.addEventListener("click", function () {
        startPaymentButton.disabled = true;
        startPaymentButton.textContent = "Открываем форму оплаты…";
        paymentStatus.textContent = "Переходим к защищённой форме " + paymentMethodLabel() + ".";
        window.setTimeout(function () {
          startPaymentButton.disabled = false;
          startPaymentButton.textContent = "Продолжить с " + paymentMethodLabel();
        }, 900);
      });
      renderCart();

      var routeParams = new URLSearchParams(window.location.search);
      var requestedProductId = routeParams.get("product");
      var requestedSize = routeParams.get("size");
      var requestedView = routeParams.get("view");
      if (requestedProductId) {
        var requestedProduct = products.find(function (product) { return product.id === requestedProductId; });
        if (requestedProduct) openProduct(requestedProduct, requestedSize || undefined);
      } else if (requestedView && ["search", "login", "favorites", "cart"].includes(requestedView)) {
        openDialog(document.getElementById(requestedView + "-dialog"));
      }

      var searchInput = document.querySelector("[data-search-input]");
      var searchResults = document.querySelector("[data-search-results]");

      function renderSearch(query) {
        var normalized = query.trim().toLocaleLowerCase("ru");
        var matches = products.filter(function (product) {
          return productLabel(product).toLocaleLowerCase("ru").includes(normalized);
        }).slice(0, 6);
        searchResults.innerHTML = "";
        if (!normalized) return;
        if (!matches.length) {
          var empty = document.createElement("p");
          empty.className = "empty-state";
          empty.textContent = "Ничего не найдено. Попробуйте бренд или часть названия.";
          searchResults.appendChild(empty);
          return;
        }
        matches.forEach(function (product) {
          var button = document.createElement("button");
          button.className = "result-button";
          button.type = "button";
          var name = document.createElement("strong");
          name.textContent = productLabel(product);
          var price = document.createElement("span");
          price.textContent = formatPrice.format(product.price) + " ₽";
          button.appendChild(name);
          button.appendChild(price);
          button.addEventListener("click", function () {
            closeDialog(document.getElementById("search-dialog"));
            openProduct(product);
          });
          searchResults.appendChild(button);
        });
      }

      searchInput.addEventListener("input", function () { renderSearch(searchInput.value); });
      document.querySelector('[data-dialog-open="search-dialog"]').addEventListener("click", function () {
        window.setTimeout(function () { searchInput.focus(); }, 40);
      });

      var phoneForm = document.querySelector("[data-phone-form]");
      var codeForm = document.querySelector("[data-code-form]");
      var loginStatus = document.querySelector("[data-login-status]");
      phoneForm.addEventListener("submit", function (event) {
        event.preventDefault();
        phoneForm.hidden = true;
        codeForm.hidden = false;
        codeForm.querySelector("input").focus();
      });
      codeForm.addEventListener("submit", function (event) {
        event.preventDefault();
        loginStatus.textContent = "Вход выполнен.";
      });

      var finderForm = document.querySelector("[data-finder-form]");
      var finderInput = document.querySelector("[data-finder-input]");
      var finderResults = document.querySelector("[data-finder-results]");
      document.querySelectorAll(".scenario").forEach(function (button) {
        button.addEventListener("click", function () {
          document.querySelectorAll(".scenario").forEach(function (item) {
            item.setAttribute("aria-pressed", String(item === button));
          });
          finderInput.value = button.dataset.query;
          finderInput.focus();
        });
      });

      finderForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var query = finderInput.value.toLocaleLowerCase("ru");
        var budgetMatch = query.match(/(?:до\\s*)?(\\d{2,3})(?:\\s*000|\\s*тыс)/);
        var budget = budgetMatch ? Number(budgetMatch[1]) * 1000 : Number.POSITIVE_INFINITY;
        var wantsTraining = /трен|силов/.test(query);
        var wantsWomen = /женск/.test(query);
        var matches = products.filter(function (product) {
          if (product.price > budget) return false;
          if (wantsTraining && product.category !== "training") return false;
          if (wantsWomen && product.name !== "A'One") return false;
          return true;
        }).slice(0, 3);
        if (!matches.length) matches = products.filter(function (product) { return product.price <= budget; }).slice(0, 3);
        if (!matches.length) matches = products.slice(0, 3);
        finderResults.innerHTML = "";
        matches.forEach(function (product) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "result-button";
          var name = document.createElement("strong");
          name.textContent = productLabel(product);
          var price = document.createElement("span");
          price.textContent = formatPrice.format(product.price) + " ₽";
          button.appendChild(name);
          button.appendChild(price);
          button.addEventListener("click", function () { openProduct(product); });
          finderResults.appendChild(button);
        });
        finderResults.classList.add("is-visible");
      });
    })();
