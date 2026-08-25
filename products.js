// Product catalog. Prices are in USD.
const PRODUCTS = [
  {
    id: "racing-harness-collar",
    name: "Racing Harness Collar",
    image: "images/placeholder.svg",
    description: "Carbon Fiber reinforced polyamide (PA6-CF) racing harness collar with carbon steel hardware, designed and produced in-house at Frog Racing.",
    variants: [
      { id: "38mm-2in", label: "1.5\" / 38mm harness bar - 2\" belt kit", price: 44.99 },
      { id: "38mm-3in", label: "1.5\" / 38mm harness bar - 3\" belt kit", price: 44.99 },
      { id: "44mm-2in", label: "1.75\" / 44mm harness bar - 2\" belt kit", price: 49.99 },
      { id: "44mm-3in", label: "1.75\" / 44mm harness bar - 3\" belt kit", price: 49.99 },
      { id: "fia40mm-2in", label: "FIA 40mm harness bar - 2\" belt kit", price: 47.99 },
      { id: "fia40mm-3in", label: "FIA 40mm harness bar - 3\" belt kit", price: 47.99 },
    ],
    // $10 for the first collar (any variant), $5 for each additional collar.
    shipping: { first: 10.00, additional: 5.00 },
  },
  {
    id: "sun-visor",
    name: "Sun Visor GoPro Mount",
    image: "images/placeholder.svg",
    description: "Black ABS plastic sun visor with a versatile GoPro mount.",
    variants: [
      { id: "standalone", label: "Standalone visor (one visor)", price: 25.00 },
      { id: "combo-1.5", label: "1.5\" Combo - Visor+1.5\" bar mount+GoPro thumbscrew+Cable tie", price: 30.00 },
      { id: "combo-1.75", label: "1.75\" Combo - Visor+1.75\" bar mount+GoPro thumbscrew+Cable tie", price: 30.00 },
      { id: "deluxe-1.5", label: "1.5\" Deluxe - Visor+1.5\" bar mount+Swivel mount+Cable tie", price: 49.00 },
      { id: "deluxe-1.75", label: "1.75\" Deluxe - Visor+1.75\" bar mount+Swivel mount+Cable tie", price: 49.00 },
      { id: "custom", label: "Custom design (contact sales@frogracing.us)", price: 79.00 },
    ],
    shipping: { first: 9.00, additional: 1.00 },
  },
  {
    id: "steering-wheel-hook",
    name: "Steering Wheel Hook with GoPro Mount",
    image: "images/placeholder.svg",
    description: "Lightweight 2-in-1 solution to hook a steering wheel to a rollcage bar, plus a standard GoPro mount.",
    variants: [
      { id: "38mm-standard-abs", label: "1.5\" / 38mm standard (ABS)", price: 12.00 },
      { id: "38mm-hd-pa6cf", label: "1.5\" / 38mm HD (PA6-CF)", price: 17.00 },
      { id: "44mm-standard-abs", label: "1.75\" / 44mm standard (ABS)", price: 12.00 },
      { id: "44mm-hd-pa6cf", label: "1.75\" / 44mm HD (PA6-CF)", price: 17.00 },
      { id: "44mm-xl-standard-abs", label: "1.75\" / 44mm XL standard (ABS)", price: 22.00 },
      { id: "44mm-xl-hd-pa6cf", label: "1.75\" / 44mm XL HD (PA6-CF)", price: 27.00 },
      { id: "contour-38mm-hd", label: "HD Contour camera adapter + 1.5\" / 38mm hook (PA6-CF)", price: 25.00 },
      { id: "contour-44mm-hd", label: "HD Contour camera adapter + 1.75\" / 44mm hook (PA6-CF)", price: 25.00 },
      { id: "contour-44mm-xl-hd", label: "HD Contour camera adapter + 1.75\" / 44mm XL hook (PA6-CF)", price: 30.00 },
    ],
    shipping: { first: 6.00, additional: 1.00 },
  },
  {
    id: "steering-wheel-plug",
    name: "Steering Wheel Horn Plug",
    image: "images/placeholder.svg",
    description: "Fits the standard Sparco steering wheel horn button hole.",
    variants: [
      { id: "sti", label: "STi", price: 10.00 },
      { id: "audi-rings", label: "Audi rings", price: 10.00 },
      { id: "vw-logo", label: "VW logo", price: 10.00 },
      { id: "custom", label: "Custom design (contact sales@frogracing.us)", price: 20.00 },
      { id: "blank", label: "Blank (all black/carbon fiber finish)", price: 8.00 },
    ],
    shipping: { first: 5.00, additional: 1.00 },
  },
  {
    id: "button-cover-fire-suppression",
    name: "Button Cover for Lifeline Fire Suppression Systems",
    image: "images/placeholder.svg",
    description: "Fits Lifeline Zero 360 FIA 3.0kg FK 5-1-12 Stored Pressure Electric System buttons.",
    variants: [
      { id: "red-bg-white-e", label: "Red background, white E (pair)", price: 5.00 },
      { id: "white-bg-red-e", label: "White background, red E (pair)", price: 5.00 },
    ],
    shipping: { first: 4.00, additional: 1.00 },
  },
];

// Fallback graduated shipping for products that don't yet have a real rate
// (flat per unit until the user gives us actual numbers).
const DEFAULT_SHIPPING = { first: 6.00, additional: 6.00 };

// Combined shipping per product: each product's variants share one shipping
// "bucket" (first unit at the full rate, each additional unit of that same
// product at the discounted rate). Buckets for different products are added
// together. This is the workaround for PayPal's own buttons only supporting
// a single flat shipping fee, not a real per-product combined-cart rate.
function shippingForProductQty(product, qty) {
  if (qty <= 0) return 0;
  const rule = product.shipping || DEFAULT_SHIPPING;
  return rule.first + (qty - 1) * rule.additional;
}
