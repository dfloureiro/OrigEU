const API_BASE = '/api/brands';

// navigator.language, not a hardcoded locale — it's already the browser's
// own, fully-qualified setting (e.g. "pt-PT"), unlike a bare macrolanguage
// tag like "pt" (no region), which Intl.DisplayNames genuinely can't
// disambiguate on its own (V8 resolves it to Brazilian Portuguese —
// "Tchéquia" instead of "Chéquia" — with no hint that European Portuguese
// was meant instead). Nothing to guess or maintain this way.
const displayNames = new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' });

function countryLabel(code) {
  if (!code || code.length !== 2) return code || '';
  try {
    return displayNames.of(code.toUpperCase()) || code;
  } catch (err) {
    return code;
  }
}

// Intl.DisplayNames's default fallback ('code') echoes the code back
// unchanged for a well-formed but unassigned/unrecognized region (e.g.
// "XX"), and a real assigned code's label is never just its own code — so
// "did the label actually change" reliably tells a real ISO 3166-1
// alpha-2 code apart from a typo, without needing a list of valid codes
// to check against (there's no platform API to enumerate "all region
// codes" — Intl.supportedValuesOf doesn't cover 'region' — and a curated
// shortlist just means anything outside it silently can't be entered).
function isKnownCode(code) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return false;
  return countryLabel(code).toUpperCase() !== code.toUpperCase();
}

// True only for a code that IS its own canonical form — i.e. not a
// historical/withdrawn alias of another code (Intl.Locale's BCP-47 region
// canonicalization maps e.g. "DD" (East Germany) to "DE", "BU" (Burma) to
// "MM"). Used to keep the reverse name->code index (below) from ever
// preferring a defunct code over the current one when both share a name.
function isPrimaryCode(code) {
  try {
    return new Intl.Locale('und-' + code).region === code;
  } catch (err) {
    return false;
  }
}

function normalizeName(s) {
  return stripCombiningMarks(String(s || '').toLowerCase().normalize('NFD'));
}

let reverseIndex = null;

// Reverse of countryLabel(): given a country name in any casing/accents
// (e.g. "portugal", "Espanha"), returns its code, or null. Built by
// brute-force enumerating all 676 two-letter combinations through
// Intl.DisplayNames itself (isKnownCode filters unassigned codes,
// isPrimaryCode filters historical aliases) rather than a hardcoded
// name->code table — 676 synchronous calls, computed once and cached,
// takes low-single-digit milliseconds.
function codeForName(name) {
  if (!reverseIndex) {
    reverseIndex = new Map();
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a) + String.fromCharCode(b);
        if (!isKnownCode(code) || !isPrimaryCode(code)) continue;
        reverseIndex.set(normalizeName(countryLabel(code)), code);
      }
    }
  }
  return reverseIndex.get(normalizeName(name)) || null;
}

