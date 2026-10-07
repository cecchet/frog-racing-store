// Collects current Amazon prices for the Recommended Products list.
//
// Amazon blocks scripted (node/curl) requests with a captcha, so this runs inside a
// normal browser tab instead:
//
//   1. Run `node build-recommended.js --asins` and copy the comma-separated ASIN line.
//   2. Open any https://www.amazon.com/ page, open the DevTools console, set
//        const ASIN_LIST = "B082MKSNSY,B083JCZHPT,...";
//      and then paste the rest of this file.
//   3. Wait (~3 seconds per product). When it finishes, the browser downloads products.json.
//      Save it as tools/cache/products.json and run `node build-recommended.js`.
//
// It stops by itself when Amazon starts challenging the requests (this happened after ~150
// products in one run) - do not try to push through; the partial results are still saved.
// Amazon's own notice points automated access at its Product Advertising API, which is the
// supported way to get prices for every item; this snippet is only a stop-gap.

(async () => {
  const asins = ASIN_LIST.split(",").filter(Boolean);
  const T = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const money = (s) => {
    const m = (s || "").replace(/,/g, "").match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    return m ? parseFloat(m[1]) : null;
  };

  // Compact keys (kept short because the whole result is written to one file):
  //   t title, p price, l list price, d percent off, c coupon, b deal badge (pbd/ltd),
  //   i image id, u unavailable, m price hidden until added to cart
  function parse(doc) {
    const box =
      doc.querySelector("#corePriceDisplay_desktop_feature_div") ||
      doc.querySelector("#corePrice_feature_div") ||
      doc.querySelector("#apex_desktop") ||
      doc;
    const unavailable = /currently unavailable/i.test(T(doc.querySelector("#availability")) + " " + T(doc.querySelector("#outOfStock")));

    // "$156.18 with 35 percent savings" - the screen-reader label holds the price actually charged.
    const acc = T(box.querySelector("#apex-pricetopay-accessibility-label"));
    let price = money(acc);
    let pct = 0;
    const pm = acc.match(/with (\d+) percent savings/);
    if (pm) pct = parseInt(pm[1], 10);
    if (price == null) {
      price = money(
        T(box.querySelector(".priceToPay .a-offscreen")) ||
          T(box.querySelector(".a-price:not(.a-text-price) .a-offscreen")) ||
          T(doc.querySelector("#price_inside_buybox")) ||
          T(doc.querySelector("#priceblock_ourprice")) ||
          T(doc.querySelector("#priceblock_dealprice"))
      );
    }
    if (unavailable) price = null;

    let list = money(
      T(box.querySelector('.basisPrice [data-a-strike="true"] .a-offscreen')) || T(box.querySelector('[data-a-strike="true"] .a-offscreen'))
    );
    if (!price || !list || list <= price) {
      list = null;
      if (!price) pct = 0;
    }
    if (list && !pct) pct = Math.round((1 - price / list) * 100);

    const cm = T(
      doc.querySelector("[id^=couponText]") || doc.querySelector("#pqv-price-coupon-message") || doc.querySelector("#couponBadgeRegularVpc")
    ).match(/(\$[\d.,]+|\d+%)\s*(?:off\s*)?coupon|save\s+(\$[\d.,]+|\d+%)/i);
    const coupon = cm ? (cm[1] || cm[2]) + " coupon" : "";

    const dealText = T(doc.querySelector("#dealBadgeSupportingText")) + " " + T(doc.querySelector("#dealBadge_feature_div"));
    const deal = /Prime Big Deal/i.test(dealText) ? "pbd" : /Ends in|Limited time deal|Lightning/i.test(dealText) ? "ltd" : "";

    const landing = doc.querySelector("#landingImage");
    const src =
      (landing && (landing.getAttribute("data-old-hires") || landing.getAttribute("src"))) ||
      (doc.querySelector('meta[property="og:image"]') || {}).content ||
      "";
    const img = (src.match(/\/images\/I\/([^._\/][^\/]*?)\./) || [])[1] || null;

    const hidden = /Why don't we show the price/i.test(T(box));
    return { t: T(doc.querySelector("#productTitle")).slice(0, 100), p: price, l: list, d: pct, c: coupon, b: deal, i: img, u: unavailable ? 1 : 0, m: hidden ? 1 : 0 };
  }

  const products = {};
  for (let n = 0; n < asins.length; n++) {
    const asin = asins[n];
    try {
      const res = await fetch(`/dp/${asin}?th=1&psc=1`, { credentials: "include" });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      // Amazon's "automated access" / captcha pages have no product title (the notice is an
      // HTML comment, so look at the raw HTML rather than the text). Stop at the first one.
      if (res.status === 200 && (!doc.querySelector("#productTitle") || /api-services-support@amazon|Type the characters/.test(html.slice(0, 6000)))) {
        console.warn(`Amazon is challenging automated access at ${asin} (${n}/${asins.length}) - stopping. Do not retry for a while.`);
        break;
      }
      products[asin] = res.status === 200 ? parse(doc) : { e: res.status };
    } catch (err) {
      products[asin] = { e: String(err).slice(0, 60) };
    }
    if (n % 25 === 24) console.log(`${n + 1}/${asins.length}`);
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 400));
  }

  const blob = new Blob([JSON.stringify({ checkedAt: new Date().toISOString(), products })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "products.json";
  a.click();
  console.log(`Done: ${Object.keys(products).length} of ${asins.length} products collected.`);
})();
