import { SETTINGS_KEY } from './settings.js';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MISS_TTL_MS = 3 * 24 * 60 * 60 * 1000; // re-try misses sooner than hits
// Bump the suffix whenever the shape/logic of a cached result changes, so
// stale entries from an older extension version don't shadow new logic.
const CACHE_PREFIX = 'origeu_cache_v16_';

function keyFor(name) {
  return `${CACHE_PREFIX}n:${(name || '').trim().toLowerCase()}`;
}

export async function getCached(name) {
  const key = keyFor(name);
  const stored = await chrome.storage.local.get(key);
  const entry = stored[key];
  if (!entry) return undefined;
  const ttl = entry.result ? TTL_MS : MISS_TTL_MS;
  if (Date.now() - entry.savedAt > ttl) return undefined;
  return entry.result;
}

export async function setCached(name, result) {
  const key = keyFor(name);
  await chrome.storage.local.set({ [key]: { result, savedAt: Date.now() } });
}

// Wipes every cache entry (per-product lookups AND own-brands.js's own
// dataset cache — different key prefixes, so it's simpler to remove
// everything except the one thing worth keeping: user preferences) — for
// the popup's "clear cache" button, useful when actively editing the own
// database and wanting to see a change immediately rather than waiting out
// a TTL.
export async function clearAll() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k !== SETTINGS_KEY);
  if (keys.length) await chrome.storage.local.remove(keys);
}
