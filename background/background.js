import { getCached, setCached, clearAll } from '../lib/cache.js';
import { getOwnIndex, matchOwnBrand, resetOwnIndex, submitSuggestion } from '../lib/own-brands.js';
import { buildResult } from '../lib/eu-decision.js';

// In-flight request de-duplication so rapid card scans on a listing page
// don't fire duplicate network requests for the same product.
const inFlight = new Map();

async function handleLookup({ name }) {
  if (!name) return null;

  const cached = await getCached(name);
  if (cached !== undefined) return cached;

  const dedupeKey = name.trim().toLowerCase();
  if (inFlight.has(dedupeKey)) return inFlight.get(dedupeKey);

  const promise = (async () => {
    let ownMatch = null;
    try {
      const index = await getOwnIndex();
      ownMatch = matchOwnBrand(index, name);
    } catch (err) {
      console.warn('[OrigEU:bg] own brand database match failed', { name }, err);
    }

    const result = buildResult({ ownMatch });
    console.debug('[OrigEU:bg] lookup', { name }, '-> own:', ownMatch, '=> result:', result);
    await setCached(name, result);
    return result;
  })();

  inFlight.set(dedupeKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(dedupeKey);
  }
}

async function handleClearCache() {
  inFlight.clear();
  resetOwnIndex();
  await clearAll();
  return { ok: true };
}

// Run from here rather than the content script that triggers it (the
// click-to-suggest form on "unknown" badges) so a strict page CSP on a
// supermarket site can't block the request the way it could for a
// content-script-initiated fetch() — host_permissions fully exempt the
// background worker from that.
async function handleSuggestion(payload) {
  try {
    const pending = await submitSuggestion(payload);
    return { ok: true, pending };
  } catch (err) {
    return { ok: false, error: err.message || 'erro ao enviar' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ORIGEU_LOOKUP') {
    handleLookup(message.payload || {}).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  if (message?.type === 'ORIGEU_CLEAR_CACHE') {
    handleClearCache().then(sendResponse);
    return true;
  }
  if (message?.type === 'ORIGEU_SUBMIT_SUGGESTION') {
    handleSuggestion(message.payload || {}).then(sendResponse);
    return true;
  }
  return false;
});
