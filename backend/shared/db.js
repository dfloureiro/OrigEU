// D1 query helpers shared by backend/api (public read) and backend/admin
// (backoffice CRUD). `db` is the D1 binding (env.DB in a Worker).

function rowToBrand(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    aliases: JSON.parse(row.aliases || '[]'),
    countries: JSON.parse(row.countries || '[]'),
    source: row.source,
    notesEn: row.notes_en,
    notesPt: row.notes_pt,
    notesEs: row.notes_es,
    notesFr: row.notes_fr,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
    active: Boolean(row.active)
  };
}

export async function listActive(db) {
  const { results } = await db.prepare('SELECT * FROM brands WHERE active = 1 ORDER BY name COLLATE NOCASE').all();
  return results.map(rowToBrand);
}

// active: '1' | '0' | 'all' (default 'all')
export async function search(db, { q, active }) {
  const conditions = [];
  const params = [];

  if (active === '1' || active === 1) conditions.push('active = 1');
  else if (active === '0' || active === 0) conditions.push('active = 0');

  if (q) {
    conditions.push('(name LIKE ? COLLATE NOCASE OR aliases LIKE ? OR id LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  let sql = 'SELECT * FROM brands';
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY name COLLATE NOCASE';

  const { results } = await db.prepare(sql).bind(...params).all();
  return results.map(rowToBrand);
}

export async function getById(db, id) {
  const row = await db.prepare('SELECT * FROM brands WHERE id = ?').bind(id).first();
  return rowToBrand(row);
}

export async function create(db, { id, name, aliases, countries, source, notesEn, notesPt, notesEs, notesFr, active }) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO brands (id, name, aliases, countries, source, notes_en, notes_pt, notes_es, notes_fr, added_at, updated_at, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, name, JSON.stringify(aliases), JSON.stringify(countries), source, notesEn, notesPt, notesEs, notesFr, now, now, active).run();
  return getById(db, id);
}

export async function update(db, id, { name, aliases, countries, source, notesEn, notesPt, notesEs, notesFr, active }) {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE brands SET name = ?, aliases = ?, countries = ?, source = ?, notes_en = ?, notes_pt = ?, notes_es = ?, notes_fr = ?, updated_at = ?, active = ?
    WHERE id = ?
  `).bind(name, JSON.stringify(aliases), JSON.stringify(countries), source, notesEn, notesPt, notesEs, notesFr, now, active, id).run();
  return getById(db, id);
}

export async function softDelete(db, id) {
  const now = new Date().toISOString();
  await db.prepare('UPDATE brands SET active = 0, updated_at = ? WHERE id = ?').bind(now, id).run();
  return getById(db, id);
}

function rowToPending(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    countries: JSON.parse(row.countries || '[]'),
    source: row.source,
    notes: row.notes,
    // Set only for a "suggest a correction" submission (content/common.js's
    // data-origeu-suggest-edit) — the id of the existing brand it proposes
    // to edit, rather than a brand-new one. See
    // backend/d1/migrations/0007_pending_brand_edits.sql.
    brandId: row.brand_id || null,
    suggestedAt: row.suggested_at
  };
}

// Suggestions from the extension's public, unauthenticated endpoint
// (backend/api). Kept in a separate table from `brands` so that endpoint
// never has write access to the real, live brand list — see
// backend/d1/migrations/0002_pending_brands.sql.
export async function createPending(db, { name, countries, source, notes, brandId }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO pending_brands (id, name, countries, source, notes, brand_id, suggested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, name, JSON.stringify(countries), source, notes, brandId || null, now).run();
  const row = await db.prepare('SELECT * FROM pending_brands WHERE id = ?').bind(id).first();
  return rowToPending(row);
}

export async function listPending(db) {
  const { results } = await db.prepare('SELECT * FROM pending_brands ORDER BY suggested_at DESC').all();
  return results.map(rowToPending);
}

export async function deletePending(db, id) {
  await db.prepare('DELETE FROM pending_brands WHERE id = ?').bind(id).run();
}

function rowToEuStatus(row) {
  if (!row) return null;
  return {
    countryCode: row.country_code,
    status: row.status
  };
}

// EU/EFTA membership by ISO 3166-1 alpha-2 code
// (backend/d1/migrations/0005_country_codes.sql) — data instead of a
// hardcoded list in the extension, so an accession/exit can be edited from
// the backoffice without a new extension release.
export async function listEuStatus(db) {
  const { results } = await db.prepare('SELECT * FROM eu_status ORDER BY country_code').all();
  return results.map(rowToEuStatus);
}

export async function getEuStatus(db, countryCode) {
  const row = await db.prepare('SELECT * FROM eu_status WHERE country_code = ?').bind(countryCode).first();
  return rowToEuStatus(row);
}

export async function createEuStatus(db, { countryCode, status }) {
  await db.prepare('INSERT INTO eu_status (country_code, status) VALUES (?, ?)')
    .bind(countryCode, status).run();
  return getEuStatus(db, countryCode);
}

export async function updateEuStatus(db, countryCode, { status }) {
  await db.prepare('UPDATE eu_status SET status = ? WHERE country_code = ?')
    .bind(status, countryCode).run();
  return getEuStatus(db, countryCode);
}

export async function deleteEuStatus(db, countryCode) {
  await db.prepare('DELETE FROM eu_status WHERE country_code = ?').bind(countryCode).run();
}
