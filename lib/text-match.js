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

// Compiles a name/alias containing "*" (e.g. "amaciador * comfort") into a
// RegExp that requires each segment to appear, in order, as whole words,
// with any number of other words allowed in between — built for brands
// like "Comfort" whose bare name is an ordinary word (unsafe as a plain
// alias, see own-brands.js) but that reliably co-occurs with a category
// word somewhere in every real product title, just not always adjacent to
// it or in a fixed position ("Amaciador Roupa Sunfresh Comfort",
// "Amaciador Roupa Concentrado Lavanda Comfort", ...). Segments are
// normalized independently so accents/case still don't matter. Returns
// null for a key with no usable (non-empty) segment either side of "*".
export function compileWildcardPattern(key) {
  const segments = String(key || '')
    .split('*')
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 0);
  if (segments.length === 0) return null;
  const body = segments.map(escapeRegex).join('( \\S+)* ');
  return new RegExp(`(^| )${body}( |$)`);
}

// Finds the entry whose key appears as a whole word (or, for `wildcards`,
// a whole-word sequence with gaps — see compileWildcardPattern) EARLIEST
// in `text`, not just the first one found while iterating. `map` and
// `wildcards` come from own-brands.js's index, built by iterating brands
// in whatever order the API returned them (alphabetical by name) — that
// ordering has nothing to do with relevance, so picking the first hit
// instead of the earliest text position previously picked the wrong brand
// whenever a product title legitimately contained two brand names as
// standalone words (e.g. "Gel de Banho Dove Men Clean Comfort" matched
// "Comfort" over "Dove" purely because "Comfort" sorts before "Dove"
// alphabetically). Real product titles put the actual manufacturer/brand
// near the front, with descriptive variant words (here, Dove's own "Clean
// Comfort" scent line colliding with the unrelated Comfort fabric-softener
// brand) following it — so leftmost position is a much better relevance
// signal than map iteration order.
export function findWordMatch(map, text, wildcards = []) {
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
  for (const { regex, value } of wildcards) {
    const m = regex.exec(haystack);
    if (m && m.index < bestIndex) {
      bestIndex = m.index;
      best = value;
    }
  }
  return best;
}
