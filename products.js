// Product catalog. Prices are in USD.
const PRODUCTS = [
  {
    id: "racing-harness-collar",
    name: "Racing Harness Collar",
    pageUrl: "https://www.frogracing.us/store/racing-harness-collars",
    image: "images/racing-harness-collar/38mm-2in.jpg",
    description: "Carbon Fiber reinforced polyamide (PA6-CF) racing harness collar with carbon steel hardware, designed and produced in-house at Frog Racing.",
    variants: [
      { id: "38mm-2in", label: "1.5\" / 38mm harness bar - 2\" belt kit", price: 44.99, image: "images/racing-harness-collar/38mm-2in.jpg" },
      { id: "38mm-3in", label: "1.5\" / 38mm harness bar - 3\" belt kit", price: 44.99, image: "images/racing-harness-collar/38mm-3in.jpg" },
      { id: "44mm-2in", label: "1.75\" / 44mm harness bar - 2\" belt kit", price: 49.99, image: "images/racing-harness-collar/44mm-2in.jpg" },
      { id: "44mm-3in", label: "1.75\" / 44mm harness bar - 3\" belt kit", price: 49.99, image: "images/racing-harness-collar/44mm-3in.jpg" },
      { id: "fia40mm-2in", label: "FIA 40mm harness bar - 2\" belt kit", price: 47.99, image: "images/racing-harness-collar/fia40mm-2in.jpg" },
      { id: "fia40mm-3in", label: "FIA 40mm harness bar - 3\" belt kit", price: 47.99, image: "images/racing-harness-collar/fia40mm-3in.jpg" },
    ],
    // $10 for the first collar (any variant), $5 for each additional collar.
    shipping: { first: 10.00, additional: 5.00 },
  },
  {
    id: "sun-visor",
    name: "Sun Visor GoPro Mount",
    pageUrl: "https://www.frogracing.us/store/sun-visor",
    image: "images/sun-visor/standalone.jpg",
    description: "Black ABS plastic sun visor with a versatile GoPro mount.",
    variants: [
      { id: "standalone", label: "Standalone visor (one visor)", price: 25.00, image: "images/sun-visor/standalone.jpg" },
      { id: "combo-1.5", label: "1.5\" Combo - Visor+1.5\" bar mount+GoPro thumbscrew+Cable tie", price: 30.00, image: "images/sun-visor/combo-1.5.jpg" },
      { id: "combo-1.75", label: "1.75\" Combo - Visor+1.75\" bar mount+GoPro thumbscrew+Cable tie", price: 30.00, image: "images/sun-visor/combo-1.75.jpg" },
      { id: "deluxe-1.5", label: "1.5\" Deluxe - Visor+1.5\" bar mount+Swivel mount+Cable tie", price: 49.00, image: "images/sun-visor/deluxe-1.5.jpg" },
      { id: "deluxe-1.75", label: "1.75\" Deluxe - Visor+1.75\" bar mount+Swivel mount+Cable tie", price: 49.00, image: "images/sun-visor/deluxe-1.75.jpg" },
      { id: "custom", label: "Custom design (contact sales@frogracing.us)", price: 79.00, image: "images/sun-visor/custom.jpg" },
    ],
    shipping: { first: 9.00, additional: 1.00 },
  },
  {
    id: "steering-wheel-hook",
    name: "Steering Wheel Hook with GoPro Mount",
    pageUrl: "https://www.frogracing.us/store/steering-wheel-hook",
    image: "images/steering-wheel-hook/38mm-standard-abs.jpg",
    description: "Lightweight 2-in-1 solution to hook a steering wheel to a rollcage bar, plus a standard GoPro mount.",
    variants: [
      { id: "38mm-standard-abs", label: "1.5\" / 38mm standard (ABS)", price: 12.00, image: "images/steering-wheel-hook/38mm-standard-abs.jpg" },
      { id: "38mm-hd-pa6cf", label: "1.5\" / 38mm HD (PA6-CF)", price: 17.00, image: "images/steering-wheel-hook/38mm-hd-pa6cf.jpg" },
      { id: "44mm-standard-abs", label: "1.75\" / 44mm standard (ABS)", price: 12.00, image: "images/steering-wheel-hook/44mm-standard-abs.jpg" },
      { id: "44mm-hd-pa6cf", label: "1.75\" / 44mm HD (PA6-CF)", price: 17.00, image: "images/steering-wheel-hook/44mm-hd-pa6cf.jpg" },
      { id: "44mm-xl-standard-abs", label: "1.75\" / 44mm XL standard (ABS)", price: 22.00, image: "images/steering-wheel-hook/44mm-xl-standard-abs.jpg" },
      { id: "44mm-xl-hd-pa6cf", label: "1.75\" / 44mm XL HD (PA6-CF)", price: 27.00, image: "images/steering-wheel-hook/44mm-xl-hd-pa6cf.jpg" },
      { id: "contour-38mm-hd", label: "HD Contour camera adapter + 1.5\" / 38mm hook (PA6-CF)", price: 25.00, image: "images/steering-wheel-hook/contour-38mm-hd.jpg" },
      { id: "contour-44mm-hd", label: "HD Contour camera adapter + 1.75\" / 44mm hook (PA6-CF)", price: 25.00, image: "images/steering-wheel-hook/contour-44mm-hd.jpg" },
      { id: "contour-44mm-xl-hd", label: "HD Contour camera adapter + 1.75\" / 44mm XL hook (PA6-CF)", price: 30.00, image: "images/steering-wheel-hook/contour-44mm-xl-hd.jpg" },
    ],
    shipping: { first: 6.00, additional: 1.00 },
  },
  {
    id: "steering-wheel-plug",
    name: "Steering Wheel Horn Plug",
    pageUrl: "https://www.frogracing.us/store/steering-wheel-plug",
    image: "images/steering-wheel-plug/sti.jpg",
    description: "Fits the standard Sparco steering wheel horn button hole.",
    variants: [
      { id: "sti", label: "STi", price: 10.00, image: "images/steering-wheel-plug/sti.jpg" },
      { id: "audi-rings", label: "Audi rings", price: 10.00, image: "images/steering-wheel-plug/audi-rings.jpg" },
      { id: "vw-logo", label: "VW logo", price: 10.00, image: "images/steering-wheel-plug/vw-logo.jpg" },
      { id: "custom", label: "Custom design (contact sales@frogracing.us)", price: 20.00, image: "images/steering-wheel-plug/custom.jpg" },
      { id: "blank", label: "Blank (all black/carbon fiber finish)", price: 8.00, image: "images/steering-wheel-plug/blank.jpg" },
    ],
    shipping: { first: 5.00, additional: 1.00 },
  },
  {
    id: "button-cover-fire-suppression",
    name: "Button Cover for Lifeline Fire Suppression Systems",
    pageUrl: "https://www.frogracing.us/store/button-cover-for-lifeline-fire-suppression-systems",
    image: "images/button-cover-fire-suppression/red-bg-white-e.jpg",
    description: "Fits Lifeline Zero 360 FIA 3.0kg FK 5-1-12 Stored Pressure Electric System buttons.",
    variants: [
      { id: "red-bg-white-e", label: "Red background, white E (pair)", price: 5.00, image: "images/button-cover-fire-suppression/red-bg-white-e.jpg" },
      { id: "white-bg-red-e", label: "White background, red E (pair)", price: 5.00, image: "images/button-cover-fire-suppression/white-bg-red-e.jpg" },
    ],
    shipping: { first: 4.00, additional: 1.00 },
  },
  {
    id: "key-ring",
    name: "Women in Motorsports Key Ring",
    image: "images/key-ring/cttc-2026.jpg",
    description: "Laser engraved transparent acrylic key ring with a lobster claw clasp made of zinc alloy metal, featuring the Frog Racing and Women in Motorsports logo. Currently only shipping to the USA; contact sales@frogracing.us for international shipping.",
    variants: [
      { id: "cttc-2026", label: "CTTC 2026", price: 3.00, image: "images/key-ring/cttc-2026.jpg" },
      { id: "frog-racing", label: "Frog Racing", price: 3.00, image: "images/key-ring/frog-racing.jpg" },
    ],
    shipping: { first: 2.00, additional: 0.50 },
  },
  {
    id: "tshirt-womens-pink",
    name: "Women in Motorsports Pink T-Shirt",
    image: "images/tshirt-womens-pink/front.jpg",
    description: "100% cotton short sleeve t-shirt with a Frog Racing logo on the front and the Women in Motorsports logo on the back. Currently only shipping to the USA; contact sales@frogracing.us for international shipping.",
    variants: [
      { id: "s", label: "S", price: 25.00, image: "images/tshirt-womens-pink/front.jpg" },
      { id: "m", label: "M", price: 25.00, image: "images/tshirt-womens-pink/front.jpg" },
      { id: "l", label: "L", price: 25.00, image: "images/tshirt-womens-pink/front.jpg" },
      { id: "xl", label: "XL", price: 25.00, image: "images/tshirt-womens-pink/front.jpg" },
    ],
    shipping: { first: 7.00, additional: 2.00 },
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
