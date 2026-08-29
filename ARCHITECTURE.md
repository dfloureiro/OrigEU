# Architecture

Technical reference for `README.md`. This is the "how it's built" doc — if
you just want to install and use the extension, the main README covers
that.

## How it works

1. A content script scans the page for product cards (listings) or the
   product detail block (PDP), and extracts the product name.
2. It asks the background service worker to look the product up.
3. The background worker checks that name/brand text against the own brand
   database (see below) — word-boundary, accent-insensitive matching, not
   fuzzy search.
4. The result is cached in `chrome.storage.local` for 30 days (3 days for
   misses, so those get retried sooner) and translated into the badge.

The badge reflects exactly one source: a self-hosted database you curate
yourself (see below), with a citation URL per brand where one's been
recorded. Treat the badge as a helpful signal, not a certified guarantee:
brand-level data can be wrong for a specific SKU (private label, regional
variant, licensing), and it's only as accurate as what's been entered.

## Brand database

`lib/own-brands.js` is the sole source of the badge — a self-hosted,
self-curated brand → country list with per-entry source citations, backed
by Cloudflare Workers + D1. See `backend/README.md` for the schema, API,
and backoffice UI used to maintain it. It shares `lib/text-match.js`
(word-boundary, accent-insensitive matching) and `lib/remote-dataset.js`
(the cache/remote-fetch/bundled-fallback logic) — infrastructure originally
built to support multiple sources, kept because it's still exactly what a
single source needs too.

Countries are stored as **ISO 3166-1 alpha-2 codes** (e.g. `"DE"`), not
free-text names — both in each brand's `countries` and in EU/EFTA
membership (`lib/eu-status.js`, `GET /api/eu-status`, also fetched from the
own database rather than hardcoded, so an accession/exit can be edited from
the backoffice's "Estado UE/EFTA" page without shipping a new extension
version). A code has exactly one canonical form, unlike a name (no more
"Suíça" vs "Suiça" vs an alias list). Label translation and flag emoji are
a *render-time* concern, not stored data: `content/countries.js` (a classic
script, loaded before `content/common.js` since content scripts can't use
ES module imports) translates a code to a label via the platform's own
`Intl.DisplayNames` — covers every ISO code, in any language, maintained by
the browser, not a hardcoded table (`'pt'` maps to the `'pt-PT'` locale
specifically, since bare `'pt'` resolves to Brazilian spellings in V8, e.g.
"Tchéquia" instead of "Chéquia") — and computes the flag emoji
algorithmically from the code via Unicode regional indicator symbols, so
there's no flag-per-country map either.

`lib/own-brands.js`'s `REMOTE_URL` points at the deployed `backend/api`
Worker, fetched with a 10-minute cache — short, because the brand list is
actively edited via the backoffice. Falls back to the bundled (empty)
`data/own-brands.json` if the API is unreachable, so a broken deployment
never breaks the extension, just leaves the badge showing "unknown" for
everything. `lib/eu-status.js` uses the same fetch/cache/fallback pattern
but with a 24h cache (membership essentially never changes) and a bundled
fallback (`data/eu-status.json`) that's a real EU-27 + EFTA-4 snapshot, not
empty — an unreachable API there should degrade to "possibly one country
out of date", not "every EU country looks non-EU".

## Sites

| Site | Platform | Status |
|---|---|---|
| continente.pt | Salesforce Commerce Cloud (confirmed) | Shared SFCC adapter |
| auchan.pt | Salesforce Commerce Cloud (confirmed) | Shared SFCC adapter |
| pingodoce.pt | Salesforce Commerce Cloud (confirmed) | Shared SFCC adapter, with overrides |
| intermarche.pt | Custom Next.js/React (confirmed) | Standalone adapter (`content/sites/intermarche.js`) |

All three run on Salesforce Commerce Cloud (SFRA) — Pingo Doce couldn't be
fingerprinted remotely early on (it 403s requests without a real
User-Agent), so it originally shipped with a from-scratch, unverified
"best effort" adapter that didn't actually match anything on the site.
Confirmed via its Demandware session cookies (`dwanonymous_`, `dwsid`) and
its search controller URL
(`/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show`), then
verified against real fetched listing/PDP pages. It now shares
`content/sites/sfcc-common.js` like the other two, with two overrides in
`content/sites/pingodoce.js`: the product name lives in
`.product-name-link a` instead of any of the stock name selectors, and its
brand is also rendered in its own separate element
(`.product-brand-name` on listings, `h1.product-brand` on the PDP) rather
than folded into the product name — since matching searches the name text
for a word-boundary match, a brand that never appears there (e.g. "Cerveja
com Álcool Mini Pack 30" for both Sagres and Super Bock) could never
match, so the brand text is folded in before matching. The PDP's own
container/name selectors already matched the stock ones as-is.

Pingo Doce's listing tiles also anchor their "Adicionar" button with
`position: absolute; bottom: 0`, independent of how much text (ratings,
promo message, bottle-deposit notice) renders above it — real measurements
found that gap varying from 22px to 36px on the same page, too unreliable
for any fixed-size badge sharing that text flow to consistently avoid.
`getInjectTarget` is overridden to inject into `.product-tile-image`
instead (already `position: relative`, since that's how the site places
its own "Poupe X%" graphic) so the badge overlays the product image's
top-right corner — a spot that graphic never uses — sidestepping the
text-flow height budget entirely (see `content/common.css`'s
`.product-tile-image > .origeu-badges` rule).

All three sites also get a badge in the search-box typeahead dropdown (the
"Sugestões"/"Queria dizer?" panel that appears while typing, before a
search is submitted) — a separate `config.suggestions` scan alongside
`listing`/`product`, driven by the same `SearchServices-GetSuggestions` SFRA
endpoint on all three, but with bespoke markup per site that doesn't match
the listing `cardSelector`/`nameSelectors` at all, so `sfcc-common.js` only
builds this scan when a site passes `suggestionsCardSelector` — there's no
shared default the way there is for real listing tiles. Continente and Pingo
Doce inject the badge into the text flow (`.suggestion-product-details`,
`.product-info`); auchan.pt anchors it inside `.suggestion-offers`, the same
element the site uses for its own promo pill, so ours renders alongside it.

intermarche.pt runs on its own custom Next.js/React storefront, not SFCC —
`content/sites/intermarche.js` is a standalone config, not another
`sfcc-common.js` override. It also sits behind DataDome bot-protection,
which returns a JS-challenge page to any non-browser request — this
project's own fetch tooling couldn't get past it the way it fetches the
other three sites' real pages directly, so its selectors were verified a
different way: real markup copied out of a live browser's DevTools
(Elements panel → Copy outerHTML) for one listing tile and one PDP, rather
than a fetched page. Unlike the SFCC sites, one listing selector
(`.product[data-nfproductid]`) covers every surface here — the search
results grid, the home page's own grid/carousel, and the search-box
typeahead dropdown all render the identical card shape, verified against
real markup from all three — so there's no separate `suggestions` scan the
way the SFCC sites need one for their typeahead dropdown. Listing tiles
carry the brand pre-folded into the name as a `data-name` attribute — no
per-site brand-folding needed the way Pingo Doce's adapter needs it by
hand — with `.product__brand`/`.product__name` as a fallback for whichever
card doesn't have it. The badge is injected as a sibling of the card's `<a>`
(before its `<footer>`, not inside the anchor) since the name/image link
wraps only part of the card — a badge inside that link would also navigate
to the PDP on click, breaking the "unknown brand" click-to-suggest
behavior. The PDP's brand is a separate element too (`.productDetail__brand`
next to `h1.productDetail__main_title`), folded in the same way.

