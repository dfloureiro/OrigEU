const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// ISO 3166-1 alpha-2 — countries are stored as codes, not free-text names
// (see git history, backend/d1/migrations/0005_country_codes.sql). Labels
// are a display concern handled in the extension (content/countries.js).
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export function validateBrand(payload, { requireId } = { requireId: true }) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['missing or invalid payload'];
  }
  if (requireId && (typeof payload.id !== 'string' || !ID_RE.test(payload.id))) {
    errors.push('id must be a lowercase, hyphen-separated slug (e.g. "ritter-sport")');
  }
  if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    errors.push('name is required');
  }
  if (payload.aliases !== undefined && !Array.isArray(payload.aliases)) {
    errors.push('aliases must be a list of strings');
  }
  if (payload.countries !== undefined) {
    if (!Array.isArray(payload.countries)) {
      errors.push('countries must be a list of 2-letter ISO codes (e.g. "PT")');
    } else if (payload.countries.some((c) => !COUNTRY_CODE_RE.test(String(c)))) {
      errors.push('countries must contain only 2-letter ISO codes (e.g. "PT", "DE")');
    }
  }
  if (payload.notesEn && String(payload.notesEn).length > 1000) {
    errors.push('notesEn is too long (max. 1000 characters)');
  }
  if (payload.notesPt && String(payload.notesPt).length > 1000) {
    errors.push('notesPt is too long (max. 1000 characters)');
  }
  return errors;
}

// Suggestions come from the public, unauthenticated endpoint (anyone with
// the extension installed can call it), so name/source/notes stay
// deliberately loose — just enough to keep garbage/oversized payloads out
// of the pending queue. countries is validated as codes, not free text,
// same as validateBrand: the extension's suggestion form has its own
// country-name typeahead (content/common.js) that fills in a code, so a
// request that skipped it (or was sent by hand) should fail clearly
// rather than let a name slip into the queue. No id here: that's only
// decided when a suggestion is reviewed and promoted into a real brand
// via the backoffice.
export function validateSuggestion(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return ['missing or invalid payload'];
  if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    errors.push('name is required');
  } else if (payload.name.length > 200) {
    errors.push('name is too long (max. 200 characters)');
  }
  if (payload.countries !== undefined) {
    if (!Array.isArray(payload.countries)) {
      errors.push('countries must be a list of 2-letter ISO codes (e.g. "PT")');
    } else if (payload.countries.some((c) => !COUNTRY_CODE_RE.test(String(c)))) {
      errors.push('countries must contain only 2-letter ISO codes (e.g. "PT", "DE")');
    }
  }
  if (payload.source && String(payload.source).length > 500) {
    errors.push('source is too long (max. 500 characters)');
  }
  if (payload.notes && String(payload.notes).length > 1000) {
    errors.push('notes is too long (max. 1000 characters)');
  }
  return errors;
}

// Trims/defaults a validated payload into the shape backend/shared/db.js expects.
export function normalizeBrandInput(payload) {
  return {
    name: String(payload.name || '').trim(),
    aliases: Array.isArray(payload.aliases) ? payload.aliases.map((a) => String(a).trim()).filter(Boolean) : [],
    countries: Array.isArray(payload.countries) ? payload.countries.map((c) => String(c).trim().toUpperCase()).filter(Boolean) : [],
    source: payload.source ? String(payload.source).trim() : null,
    notesEn: payload.notesEn ? String(payload.notesEn).trim() : null,
    notesPt: payload.notesPt ? String(payload.notesPt).trim() : null,
    active: payload.active === false ? 0 : 1
  };
}

const EU_STATUS_VALUES = ['eu', 'efta'];

export function validateEuStatus(payload, { requireCountry } = { requireCountry: true }) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return ['missing or invalid payload'];
  if (requireCountry && (typeof payload.countryCode !== 'string' || !COUNTRY_CODE_RE.test(payload.countryCode))) {
    errors.push('countryCode must be a 2-letter ISO code (e.g. "PT")');
  }
  if (!EU_STATUS_VALUES.includes(payload.status)) {
    errors.push(`status must be one of: ${EU_STATUS_VALUES.join(', ')}`);
  }
  return errors;
}

export function normalizeEuStatusInput(payload) {
  return {
    status: payload.status
  };
}
