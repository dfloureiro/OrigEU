// Shared adapter for storefronts built on Salesforce Commerce Cloud (Demandware)
// using the standard SFRA markup conventions. Both continente.pt and auchan.pt
// were confirmed to run on this platform (demandware.static asset paths).
//
// SFRA conventions relied on here:
//  - Listing tiles: elements carrying a `data-pid` attribute (product id),
//    usually with class `product-tile`, containing a `.tile-body` block.
//  - PDP: a `.product-detail` container with `data-pid`, and an
//    `h1.product-name` (or `.product-name`) heading.
//
// These are the standard SFRA class names, but individual storefronts
// sometimes rename/restyle them. If badges don't show up on a given site,
// inspect the tile/PDP markup in DevTools and adjust the selectors below
// (or pass overrides from the per-site file).
(function () {
  function textOf(el) {
    return el && el.textContent ? el.textContent.trim() : '';
  }

  function nearestPid(el) {
    const withPid = el.matches('[data-pid]') ? el : el.querySelector('[data-pid]');
    const pid = withPid && withPid.getAttribute('data-pid');
    return BuyEU.looksLikeBarcode(pid) ? pid.trim() : null;
  }

  function buildConfig(overrides = {}) {
    const cardSelector = overrides.cardSelector || '.product-tile, [data-pid].product, .product-grid-tile';
    const nameSelectors = overrides.nameSelectors ||
      ['.pdp-link a', '.pdp-link', '.product-name a', '.product-name', 'a.link', 'h2', 'h3'];
    const pdpNameSelectors = overrides.pdpNameSelectors ||
      ['.product-detail h1.product-name', 'h1.product-name', '.product-detail h1', 'h1'];
    const pdpContainerSelector = overrides.pdpContainerSelector || '.product-detail';

    return {
      listing: {
        cardSelector,
        getIdentity(card) {
          const barcode = nearestPid(card);
          let name = null;
          for (const sel of nameSelectors) {
            const el = card.querySelector(sel);
            if (el && textOf(el)) { name = textOf(el); break; }
          }
          return { barcode, name };
        },
        getInjectTarget(card) {
          return card.querySelector('.tile-body') || card;
        }
      },
      product: {
        isProductPage() {
          return Boolean(document.querySelector(pdpContainerSelector) &&
            pdpNameSelectors.some((sel) => document.querySelector(sel)));
        },
        getProductIdentity() {
          const jsonLdBarcode = BuyEU.findJsonLdBarcode(document);
          const container = document.querySelector(pdpContainerSelector);
          const pidBarcode = container ? nearestPid(container) : null;
          const barcode = jsonLdBarcode || pidBarcode;
          let name = null;
          for (const sel of pdpNameSelectors) {
            const el = document.querySelector(sel);
            if (el && textOf(el)) { name = textOf(el); break; }
          }
          return { barcode, name };
        },
        getProductInjectTarget() {
          let h1 = null;
          for (const sel of pdpNameSelectors) {
            h1 = document.querySelector(sel);
            if (h1) break;
          }
          if (!h1) return null;
          let anchor = h1.parentElement && h1.parentElement.querySelector(':scope > .buyeu-anchor');
          if (!anchor) {
            anchor = document.createElement('div');
            anchor.className = 'buyeu-anchor';
            h1.insertAdjacentElement('afterend', anchor);
          }
          return anchor;
        }
      }
    };
  }

  window.BuyEUSfcc = { buildConfig };
})();
