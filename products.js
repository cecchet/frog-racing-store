// Product catalog. Prices are in USD.
// TODO: replace these placeholders with the real catalog pulled from the
// Google Sites store (frogracing.us/store).
const PRODUCTS = [
  {
    id: "sun-visor",
    name: "Sun Visor",
    price: 15.00,
    image: "images/placeholder.svg",
    description: "Replacement sun visor.",
  },
  {
    id: "steering-wheel-hook",
    name: "Steering Wheel Hook",
    price: 10.00,
    image: "images/placeholder.svg",
    description: "Hook for hanging your steering wheel in the garage.",
  },
  {
    id: "racing-harness-collars",
    name: "Racing Harness Collars",
    price: 8.00,
    image: "images/placeholder.svg",
    description: "Collars for racing harness webbing.",
  },
];

// Flat shipping fee applied once per order, regardless of how many items are
// in the cart. This is the "start simple" combined-shipping workaround since
// PayPal's own buttons only support per-item flat shipping.
const FLAT_SHIPPING_USD = 6.00;