## If badges don't show up on a site

This usually means the CSS selectors in the adapter don't match that site's
current markup (retailers restyle their sites over time).

1. Open the site, right-click a product card → Inspect
2. Find the repeating card element and note its class name and the element
   holding the product name
3. Open `chrome://extensions`, click the service worker / inspect views for
   this extension to see console warnings
4. Update the relevant selectors — the three SFCC sites share
   `content/sites/sfcc-common.js` (`cardSelector`, `nameSelectors`,
   `tileBodySelector`, `pdpNameSelectors`); Continente/Auchan use its
   defaults as-is, Pingo Doce passes overrides for the two that differ
   (`content/sites/pingodoce.js`). intermarche.pt doesn't use that shared
   file at all — its selectors live directly in
   `content/sites/intermarche.js`
5. Reload the extension (⟳ icon on `chrome://extensions`) and refresh the page

## Project layout

```
manifest.json                    # Chrome/Chromium MV3 manifest
manifest.firefox.json            # Firefox MV3 manifest — background.scripts instead of service_worker,
                                  # plus browser_specific_settings; kept in sync with manifest.json by hand
_locales/pt_PT/messages.json, _locales/en/messages.json   # chrome.i18n UI text, matched to browser language
background/background.js         # service worker: matches the own brand database + caching + clear-cache action
lib/config.example.js            # template for lib/config.js (gitignored) — your own backend URL, never committed
lib/own-brands.js                # own database client: indexing, matching (see backend/)
lib/eu-status.js                 # EU/EFTA classification by country code — fetched from backend/api (used by own-brands.js)
lib/text-match.js                # accent-insensitive word-boundary matching (used by own-brands.js)
lib/remote-dataset.js            # cache/remote-fetch/bundled-fallback loader (used by own-brands.js)
lib/eu-decision.js               # translates an own-brands.js match into the badge's data shape
lib/cache.js                     # chrome.storage.local cache with TTL + clear-all
lib/settings.js                  # badge on/off, detail style, hide-unknown preferences (read by popup.js)
data/own-brands.json             # bundled empty fallback for the own database
data/eu-status.json              # bundled EU-27 + EFTA-4 fallback for lib/eu-status.js
popup/popup.html, popup.js       # toolbar popup: show/hide the badge, clear cache
content/countries.js             # country code -> label/flag translation, loaded before common.js
content/common.js                # shared badge rendering, messaging, scanning, tooltips
content/common.css               # badge + tooltip styles
content/sites/sfcc-common.js     # shared adapter for all three sites (SFCC)
content/sites/continente.js
content/sites/auchan.js
content/sites/pingodoce.js       # sfcc-common.js + overrides for renamed classes
backend/                         # own brand database: Cloudflare Workers + D1 + backoffice (see backend/README.md)
```

## Extending to other sites / browsers

- **New supermarket site**: add a `content/sites/<site>.js` adapter (reuse
  `sfcc-common.js` if the site also runs Salesforce Commerce Cloud), and
  register it in `manifest.json`'s `content_scripts`.
- **Firefox**: already supported, via `manifest.firefox.json` — Firefox's
  MV3 implementation doesn't use `background.service_worker` and needs
  `background.scripts` instead, which Chrome's MV3 validator rejects
  outright, so one shared manifest can't satisfy both. Everything else
  (`lib/`, `content/`) is unchanged: the codebase's only extension-API
  surface — `chrome.runtime`, `chrome.storage`, `chrome.i18n` — works
  identically in Firefox via its `chrome.*` compatibility shim. See
  `README.md`'s "Setting it up yourself" for load/build steps per browser.

## Known limitations (v0.1)

- The database is brand-level, not SKU-level — a specific product (regional
  variant, private-label overlap, licensed manufacture) can differ from its
  brand's general origin.
- The badge is only as complete/accurate as what's been entered.
