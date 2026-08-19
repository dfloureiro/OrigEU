import {
  search, getById, create, update, softDelete, listPending, deletePending,
  listEuStatus, getEuStatus, createEuStatus, updateEuStatus, deleteEuStatus
} from '../../shared/db.js';
import { validateBrand, normalizeBrandInput, validateEuStatus, normalizeEuStatusInput } from '../../shared/validate.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function errorJson(errors, status = 400) {
  return json({ errors }, status);
}

// Handles every /api/* route on the admin Worker. The whole Worker sits
// behind Cloudflare Access ("All traffic"), so there's no separate auth
// check needed here — an unauthenticated request never reaches this code.
export async function handleApi(request, env, url) {
  const db = env.DB;
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'brands'|'pending', maybe ':id']

  if (parts[1] === 'pending') {
    const pendingId = parts[2] ? decodeURIComponent(parts[2]) : null;
    if (request.method === 'GET' && !pendingId) {
      const pending = await listPending(db);
      return json({ pending });
    }
    if (request.method === 'DELETE' && pendingId) {
      await deletePending(db, pendingId);
      return json({ ok: true });
    }
    return errorJson(['method not allowed'], 405);
  }

  if (parts[1] === 'eu-status') {
    const countryCode = parts[2] ? decodeURIComponent(parts[2]).toUpperCase() : null;

    if (request.method === 'GET' && !countryCode) {
      const countries = await listEuStatus(db);
      return json({ countries });
    }

    if (request.method === 'POST' && !countryCode) {
      const payload = await request.json().catch(() => null);
      const errors = validateEuStatus(payload, { requireCountry: true });
      if (errors.length) return errorJson(errors);
      const code = payload.countryCode.trim().toUpperCase();
      if (await getEuStatus(db, code)) return errorJson([`an entry for "${code}" already exists`], 409);
      const entry = await createEuStatus(db, { countryCode: code, ...normalizeEuStatusInput(payload) });
      return json(entry, 201);
    }

    if (request.method === 'PUT' && countryCode) {
      const payload = await request.json().catch(() => null);
      const errors = validateEuStatus(payload, { requireCountry: false });
      if (errors.length) return errorJson(errors);
      if (!(await getEuStatus(db, countryCode))) return errorJson(['country not found'], 404);
      const entry = await updateEuStatus(db, countryCode, normalizeEuStatusInput(payload));
      return json(entry);
    }

    if (request.method === 'DELETE' && countryCode) {
      if (!(await getEuStatus(db, countryCode))) return errorJson(['country not found'], 404);
      await deleteEuStatus(db, countryCode);
      return json({ ok: true });
    }

    return errorJson(['method not allowed'], 405);
  }

  if (parts[1] !== 'brands') return errorJson(['not found'], 404);

  const id = parts[2] ? decodeURIComponent(parts[2]) : null;

  if (request.method === 'GET' && !id) {
    const q = url.searchParams.get('search') || '';
    const active = url.searchParams.get('active') || 'all';
    const brands = await search(db, { q, active });
    return json({ brands });
  }

  if (request.method === 'GET' && id) {
    const brand = await getById(db, id);
    if (!brand) return errorJson(['brand not found'], 404);
    return json(brand);
  }

  if (request.method === 'POST' && !id) {
    const payload = await request.json().catch(() => null);
    const errors = validateBrand(payload, { requireId: true });
    if (errors.length) return errorJson(errors);
    if (await getById(db, payload.id)) return errorJson([`a brand with id "${payload.id}" already exists`], 409);
    const brand = await create(db, { id: payload.id, ...normalizeBrandInput(payload) });
    return json(brand, 201);
  }

  if (request.method === 'PUT' && id) {
    const payload = await request.json().catch(() => null);
    const errors = validateBrand(payload, { requireId: false });
    if (errors.length) return errorJson(errors);
    if (!(await getById(db, id))) return errorJson(['brand not found'], 404);
    const brand = await update(db, id, normalizeBrandInput(payload));
    return json(brand);
  }

  if (request.method === 'DELETE' && id) {
    if (!(await getById(db, id))) return errorJson(['brand not found'], 404);
    const brand = await softDelete(db, id);
    return json(brand);
  }

  return errorJson(['method not allowed'], 405);
}
