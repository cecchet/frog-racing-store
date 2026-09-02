const CART_KEY = "frogracing-cart";

// Paste the Google Apps Script Web App URL here after deploying it (see
// google-apps-script.gs in this repo for the script + deployment steps).
// Order logging is skipped silently if this is left blank.
const ORDER_LOG_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyFxXB60DY6rtPQNqn7qzFUK5es2l7LSV4EX7ZdmyNOQWbgQCUY2KpXZNbcoS7AGB3ghA/exec";

function logOrderToSheet(details, lines, subtotal, shippingCost, total) {
  if (!ORDER_LOG_WEBHOOK_URL) return;

  // PayPal collects a shipping address by default (shipping_preference
  // defaults to GET_FROM_FILE since we don't set NO_SHIPPING), and it comes
  // back on the capture response under purchase_units[0].shipping.
  const shipToInfo = details.purchase_units && details.purchase_units[0] && details.purchase_units[0].shipping;
  const shipToAddress = (shipToInfo && shipToInfo.address) || {};

  const payload = {
    orderId: details.id,
    payerName: [details.payer.name.given_name, details.payer.name.surname].filter(Boolean).join(" "),
    payerEmail: details.payer.email_address,
    shipToName: (shipToInfo && shipToInfo.name && shipToInfo.name.full_name) || "",
    shipToAddressLine1: shipToAddress.address_line_1 || "",
    shipToAddressLine2: shipToAddress.address_line_2 || "",
    shipToCity: shipToAddress.admin_area_2 || "",
    shipToState: shipToAddress.admin_area_1 || "",
    shipToPostalCode: shipToAddress.postal_code || "",
    shipToCountry: shipToAddress.country_code || "",
    subtotal: subtotal.toFixed(2),
    shipping: shippingCost.toFixed(2),
    total: total.toFixed(2),
    items: lines.map((line) => ({
      product: line.product.name,
      variant: line.variant ? line.variant.label : "",
      quantity: line.qty,
      unitPrice: line.price.toFixed(2),
      lineTotal: (line.price * line.qty).toFixed(2),
    })),
  };

  // Apps Script web apps don't handle CORS preflight requests; using
  // text/plain avoids the browser sending one, and mode: "no-cors" means we
  // can't read a response, so this is fire-and-forget best-effort logging.
  // PayPal's own transaction record remains the source of truth for orders.
  fetch(ORDER_LOG_WEBHOOK_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error("Order logging to sheet failed", err));
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// Cart is keyed by "productId" or "productId::variantId" for variant products.
let cart = loadCart();
let paypalButtonsInstance = null;

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function cartKey(productId, variantId) {
  return variantId ? `${productId}::${variantId}` : productId;
}

function parseCartKey(key) {
  const [productId, variantId] = key.split("::");
  return { productId, variantId };
}

function lineInfo(key) {
  const { productId, variantId } = parseCartKey(key);
  const product = findProduct(productId);
  if (!product) return null;
  const variant = variantId ? product.variants.find((v) => v.id === variantId) : null;
  if (variantId && !variant) return null;
  const price = variant ? variant.price : product.price;
  const label = variant ? `${product.name} — ${variant.label}` : product.name;
  return { product, variant, price, label };
}

function addToCart(productId, variantId) {
  const key = cartKey(productId, variantId);
  cart[key] = (cart[key] || 0) + 1;
  saveCart(cart);
  renderCart();
  openCart();
}

function setQuantity(key, qty) {
  qty = Math.max(0, Math.floor(Number(qty)) || 0);
  if (qty === 0) {
    delete cart[key];
  } else {
    cart[key] = qty;
  }
  saveCart(cart);
  renderCart();
}

function removeFromCart(key) {
  delete cart[key];
  saveCart(cart);
  renderCart();
}

function cartLines() {
  return Object.entries(cart)
    .map(([key, qty]) => ({ key, qty, ...lineInfo(key) }))
    .filter((line) => line.product);
}

function cartSubtotal() {
  return cartLines().reduce((sum, line) => sum + line.price * line.qty, 0);
}

function cartTotalUnits() {
  return cartLines().reduce((sum, line) => sum + line.qty, 0);
}

// A variant can override its own additional-item shipping rate (e.g. a
// bundled add-on that ships free alongside another unit of the same
// product) via `variant.shippingAdditional`. Falls back to the product's
// standard additional rate otherwise.
function lineAdditionalRate(line) {
  if (line.variant && line.variant.shippingAdditional !== undefined) {
    return line.variant.shippingAdditional;
  }
  return (line.product.shipping || DEFAULT_SHIPPING).additional;
}

function cartShippingTotal() {
  // Group by product: each product's units share one shipping "bucket" -
  // one of them (whichever has the highest additional rate) gets promoted
  // to absorb the order-wide "first item" charge, and every other unit
  // (across every product) pays its own line's additional rate. This lets
  // a discounted/free variant "ride along" without ever being the one that
  // absorbs the first-item charge, while still paying full first-item price
  // if it's the only thing in the cart.
  const groups = {};
  for (const line of cartLines()) {
    const productId = line.product.id;
    const rate = lineAdditionalRate(line);
    if (!groups[productId]) {
      groups[productId] = {
        sumAdditional: 0,
        maxAdditional: -Infinity,
        first: (line.product.shipping || DEFAULT_SHIPPING).first,
      };
    }
    groups[productId].sumAdditional += line.qty * rate;
    groups[productId].maxAdditional = Math.max(groups[productId].maxAdditional, rate);
  }

  const productGroups = Object.values(groups);
  if (productGroups.length === 0) return 0;

  let sumAdditional = 0;
  let maxFirst = -Infinity;
  let maxFirstAdditional = 0;
  for (const group of productGroups) {
    sumAdditional += group.sumAdditional;
    if (group.first > maxFirst) {
      maxFirst = group.first;
      maxFirstAdditional = group.maxAdditional;
    }
  }
  return sumAdditional + (maxFirst - maxFirstAdditional);
}

// Returns the list of photos to cycle through for a product or variant -
// falls back to its single `image` field when there's no `images` array.
function getImages(item) {
  return item.images && item.images.length > 0 ? item.images : [item.image];
}

function buildProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const priceDisplay = hasVariants
    ? `$${Math.min(...product.variants.map((v) => v.price)).toFixed(2)}+`
    : `$${product.price.toFixed(2)}`;
  // Always start on the product's own cover photo(s), not a specific
  // variant's - once the shopper picks a variant, the select's "change"
  // handler below takes over and shows that variant's own photo(s).
  const initialImages = getImages(product);

  const nameHtml = product.pageUrl
    ? `<a href="${product.pageUrl}" target="_blank" rel="noopener">${product.name}</a>`
    : product.name;

  card.innerHTML = `
    <div class="image-carousel">
      <img src="${initialImages[0]}" alt="${product.name}" data-product-id="${product.id}">
      <button class="carousel-prev" type="button" aria-label="Previous photo">&#10094;</button>
      <button class="carousel-next" type="button" aria-label="Next photo">&#10095;</button>
      <div class="carousel-dots"></div>
    </div>
    <h3>${nameHtml}</h3>
    <p>${product.description}</p>
    ${hasVariants ? `<select class="variant-select"></select>` : ""}
    <div class="price">${priceDisplay}</div>
    <button class="add-to-cart" type="button">Add to Cart</button>
  `;

  const img = card.querySelector(".image-carousel img");
  const prevBtn = card.querySelector(".carousel-prev");
  const nextBtn = card.querySelector(".carousel-next");
  const dotsEl = card.querySelector(".carousel-dots");
  let images = initialImages;
  let index = 0;

  function renderCarousel() {
    img.src = images[index];
    const multi = images.length > 1;
    prevBtn.style.display = multi ? "flex" : "none";
    nextBtn.style.display = multi ? "flex" : "none";
    dotsEl.style.display = multi ? "flex" : "none";
    dotsEl.innerHTML = "";
    if (multi) {
      images.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot" + (i === index ? " active" : "");
        dot.setAttribute("aria-label", `Photo ${i + 1}`);
        dot.addEventListener("click", () => {
          index = i;
          renderCarousel();
        });
        dotsEl.appendChild(dot);
      });
    }
  }

  function setImages(newImages) {
    images = newImages.length > 0 ? newImages : ["images/placeholder.svg"];
    index = 0;
    renderCarousel();
  }

  prevBtn.addEventListener("click", () => {
    index = (index - 1 + images.length) % images.length;
    renderCarousel();
  });
  nextBtn.addEventListener("click", () => {
    index = (index + 1) % images.length;
    renderCarousel();
  });

  renderCarousel();

  if (hasVariants) {
    const select = card.querySelector(".variant-select");
    for (const variant of product.variants) {
      const opt = document.createElement("option");
      opt.value = variant.id;
      opt.textContent = `${variant.label} — $${variant.price.toFixed(2)}`;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      const variant = product.variants.find((v) => v.id === select.value);
      if (variant) setImages(getImages(variant));
    });
    card.querySelector(".add-to-cart").addEventListener("click", () => addToCart(product.id, select.value));
  } else {
    card.querySelector(".add-to-cart").addEventListener("click", () => addToCart(product.id));
  }

  return card;
}

