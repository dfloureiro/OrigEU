// carrefour.es sits behind a Cloudflare bot-management challenge ("Attention
// Required!") that blocks a plain fetch the same way intermarche.pt's
// DataDome does, so these selectors are taken from real markup copied out
// of a live browser's DevTools instead (a search-results tile and a
// product page).
//
// Listing tile:
//   <div class="product-card">
//     <div class="product-card__media">
//       <a class="product-card__media-link ..." href="/supermercado/.../R-.../p">
//         <img class="product-card__image" alt="Agua micelar con vitamina C...">
//       </a>
//     </div>
//     <div class="product-card__info-container">
//       <div class="product-card__detail">
//         ...
//         <h2 class="product-card__title">
//           <a class="product-card__title-link ..." href="/supermercado/.../R-.../p">
//             Agua micelar con vitamina C limpia, desmaquilla e ilumina la
//             piel apagada fórmula hipoalergénica Garnier 400 ml.
//           </a>
//         </h2>
//         ...
//       </div>
//       <div class="product-card__footer">
//         ...
//         <div class="product-card__availability">...add-to-cart form/button...</div>
//       </div>
//     </div>
//   </div>
// The title already has the brand folded into it by the site itself (e.g.
// "...Garnier...", "...Oral-B..." on the PDP below) — no separate brand
// lookup needed.
const LISTING_CARD_SELECTOR = '.product-card';

function listingName(card) {
  const el = card.querySelector('.product-card__title');
  return el && el.textContent.replace(/\s+/g, ' ').trim();
}

OrigEU.init({
  listing: {
    cardSelector: LISTING_CARD_SELECTOR,
    getName: listingName,
    // .product-card__footer (holding the add-to-cart button) is a *sibling*
    // of .product-card__detail (holding the title), both inside
    // .product-card__info-container — grid cells like this tend to have a
    // fixed height with that footer pinned to the bottom (the exact bug
    // already hit on mercadona.es's identically-shaped cards: see
    // content/sites/mercadona.js and content/common.css), so inserting the
    // badge into .product-card__detail's own flow risks pushing the button
    // down past the card's own boundary before anyone's even reported it
    // here. Injecting into .product-card__media instead (as an absolute
    // overlay, see content/common.css) sidesteps that budget entirely, the
    // same fix pingodoce.pt/mercadona.es use. .product-card__media itself
    // isn't a link — only the <a> nested inside it is — so the badge lands
    // as that anchor's sibling, not inside it, keeping the "unknown brand"
    // click-to-suggest behavior intact.
    getInjectTarget(card) {
      return card.querySelector('.product-card__media') || card;
    }
  },
  product: {
    // PDP, verified structure:
    //   <div class="pdp-view__left">
    //     <div class="product-header">
    //       <h1 class="product-header__name">
    //         Dentrifico Advanced prevención del sarro Oral-B pack 3 unidades 75 ml.
    //       </h1>
    //       <div class="product-header__rating">...</div>
    //     </div>
    //     <div class="product-header__features">...</div>
    //   </div>
    // No bot-protection dialog/modal here (unlike mercadona.es) — the
    // listing tile's link points at a real page path (.../p), so this is a
    // normal navigation, just possibly client-side routed.
    isProductPage() {
      return Boolean(document.querySelector('.pdp-view__left') &&
        document.querySelector('.product-header__name'));
    },
    getProductName() {
      const h1 = document.querySelector('.product-header__name');
      return h1 && h1.textContent.replace(/\s+/g, ' ').trim();
    },
    getProductInjectTarget() {
      const h1 = document.querySelector('.product-header__name');
      if (!h1) return null;
      // .origeu-anchor (content/common.css) resets position/display so the
      // badge isn't caught by whatever layout rule the host page applies to
      // that DOM slot — same anchor-after-title trick the other standalone
      // adapters use. Unlike the listing card above, there's no evidence
      // here of a fixed-height container squeezing this title block, so
      // this uses the plain after-title placement rather than an overlay.
      const container = h1.closest('.product-header') || h1.parentElement;
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