// Tries a code first (so "PT"/"pt" both just work), then a name lookup
// (so "Portugal" resolves too) — the one entry point the UI below uses to
// turn whatever was typed into a real code.
function resolveCountryInput(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  if (isKnownCode(trimmed)) return trimmed.toUpperCase();
  return codeForName(trimmed);
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

// Mirrors backend/shared/validate.js's isHttpsUrl() — this file is a plain
// classic script (no shared imports across the admin/extension boundary),
// so it's duplicated rather than pulled in. Used both to reject a
// non-https source before submitting the brand form, and to refuse
// rendering one as a clickable link in the pending-suggestions table even
// if it somehow got stored (e.g. written directly to D1, bypassing the
// API's own validation).
function isHttpsUrl(s) {
  try {
    return new URL(String(s)).protocol === 'https:';
  } catch (err) {
    return false;
  }
}

// Splits a comma-separated field into resolved codes. Each entry can be a
// code ("PT") or a name ("Portugal") — resolveCountryInput tries a code
// match first, then the reverse lookup. Whatever doesn't resolve is kept
// as-is (uppercased) rather than dropped, so server-side validation still
// catches and reports it.
function resolveCountriesField(rawValue) {
  return rawValue.split(',').map((s) => s.trim()).filter(Boolean).map((entry) => {
    return { entry, code: resolveCountryInput(entry) };
  });
}

// Lets you type an ISO 3166-1 alpha-2 code OR a country name directly
// (comma-separated for more than one) and shows what it resolved to live
// next to the field as confirmation, with anything that doesn't resolve
// flagged visually — same approach as content/common.js's suggestion form.
function attachCountryCodeConfirm(inputEl) {
  const confirmEl = document.createElement('div');
  confirmEl.className = 'country-confirm';
  inputEl.insertAdjacentElement('afterend', confirmEl);

  function update() {
    const resolved = resolveCountriesField(inputEl.value);
    if (!resolved.length) {
      confirmEl.textContent = '';
      return;
    }
    confirmEl.innerHTML = resolved
      .map(({ entry, code }) => {
        const label = code ? countryLabel(code) : `"${entry}"?`;
        return `<span class="${code ? '' : 'country-confirm--unknown'}">${esc(label)}</span>`;
      })
      .join(', ');
  }

  inputEl.addEventListener('input', update);
  update();
}

// Matches the id (slug) pattern validated server-side (backend/shared/validate.js
// ID_RE): lowercase letters/digits, hyphen-separated. Strips accents by
// dropping NFD combining marks (code points 0x0300-0x036f) via a numeric
// check rather than a \uXXXX regex range, to sidestep a repeat of a past
// mistake where that escape syntax silently became a literal character.
function stripCombiningMarks(s) {
  return s.split('').filter((ch) => {
    const code = ch.codePointAt(0);
    return code < 0x0300 || code > 0x036f;
  }).join('');
}

function slugify(s) {
  return stripCombiningMarks(String(s || '').normalize('NFD'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.errors || [`HTTP ${res.status}`]).join('\n'));
  return data;
}

async function initList() {
  const rowsEl = document.getElementById('rows');
  const searchEl = document.getElementById('search');
  const showInactiveEl = document.getElementById('showInactive');

  async function render() {
    const q = searchEl.value.trim();
    const active = showInactiveEl.checked ? 'all' : '1';
    const { brands } = await fetchJson(`${API_BASE}?search=${encodeURIComponent(q)}&active=${active}`);
    rowsEl.innerHTML = brands.length
      ? brands.map((b) => `
        <tr>
          <td><a href="brand-form?id=${encodeURIComponent(b.id)}">${esc(b.name)}</a></td>
          <td>${esc((b.countries || []).map(countryLabel).join(', '))}</td>
          <td>${esc((b.updatedAt || '').slice(0, 10))}</td>
          <td>${b.active ? 'yes' : 'no'}</td>
          <td><button type="button" data-id="${esc(b.id)}" class="delete">delete</button></td>
        </tr>
      `).join('')
      : '<tr><td colspan="5">No results.</td></tr>';
  }

  let debounceTimer;
  searchEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 200);
  });
  showInactiveEl.addEventListener('change', render);

  rowsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.delete');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!confirm(`Delete "${id}"? (becomes inactive, not removed from the database)`)) return;
    await fetchJson(`${API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    render();
  });

  render();
}

async function initForm() {
  const form = document.getElementById('brandForm');
  const idEl = document.getElementById('id');
  const errorsEl = document.getElementById('errors');
  attachCountryCodeConfirm(document.getElementById('countriesInput'));
  const params = new URLSearchParams(location.search);
  const editingId = params.get('id');
  // Set when arriving from the pending-suggestions page — either "Use in
  // new brand →" (no `id`: prefills the create form from a suggestion) or
  // "Review suggested edit →" (with `id`: an existing brand's page,
  // overlaid with what was suggested for it). Either way the suggestion
  // gets deleted from the pending queue once the save actually succeeds
  // (not before, in case the save fails validation and the user abandons
  // the form).
  const pendingId = params.get('pendingId');

  if (editingId) {
    document.getElementById('formTitle').textContent = pendingId ? 'Review suggested edit' : 'Edit brand';
    idEl.readOnly = true;
    try {
      const brand = await fetchJson(`${API_BASE}/${encodeURIComponent(editingId)}`);
      idEl.value = brand.id;
      form.name.value = brand.name;
      form.aliases.value = (brand.aliases || []).join(', ');
      form.countries.value = (brand.countries || []).join(', ');
      form.source.value = brand.source || '';
      form.notesEn.value = brand.notesEn || '';
      form.notesPt.value = brand.notesPt || '';
      form.notesEs.value = brand.notesEs || '';
      form.notesFr.value = brand.notesFr || '';
      form.notesDe.value = brand.notesDe || '';
      form.notesIt.value = brand.notesIt || '';
      form.active.checked = Boolean(brand.active);
      if (pendingId) {
        // Overlay the suggested fields on top of the brand's current, just-
        // loaded values, so the reviewer sees exactly what was proposed —
        // aliases/active aren't part of the suggestion schema, so those
        // stay as the live brand's.
        if (params.get('name')) form.name.value = params.get('name');
        if (params.get('countries')) form.countries.value = params.get('countries');
        if (params.get('source')) form.source.value = params.get('source');
        // Suggestion notes are raw free text of unknown language — parked
        // in notesEn, overwriting the brand's current one; cross-check
        // against notesPt (untouched here) before saving.
        if (params.get('notes')) form.notesEn.value = params.get('notes');
      }
      form.countries.dispatchEvent(new Event('input')); // populated programmatically — nudge the confirm label to show
    } catch (err) {
      errorsEl.textContent = err.message;
    }
  } else if (pendingId) {
    if (params.get('name')) form.name.value = params.get('name');
    if (params.get('countries')) form.countries.value = params.get('countries');
    if (params.get('source')) form.source.value = params.get('source');
    // Suggestion notes are raw free text of unknown language — parked in
    // notesEn as a starting point; translate/move to notesPt by hand before saving.
    if (params.get('notes')) form.notesEn.value = params.get('notes');
    idEl.value = slugify(form.name.value);
    form.countries.dispatchEvent(new Event('input'));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorsEl.textContent = '';
    const source = form.source.value.trim() || null;
    if (source && !isHttpsUrl(source)) {
      errorsEl.textContent = 'source must be a valid https:// URL';
      return;
    }
    const payload = {
      id: idEl.value.trim(),
      name: form.name.value.trim(),
      aliases: form.aliases.value.split(',').map((s) => s.trim()).filter(Boolean),
      countries: resolveCountriesField(form.countries.value).map(({ entry, code }) => code || entry.toUpperCase()),
      source,
      notesEn: form.notesEn.value.trim() || null,
      notesPt: form.notesPt.value.trim() || null,
      notesEs: form.notesEs.value.trim() || null,
      notesFr: form.notesFr.value.trim() || null,
      notesDe: form.notesDe.value.trim() || null,
      notesIt: form.notesIt.value.trim() || null,
      active: form.active.checked
    };
    try {
      if (editingId) {
        await fetchJson(`${API_BASE}/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetchJson(API_BASE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      if (pendingId) {
        await fetchJson(`/api/pending/${encodeURIComponent(pendingId)}`, { method: 'DELETE' }).catch(() => {});
      }
      location.href = '/';
    } catch (err) {
      errorsEl.textContent = err.message;
    }
  });
}

