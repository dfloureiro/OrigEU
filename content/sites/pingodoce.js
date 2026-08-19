// pingodoce.pt runs on the same platform as continente.pt/auchan.pt
// (Salesforce Commerce Cloud / SFRA) — confirmed via its Demandware session
// cookies (dwanonymous_, dwsid) and its search controller URL
// (/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show). This
// couldn't be confirmed earlier in the project (the site blocks
// non-browser requests without a real User-Agent), so it originally shipped
// with a from-scratch, unverified "best effort" adapter that didn't match
// anything real on the site — see git history.
//
// Verified against real fetched listing/PDP pages: the PDP already matches
// sfcc-common.js's stock SFRA selectors as-is (.product-detail,
// h1.product-name). The listing needs a name-selector override — the
// product name sits in `.product-name-link a` rather than any of the
// stock name selectors (tileBodySelector doesn't need one: getInjectTarget
// is replaced below instead of using it, see that comment for why).
const config = OrigEUSfcc.buildConfig({
  nameSelectors: ['.product-name-link a', '.pdp-link a', '.pdp-link', '.product-name a', '.product-name', 'a.link', 'h2', 'h3']
});

// Unlike continente.pt/auchan.pt, Pingo Doce renders the brand in its own
// element (listing: .product-brand-name; PDP: h1.product-brand),
// completely separate from the product name/title — e.g. a listing tile's
// name is just "Cerveja com Álcool Mini Pack 30" with "Sagres" only
// appearing in that separate element. Since matching is word-boundary
// search over the product name (lib/text-match.js), a brand that never
// appears in the name text can never match — every such product showed as
// "unknown" regardless of whether it was actually in the database. Folding
// the brand text into the searched name fixes that.
function withBrand(name, brandText) {
  const brand = brandText && brandText.trim();
  return brand ? `${brand} ${name || ''}`.trim() : name;
}

const baseGetName = config.listing.getName;
config.listing.getName = function (card) {
  const brandEl = card.querySelector('.product-brand-name');
  return withBrand(baseGetName(card), brandEl && brandEl.textContent);
};

const baseGetProductName = config.product.getProductName;
config.product.getProductName = function () {
  const brandEl = document.querySelector('h1.product-brand, .product-brand');
  return withBrand(baseGetProductName(), brandEl && brandEl.textContent);
};

// Listing tiles anchor "Adicionar" with position: absolute; bottom: 0,
// independent of how much text content (ratings, brand, promo message,
// bottle-deposit notice) renders above it — real measurements across
// products showed that gap varying from 22px to 36px on the exact same
// page, so no fixed-size badge injected into that text flow can reliably
// avoid it for every product; shrinking the badge only reduced how often
// it happened. Overlaying the badge on the product image instead sidesteps
// the problem entirely — .product-tile-image is already position:relative
// (it's how the site places its own "Poupe X%" promo graphic), and that
// promo graphic only ever occupies the image's bottom portion, leaving the
// top-right corner reliably free (see common.css's
// .product-tile-image > .origeu-badges rule).
config.listing.getInjectTarget = function (card) {
  return card.querySelector('.product-tile-image') || card;
};

OrigEU.init(config);
