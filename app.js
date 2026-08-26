const CART_KEY = "frogracing-cart";

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

function cartShippingTotal() {
  const qtyByProduct = {};
  for (const line of cartLines()) {
    qtyByProduct[line.product.id] = (qtyByProduct[line.product.id] || 0) + line.qty;
  }
  return Object.entries(qtyByProduct).reduce(
    (sum, [productId, qty]) => sum + shippingForProductQty(findProduct(productId), qty),
    0
  );
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  for (const product of PRODUCTS) {
    const card = document.createElement("div");
    card.className = "product-card";

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const priceDisplay = hasVariants
      ? `$${Math.min(...product.variants.map((v) => v.price)).toFixed(2)}+`
      : `$${product.price.toFixed(2)}`;
    const initialImage = hasVariants ? (product.variants[0].image || product.image) : product.image;

    card.innerHTML = `
      <img src="${initialImage}" alt="${product.name}" data-product-id="${product.id}">
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      ${hasVariants ? `<select class="variant-select"></select>` : ""}
      <div class="price">${priceDisplay}</div>
      <button class="add-to-cart" type="button">Add to Cart</button>
    `;

    if (hasVariants) {
      const select = card.querySelector(".variant-select");
      const img = card.querySelector("img");
      for (const variant of product.variants) {
        const opt = document.createElement("option");
        opt.value = variant.id;
        opt.textContent = `${variant.label} — $${variant.price.toFixed(2)}`;
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        const variant = product.variants.find((v) => v.id === select.value);
        if (variant && variant.image) img.src = variant.image;
      });
      card.querySelector(".add-to-cart").addEventListener("click", () => addToCart(product.id, select.value));
    } else {
      card.querySelector(".add-to-cart").addEventListener("click", () => addToCart(product.id));
    }

    grid.appendChild(card);
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
      return actions.order.capture().then((details) => {
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

renderProducts();
renderCart();
