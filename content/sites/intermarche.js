// intermarche.pt is NOT Salesforce Commerce Cloud like the other three
// sites — it's a custom Next.js/React storefront (ITM_CONFIG, /_next/static
// chunks, API_HOST_DOMAIN api.intermarche.pt), so this is a standalone
// config rather than another content/sites/sfcc-common.js override.
//
// The site also sits behind DataDome bot-protection, which returns a
// JS-challenge page to every non-browser request (curl, this project's own
// fetch tooling, etc.) — so unlike the other three sites' selectors, these
// couldn't be verified by fetching the page directly. They're taken from
// real markup copied out of a live browser's DevTools instead (a search
// results tile and a PDP title block).
//
// Listing tile, verified in three different contexts — the search results
// grid (`.productList__grid__item.product`), the home page's own grid/
// carousel (bare `.product`, no `.productList__grid__item` wrapper), and
// the search-box typeahead dropdown while typing (`.search__result.product`)
// — all three render the exact same card shape:
//   <div class="... product" data-id="57464" data-nfproductid="57464"
//        data-name="Páturages - Leite Uht Magro sem Lactose 1l" ...>
//     <a class="link product__info" href="/product/.../5604260344062">
//       <div class="product__media">...</div>
//       <div class="product__texts"><div class="product__title">
//         <span class="product__brand">Páturages - </span>
//         <h2 class="product__name">Leite Uht Magro sem Lactose 1l</h2>
//       </div></div>
//     </a>
//     <footer class="product__footer">...prices/add-to-cart...</footer>
//   </div>
// `.product` alone would be a bit loose as a global selector (a common
// enough word to risk matching something unrelated elsewhere on the site),
// so it's paired with `[data-nfproductid]` — present on every verified
// card, in every context — for the one shared selector that covers all
// three without needing a separate config the way the SFCC sites need one
// for their typeahead dropdown (see ARCHITECTURE.md).
// data-name already has the brand folded into the name (same reason
// pingodoce.js does this by hand for its own site — a brand that never
// appears in the name text can never word-match) — no separate lookup
// needed for the common case; product__brand/product__name are kept as a
// fallback for whichever card doesn't carry data-name.
const LISTING_CARD_SELECTOR = '.product[data-nfproductid]';

function withBrand(name, brandText) {
  const brand = brandText && brandText.trim();
  return brand ? `${brand} ${name || ''}`.replace(/\s+/g, ' ').trim() : name;
}

function listingName(card) {
  const dataName = card.getAttribute('data-name');
  if (dataName && dataName.trim()) return dataName.trim();
  const nameEl = card.querySelector('.product__name');
  const brandEl = card.querySelector('.product__brand');
  return withBrand(nameEl && nameEl.textContent.trim(), brandEl && brandEl.textContent);
}

OrigEU.init({
  listing: {
    cardSelector: LISTING_CARD_SELECTOR,
    getName: listingName,
    // The name/image sit inside `<a class="link product__info">`, but the
    // price/add-to-cart `<footer>` is a *sibling* of that anchor, not
    // nested in it — inject into the card itself, positioned before the
    // footer, so the badge lands outside the link (a badge inside the
    // anchor would also navigate to the PDP on click, breaking its own
    // "unknown brand" click-to-suggest behavior).
    getInjectTarget(card) {
      return card;
    },
    getInjectBefore(card, target) {
      return target.querySelector('.product__footer');
    }
  },
  product: {
    // PDP, verified structure:
    //   <div class="productDetail__resume__content">
    //     <div>
    //       <strong class="productDetail__brand">Páturages</strong>
    //       <div class="productDetail__title">
    //         <h1 class="productDetail__main_title">Leite Uht Magro sem Lactose 1l</h1>
    //       </div>
    //       <div class="productDetail__description">...</div>
    //     </div>
    //     <div class="productDetail__footer">...prices/add-to-cart...</div>
    //   </div>
    // Brand is a separate element here too (there's no PDP equivalent of
    // the listing tile's pre-folded data-name), so it's folded in the same
    // way as the listing.
    isProductPage() {
      return Boolean(document.querySelector('.productDetail__resume__content') &&
        document.querySelector('h1.productDetail__main_title'));
    },
    getProductName() {
      const h1 = document.querySelector('h1.productDetail__main_title');
      const brandEl = document.querySelector('.productDetail__brand');
      return withBrand(h1 && h1.textContent.trim(), brandEl && brandEl.textContent);
    },
    getProductInjectTarget() {
      const h1 = document.querySelector('h1.productDetail__main_title');
      if (!h1) return null;
      // .origeu-anchor (content/common.css) resets position/display so the
      // badge isn't caught by whatever layout rule the host page applies
      // to that DOM slot — same anchor-after-title trick sfcc-common.js
      // uses for the other three sites' PDPs.
      const container = h1.closest('.productDetail__title') || h1.parentElement;
      if (!container) return null;
      let anchor = container.querySelector(':scope > .origeu-anchor');
      if (!anchor) {
        anchor = document.createElement('div');
        anchor.className = 'origeu-anchor';
        container.appendChild(anchor);
      }
      return anchor;
    }
  }
});
