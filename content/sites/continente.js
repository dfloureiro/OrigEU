// Verified against real fetched listing markup: the tile body
// (.ct-tile-body) ends with .pwc-tile-buy-section (the "add to cart"
// button), appended last. The default append-at-the-end behavior put the
// badge below that button instead of in the more natural spot right after
// the price — inserting before it fixes that.
// Search-box typeahead dropdown: verified via the site's own
// SearchServices-GetSuggestions XHR endpoint (the normal page fetch never
// runs it) — a completely different template from the listing tile above,
// `.suggestion-product-item[data-pid]` with the name in
// `.suggestion-product-name` rather than any of the stock nameSelectors.
// Injecting into `.suggestion-product-details` (before `.suggestion-price-wrap`,
// its sibling) puts the badge right after the name/unit line instead of
// after the price and "Adicionar" button that follow it.
OrigEU.init(OrigEUSfcc.buildConfig({
  insertBeforeSelector: '.pwc-tile-buy-section',
  suggestionsCardSelector: '.suggestion-product-item',
  suggestionsNameSelectors: ['.suggestion-product-name'],
  suggestionsInjectTarget: '.suggestion-product-details',
  suggestionsInsertBeforeSelector: '.suggestion-price-wrap'
}));
