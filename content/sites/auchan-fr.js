// auchan.fr is NOT the same platform as auchan.pt (Salesforce Commerce
// Cloud, via sfcc-common.js) — it's a custom server-rendered platform
// (server header "dodo"), so this is a standalone config, like
// intermarche.js, rather than another sfcc-common.js override. Unlike
// intermarche.pt, this site has no bot-protection blocking a plain fetch,
// so the selectors below were verified directly against the site's own
// server-rendered HTML (a category page, a search-results page, and a
// product page) rather than copied out of a browser's DevTools.
//
// Listing tile — category and search-results pages render the identical
// shape:
//   <article class="product-thumbnail list__item ..." data-id="...">
//     <div class="product-thumbnail__content-wrapper">
//       <a class="product-thumbnail__details-wrapper productThumbnailLink ..."
//          href="/.../pr-C1752896">
//         ...
//         <div class="product-thumbnail__details">
//           <p class="product-thumbnail__description" itemprop="name description">
//             <strong itemprop="brand">ALSACE LAIT</strong>
//             Lait frais demi-écrémé pasteurisé
//           </p>
//           ...
//         </div>
//       </a>
//       <footer class="product-thumbnail__footer">...prices/add-to-cart...</footer>
//     </div>
//   </article>
// `.product-thumbnail__description`'s textContent already folds the brand
// (leading <strong>) and the product name together — same reason
// pingodoce.js/intermarche.js do this by hand for their own sites: a brand
// that never appears in the name text can never word-match.
const LISTING_CARD_SELECTOR = '.product-thumbnail[data-id]';

function listingName(card) {
  const el = card.querySelector('.product-thumbnail__description');
  return el && el.textContent.replace(/\s+/g, ' ').trim();
}

function withBrand(name, brandText) {
  const brand = brandText && brandText.trim();
  return brand ? `${brand} ${name || ''}`.replace(/\s+/g, ' ').trim() : name;
}

OrigEU.init({
  listing: {
    cardSelector: LISTING_CARD_SELECTOR,
    getName: listingName,
    // The price/add-to-cart footer is a *sibling* of the name-carrying <a>,
    // both inside `.product-thumbnail__content-wrapper` — inject there,
    // positioned before the footer, so the badge lands outside the anchor
    // (a badge inside the anchor would also navigate to the PDP on click,
    // breaking its own "unknown brand" click-to-suggest behavior).
    getInjectTarget(card) {
      return card.querySelector('.product-thumbnail__content-wrapper') || card;
    },
    getInjectBefore(card, target) {
      return target.querySelector('.product-thumbnail__footer');
    }
  },
  product: {
    // PDP, verified structure:
    //   <div class="offer-selector productOfferSelector">
    //     ...
    //     <div class="offer-selector__name--large">
    //       <a href="/recherche/?text=ALSACE LAIT">
    //         <bold class="offer-selector__brand">ALSACE LAIT</bold>
    //       </a>
    //       <h1>Lait frais demi-écrémé pasteurisé</h1>
    //     </div>
    //     ...
    //   </div>
    // Brand is a separate element here — no PDP equivalent of the listing
    // tile's pre-folded description text — so it's folded in by hand, same
    // as the listing.
    isProductPage() {
      return Boolean(document.querySelector('.offer-selector.productOfferSelector') &&
        document.querySelector('.offer-selector__name--large h1'));
    },
    getProductName() {
      const h1 = document.querySelector('.offer-selector__name--large h1');
      const brandEl = document.querySelector('.offer-selector__brand');
      return withBrand(h1 && h1.textContent.trim(), brandEl && brandEl.textContent);
    },
    getProductInjectTarget() {
      const h1 = document.querySelector('.offer-selector__name--large h1');
      if (!h1) return null;
      // .origeu-anchor (content/common.css) resets position/display so the
      // badge isn't caught by whatever layout rule the host page applies
      // to that DOM slot — same anchor-after-title trick intermarche.js
      // and sfcc-common.js use for their own PDPs.
      const container = h1.closest('.offer-selector__name--large');
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
