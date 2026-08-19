// Verified against real fetched listing markup: the tile body
// (.ct-tile-body) ends with .pwc-tile-buy-section (the "add to cart"
// button), appended last. The default append-at-the-end behavior put the
// badge below that button instead of in the more natural spot right after
// the price — inserting before it fixes that.
OrigEU.init(OrigEUSfcc.buildConfig({
  insertBeforeSelector: '.pwc-tile-buy-section'
}));