function renderNav() {
  const nav = document.getElementById("category-nav");
  nav.innerHTML = "";
  for (const category of CATEGORIES) {
    const hasProducts = PRODUCTS.some((p) => p.category === category.id);
    if (!hasProducts) continue;

    const link = document.createElement("a");
    link.href = `#${category.id}`;
    link.textContent = category.label;
    nav.appendChild(link);
  }
}

function renderProducts() {
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = "";

  for (const category of CATEGORIES) {
    const productsInCategory = PRODUCTS.filter((p) => p.category === category.id);
    if (productsInCategory.length === 0) continue;

    const section = document.createElement("section");
    section.className = "category-section";
    section.id = category.id;

    const heading = document.createElement("h2");
    heading.textContent = category.label;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "product-grid";
    for (const product of productsInCategory) {
      grid.appendChild(buildProductCard(product));
    }
    section.appendChild(grid);

    catalog.appendChild(section);
  }
}

function renderCart() {
  const linesEl = document.getElementById("cart-lines");
  const emptyMsg = document.getElementById("empty-cart-msg");
  const totalsEl = document.getElementById("cart-totals");
  const paypalContainer = document.getElementById("paypal-button-container");
  const lines = cartLines();

  linesEl.innerHTML = "";

  if (lines.length === 0) {
    emptyMsg.style.display = "block";
    totalsEl.style.display = "none";
    paypalContainer.style.display = "none";
    paypalContainer.innerHTML = "";
    paypalButtonsInstance = null;
    updateCartCount();
    return;
  }

  emptyMsg.style.display = "none";
  totalsEl.style.display = "block";
  paypalContainer.style.display = "block";

  for (const line of lines) {
    const row = document.createElement("div");
    row.className = "cart-line";
    row.innerHTML = `
      <span class="line-name">${line.label}</span>
      <input type="number" min="0" value="${line.qty}">
      <span>$${(line.price * line.qty).toFixed(2)}</span>
      <button class="remove" type="button">Remove</button>
    `;
    row.querySelector("input").addEventListener("change", (e) => setQuantity(line.key, e.target.value));
    row.querySelector(".remove").addEventListener("click", () => removeFromCart(line.key));
    linesEl.appendChild(row);
  }

  const subtotal = cartSubtotal();
  const shipping = cartShippingTotal();
  const total = subtotal + shipping;

  totalsEl.innerHTML = `
    <div class="row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
    <div class="row"><span>Shipping</span><span>$${shipping.toFixed(2)}</span></div>
    <div class="row grand"><span>Total</span><span>$${total.toFixed(2)}</span></div>
  `;

  updateCartCount();
  renderPayPalButtons();
}

