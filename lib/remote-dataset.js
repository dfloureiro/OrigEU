// Shared load pattern for curated datasets that should be updatable without
// shipping a new extension version: try a cached copy, then a remote URL
// (if configured), falling back to a stale cache or the bundled snapshot so
// a broken/unreachable URL never breaks matching — only makes it stale.
export async function loadDataset({ remoteUrl, cacheKey, cacheTtlMs, bundledPath }) {
  async function fetchBundled() {
    const res = await fetch(chrome.runtime.getURL(bundledPath));
    return res.json();
  }

  if (!remoteUrl) return fetchBundled();

  let cachedEntry = null;
  try {
    const stored = await chrome.storage.local.get(cacheKey);
    cachedEntry = stored[cacheKey] || null;
    if (cachedEntry && Date.now() - cachedEntry.savedAt < cacheTtlMs) {
      return cachedEntry.data;
    }
  } catch (err) {
    // storage read failed, fall through to network
  }

  try {
    const res = await fetch(remoteUrl);
    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({ [cacheKey]: { data, savedAt: Date.now() } });
      return data;
    }
  } catch (err) {
    console.warn('[OrigEU] remote dataset fetch failed, using cache/bundled fallback', remoteUrl, err);
  }

  if (cachedEntry) return cachedEntry.data; // stale cache beats nothing
  return fetchBundled();
}
