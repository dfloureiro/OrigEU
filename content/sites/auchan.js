// auchan.pt's PDP title block sits in a container with a fixed height
// budget — the image row below it starts at a fixed offset regardless of
// how tall the title content is, so the badge overlaps the image unless
// it's overlaid on the image itself instead of inserted after the <h1>
// (see sfcc-common.js's pdpImageOverlaySelector for the full explanation).
OrigEU.init(OrigEUSfcc.buildConfig({
  pdpImageOverlaySelector: '.primary-images'
}));
