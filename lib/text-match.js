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

// Finds the entry in `map` (normalized-key -> value) whose key appears as
// a whole word EARLIEST in `text`, not just the first one found while
// iterating the map. `map` comes from own-brands.js's index, built by
// iterating brands in whatever order the API returned them (alphabetical
// by name) — that ordering has nothing to do with relevance, so picking
// the first map hit instead of the earliest text position previously
// picked the wrong brand whenever a product title legitimately contained
// two brand names as standalone words (e.g. "Gel de Banho Dove Men Clean
// Comfort" matched "Comfort" over "Dove" purely because "Comfort" sorts
// before "Dove" alphabetically). Real product titles put the actual
// manufacturer/brand near the front, with descriptive variant words
// (here, Dove's own "Clean Comfort" scent line colliding with the
// unrelated Comfort fabric-softener brand) following it — so leftmost
// position is a much better relevance signal than map iteration order.
export function findWordMatch(map, text) {
  const haystack = ` ${normalizeText(text)} `;
  if (haystack.trim().length === 0) return null;
  let best = null;
  let bestIndex = Infinity;
  for (const [key, value] of map) {
    const re = new RegExp(`(^| )${escapeRegex(key)}( |$)`);
    const m = re.exec(haystack);
    if (m && m.index < bestIndex) {
      bestIndex = m.index;
      best = value;
    }
  }
  return best;
}
