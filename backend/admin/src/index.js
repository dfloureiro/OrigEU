// Backoffice Worker: serves the static admin UI (public/) and the CRUD API
// under /api/*. `run_worker_first: ["/api/*"]` in wrangler.jsonc means only
// /api/* actually reaches this fetch handler — every other path is served
// straight from the assets binding without invoking this code at all. The
// ASSETS.fetch fallback below is just a defensive no-op for any path that
// somehow still reaches here.
//
// No auth code here: this entire Worker is protected by Cloudflare Access
// ("Protect this Worker behind Access" -> All traffic, set in the
// dashboard, not in code) — an unauthenticated request never arrives.
import { handleApi } from './routes.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error('[origeu-admin] unhandled error', err);
        return new Response(JSON.stringify({ errors: ['internal error'] }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
