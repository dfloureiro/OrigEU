// auchan.pt's PDP title block sits in a container with a fixed height
// budget — the image row below it starts at a fixed offset regardless of
// how tall the title content is, so the badge overlaps the image unless
// it's overlaid on the image itself instead of inserted after the <h1>
// (see sfcc-common.js's pdpImageOverlaySelector for the full explanation).
// Search-box typeahead dropdown: verified via the site's own
// SearchServices-GetSuggestions XHR endpoint (the normal page fetch never
// runs it). Each suggestion is a `<span class="item">` inside
// `.auc-suggestions__image-items`, wrapping an `<a class="product-name">`
// that also matches the default nameSelectors fallback — but that anchor
// wraps `.suggestion-offers` (the promo pill) too, so the fallback's
// textContent glues the promo text onto the product name. The name needs
// its own selector, `.auc-suggestions__product-name`, to get just the name.
// `.suggestion-offers` is where the site renders its own promo pill ("10%
// DESC. IMEDIATO INCLUÍDO"), so anchoring our badge there puts it next to
// that instead of after the whole clickable row.
OrigEU.init(OrigEUSfcc.buildConfig({
  pdpImageOverlaySelector: '.primary-images',
  suggestionsCardSelector: '.auc-suggestions__image-items .item',
  suggestionsNameSelectors: ['.auc-suggestions__product-name'],
  suggestionsInjectTarget: '.suggestion-offers'
}));
