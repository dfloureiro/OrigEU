// Shared country-code -> localized label + flag-emoji helper for content
// scripts, which can't use ES module imports the way lib/ files can (see
// content/common.js's similar note on SETTINGS_KEY/DEFAULT_SETTINGS) — so
// this is loaded as its own classic script, before content/common.js, in
// manifest.json's content_scripts.
//
// Labels come from the platform's own Intl.DisplayNames rather than a
// hardcoded table — it already covers every ISO 3166-1 alpha-2 code, in
// any language, maintained by the browser vendor, not us. The locale
// defaults to navigator.language (the browser's own, fully-qualified
// setting, e.g. "pt-PT" or "en-US") instead of a hand-maintained
// lang->locale mapping — a bare macrolanguage tag like "pt" (no region)
// is genuinely ambiguous to Intl.DisplayNames (V8 resolves it to Brazilian
// Portuguese, "Tchéquia" instead of "Chéquia"), but navigator.language is
// always already region-qualified, so there's nothing to guess or maintain.
//
// No curated code list here on purpose (there used to be one, just for
// picker suggestions — removed): there's no platform API to enumerate
// "all region codes" (Intl.supportedValuesOf doesn't cover 'region'), and
// a hand-picked shortlist means anything outside it silently can't be
// picked. Instead, UIs that need to work with a code (content/common.js's
// suggestion form, backend/admin/public/admin.js) let you type any 2-letter
// code directly and show the resolved label live as confirmation —
// isKnownCode() below is what tells a real code apart from a typo.
(function () {
  const displayNamesCache = new Map(); // locale -> Intl.DisplayNames instance

  function getDisplayNames(locale) {
    const key = locale || navigator.language || 'en';
    if (!displayNamesCache.has(key)) {
      displayNamesCache.set(key, new Intl.DisplayNames([key], { type: 'region' }));
    }
    return displayNamesCache.get(key);
  }

  // locale: any BCP-47 tag (e.g. "pt-PT"); defaults to the browser's own.
  function countryLabel(code, locale) {
    if (typeof code !== 'string' || code.length !== 2) return code || null;
    try {
      return getDisplayNames(locale).of(code.toUpperCase()) || code;
    } catch (err) {
      return code;
    }
  }

  // Intl.DisplayNames's default fallback ('code') echoes the code back
  // unchanged for a well-formed but unassigned/unrecognized region (e.g.
  // "XX"), and a real assigned code's label is never just its own code —
  // so "did the label actually change" is a reliable way to tell them
  // apart without a list of valid codes to check against.
  function isKnownCode(code) {
    if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return false;
    return countryLabel(code).toUpperCase() !== code.toUpperCase();
  }

  // Any real 2-letter ISO 3166-1 alpha-2 code works here — no per-country
  // map to keep in sync, unlike a hardcoded flag emoji table.
  function flagFromCode(code) {
    if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return null;
    const upper = code.toUpperCase();
    const points = [...upper].map((ch) => 0x1F1E6 + (ch.charCodeAt(0) - 65));
    return String.fromCodePoint(...points);
  }

  // True only for a code that IS its own canonical form — i.e. not a
  // historical/withdrawn alias of another code (Intl.Locale's BCP-47
  // region canonicalization maps e.g. "DD" (East Germany) to "DE", "BU"
  // (Burma) to "MM"). Used to keep the reverse name->code index (below)
  // from ever preferring a defunct code over the current one.
  function isPrimaryCode(code) {
    try {
      return new Intl.Locale('und-' + code).region === code;
    } catch (err) {
      return false;
    }
  }

  function stripAccents(s) {
    return s.normalize('NFD').split('').filter((ch) => {
      const cp = ch.codePointAt(0);
      return cp < 0x0300 || cp > 0x036f;
    }).join('');
  }

  function normalizeName(s) {
    return stripAccents(String(s || '').toLowerCase());
  }

  const reverseIndexCache = new Map(); // locale -> Map<normalized name, code>

  // Built by brute-force enumerating all 676 two-letter combinations
  // through Intl.DisplayNames itself (isKnownCode filters unassigned ones,
  // isPrimaryCode filters historical aliases) rather than a hardcoded
  // name->code table — 676 synchronous calls, computed once and cached,
  // takes low-single-digit milliseconds.
  function getReverseIndex(locale) {
    const key = locale || navigator.language || 'en';
    if (!reverseIndexCache.has(key)) {
      const index = new Map();
      for (let a = 65; a <= 90; a++) {
        for (let b = 65; b <= 90; b++) {
          const code = String.fromCharCode(a) + String.fromCharCode(b);
          if (!isKnownCode(code) || !isPrimaryCode(code)) continue;
          index.set(normalizeName(countryLabel(code, key)), code);
        }
      }
      reverseIndexCache.set(key, index);
    }
    return reverseIndexCache.get(key);
  }

  // Reverse of countryLabel(): given a country name in any casing/accents
  // (e.g. "portugal", "Espanha", "chequia"), returns its ISO 3166-1
  // alpha-2 code, or null if nothing matches exactly. locale: which
  // language the name is expected to be in — defaults to the browser's own.
  function codeForName(name, locale) {
    if (typeof name !== 'string' || !name.trim()) return null;
    return getReverseIndex(locale).get(normalizeName(name)) || null;
  }

  // Tries a code first (so "PT" and "pt" both just work), then falls back
  // to a name lookup (so "Portugal" resolves too) — the single entry point
  // UIs should use to turn whatever someone typed into a real code.
  function resolveCountryInput(text, locale) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    if (isKnownCode(trimmed)) return trimmed.toUpperCase();
    return codeForName(trimmed, locale);
  }

  window.OrigEUCountries = { countryLabel, flagFromCode, isKnownCode, codeForName, resolveCountryInput };
})();
