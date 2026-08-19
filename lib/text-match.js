// Accent-insensitive, word-boundary text matching used by the own brand
// database (lib/own-brands.js) to match product names against brand names
// and aliases. The accent-stripping regex has been a recurring source of
// subtle bugs when rewritten — see git history — so it's kept in this one
// place rather than duplicated.
export function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(s) {
  return stripAccents(String(s || '').toLowerCase()).replace(/[^a-z0-9&]+/g, ' ').trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Finds the first entry in `map` (normalized-key -> value) whose key
// appears as a whole word in `text`.
export function findWordMatch(map, text) {
  const haystack = ` ${normalizeText(text)} `;
  if (haystack.trim().length === 0) return null;
  for (const [key, value] of map) {
    const re = new RegExp(`(^| )${escapeRegex(key)}( |$)`);
    if (re.test(haystack)) return value;
  }
  return null;
}
