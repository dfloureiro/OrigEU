// The user's own, self-hosted brand database (Cloudflare Workers + D1 —
// see backend/) — the sole source of the EU-origin badge. Built to avoid
// depending on third-party sources after both previously-used ones
// (escolho.eu, buy-european.net) were found to contain factual errors and
// were removed entirely once their useful data was migrated in with
// citations (see git history).
import { normalizeText, findWordMatch } from './text-match.js';
import { loadDataset } from './remote-dataset.js';
import { getEuStatusIndex, resetEuStatusIndex, euStatusFor } from './eu-status.js';
import { BACKEND_URL } from './config.js';

// BACKEND_URL comes from lib/config.js (gitignored, not committed — copy
// lib/config.example.js to create it) after following backend/README.md's
// setup steps. Without it pointing at a real deployment, the badge shows
// "unknown" for everything rather than failing loudly — see
// lib/remote-dataset.js's fallback chain.
const REMOTE_URL = `${BACKEND_URL}/api/brands`;
// Same public Worker's brand-suggestion endpoint (backend/api) — writes
// into a separate pending_brands queue only, never the live brand list
// directly. Used by the extension's click-to-suggest form for "unknown"
// badges (content/common.js -> background/background.js -> here), kept in
// the background worker rather than fetched from the content script so a
// strict page CSP on a supermarket site can't block the request the way it
// could for a content-script-initiated fetch().
const SUGGESTIONS_URL = `${BACKEND_URL}/api/suggestions`;
const CACHE_KEY = 'origeu_own_brands_v1';
// This database is actively edited via the backoffice, so too long a TTL
// means "I just added a brand" doesn't show up for a while — but the
// popup's "clear cache" button (background.js's ORIGEU_CLEAR_CACHE) already
// covers that on demand, so this just needs to bound background refetch
// volume against the Workers free-tier request quota, not guarantee
// near-instant propagation.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const BUNDLED_PATH = 'data/own-brands.json';

function buildIndex(data, euStatusIndex) {
  const index = new Map();
  for (const entry of data.brands || []) {
    const countries = entry.countries || []; // ISO 3166-1 alpha-2 codes, e.g. ["DE"]
    const euCode = countries.find((c) => euStatusFor(euStatusIndex, c) === 'eu');
    const eftaCode = countries.find((c) => euStatusFor(euStatusIndex, c) === 'efta');
    const value = {
      brand: entry.name,
      countries,
      isEu: Boolean(euCode),
      isEfta: Boolean(eftaCode),
      // The one code to show on the badge — the labeled translation
      // (content/countries.js) happens at render time, not here, so this
      // stays language-agnostic.
      countryCode: euCode || eftaCode || countries[0] || null,
      source: entry.source || null, // citation URL, shown clickable in the badge tooltip when present
      notesEn: entry.notesEn || null, // short factual blurb, shown in the badge tooltip when present
      notesPt: entry.notesPt || null
    };

    const nameKey = normalizeText(entry.name);
    if (nameKey) index.set(nameKey, value);
    for (const alias of entry.aliases || []) {
      const aliasKey = normalizeText(alias);
      if (aliasKey && !index.has(aliasKey)) index.set(aliasKey, value);
    }
  }
  return index;
}

let indexPromise = null;

export function getOwnIndex() {
  if (!indexPromise) {
    indexPromise = Promise.all([
      loadDataset({
        remoteUrl: REMOTE_URL,
        cacheKey: CACHE_KEY,
        cacheTtlMs: CACHE_TTL_MS,
        bundledPath: BUNDLED_PATH
      }),
      getEuStatusIndex()
    ]).then(([data, euStatusIndex]) => buildIndex(data, euStatusIndex));
  }
  return indexPromise;
}

export function resetOwnIndex() {
  indexPromise = null;
  resetEuStatusIndex();
}

export function matchOwnBrand(index, text) {
  return findWordMatch(index, text);
}

export async function submitSuggestion(payload) {
  const res = await fetch(SUGGESTIONS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.errors || ['erro ao enviar']).join('\n'));
  return data;
}
