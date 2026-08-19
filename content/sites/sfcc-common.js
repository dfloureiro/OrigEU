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

  function buildConfig(overrides = {}) {
    const cardSelector = overrides.cardSelector || '.product-tile, [data-pid].product, .product-grid-tile';
    const nameSelectors = overrides.nameSelectors ||
      ['.pdp-link a', '.pdp-link', '.product-name a', '.product-name', 'a.link', 'h2', 'h3'];
    // continente.pt's own SFCC customization renames the SFRA `.tile-body`
    // class to `.ct-tile-body` — kept as a fallback alongside the generic
    // name (not a replacement) so a site that does use the stock SFRA class
    // still works.
    const tileBodySelector = overrides.tileBodySelector || '.tile-body, .ct-tile-body';
    // Optional: a selector for an element the badge should be inserted
    // *before*, within the inject target — e.g. continente.pt's "add to
    // cart" button sits last in the tile body, so appending (the default)
    // puts the badge below it instead of in the more natural spot right
    // after the price. null means "append at the end", same as before.
    const insertBeforeSelector = overrides.insertBeforeSelector || null;
    const pdpNameSelectors = overrides.pdpNameSelectors ||
      ['.product-detail h1.product-name', 'h1.product-name', '.product-detail h1', 'h1'];
    const pdpContainerSelector = overrides.pdpContainerSelector || '.product-detail';
    // Optional: overlay the badge on the product image instead of inserting
    // it after the <h1> — auchan.pt's title block sits in a container with
    // a fixed height budget (the image row below starts at a fixed offset
    // regardless of how tall the title block's content actually is), so our
    // full-size PDP badge always overflowed into the image. Anchoring it as
    // an absolutely-positioned overlay on the image sidesteps that budget
    // entirely, the same fix already used for pingodoce's listing tiles
    // (see .product-tile-image in content/common.css).
    const pdpImageOverlaySelector = overrides.pdpImageOverlaySelector || null;

    return {
      listing: {
        cardSelector,
        getName(card) {
          for (const sel of nameSelectors) {
            const el = card.querySelector(sel);
            if (el && textOf(el)) return textOf(el);
          }
          return null;
        },
        getInjectTarget(card) {
          return card.querySelector(tileBodySelector) || card;
        },
        getInjectBefore(card, target) {
          if (!insertBeforeSelector) return null;
          return target.querySelector(insertBeforeSelector) || null;
        }
      },
      product: {
        isProductPage() {
          return Boolean(document.querySelector(pdpContainerSelector) &&
            pdpNameSelectors.some((sel) => document.querySelector(sel)));
        },
        getProductName() {
          for (const sel of pdpNameSelectors) {
            const el = document.querySelector(sel);
            if (el && textOf(el)) return textOf(el);
          }
          return null;
        },
        getProductInjectTarget() {
          if (pdpImageOverlaySelector) {
            const imageContainer = document.querySelector(pdpImageOverlaySelector);
            if (imageContainer) {
              let anchor = imageContainer.querySelector(':scope > .origeu-anchor');
              if (!anchor) {
                anchor = document.createElement('div');
                anchor.className = 'origeu-anchor origeu-anchor--overlay';
                imageContainer.insertAdjacentElement('afterbegin', anchor);
              }
              return anchor;
            }
            // Fall through to the after-<h1> strategy if the image
            // container isn't found (e.g. site markup changed).
          }
          let h1 = null;
          for (const sel of pdpNameSelectors) {
            h1 = document.querySelector(sel);
            if (h1) break;
          }
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
    };
  }

  window.OrigEUSfcc = { buildConfig };
})();