function updateCartCount() {
  const count = cartTotalUnits();
  document.getElementById("cart-count").textContent = count > 0 ? `(${count})` : "";
}

function renderPayPalButtons() {
  const container = document.getElementById("paypal-button-container");
  container.innerHTML = "";

  if (typeof paypal === "undefined") {
    container.innerHTML = "<p style='color:#c62828;font-size:0.85rem;'>PayPal checkout failed to load.</p>";
    return;
  }

  paypalButtonsInstance = paypal.Buttons({
    style: { layout: "vertical", color: "gold", label: "paypal" },
    createOrder: (data, actions) => {
      const lines = cartLines();
      const subtotal = cartSubtotal();
      const shipping = cartShippingTotal();
      const total = subtotal + shipping;

      return actions.order.create({
        purchase_units: [
          {
            amount: {
              value: total.toFixed(2),
              currency_code: "USD",
              breakdown: {
                item_total: { currency_code: "USD", value: subtotal.toFixed(2) },
                shipping: { currency_code: "USD", value: shipping.toFixed(2) },
              },
            },
            items: lines.map((line) => ({
              name: line.label,
              unit_amount: { currency_code: "USD", value: line.price.toFixed(2) },
              quantity: String(line.qty),
            })),
          },
        ],
      });
    },
    onApprove: (data, actions) => {
      const lines = cartLines();
      const subtotal = cartSubtotal();
      const shipping = cartShippingTotal();
      const total = subtotal + shipping;

      return actions.order.capture().then((details) => {
        logOrderToSheet(details, lines, subtotal, shipping, total);
        cart = {};
        saveCart(cart);
        renderCart();
        renderProducts();
        alert(`Thanks, ${details.payer.name.given_name}! Your order is complete.`);
        closeCart();
      });
    },
    onError: (err) => {
      console.error("PayPal checkout error", err);
      alert("Something went wrong with checkout. Please try again.");
    },
  });

  paypalButtonsInstance.render("#paypal-button-container");
}

function openCart() {
  document.getElementById("cart-drawer").classList.add("open");
  document.getElementById("cart-overlay").classList.add("open");
}

function closeCart() {
  document.getElementById("cart-drawer").classList.remove("open");
  document.getElementById("cart-overlay").classList.remove("open");
}

document.getElementById("cart-toggle").addEventListener("click", openCart);
document.getElementById("close-cart").addEventListener("click", closeCart);
document.getElementById("cart-overlay").addEventListener("click", closeCart);

renderNav();
renderProducts();
renderCart();
