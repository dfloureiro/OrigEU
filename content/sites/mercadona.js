// tienda.mercadona.es is a client-rendered React SPA — the plain server
// response is an empty `<div id="root"></div>` shell, so these selectors
// couldn't be verified by fetching the page directly (same blocker as
// intermarche.pt's DataDome protection, just for a different reason).
// They're taken from real markup copied out of a live browser's DevTools
// instead (a search-results tile and an open product-detail modal).
//
// Listing tile, and also the "Productos relacionados" cross-sell carousel
// inside the product-detail modal (identical markup, see below):
//   <div data-testid="product-cell" class="product-cell ...">
//     <button class="product-cell__content-link" data-testid="open-product-detail">
//       ...
//       <div class="product-cell__info">
//         <h4 class="..." data-testid="product-cell-name">Dentífrico Triple Acción Colgate menta intensa</h4>
//         ...
//       </div>
//     </button>
//     <div class="product-quantity-button ...">...add/remove-from-cart controls...</div>
//   </div>
// The name already has the brand folded into it by the site itself (e.g.
// "...Colgate...", "...Sensodyne...", "...Deliplus...") — no separate
// brand lookup needed, unlike pingodoce.js/intermarche.js/auchan-fr.js.
const LISTING_CARD_SELECTOR = '[data-testid="product-cell"]';

function listingName(card) {
  const el = card.querySelector('[data-testid="product-cell-name"]');
  return el && el.textContent.trim();
}

OrigEU.init({
  listing: {
    cardSelector: LISTING_CARD_SELECTOR,
    getName: listingName,
    // The add/remove-from-cart controls are a *sibling* of the name-carrying
    // <button>, not nested in it — inject into the card itself, positioned
    // before that sibling, so the badge lands outside the button (a badge
    // inside it would also open the product-detail modal on click, breaking
    // its own "unknown brand" click-to-suggest behavior). content/common.css
    // then makes the badge an absolute-positioned overlay on the card
    // ([data-testid="product-cell"] > .origeu-badges) rather than flow
    // content — the grid cells have a fixed height with the cart controls
    // pinned to the bottom, so leaving the badge in normal flow pushed them
    // down past the cell's own boundary.
    getInjectTarget(card) {
      return card;
    },
    getInjectBefore(card, target) {
      return target.querySelector('.product-quantity-button');
    }
  },
  product: {
    // There is no separate PDP URL here — clicking a product-cell opens an
    // in-page modal dialog over the still-visible search results:
    //   <div class="modal-content" role="dialog" ...>
    //     <div class="private-product-detail" data-testid="private-product-detail">
    //       ...
    //       <div data-testid="private-product-detail-info">
    //         <div>
    //           <h1 class="title2-b private-product-detail__description" tabindex="0">
    //             Dentífrico Triple Acción Colgate menta intensa
    //           </h1>
    //           <div class="product-format ...">...</div>
    //           <div class="product-price">...</div>
    //         </div>
    //         ...
    //       </div>
    //     </div>
    //   </div>
    // (There's a second, `aria-hidden="true"` <h1> with the same text in a
    // sticky mini-header above the modal's scroll area — skipped here since
    // the site's own accessibility tree already treats it as decorative.)
    // This needs no special "did the URL change" handling: content/common.js
    // re-runs every scan on any DOM mutation, and the modal opening/closing
    // is itself one, so isProductPage() just checks whether it's currently
    // in the document.
    isProductPage() {
      return Boolean(document.querySelector('[data-testid="private-product-detail"]') &&
        document.querySelector('.private-product-detail__description'));
    },
    getProductName() {
      const h1 = document.querySelector('.private-product-detail__description');
      return h1 && h1.textContent.trim();
    },
    getProductInjectTarget() {
      const h1 = document.querySelector('.private-product-detail__description');
      if (!h1) return null;
      // The modal's right-hand column pins "Añadir al carro" to the bottom
      // of a fixed-height flex column (matched to the image gallery's
      // height on the left) — inserting the badge after the <h1> pushed
      // that button down past the column's own boundary, hiding it
      // entirely. Overlaying it on the product image instead (the same fix
      // sfcc-common.js uses for auchan.pt's PDP, via .origeu-anchor--overlay
      // in content/common.css) sidesteps that fixed height budget rather
      // than trying to fit inside it.
      const imageContainer = document.querySelector('.private-product-detail__left');
      if (imageContainer) {
        let anchor = imageContainer.querySelector(':scope > .origeu-anchor');
        if (!anchor) {
          anchor = document.createElement('div');
          anchor.className = 'origeu-anchor origeu-anchor--overlay';
          imageContainer.insertAdjacentElement('afterbegin', anchor);
        }
        return anchor;
      }
      // Fall through to the after-<h1> strategy if the image container
      // isn't found (e.g. site markup changed).
      const container = h1.parentElement;
      if (!container) return null;
      let anchor = container.querySelector(':scope > .origeu-anchor');
      if (!anchor) {
        anchor = document.createElement('div');
        anchor.className = 'origeu-anchor';
        container.insertBefore(anchor, h1.nextSibling);
      }
      return anchor;
    }
  }
});
