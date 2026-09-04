// The user's own, self-hosted brand database (Cloudflare Workers + D1 —
// see backend/) — the sole source of the EU-origin badge. Built to avoid
// depending on third-party sources after both previously-used ones
// (escolho.eu, buy-european.net) were found to contain factual errors and
// were removed entirely once their useful data was migrated in with
// citations (see git history).
import { normalizeText, findWordMatch, compileWildcardPattern } from './text-match.js';
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

// A name/alias containing "*" (e.g. "amaciador * comfort") is compiled to
// a wildcard RegExp instead of a plain map entry — see
// text-match.js's compileWildcardPattern for why: it's the safe way to
// give an ordinary-word brand name (unsafe as a bare alias — a common
// word matches any unrelated product containing it) a match rule that
// still requires a category word to co-occur, without pinning the exact
// words in between. Kept as a separate array rather than folded into
// `index` so the hot path (the vast majority of brands, with no wildcard)
// stays a plain Map lookup with no regex compiled or scanned per brand.
// `overwrite`: true for a brand's own name (always wins a collision with
// an earlier entry, same as before this helper existed), false for
// aliases (first brand to claim a normalized alias keeps it).
function addToIndex(index, wildcards, key, value, overwrite) {
  if (!key) return;
  if (key.includes('*')) {
    const regex = compileWildcardPattern(key);
    if (regex) wildcards.push({ regex, value });
    return;
  }
  const normalizedKey = normalizeText(key);
  if (!normalizedKey) return;
  if (overwrite || !index.has(normalizedKey)) index.set(normalizedKey, value);
}

function buildIndex(data, euStatusIndex) {
  const index = new Map();
  const wildcards = [];
  for (const entry of data.brands || []) {
    const countries = entry.countries || []; // ISO 3166-1 alpha-2 codes, e.g. ["DE"]
    const euCode = countries.find((c) => euStatusFor(euStatusIndex, c) === 'eu');
    const eftaCode = countries.find((c) => euStatusFor(euStatusIndex, c) === 'efta');
    // entry.name normally IS the display brand string. But when a brand's
    // real name is itself an ordinary word with no safe literal form (see
    // addToIndex below), `name` can hold a wildcard pattern instead (e.g.
    // "Amaciador * Comfort") so it's excluded from literal matching same
    // as any wildcard alias — displayed here with the "*" stripped back
    // out to a plain phrase ("Amaciador Comfort") rather than shown raw.
    const displayName = entry.name && entry.name.includes('*')
      ? entry.name.split('*').map((part) => part.trim()).filter(Boolean).join(' ')
      : entry.name;
    const value = {
      id: entry.id, // slug — carried through to the "suggest a correction" button (content/common.js) so an edit suggestion can reference which brand it's about
      brand: displayName,
      countries,
      isEu: Boolean(euCode),
      isEfta: Boolean(eftaCode),
      // The one code to show on the badge — the labeled translation
      // (content/countries.js) happens at render time, not here, so this
      // stays language-agnostic.
      countryCode: euCode || eftaCode || countries[0] || null,
      source: entry.source || null, // citation URL, shown clickable in the badge tooltip when present
      notesEn: entry.notesEn || null, // short factual blurb, shown in the badge tooltip when present
      notesPt: entry.notesPt || null,
      notesEs: entry.notesEs || null,
      notesFr: entry.notesFr || null,
      notesDe: entry.notesDe || null,
      notesIt: entry.notesIt || null
    };

    addToIndex(index, wildcards, entry.name, value, true);
    for (const alias of entry.aliases || []) {
      addToIndex(index, wildcards, alias, value, false);
    }
  }
  return { map: index, wildcards };
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
  return findWordMatch(index.map, text, index.wildcards);
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
