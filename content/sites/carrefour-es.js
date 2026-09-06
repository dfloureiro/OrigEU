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
//
// The site ships (at least) two entirely different listing-tile components
// depending on which page renders them: the .product-card one above (a
// category/browse page) and a completely differently-built one on the
// search-results page — verified from real markup, a different Vue
// micro-frontend judging by its atomic, versioned "x-*" utility classes:
//   <article data-test="search-grid-result" class="x-group/result ...">
//     <button class="... x-absolute ...">...(favourite icon)...</button>
//     <div class="... x-col-span-1 x-col-start-1 ...">
//       <a data-test="result-link" class="x-result-link x-result__picture ...">
//         <div data-test="result-picture" class="x-result-picture ...">
//           <img data-test="result-picture-image" ...>
//         </div>
//       </a>
//     </div>
//     <div class="x-relative x-col-span-2 x-col-start-2 ... x-justify-between">
//       <div class="... x-col-span-2 x-col-start-2 ...">
//         ...price...
//         <a data-test="result-title" class="x-result-link x-order-2 ...">
//           <p class="x-font-bold ...">Dentífrico protección caries Maximum Caries Protection Colgate 50 ml.</p>
//         </a>
//       </div>
//       <div class="x-mt-6 x-max-h-[40px] ...">
//         <button data-test="result-add-to-cart">Añadir</button>
//       </div>
//     </div>
//   </article>
// Same brand-in-title convention as the other tile (e.g. "...Colgate...").
// `data-test` attributes (rather than the versioned "x-*" classes, which
// read like build output and could easily get re-hashed) are the stable
// anchor here.
const SEARCH_CARD_SELECTOR = 'article[data-test="search-grid-result"]';
const LISTING_CARD_SELECTOR = `.product-card, ${SEARCH_CARD_SELECTOR}`;

function listingName(card) {
  if (card.matches(SEARCH_CARD_SELECTOR)) {
    const el = card.querySelector('[data-test="result-title"] p, [data-test="result-title"]');
    return el && el.textContent.replace(/\s+/g, ' ').trim();
  }
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
    //
    // The search-results tile's own picture is wrapped the other way
    // around from .product-card's — [data-test="result-link"] IS the link,
    // wrapping the picture directly, with no separate non-link container to
    // land the badge in — injecting inside it would make the badge (and its
    // "suggest a correction" tooltip) also navigate to the PDP on click.
    // Its *parent* (the picture column) isn't a link and isn't nested in
    // one, but has no stable class of its own — the whole card is built
    // from generic, versioned utility classes — so it's tagged with a
    // marker class here to give content/common.css something stable to
    // overlay onto (see .origeu-overlay-container there), the same overlay
    // reasoning as the .product-card branch above.
    getInjectTarget(card) {
      if (card.matches(SEARCH_CARD_SELECTOR)) {
        const pictureLink = card.querySelector('[data-test="result-link"]');
        const container = (pictureLink && pictureLink.parentElement) || card;
        container.classList.add('origeu-overlay-container');
        return container;
      }
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
