import { EU_COUNTRY_TAGS, EU_GENERIC_TAGS, euCountryDisplayName, isEuTag } from './eu-countries.js';

const API_BASE = 'https://world.openfoodfacts.org';
const SEARCH_BASE = 'https://search.openfoodfacts.org';
const FIELDS = [
  'code', 'product_name', 'product_name_pt', 'brands',
  'origins_tags', 'manufacturing_places_tags', 'countries_tags',
  'labels_tags', 'allergens_tags', 'traces_tags'
].join(',');

const GLUTEN_FREE_LABELS = new Set(['en:gluten-free', 'en:no-gluten']);
const GLUTEN_ALLERGEN = 'en:gluten';
const LACTOSE_FREE_LABELS = new Set(['en:lactose-free', 'en:no-lactose', 'en:lactose-free-in-milk']);
const MILK_ALLERGEN = 'en:milk';

function pickEuOrigin(tags) {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    if (EU_COUNTRY_TAGS.has(tag)) return tag;
  }
  for (const tag of tags) {
    if (EU_GENERIC_TAGS.has(tag)) return tag;
  }
  return null;
}

function nonEuOriginPresent(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  return tags.some((t) => t.startsWith('en:') && !isEuTag(t));
}

function determineEuStatus(product) {
  const origins = product.origins_tags || [];
  const manufacturing = product.manufacturing_places_tags || [];
  const combined = [...origins, ...manufacturing];

  const euTag = pickEuOrigin(combined);
  if (euTag) {
    return {
      status: 'eu',
      confidence: 'confirmed',
      label: EU_GENERIC_TAGS.has(euTag) ? 'União Europeia' : euCountryDisplayName(euTag)
    };
  }
  if (nonEuOriginPresent(combined)) {
    return { status: 'non-eu', confidence: 'confirmed', label: null };
  }

  // Open Food Facts' origins/manufacturing-place fields are populated for
  // only a small minority of products, even well-known ones. Rather than
  // leaving everything "unknown", fall back to the market(s) this exact
  // product is registered as sold in: if it's sold only within a single EU
  // country, that's a reasonable (but not certain — could be an import)
  // signal of EU origin. We never infer "non-eu" this way, since being sold
  // outside the EU doesn't rule out EU manufacture.
  const countries = product.countries_tags || [];
  if (countries.length > 0 && countries.every(isEuTag)) {
    const euCountry = countries.find((c) => EU_COUNTRY_TAGS.has(c));
    return {
      status: 'eu-likely',
      confidence: 'inferred',
      label: euCountry ? euCountryDisplayName(euCountry) : 'União Europeia'
    };
  }
  return { status: 'unknown', confidence: 'none', label: null };
}

function determineFreeStatus(labelsTags, allergensTags, freeLabelSet, allergenTag) {
  const labels = labelsTags || [];
  const allergens = allergensTags || [];
  if (labels.some((t) => freeLabelSet.has(t))) return 'free';
  if (allergens.includes(allergenTag)) return 'contains';
  return 'unknown';
}

export function normalizeProduct(off) {
  if (!off) return null;
  const eu = determineEuStatus(off);
  const soldInEu = (off.countries_tags || []).some(isEuTag);
  return {
    barcode: off.code || null,
    productName: off.product_name_pt || off.product_name || null,
    brands: off.brands || null,
    euStatus: eu.status,
    euConfidence: eu.confidence,
    euCountryLabel: eu.label,
    euSource: 'off',
    soldInEu,
    gluten: determineFreeStatus(off.labels_tags, off.allergens_tags, GLUTEN_FREE_LABELS, GLUTEN_ALLERGEN),
    lactose: determineFreeStatus(off.labels_tags, off.allergens_tags, LACTOSE_FREE_LABELS, MILK_ALLERGEN),
    offUrl: off.code ? `https://world.openfoodfacts.org/product/${off.code}` : null
  };
}

export async function lookupByBarcode(barcode) {
  const url = `${API_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return normalizeProduct({ code: barcode, ...data.product });
}

export async function lookupByName(name) {
  // Uses the newer search-a-licious backend (the legacy cgi/search.pl
  // endpoint has become unreliable). It doesn't support a documented
  // country filter, so results are ranked by relevance and then
  // re-preferred client-side toward products actually sold in Portugal,
  // to reduce mismatches against same-named products from other markets.
  const url = `${SEARCH_BASE}/search?q=${encodeURIComponent(name)}&page_size=5&fields=${FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const hits = data.hits || [];
  if (hits.length === 0) return null;
  const ptHit = hits.find((h) => (h.countries_tags || []).includes('en:portugal'));
  return normalizeProduct(ptHit || hits[0]);
}

export async function lookupProduct({ barcode, name }) {
  if (barcode) {
    const byBarcode = await lookupByBarcode(barcode);
    if (byBarcode) return byBarcode;
  }
  if (name) {
    return lookupByName(name);
  }
  return null;
}
