// Best-effort generic adapter for pingodoce.pt.
//
// Unlike continente.pt and auchan.pt, this site's platform could not be
// fingerprinted automatically (it returns 403 to non-browser requests), so
// these selectors are educated guesses based on common patterns rather than
// a confirmed DOM structure. If badges don't appear:
//   1. Open a search results page and a product page on pingodoce.pt
//   2. Inspect a product card / the product title in DevTools
//   3. Update CARD_SELECTORS / NAME_SELECTORS / PDP_NAME_SELECTORS below
//      to match the real class names or data-testid attributes.
(function () {
  const CARD_SELECTORS = [
    '[data-testid*="product-card"]',
    '[data-testid*="product-tile"]',
    '.product-card',
    '.product-tile',
    'article[class*="product"]',
    'li[class*="product"]'
  ].join(', ');

  const NAME_SELECTORS = [
    '[data-testid*="product-name"]',
    '[data-testid*="title"]',
    '.product-name',
    '.product-title',
    'h2', 'h3'
  ];

  const PDP_NAME_SELECTORS = [
    'h1[data-testid*="product-name"]',
    'h1.product-name',
    '.product-detail h1',
    'h1'
  ];

  function textOf(el) {
    return el && el.textContent ? el.textContent.trim() : '';
  }

  function firstText(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && textOf(el)) return textOf(el);
    }
    return null;
  }

  BuyEU.init({
    listing: {
      cardSelector: CARD_SELECTORS,
      getIdentity(card) {
        return { barcode: BuyEU.findJsonLdBarcode(card), name: firstText(card, NAME_SELECTORS) };
      },
      getInjectTarget(card) {
        return card;
      }
    },
    product: {
      isProductPage() {
        return Boolean(BuyEU.findJsonLdBarcode(document)) ||
          PDP_NAME_SELECTORS.some((sel) => document.querySelector(sel));
      },
      getProductIdentity() {
        return {
          barcode: BuyEU.findJsonLdBarcode(document),
          name: firstText(document, PDP_NAME_SELECTORS)
        };
      },
      getProductInjectTarget() {
        let h1 = null;
        for (const sel of PDP_NAME_SELECTORS) {
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
  });
})();
