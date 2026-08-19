# OrigEU own brand database (Cloudflare Workers + D1)

The sole source of the extension's EU-origin badge. Two Workers share one D1
database:

- **`api/`** — public, unauthenticated Worker. Three endpoints:
  - `GET /api/brands` — every active brand, fetched once and cached 10 min
    client-side (`lib/own-brands.js`), not queried per product. Short TTL
    because this table is actively edited. Also edge-cached 5 min via the
    Workers Cache API (`src/index.js`) so repeat GETs never reach D1.
  - `GET /api/eu-status` — EU/EFTA membership by ISO 3166-1 alpha-2 country
    code, cached 24h client-side (`lib/eu-status.js`) since it essentially
    never changes. Editing it here (accession/exit) takes effect without a
    new extension release. Edge-cached 1h for the same reason.
  - `POST /api/suggestions` — brand suggestions from the extension's
    click-to-suggest form, written only to a separate `pending_brands`
    queue (`backend/d1/migrations/0002_pending_brands.sql`), never to the
    live `brands` table. Reviewed and promoted into a real brand from the
    backoffice's "Sugestões pendentes" page. Rate-limited per IP (5/minute,
    via the `SUGGESTION_RATE_LIMIT` KV namespace) since it's the one
    unauthenticated write endpoint — a coarse deterrent against scripted
    spam into the pending queue, not a hard guarantee.
- **`admin/`** — the backoffice: a plain HTML/JS UI (`public/`) plus CRUD
  APIs (`src/routes.js`) for brands (add/edit/search/soft-delete),
  EU/EFTA status (add/edit/delete), and pending suggestions
  (list/discard/promote), all gated by Cloudflare Access so nobody but you
  can reach them.

`countries` on each brand stores **ISO 3166-1 alpha-2 codes** (e.g. `"DE"`,
`"US"`) as raw facts only — not names, not EU/EFTA status. A code has
exactly one canonical form (no more "Suíça" vs "Suiça" vs an alias list to
keep in sync), and lets the extension translate to a label in whichever
language it wants via the platform's `Intl.DisplayNames`
(`content/countries.js`) — no hardcoded name table, in the extension or
here — and compute the flag emoji algorithmically instead of keeping a
hardcoded flag-per-country map. EU/EFTA classification is a separate table
(`eu_status`, also code-keyed — see
`backend/d1/migrations/0005_country_codes.sql`) edited from the
backoffice's "Estado UE/EFTA" page, kept apart from `brands` so the two can
be edited (and cached) independently. The backoffice's country fields
(brand form's "Países", eu-status's add-country) are plain text inputs
where you can type either the ISO code ("PT") or the country's name
("Portugal") — either resolves to the code, shown live underneath as
confirmation (or a visible warning if nothing resolves). The name->code
direction is the reverse of `Intl.DisplayNames`: built by brute-force
enumerating all 676 two-letter combinations through it once (cached
after), keeping only codes that are both real (`isKnownCode`) and their
own canonical form (`isPrimaryCode`, via `Intl.Locale`'s BCP-47 region
canonicalization) — that second check matters because several defunct
codes share a modern country's name (e.g. "DD"/East Germany and "DE" both
display as "Alemanha"; a naive index would risk resolving "Alemanha" back
to the wrong one). Deliberately not a picker backed by a curated list of
"supported" countries: there's no platform API to enumerate every region
code, and a hand-picked shortlist just means anything outside it can't be
entered from the dropdown at all.

## First-time setup

Requires your own Cloudflare account. None of this can be scripted without
your credentials — run these yourself.

`wrangler.jsonc` in `api/` and `admin/` holds your `database_id`, which is
specific to your own D1 database — so those two files are gitignored
(`backend/.gitignore`) and you create your own from the committed
`.example` templates, the same pattern as `lib/config.example.js` in the
main repo:

```bash
cp backend/api/wrangler.jsonc.example     backend/api/wrangler.jsonc
cp backend/admin/wrangler.jsonc.example   backend/admin/wrangler.jsonc

npx wrangler login                                    # one-time, interactive OAuth

cd backend/api
npx wrangler d1 create origeu-brands --update-config    # writes database_id into api/wrangler.jsonc
npx wrangler kv namespace create SUGGESTION_RATE_LIMIT --update-config  # writes its id into api/wrangler.jsonc
```

Copy the `database_id` that command wrote into `backend/admin/wrangler.jsonc`
too (replacing its `REPLACE_WITH_YOUR_D1_DATABASE_ID` placeholder) — both
Workers must bind the same database. The KV namespace is only used by
`api/`, so `admin/` doesn't need it.

```bash
# Apply the schema — locally first (for `wrangler dev`), then to the real remote DB
npx wrangler d1 migrations apply origeu-brands --local
npx wrangler d1 migrations apply origeu-brands --remote

# Deploy both Workers
cd ../api   && npx wrangler deploy
cd ../admin && npx wrangler deploy
```

Then in the Cloudflare dashboard (one-time):

1. Workers & Pages → `origeu-admin` → **Access** tab (or **Domains** tab,
   depending on which UI you land on) → "Protect this Worker behind
   Access" → **All traffic**. (First visit to Zero Trust prompts a
   one-time team-name pick — free, no card needed.)
2. Accept the default policy (sign in with your existing Cloudflare
   account) or restrict it to your specific email.
3. Note the deployed `origeu-api.<subdomain>.workers.dev` URL. Back in the
   extension repo, copy `lib/config.example.js` to `lib/config.js` (also
   gitignored, same reasoning) and set `BACKEND_URL` in it to that URL —
   both `lib/own-brands.js` and `lib/eu-status.js` read from there.
   `manifest.json`'s `host_permissions` already allows any `*.workers.dev`
   subdomain, so it doesn't need editing unless you route the Worker
   through a custom domain instead. Reload the unpacked extension.

**⚠️ Don't skip step 1, or postpone it.** The admin Worker is reachable
(and fully writable) the moment it's deployed, before Access is set up —
there's a real window where anyone with the URL could edit your data.
Verify it's actually gated before trusting it:
`curl -I https://origeu-admin.<subdomain>.workers.dev/` should return a
`302` redirecting to `*.cloudflareaccess.com`, not a `200`.

## Local development

```bash
cd backend/api   && npx wrangler dev --local   # http://localhost:8787
cd backend/admin && npx wrangler dev --local   # separate port; Access does not apply locally
```

Exercise the admin API with `curl` against the local instance before
touching the real remote database:

```bash
curl -X POST http://localhost:8787/api/brands \
  -H 'content-type: application/json' \
  -d '{"id":"ritter-sport","name":"Ritter Sport","aliases":["Ritter"],"countries":["DE"],"source":"https://en.wikipedia.org/wiki/Ritter_Sport"}'

curl http://localhost:8787/api/brands
curl -X DELETE http://localhost:8787/api/brands/ritter-sport
```

## Updating the schema later

Add a new numbered file under `d1/migrations/` (e.g. `0002_*.sql`), then
run `wrangler d1 migrations apply origeu-brands --local` and `--remote`
again from `backend/api/` (either Worker's config works, since they share
the same `database_id`).
