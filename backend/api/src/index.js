// Public, unauthenticated Worker: one bulk-read endpoint the extension
// fetches once and caches client-side (lib/own-brands.js), matching the
// bundled-JSON envelope shape used by the other two sources. Also accepts
// brand suggestions from the extension's click-to-suggest form
// (content/common.js) — write access here is intentionally narrow: it can
// only insert into the separate pending_brands queue, never the real
// brands table (see backend/shared/db.js, backend/admin for review/promotion).
import { listActive, createPending, listEuStatus } from '../../shared/db.js';
import { validateSuggestion } from '../../shared/validate.js';

// Edge-cached via the Workers Cache API so repeat GETs (the extension's
// background worker re-fetching on every browser start, plus anyone else
// hitting the open endpoint) don't hit D1 at all. TTL is shorter for
// /api/brands since it's actively edited via the backoffice — a stale
// edge cache would hide "I just added a brand" the same way the client's
// own 10-min cache does (see lib/own-brands.js) — while /api/eu-status
// barely ever changes, so it can sit longer.
const BRANDS_CACHE_TTL_SECONDS = 5 * 60;
const EU_STATUS_CACHE_TTL_SECONDS = 60 * 60;

// Per-IP token bucket for the one write endpoint. KV isn't strongly
// consistent/atomic, so this is a best-effort spam deterrent, not a hard
// guarantee under concurrent requests from the same IP — fine for this
// purpose since the goal is throttling scripted abuse, not precision.
const SUGGESTION_RATE_LIMIT_WINDOW_SECONDS = 60;
const SUGGESTION_RATE_LIMIT_MAX = 5;

async function cachedJson(request, ctx, ttlSeconds, compute) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const data = await compute();
  const response = Response.json(data, {
    headers: { 'Cache-Control': `public, max-age=${ttlSeconds}` }
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function isRateLimited(kv, ip) {
  if (!kv || !ip) return false;
  const key = `suggest:${ip}`;
  const count = parseInt((await kv.get(key)) || '0', 10);
  if (count >= SUGGESTION_RATE_LIMIT_MAX) return true;
  await kv.put(key, String(count + 1), { expirationTtl: SUGGESTION_RATE_LIMIT_WINDOW_SECONDS });
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/brands' && request.method === 'GET') {
      try {
        return await cachedJson(request, ctx, BRANDS_CACHE_TTL_SECONDS, async () => {
          const brands = await listActive(env.DB);
          return {
            schemaVersion: 1,
            source: 'origeu-own',
            generatedAt: new Date().toISOString(),
            brands: brands.map(({ id, name, aliases, countries, source, notesEn, notesPt, addedAt, updatedAt }) => ({
              id, name, aliases, countries, source, notesEn, notesPt, addedAt, updatedAt
            }))
          };
        });
      } catch (err) {
        console.error('[origeu-api] unhandled error', err);
        return Response.json({ errors: ['erro interno'] }, { status: 500 });
      }
    }

    if (url.pathname === '/api/eu-status' && request.method === 'GET') {
      try {
        return await cachedJson(request, ctx, EU_STATUS_CACHE_TTL_SECONDS, async () => {
          const countries = await listEuStatus(env.DB);
          return {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            countries
          };
        });
      } catch (err) {
        console.error('[origeu-api] unhandled error', err);
        return Response.json({ errors: ['erro interno'] }, { status: 500 });
      }
    }

    if (url.pathname === '/api/suggestions' && request.method === 'POST') {
      try {
        const ip = request.headers.get('CF-Connecting-IP');
        if (await isRateLimited(env.SUGGESTION_RATE_LIMIT, ip)) {
          return Response.json({ errors: ['demasiados pedidos, tenta mais tarde'] }, { status: 429 });
        }
        const payload = await request.json().catch(() => null);
        const errors = validateSuggestion(payload);
        if (errors.length) return Response.json({ errors }, { status: 400 });
        const pending = await createPending(env.DB, {
          name: payload.name.trim(),
          countries: Array.isArray(payload.countries) ? payload.countries.map((c) => String(c).trim().toUpperCase()).filter(Boolean) : [],
          source: payload.source ? String(payload.source).trim() : null,
          notes: payload.notes ? String(payload.notes).trim() : null
        });
        return Response.json(pending, { status: 201 });
      } catch (err) {
        console.error('[origeu-api] unhandled error', err);
        return Response.json({ errors: ['erro interno'] }, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
