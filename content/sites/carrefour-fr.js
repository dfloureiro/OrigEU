// carrefour.fr is NOT the same platform as carrefour.es — completely
// different markup, verified separately. It sits behind the same kind of
// Cloudflare bot-management challenge that blocks a plain fetch
// (cf-mitigated: challenge), so these selectors are taken from real markup
// copied out of a live browser's DevTools instead.
//
// Listing tile — the same component (.product-card-vertical-grid-new) is
// reused for the sponsored slot at the top of results, the "Vous pourriez
// aussi aimer"/"Nos clients ont également acheté" carousels, and — per the
// "product-list-card-plp-grid-new__per-unit-label" class nested inside its
// price block — the actual search-results grid too:
//   <article class="... product-card-vertical-grid-new">
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
// Every example checked has the brand folded into the title text itself
// too, redundantly with the separate brand <span> (e.g. "...FEBREZE",
// "...CARREFOUR ESSENTIAL") — no brand-folding needed, unlike
// pingodoce.js/intermarche.js. The buy button lives inside .body, in a
// completely separate branch from .right-section (the title) — unlike
// carrefour-es.js's two tile shapes, there's no shared fixed-height column
// between them here, so no overlay trick is needed to avoid pushing
// anything out of view.
const LISTING_CARD_SELECTOR = '.product-card-vertical-grid-new';

function listingName(card) {
  const el = card.querySelector('.product-card-title__text');
  return el && el.textContent.replace(/\s+/g, ' ').trim();
}

OrigEU.init({
  listing: {
    cardSelector: LISTING_CARD_SELECTOR,
    getName: listingName,
    // .infos holds the title <a> and a separate reviews <a> as siblings —
    // appending here lands the badge outside both anchors (inside either
    // one would also navigate to the PDP on badge click, breaking the
    // "unknown brand" click-to-suggest behavior).
    getInjectTarget(card) {
      return card.querySelector('.product-card-vertical-grid-new__infos') || card;
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
