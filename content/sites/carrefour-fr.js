// carrefour.fr is NOT the same platform as carrefour.es — completely
// different markup, verified separately. It sits behind the same kind of
// Cloudflare bot-management challenge that blocks a plain fetch
// (cf-mitigated: challenge), so these selectors are taken from real markup
// copied out of a live browser's DevTools instead.
//
// Listing tile — the site turns out to ship *several* differently-prefixed
// listing-tile components rather than one shared across every surface (a
// guess that one covered both the carousels and the real search-results
// grid was wrong, and a third, .product-card-mini-reco, showed up later
// too — likely not the last one either). Three verified so far:
//   <article class="... product-card-vertical-grid-new">    <!-- sponsored slot / recommendation carousels -->
//     ...
//     <div class="product-card-vertical-grid-new__right-section">
//       <div class="product-card-vertical-grid-new__infos">
//         <a class="... product-card-vertical-grid-new__title-container ...">
//           <span class="c-link ... c-link--bold"> FEBREZE </span>
//           <p class="... product-card-title__text ...">
//             Désodorisant Spray Pureté de Coton Brume d'air FEBREZE
//           </p>
//         </a>
//         <a ...>...rating...</a>          <!-- sibling of the title link -->
//       </div>
//     </div>
//   </article>
//
//   <article class="product-list-card-plp-grid-new">          <!-- real search-results grid -->
//     ...
//     <div class="product-list-card-plp-grid-new__infos">
//       <a class="... product-list-card-plp-grid-new__title-container ...">
//         <span class="c-link ... c-link--bold"> DODOT </span>
//         <p class="... product-card-title__text ...">
//           Couches Dodot Etapas 4 78 Unités DODOT
//         </p>
//       </a>
//     </div>
//   </article>
//
//   <article class="product-card-mini-reco">                  <!-- small sponsored reco slot -->
//     <div class="product-card-mini-reco__body">
//       <div class="product-card-mini-reco__left-section">...image, size tag...</div>
//       <div class="product-card-mini-reco__infos">...pricing/buy-cta, NOT the title...</div>
//       <a class="c-link product-card-click-wrapper ...">     <!-- sibling of .infos here, not inside it -->
//         <p class="product-card-mini-reco__title product-card-title__text ...">
//           Dentifrice Protection Caries SIGNAL
//         </p>
//       </a>
//     </div>
//   </article>
// Given how much the container around the title link differs between
// shapes — an "__infos" wrapper that holds *only* the title on one, the
// same class name repurposed for pricing/cta on another, no dedicated
// wrapper at all on the third — hardcoding a container selector per shape
// doesn't scale. What's identical across all three: .product-card-title__text
// for the name, and the title always sitting inside a clickable <a>. So
// rather than special-case each shape's container, getInjectTarget below
// finds that <a> generically and uses *its* parent, whatever that happens
// to be named on the shape at hand.
// Every example checked has the brand folded into the title text itself
// too, redundantly with the separate brand <span> (e.g. "...FEBREZE",
// "...DODOT", "...SIGNAL" is the one case where it isn't — the brand span
// wasn't present in that markup at all, "Dentifrice Protection Caries
// SIGNAL" already reads as a full product name) — no brand-folding needed.
// The buy/"Voir" button never shares a fixed-height column with the title
// link's parent in any of the three shapes, so there's no risk of the same
// "button pushed out of view" bug carrefour-es.js hit — no overlay trick
// needed here.
const LISTING_CARD_SELECTOR = '.product-card-vertical-grid-new, .product-list-card-plp-grid-new, .product-card-mini-reco';

function listingTitleEl(card) {
  return card.querySelector('.product-card-title__text');
}

function listingName(card) {
  const el = listingTitleEl(card);
  return el && el.textContent.replace(/\s+/g, ' ').trim();
}

OrigEU.init({
  listing: {
    cardSelector: LISTING_CARD_SELECTOR,
    getName: listingName,
    getInjectTarget(card) {
      const title = listingTitleEl(card);
      // The title text always sits inside a clickable <a> — injecting
      // inside it would also navigate to the PDP on badge click, breaking
      // the "unknown brand" click-to-suggest behavior. Landing the badge
      // as a sibling of that link (in its parent) sidesteps that
      // regardless of which of the site's several listing-tile shapes
      // matched, rather than hardcoding a container selector per shape.
      const link = title && title.closest('a');
      return (link && link.parentElement) || card;
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