async function initPending() {
  const rowsEl = document.getElementById('rows');

  async function render() {
    const { pending } = await fetchJson('/api/pending');
    rowsEl.innerHTML = pending.length
      ? pending.map((p) => {
        const params = new URLSearchParams({ pendingId: p.id, name: p.name, countries: (p.countries || []).join(', ') });
        if (p.source) params.set('source', p.source);
        if (p.notes) params.set('notes', p.notes);
        // brandId set means this came from the "suggest a correction"
        // button on a known-brand badge (content/common.js), not the
        // "unknown brand" click-to-suggest form — route it at the existing
        // brand's edit page (via `id`) instead of a blank create form.
        const isEdit = Boolean(p.brandId);
        if (isEdit) params.set('id', p.brandId);
        return `
        <tr>
          <td>${esc(p.name)}</td>
          <td>${isEdit ? `Edit: ${esc(p.brandId)}` : 'New brand'}</td>
          <td>${esc((p.countries || []).map(countryLabel).join(', '))}</td>
          <td>${p.source && isHttpsUrl(p.source) ? `<a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">source ↗</a>` : ''}</td>
          <td>${esc(p.notes || '')}</td>
          <td>${esc((p.suggestedAt || '').slice(0, 10))}</td>
          <td>
            <a class="button use" href="brand-form?${params.toString()}">${isEdit ? 'Review suggested edit →' : 'Use in new brand →'}</a>
            <button type="button" data-id="${esc(p.id)}" class="discard">discard</button>
          </td>
        </tr>
      `;
      }).join('')
      : '<tr><td colspan="7">No pending suggestions.</td></tr>';
  }

  rowsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.discard');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!confirm('Discard this suggestion?')) return;
    await fetchJson(`/api/pending/${encodeURIComponent(id)}`, { method: 'DELETE' });
    render();
  });

  render();
}

async function initEuStatus() {
  const rowsEl = document.getElementById('rows');
  const addForm = document.getElementById('addForm');
  const addErrors = document.getElementById('addErrors');
  attachCountryCodeConfirm(document.getElementById('addCountryCode'));

  async function render() {
    const { countries } = await fetchJson('/api/eu-status');
    rowsEl.innerHTML = countries.map((c) => `
      <tr data-country-code="${esc(c.countryCode)}">
        <td>${esc(countryLabel(c.countryCode))}</td>
        <td>${esc(c.countryCode)}</td>
        <td>
          <select class="status">
            <option value="eu" ${c.status === 'eu' ? 'selected' : ''}>EU</option>
            <option value="efta" ${c.status === 'efta' ? 'selected' : ''}>EFTA</option>
          </select>
        </td>
        <td><button type="button" class="delete">delete</button></td>
      </tr>
    `).join('');
  }

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    addErrors.textContent = '';
    const payload = {
      countryCode: resolveCountryInput(addForm.countryCode.value) || addForm.countryCode.value.trim().toUpperCase(),
      status: addForm.status.value
    };
    try {
      await fetchJson('/api/eu-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      addForm.reset();
      render();
    } catch (err) {
      addErrors.textContent = err.message;
    }
  });

  // Status changes save immediately (no separate "save" step) since it's a
  // single field per row — matches how lightweight this dataset is meant
  // to stay (country code -> eu|efta, nothing more).
  rowsEl.addEventListener('change', async (e) => {
    const select = e.target.closest('select.status');
    if (!select) return;
    const countryCode = select.closest('tr').dataset.countryCode;
    await fetchJson(`/api/eu-status/${encodeURIComponent(countryCode)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: select.value })
    });
  });

  rowsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button.delete');
    if (!btn) return;
    const countryCode = btn.closest('tr').dataset.countryCode;
    if (!confirm(`Delete "${countryLabel(countryCode)}" (${countryCode})? It stops counting as EU/EFTA.`)) return;
    await fetchJson(`/api/eu-status/${encodeURIComponent(countryCode)}`, { method: 'DELETE' });
    render();
  });

  render();
}

if (document.getElementById('search')) initList();
else if (document.getElementById('addForm')) initEuStatus();
else if (document.getElementById('rows')) initPending();
if (document.getElementById('brandForm')) initForm();
