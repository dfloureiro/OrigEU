// Curated brand-level EU/non-EU signal, sourced from escolho.eu's
// "avoid this brand / choose this European or national alternative" list.
// This is complementary to Open Food Facts: OFF is precise per-SKU but its
// origin fields are sparse; this list is brand-level (coarser) but has much
// better coverage for well-known multinational vs. European/national brands.
//
// The dataset is meant to live outside the extension bundle so it can be
// updated without shipping a new extension version. Set REMOTE_URL below
// once it's hosted somewhere (e.g. a raw GitHub URL) — remember to also add
// that host to `host_permissions` in manifest.json. Until then, the
// extension uses the bundled snapshot at data/curated-brands.json.
const REMOTE_URL = null;

const CACHE_KEY = 'buyeu_curated_brands_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Supermarket-relevant categories only — the source list also covers
// digital services, fashion, travel, etc., which won't appear on a grocery
// site and would just be dead weight (or a false-match risk) here.
const RELEVANT_CATEGORIES = new Set(['Alimentação', 'Higiene pessoal & Cosmética', 'Limpeza']);

const EU_COUNTRY_NAMES_PT = new Set([
  'austria', 'belgica', 'bulgaria', 'croacia', 'chipre', 'chequia', 'republica checa',
  'dinamarca', 'estonia', 'finlandia', 'franca', 'alemanha', 'grecia', 'hungria',
  'irlanda', 'italia', 'letonia', 'lituania', 'luxemburgo', 'malta', 'paises baixos',
  'holanda', 'polonia', 'portugal', 'romenia', 'eslovaquia', 'eslovenia', 'espanha', 'suecia'
]);

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(s) {
  return stripAccents(String(s || '').toLowerCase()).replace(/[^a-z0-9&]+/g, ' ').trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isEuCountryName(name) {
  return EU_COUNTRY_NAMES_PT.has(normalize(name));
}

function buildIndices(data) {
  const avoidBrands = new Map();
  const alternativeBrands = new Map();

  for (const row of data.rows || []) {
    if (!RELEVANT_CATEGORIES.has(row.category)) continue;

    for (const brand of row.avoid || []) {
      const key = normalize(brand);
      if (key) avoidBrands.set(key, { brand, category: row.category, subcategory: row.subcategory });
    }

    for (const alt of row.alternatives || []) {
      const key = normalize(alt.brand);
      if (!key) continue;
      const euCountry = (alt.countries || []).find(isEuCountryName);
      alternativeBrands.set(key, {
        brand: alt.brand,
        countries: alt.countries || [],
        isEu: Boolean(euCountry),
        euCountryLabel: euCountry || null,
        category: row.category,
        subcategory: row.subcategory
      });
    }
  }

  return { avoidBrands, alternativeBrands };
}

function findWordMatch(map, normalizedHaystack) {
  for (const [key, value] of map) {
    const re = new RegExp(`(^| )${escapeRegex(key)}( |$)`);
    if (re.test(normalizedHaystack)) return value;
  }
  return null;
}

async function fetchBundled() {
  const res = await fetch(chrome.runtime.getURL('data/curated-brands.json'));
  return res.json();
}

async function loadRawData() {
  if (!REMOTE_URL) return fetchBundled();

  let cachedEntry = null;
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    cachedEntry = stored[CACHE_KEY] || null;
    if (cachedEntry && Date.now() - cachedEntry.savedAt < CACHE_TTL_MS) {
      return cachedEntry.data;
    }
  } catch (err) {
    // storage read failed, fall through to network
  }

  try {
    const res = await fetch(REMOTE_URL);
    if (res.ok) {
      const data = await res.json();
      await chrome.storage.local.set({ [CACHE_KEY]: { data, savedAt: Date.now() } });
      return data;
    }
  } catch (err) {
    console.warn('[BuyEU] curated brand list fetch failed, using cache/bundled fallback', err);
  }

  if (cachedEntry) return cachedEntry.data; // stale cache beats nothing
  return fetchBundled();
}

let indicesPromise = null;

export function getCuratedIndices() {
  if (!indicesPromise) {
    indicesPromise = loadRawData().then(buildIndices);
  }
  return indicesPromise;
}

// text: arbitrary free text (product name, brand field, etc.) to search for
// a known brand within. Returns { type: 'avoid'|'alternative', brand, ... }
// or null.
export function matchCuratedBrand(indices, text) {
  const haystack = ` ${normalize(text)} `;
  if (haystack.trim().length === 0) return null;

  const avoid = findWordMatch(indices.avoidBrands, haystack);
  if (avoid) return { type: 'avoid', ...avoid };

  const alt = findWordMatch(indices.alternativeBrands, haystack);
  if (alt) return { type: 'alternative', ...alt };

  return null;
}

// Folds a curated-brand match into an Open Food Facts result (which may be
// null if OFF had no match at all). SKU-specific OFF origin data (when
// actually confirmed) always wins over the coarser brand-level signal. A
// non-EU "alternative" match (e.g. a UK/Swiss brand escolho.eu still
// recommends) is deliberately not treated as a positive or negative EU
// signal, since it doesn't tell us anything about EU membership either way.
export function mergeCuratedMatch(offResult, curatedMatch) {
  if (!curatedMatch) return offResult;
  if (offResult && offResult.euConfidence === 'confirmed') return offResult;

  let euStatus = 'unknown';
  let euCountryLabel = null;
  if (curatedMatch.type === 'avoid') {
    euStatus = 'non-eu';
  } else if (curatedMatch.type === 'alternative' && curatedMatch.isEu) {
    euStatus = 'eu';
    euCountryLabel = curatedMatch.euCountryLabel;
  } else {
    return offResult; // no usable EU signal from this match
  }

  const base = offResult || {
    barcode: null, productName: null, brands: null,
    soldInEu: null, gluten: 'unknown', lactose: 'unknown', offUrl: null
  };

  return {
    ...base,
    euStatus,
    euConfidence: 'confirmed',
    euCountryLabel,
    euSource: 'curated'
  };
}
