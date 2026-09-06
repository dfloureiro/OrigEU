// rewe.de/shop sits behind the same kind of Cloudflare bot-management
// challenge that blocks a plain fetch (cf-mitigated: challenge), so these
// selectors are taken from real markup copied out of a live browser's
// DevTools instead.
//
// Listing tile — the same component shape shows up in at least two
// places, verified from real markup in both: the homepage/search-results
// grid (data-theme="tile-responsive" on the outer wrapper) and the
// search-suggestions typeahead flyout (data-theme="line-item-responsive").
// Structurally identical, but each theme variant renders its own CSS
// Modules hash suffix per part — e.g. the grid's
// ".a-pt__product-tile__container_mbaovz" vs the flyout's
// ".a-pt__product-tile__container_-0VeKe" for the exact same role. Rather
// than hardcode one variant's hashes (which would silently miss the
// other, and break again on the next hash rotation), every selector below
// matches on the stable "a-pt__product-tile__<part>_" prefix via a
// substring attribute selector, so it's agnostic to the hash and to
// however many more theme variants exist:
//   <section class="a-pt__product-tile__container_<hash>">
//     <a class="... a-pt__product-tile__link_<hash>" href="/shop/p/.../8425181">
//       <h4 class="a-pt__product-tile__title_<hash>">Rewe Beste Wahl Italienisches Natives Olivenöl 500ml</h4>
//       <div class="a-pt__product-tile__grammage_<hash> ...">500ml (1 l = 18,58 €)</div>
//     </a>
//     <div class="a-pt__product-tile__image-area_<hash>">...picture...</div>
//     <div class="a-pt__product-tile__top-badges-area_<hash>">...</div>
//     <div class="a-pt__product-tile__price-area_<hash>">...</div>
//     <div class="a-pt__product-tile__actions-area_<hash>">...add-to-cart...</div>
//     <meso-data ...>
//       <div class="a-pt__product-tile__favorite-button_<hash> ...">...heart icon...</div>
//     </meso-data>
//   </section>
// The title always sits inside a clickable <a>, so — same reasoning as
// carrefour-fr.js — getInjectTarget's fallback path finds that link
// generically via .closest('a') and uses its parent (the <section>)
// rather than injecting inside the link itself. The primary path overlays
// the badge on .image-area instead: this is a uniform grid tile, the same
// shape that pushed the add-to-cart button out of view on mercadona.es and
// carrefour.es — so rather than wait for that bug report again, the badge
// is placed as an absolutely-positioned overlay from the start (content/
// common.css), left-aligned to stay clear of the site's own
// favourites-heart button, which sits top-right of the tile.
const LISTING_CARD_SELECTOR = '[class*="a-pt__product-tile__container_"]';
const IMAGE_AREA_SELECTOR = '[class*="a-pt__product-tile__image-area_"]';

function listingTitleEl(card) {
  return card.querySelector('[class*="a-pt__product-tile__title_"]');
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
      // .a-pt__product-tile__image-area_4ZJkKE gets position:relative in
      // content/common.css, which overlays the badge (absolute) on top of
      // it instead of leaving it in flow — same trick carrefour-es.js
      // uses on .product-card__media, positioned top-left there too.
      const imageArea = card.querySelector(IMAGE_AREA_SELECTOR);
      if (imageArea) return imageArea;
      // Fallback if the image area isn't found (site markup changed):
      // land the badge as a sibling of the title's link rather than
      // inside it, so a badge click doesn't also navigate to the PDP.
      const title = listingTitleEl(card);
      const link = title && title.closest('a');
      return (link && link.parentElement) || card;
    }
  },
  product: {
    // PDP: <h1 class="pdpr-Title"> sits directly inside
    // #pdpr-ProductInformation, which also holds the regulated name,
    // brand link, badges bar, and the full price/add-to-cart block below
    // it — appending to the end of that container would land the badge
    // way below the title, so the anchor goes right after the <h1>
    // itself instead (same approach as sfcc-common.js's plain PDP case).
    isProductPage() {
      return Boolean(document.querySelector('#pdpr-ProductInformation') &&
        document.querySelector('.pdpr-Title'));
    },
    getProductName() {
      const h1 = document.querySelector('.pdpr-Title');
      return h1 && h1.textContent.replace(/\s+/g, ' ').trim();
    },
    getProductInjectTarget() {
      const h1 = document.querySelector('.pdpr-Title');
      if (!h1) return null;
      let anchor = h1.parentElement && h1.parentElement.querySelector(':scope > .origeu-anchor');
      if (!anchor) {
        anchor = document.createElement('div');
        anchor.className = 'origeu-anchor';
        h1.insertAdjacentElement('afterend', anchor);
      }
      return anchor;
    }
  }
});
