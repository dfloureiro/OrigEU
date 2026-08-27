// Translates a lib/own-brands.js match — the sole source of the EU-origin
// badge — into the shape the UI (content/common.js) renders.
//
// This used to combine multiple third-party sources and arbitrate
// disagreements between them; both (escolho.eu, buy-european.net) were
// removed after being caught with factual errors, and their useful data
// was migrated into the own database with citations (see git history).
// `euSignals` stays an array of one rather than a bare object so the UI
// code wouldn't need a special case if a second source is ever added back.
function signalFromOwnMatch(match) {
  if (!match) return null;
  return {
    brandId: match.id, // slug — lets the UI offer "suggest a correction" for a known brand (content/common.js), scoped to the exact row instead of proposing a brand-new duplicate
    sourceUrl: match.source || null, // per-brand citation URL, when one was recorded
    status: match.isEu ? 'eu' : 'non-eu',
    countryCode: match.countryCode, // ISO 3166-1 alpha-2 — translated to a label at render time (content/countries.js)
    countries: match.countries || [], // full country list (countryCode above is just the one shown on the badge) — prefills the correction form's countries field
    efta: !match.isEu && Boolean(match.isEfta),
    detail: `Marca listada: ${match.brand}`,
    // Short factual blurb, shown in the badge tooltip when present — kept
    // as separate EN/PT fields through to render time (content/common.js)
    // rather than picked here, so a cached lookup result (up to 30 days,
    // lib/cache.js) doesn't lock in whichever language was current when it
    // was first looked up.
    notesEn: match.notesEn || null,
    notesPt: match.notesPt || null
  };
}

// ownMatch: matchOwnBrand() output from lib/own-brands.js, or null.
export function buildResult({ ownMatch }) {
  const signal = signalFromOwnMatch(ownMatch);
  if (!signal) return null;

  return {
    brands: ownMatch.brand,
    euStatus: signal.status,
    euCountryCode: signal.countryCode,
    euRegion: signal.efta ? 'efta' : null,
    euSignals: [signal]
  };
}
