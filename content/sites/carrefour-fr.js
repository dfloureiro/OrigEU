// carrefour.fr is NOT the same platform as carrefour.es — completely
// different markup, verified separately. It sits behind the same kind of
// Cloudflare bot-management challenge that blocks a plain fetch
// (cf-mitigated: challenge), so these selectors are taken from real markup
// copied out of a live browser's DevTools instead.
//
// Listing tile — the site actually ships *two* differently-prefixed but
// near-identically-shaped components: .product-card-vertical-grid-new
// (verified first, from the sponsored slot at the top of results and the
// "Vous pourriez aussi aimer"/"Nos clients ont également acheté"
// carousels — a guess that this same class also covered the real
// search-results grid turned out to be wrong) and
// .product-list-card-plp-grid-new (the real search-results grid, verified
// separately once that guess was caught):
//   <article class="... product-card-vertical-grid-new">    <!-- carousels/sponsored -->
//     <div class="product-card-vertical-grid-new__body">
//       <div class="product-card-vertical-grid-new__image">...</div>
//       <div class="product-card-vertical-grid-new__container">
//         ...price...
//         <div class="product-card-vertical-grid-new__product-card-cta">
//           ...buy button...
//         </div>
//       </div>
//     </div>
//     <div class="product-card-vertical-grid-new__meta">...size tag...</div>
//     <div class="product-card-vertical-grid-new__right-section">
//       <div class="product-card-vertical-grid-new__infos">
//         <a class="... product-card-vertical-grid-new__title-container ...">
//           <span class="c-link ... c-link--bold"> FEBREZE </span>
//           <p class="... product-card-title__text ...">
//             Désodorisant Spray Pureté de Coton Brume d'air FEBREZE
//           </p>
//         </a>
//         <a ...>...rating...</a>
//       </div>
//     </div>
//   </article>
//
//   <article class="product-list-card-plp-grid-new">          <!-- real search grid -->
//     <div class="product-list-card-plp-grid-new__body">
//       <div class="product-list-card-plp-grid-new__image">...</div>
//       <div class="product-list-card-plp-grid-new__right-section">
//         <div class="product-list-card-plp-grid-new__infos">
//           <a class="... product-list-card-plp-grid-new__title-container ...">
//             <span class="c-link ... c-link--bold"> DODOT </span>
//             <p class="... product-card-title__text ...">
//               Couches Dodot Etapas 4 78 Unités DODOT
//             </p>
//           </a>
//         </div>
//         ...price, seller info, buy/"Voir" cta...
//       </div>
//     </div>
//   </article>
// The inner pieces that matter here are identical between the two —
// .product-card-title__text for the name, an "__infos" sub-container
// holding just the title (and, on the carousel variant, a reviews link) —
// only the outer BEM prefix and the exact nesting of .right-section
// differ, so a single name getter and a two-selector-list inject target
// cover both without needing to branch on which shape matched.
// Every example checked has the brand folded into the title text itself
// too, redundantly with the separate brand <span> (e.g. "...FEBREZE",
// "...DODOT") — no brand-folding needed, unlike pingodoce.js/intermarche.js.
// The buy/"Voir" button lives outside .infos in both shapes, so there's no
// shared fixed-height column risking the same "button pushed out of view"
// bug carrefour-es.js hit — no overlay trick needed here.
const LISTING_CARD_SELECTOR = '.product-card-vertical-grid-new, .product-list-card-plp-grid-new';
const INFOS_SELECTOR = '.product-card-vertical-grid-new__infos, .product-list-card-plp-grid-new__infos';

function listingName(card) {
  const el = card.querySelector('.product-card-title__text');
  return el && el.textContent.replace(/\s+/g, ' ').trim();
}

OrigEU.init({
  listing: {
    cardSelector: LISTING_CARD_SELECTOR,
    getName: listingName,
    // .infos holds the title <a> (and, on the carousel variant, a separate
    // reviews <a>) — appending here lands the badge outside those anchors
    // (inside one would also navigate to the PDP on badge click, breaking
    // the "unknown brand" click-to-suggest behavior).
    getInjectTarget(card) {
      return card.querySelector(INFOS_SELECTOR) || card;
    }
  },
  product: {
    // PDP: the <h1> is rendered *twice* — once in a mobile-only block, once
    // in a desktop-only one, toggled by CSS media query rather than by JS:
    //   <div id="product-title-mobile" class="... main-details__title--mobile">
    //     <div><h1 class="product-title__title ...">Désodorisant Spray Pureté de Coton Brume d'air FEBREZE</h1></div>
    //     ...
    //   </div>
    //   ...
    //   <div id="product-title-desktop" class="... main-details__title--desktop">
    //     <div><h1 class="product-title__title ...">Désodorisant Spray Pureté de Coton Brume d'air FEBREZE</h1></div>
    //     ...
    //   </div>
    // Picking the first match in DOM order would badge whichever one
    // happens to be hidden at the current viewport width half the time —
    // visibleTitleH1() checks offsetParent (null when an ancestor is
    // display:none) to always find the one actually on screen, re-checked
    // on every scan so a window resize across the breakpoint is picked up
    // too.
    isProductPage() {
      return Boolean(document.querySelector('.product-details') &&
        document.querySelector('.product-title__title'));
    },
    getProductName() {
      const h1 = visibleTitleH1();
      return h1 && h1.textContent.replace(/\s+/g, ' ').trim();
    },
    getProductInjectTarget() {
      const h1 = visibleTitleH1();
      if (!h1) return null;
      // .origeu-anchor (content/common.css) resets position/display so the
      // badge isn't caught by whatever layout rule the host page applies to
      // that DOM slot — same anchor-after-title trick the other standalone
      // adapters use. No sign here of a fixed-height container squeezing
      // this title block, so this uses the plain after-title placement
      // rather than an overlay.
      const container = h1.parentElement;
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

function visibleTitleH1() {
  const candidates = document.querySelectorAll('.product-title__title');
  for (const h1 of candidates) {
    if (h1.offsetParent !== null) return h1;
  }
  // Fallback for the very first paint, before layout has settled either way.
  return candidates[0] || null;
}
