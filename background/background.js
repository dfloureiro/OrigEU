import { lookupProduct } from '../lib/openfoodfacts.js';
import { getCached, setCached } from '../lib/cache.js';
import { getCuratedIndices, matchCuratedBrand, mergeCuratedMatch } from '../lib/curated-brands.js';

// In-flight request de-duplication so rapid card scans on a listing page
// don't fire duplicate network requests for the same product.
const inFlight = new Map();

async function handleLookup({ barcode, name }) {
  const cached = await getCached(barcode, name);
  if (cached !== undefined) return cached;

  const dedupeKey = barcode ? `b:${barcode}` : `n:${(name || '').trim().toLowerCase()}`;
  if (inFlight.has(dedupeKey)) return inFlight.get(dedupeKey);

  const promise = (async () => {
    let result = null;
    try {
      result = await lookupProduct({ barcode, name });
    } catch (err) {
      console.warn('[BuyEU:bg] OFF lookup failed', { barcode, name }, err);
    }

    try {
      const indices = await getCuratedIndices();
      const searchText = [name, result?.brands, result?.productName].filter(Boolean).join(' ');
      const curatedMatch = matchCuratedBrand(indices, searchText);
      result = mergeCuratedMatch(result, curatedMatch);
      if (curatedMatch) console.debug('[BuyEU:bg] curated match', searchText, '->', curatedMatch);
    } catch (err) {
      console.warn('[BuyEU:bg] curated brand match failed', { barcode, name }, err);
    }

    console.debug('[BuyEU:bg] lookup', { barcode, name }, '->', result);
    await setCached(barcode, name, result);
    return result;
  })();

  inFlight.set(dedupeKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(dedupeKey);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'BUYEU_LOOKUP') return false;
  handleLookup(message.payload || {}).then(sendResponse);
  return true; // keep the message channel open for the async response
});
