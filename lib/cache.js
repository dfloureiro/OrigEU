const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MISS_TTL_MS = 3 * 24 * 60 * 60 * 1000; // re-try misses sooner than hits
// Bump the "v2" suffix whenever the shape/logic of a cached result changes,
// so stale entries from an older extension version don't shadow new logic.
const CACHE_PREFIX = 'buyeu_cache_v3_';

function keyFor(barcode, name) {
  const id = barcode ? `b:${barcode}` : `n:${(name || '').trim().toLowerCase()}`;
  return `${CACHE_PREFIX}${id}`;
}

export async function getCached(barcode, name) {
  const key = keyFor(barcode, name);
  const stored = await chrome.storage.local.get(key);
  const entry = stored[key];
  if (!entry) return undefined;
  const ttl = entry.result ? TTL_MS : MISS_TTL_MS;
  if (Date.now() - entry.savedAt > ttl) return undefined;
  return entry.result;
}

export async function setCached(barcode, name, result) {
  const key = keyFor(barcode, name);
  await chrome.storage.local.set({ [key]: { result, savedAt: Date.now() } });
}
