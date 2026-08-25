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

let cart = loadCart();
let paypalButtonsInstance = null;

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart(cart);
  renderCart();
  openCart();
}

function setQuantity(id, qty) {
  qty = Math.max(0, Math.floor(Number(qty)) || 0);
  if (qty === 0) {
    delete cart[id];
  } else {
    cart[id] = qty;
  }
  saveCart(cart);
  renderCart();
}

function removeFromCart(id) {
  delete cart[id];
  saveCart(cart);
  renderCart();
}

function cartLines() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ product: findProduct(id), qty }))
    .filter((line) => line.product);
}

function cartSubtotal() {
  return cartLines().reduce((sum, line) => sum + line.product.price * line.qty, 0);
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  for (const product of PRODUCTS) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <div class="price">$${product.price.toFixed(2)}</div>
      <button class="add-to-cart" type="button">Add to Cart</button>
    `;
    card.querySelector(".add-to-cart").addEventListener("click", () => addToCart(product.id));
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

  for (const { product, qty } of lines) {
    const row = document.createElement("div");
    row.className = "cart-line";
    row.innerHTML = `
      <span class="line-name">${product.name}</span>
      <input type="number" min="0" value="${qty}">
      <span>$${(product.price * qty).toFixed(2)}</span>
      <button class="remove" type="button">Remove</button>
    `;
    row.querySelector("input").addEventListener("change", (e) => setQuantity(product.id, e.target.value));
    row.querySelector(".remove").addEventListener("click", () => removeFromCart(product.id));
    linesEl.appendChild(row);
  }

  const subtotal = cartSubtotal();
  const shipping = FLAT_SHIPPING_USD;
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
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
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
      const shipping = FLAT_SHIPPING_USD;
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
              name: line.product.name,
              unit_amount: { currency_code: "USD", value: line.product.price.toFixed(2) },
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
