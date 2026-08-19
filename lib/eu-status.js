// EU-27 / EFTA membership by ISO 3166-1 alpha-2 country code — fetched from
// the own database (backend/, GET /api/eu-status) instead of hardcoded, so
// an accession or exit can be edited from the backoffice without shipping
// a new extension version. Falls back to a bundled snapshot
// (data/eu-status.json) if the API is unreachable, so a broken deploy
// degrades to "possibly stale" rather than "every EU country looks non-EU".
//
// Keyed by code rather than free-text country name (see git history,
// backend/d1/migrations/0005_country_codes.sql) — a code has exactly one
// canonical form, so there's no alias list to keep in sync. Country
// *labels* (for display) live in content/countries.js, not here: this
// module only classifies, it never needs to know what a code is called in
// any language.
//
// EFTA (Iceland, Liechtenstein, Norway, Switzerland): outside the EU but
// tightly economically integrated with it — worth distinguishing from
// "somewhere else in the world" (see lib/eu-decision.js).
import { loadDataset } from './remote-dataset.js';
import { BACKEND_URL } from './config.js';

// BACKEND_URL comes from lib/config.js (gitignored — see
// lib/own-brands.js's identical note and lib/config.example.js). Unlike
// that one, this works fine even before you set it up: the bundled
// fallback (data/eu-status.json) is a real, complete EU-27+EFTA-4
// snapshot, not an empty placeholder.
const REMOTE_URL = `${BACKEND_URL}/api/eu-status`;
const CACHE_KEY = 'origeu_eu_status_v2';
// EU/EFTA membership essentially never changes (the last EU accession was
// 2013, the last exit 2020), unlike lib/own-brands.js's actively-edited
// brand list — a much longer TTL is fine here and avoids re-fetching on
// every startup for data that's almost always identical to last time.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const BUNDLED_PATH = 'data/eu-status.json';

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function buildStatusIndex(data) {
  const index = new Map(); // code -> 'eu' | 'efta'
  for (const entry of data.countries || []) {
    const code = normalizeCode(entry.countryCode);
    if (code) index.set(code, entry.status);
  }
  return index;
}

let statusPromise = null;

export function getEuStatusIndex() {
  if (!statusPromise) {
    statusPromise = loadDataset({
      remoteUrl: REMOTE_URL,
      cacheKey: CACHE_KEY,
      cacheTtlMs: CACHE_TTL_MS,
      bundledPath: BUNDLED_PATH
    }).then(buildStatusIndex);
  }
  return statusPromise;
}

export function resetEuStatusIndex() {
  statusPromise = null;
}

// Synchronous lookup against an already-resolved index (see
// getEuStatusIndex above) — split out so a caller checking many country
// codes at once (lib/own-brands.js's buildIndex) only awaits the fetch
// once rather than per code.
export function euStatusFor(index, code) {
  return index.get(normalizeCode(code)) || null; // 'eu' | 'efta' | null
}
