// compraonline.alcampo.es runs on the Ocado Smart Platform (its
// Content-Security-Policy explicitly allows framing from *.osp.tech) and
// is fully client-rendered — a plain fetch only returns loading skeletons
// (data-test="fop-skeleton"), no real product data — so these selectors
// come from real markup copied out of a live browser's DevTools. Ocado's
// own markup uses clean, stable data-test="..." attributes throughout
// rather than hashed CSS-module classes, which is a nicer foundation than
// most of the sites this project supports.
//
// Listing tile — same component confirmed on both the homepage carousel
// and the real search-results grid:
//   <div class="product-card-container">
//     <div class="header-container">
//       <div class="image-container">
//         <a data-test="fop-product-link" aria-hidden="true" tabindex="-1" href="/products/.../190900">
//           <span class="salt-vc">COLGATE Maximum caries protection...</span>
//         </a>
//         <img data-test="lazy-load-image" alt="...">
//       </div>
//       ...rating badge...
//     </div>
//     <div data-test="fop-body" class="footer-container">
//       <div class="title-container">
//         <a data-test="fop-product-link" aria-hidden="false" tabindex="0" href="/products/.../190900">
//           <h3 data-test="fop-title">COLGATE Maximum caries protection Pasta de dientes ...</h3>
//         </a>
//       </div>
//       ...promotion, size, price, add-to-cart...
//     </div>
//   </div>
// Notice data-test="fop-product-link" appears *twice* — once wrapping just
// an aria-hidden, tabindex="-1" screen-reader label alongside the image
// (a purely decorative/duplicate click target for a11y purposes, not
// containing the image itself, but very likely stretched over the whole
// .image-container via CSS the same way e.leclerc's "stretched link" cards
// were), and once wrapping the real, focusable title. Overlaying the badge
// on .image-container (already position: relative in the site's own CSS)
// like the other grid-tile sites, but with an explicit z-index this time
// from the start rather than waiting for a click/hover bug report, given
// there's already direct evidence of an invisible click layer sharing
// that exact space.
const LISTING_CARD_SELECTOR = '.product-card-container';
const IMAGE_CONTAINER_SELECTOR = '.image-container';

function listingTitleEl(card) {
  return card.querySelector('h3[data-test="fop-title"]');
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
      const imageContainer = card.querySelector(IMAGE_CONTAINER_SELECTOR);
      if (imageContainer) return imageContainer;
      // Fallback if the image container isn't found (site markup
      // changed): land the badge as a sibling of the title's link rather
      // than inside it, so a badge click doesn't also navigate to the PDP.
      const title = listingTitleEl(card);
      const link = title && title.closest('a');
      return (link && link.parentElement) || card;
    }
  },
  product: {
    // PDP: <h1> has no data-test of its own, but its neighboring
    // [data-test="price-container"] is a solid "this is a product page"
    // signal to pair it with.
    isProductPage() {
      return Boolean(document.querySelector('h1') &&
        document.querySelector('[data-test="price-container"]'));
    },
    getProductName() {
      const h1 = document.querySelector('h1');
      return h1 && h1.textContent.replace(/\s+/g, ' ').trim();
    },
    getProductInjectTarget() {
      const h1 = document.querySelector('h1');
      if (!h1) return null;
      // .origeu-anchor (content/common.css) resets position/display so the
      // badge isn't caught by whatever layout rule the host page applies
      // to that DOM slot. Inserted right after the <h1> itself, not
      // appended to its parent, since that parent also holds the rating
      // link, size/price blocks, and the add-to-cart controls below.
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
