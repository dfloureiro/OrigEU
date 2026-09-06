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
| auchan.fr | Custom server-rendered platform (confirmed) | Standalone adapter (`content/sites/auchan-fr.js`) |
| pingodoce.pt | Salesforce Commerce Cloud (confirmed) | Shared SFCC adapter, with overrides |
| intermarche.pt | Custom Next.js/React (confirmed) | Standalone adapter (`content/sites/intermarche.js`) |
| tienda.mercadona.es | Custom React SPA (confirmed) | Standalone adapter (`content/sites/mercadona.js`) |
| carrefour.es | Custom Vue SPA (confirmed) | Standalone adapter (`content/sites/carrefour-es.js`) |
| carrefour.fr | Custom Vue SPA, unrelated markup to .es (confirmed) | Standalone adapter (`content/sites/carrefour-fr.js`) |
| rewe.de | Custom server-rendered platform behind a Cloudflare challenge (confirmed) | Standalone adapter (`content/sites/rewe.js`) |

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

auchan.fr is a *different retailer country site* on a *different platform*
from auchan.pt — same brand, not the same storefront. Auchan runs at least
five distinct platforms across its EU country sites (SFCC on .pt, a custom
Node platform on .fr, a Vue.js SPA on .pl, PrestaShop on .lu, VTEX on .ro),
so there's no shared adapter across countries the way there is for the
three Portuguese SFCC sites — each Auchan country needs its own
from-scratch selectors, same as any other retailer. `content/sites/
auchan-fr.js` is a standalone config verified against auchan.fr's own
server-rendered HTML (a category page, a search-results page, and a
product page) — unlike intermarche.pt, this site has no bot-protection
blocking a plain fetch, so no browser DevTools copy-paste was needed.
Listing tiles (`.product-thumbnail[data-id]`, identical shape on both
category and search-results pages) carry the brand pre-folded into the
name text via a `<strong itemprop="brand">` inside
`.product-thumbnail__description` — no separate brand-folding needed,
same reason intermarche.pt's `data-name` attribute doesn't need it either.
The badge is injected as a sibling of the card's `<a>` (into
`.product-thumbnail__content-wrapper`, before its `<footer>`), same
click-to-suggest reasoning as intermarche.pt. The PDP's brand is a
separate element (`.offer-selector__brand` next to a bare `<h1>` inside
`.offer-selector__name--large`), folded in by hand like the other
non-SFCC sites.

tienda.mercadona.es is a client-rendered React SPA — the plain server
response is an empty `<div id="root"></div>`, so unlike auchan.fr (and
like intermarche.pt) its selectors were verified from real markup copied
out of a live browser's DevTools rather than a fetched page.
`content/sites/mercadona.js` is a standalone config. Its listing tile
(`[data-testid="product-cell"]`) already folds the brand into the product
name text itself (e.g. "Dentífrico Triple Acción Colgate menta intensa"),
same reasoning as intermarche.pt's `data-name` attribute — no per-site
brand-folding needed. More interestingly, the site has no separate PDP at
all: clicking a product cell opens an in-page modal dialog
(`[data-testid="private-product-detail"]`) over the still-visible search
results, without changing the URL. That needs no special handling here —
`content/common.js`'s scan loop already re-runs on every DOM mutation (see
"How it works" above), and the modal opening is itself one, so
`isProductPage()` just checks whether the modal is currently present in
the document. The modal's own "Productos relacionados" cross-sell carousel
reuses the exact same `[data-testid="product-cell"]` card markup as the
main grid, so the one listing config covers it automatically too.

Both surfaces pin their own "add to cart" control to a fixed-height
container's bottom edge (the grid cell on the listing, a flex column
matched to the image gallery's height in the modal) — inserting the badge
into that flow, as first shipped, pushed the control down past the
container's own boundary and hid it. Fixed the same way as pingodoce.pt's
listing tiles and auchan.pt's PDP: the badge is an absolute-positioned
overlay instead of flow content (`[data-testid="product-cell"] >
.origeu-badges` in `content/common.css` for the grid; `.origeu-anchor--overlay`
anchored to `.private-product-detail__left` for the modal), so it never
competes for space with anything the site itself sized.

carrefour.es sits behind a Cloudflare bot-management challenge ("Attention
Required!") that blocks a plain fetch the same way intermarche.pt's
DataDome does, so `content/sites/carrefour-es.js`'s selectors were also
verified from real markup copied out of a live browser's DevTools. Its
listing tile (`.product-card`) has the exact same shape as
mercadona.es's — an add-to-cart footer (`.product-card__footer`) pinned to
the bottom of the card, sibling of the title block
(`.product-card__detail`) — so this one shipped with the overlay-on-image
fix from the start (`.product-card__media > .origeu-badges` in
`content/common.css`) rather than waiting for the same bug to get reported
again. Its title text also already folds the brand in (e.g. "...Garnier
400 ml.", "...Oral-B pack 3 unidades..."), so no brand-folding needed
either. The PDP (`.product-header__name` inside `.pdp-view__left`) showed
no sign of the same fixed-height squeeze in the markup that was checked,
so it uses the plain after-`<h1>` placement instead of an overlay.

The site turned out to ship a *second*, entirely different listing-tile
component too — `article[data-test="search-grid-result"]`, verified from
the search-results page, built by what looks like a separate Vue
micro-frontend (atomic, versioned `x-*` utility classes rather than
`.product-card__*`'s BEM-ish naming). `cardSelector` matches both shapes
(comma-separated), and `getName`/`getInjectTarget` branch on which one
matched via `card.matches(SEARCH_CARD_SELECTOR)`. Its picture is wrapped
the opposite way around from `.product-card`'s: `[data-test="result-link"]`
*is* the link, with no separate non-link wrapper inside it to overlay a
badge onto — injecting there would make the badge also navigate to the PDP
on click. Its parent (the picture column) isn't a link and has no stable
class of its own, so the adapter tags it with a marker class
(`.origeu-overlay-container`) via JS instead, giving `content/common.css` a
generic version of the same overlay rule to key on — reusable by any future
site with the same "no addressable class, just a structural relationship
to a `data-test` anchor" problem.

carrefour.fr is a genuinely different site from carrefour.es — same
Cloudflare bot-management challenge blocking a plain fetch, but completely
unrelated markup underneath, confirming Carrefour doesn't share a platform
across countries any more than Auchan does.
`content/sites/carrefour-fr.js` initially assumed one listing-tile
component (`.product-card-vertical-grid-new`, verified from the sponsored
slot and two recommendation carousels) also covered the real
search-results grid, based on a class name (`product-list-card-plp-grid-
new__per-unit-label`) glimpsed nested inside it — that guess was wrong,
and a *third* shape (`.product-card-mini-reco`, a small sponsored-reco
slot) turned up after that. Three verified shapes so far, likely not the
last: `.product-card-vertical-grid-new` and `.product-list-card-plp-grid-
new` both wrap the title `<a>` in an `__infos` container that holds
*nothing else but the title* (and, on the carousel variant, a sibling
reviews link); `.product-card-mini-reco` repurposes that same `__infos`
class name for the pricing/buy-cta block instead, with the title `<a>` as
a plain sibling with no dedicated wrapper at all. Hardcoding a container
selector per shape stopped scaling at three, so `getInjectTarget` doesn't
try — every shape's `.product-card-title__text` sits inside a clickable
`<a>` regardless of what (if anything) wraps that `<a>`, so it finds that
link generically via `.closest('a')` and uses *its* parent, whatever that
happens to be named on the shape at hand — a lesson in resisting the urge
to special-case a specific class name when the more general, stable fact
is simply "title lives inside a link, don't badge inside that link
itself". Every example's title text redundantly folds the brand in at the
*end* too (e.g. "...FEBREZE", "...DODOT"), same as carrefour.es, so no
brand-folding logic needed either; and the buy/"Voir" button never shares
a fixed-height column with the title link's parent in any of the three
shapes, so there's no risk of the same "button pushed out of view" bug
carrefour-es.js hit — plain placement is enough. The PDP is the
interesting part: its `<h1>` is
rendered *twice*, once in a mobile-only block and once in a desktop-only
one, toggled by a CSS media query rather than by JS, so picking the first
DOM match would badge whichever copy happens to be hidden at the current
viewport width half the time. `visibleTitleH1()` checks `offsetParent`
(`null` when an ancestor is `display:none`) to find the one actually on
screen, re-checked on every scan (`content/common.js`'s scan loop already
re-runs on every DOM mutation and every 2s) so a window resize across the
breakpoint gets picked up too.

rewe.de sits behind the same kind of Cloudflare bot-management challenge as
the two carrefour.* sites, so `content/sites/rewe.js`'s selectors also come
from user-supplied DevTools markup rather than a fetchable response. Its
listing tile wraps the title `<h4>` in a clickable `<a>` exactly like
carrefour.fr's shapes, so `getInjectTarget` uses the same `.closest('a')`
→ parent generalization for its fallback path. It's a uniform grid tile,
the same shape that pushed the add-to-cart button out of view on
mercadona.es and carrefour.es after shipping a plain in-flow badge —
rather than wait for that same bug report a third time, the badge is
overlaid on the tile's image area (absolute-positioned, top-left) from the
start, mirroring carrefour.es's `.product-card__media` fix and its
left-aligned corner choice to stay clear of the tile's own top-right "add
to favourites" heart button. One further wrinkle turned up when trying to
verify a second card shape: this tile component gets reused for the
search-suggestions typeahead flyout too (`data-theme="line-item-responsive"`
vs. the grid's `data-theme="tile-responsive"`), structurally identical but
with every part rendering its *own* CSS Modules hash suffix per theme
variant — e.g. `a-pt__product-tile__container_mbaovz` on the grid tile vs.
`a-pt__product-tile__container_-0VeKe` on the exact same role in the
flyout. Hardcoding either hash would silently miss the other and break
again on the next rebuild's hash rotation, so every selector in
`content/sites/rewe.js` (and the matching CSS in `content/common.css`)
matches on the stable `a-pt__product-tile__<part>_` prefix via a substring
attribute selector (`[class*="..."]`) instead of an exact class name. The
PDP (`#pdpr-ProductInformation` / `h1.pdpr-Title`) uses plain, unhashed BEM
classes from a different component, and is a plain content panel rather
than a fixed-height card, so it uses the ordinary after-`<h1>` placement
instead of an overlay — same as auchan.fr and carrefour.fr's product
pages.

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
   `tileBodySelector`, `pdpNameSelectors`); Continente/Auchan (.pt) use its
   defaults as-is, Pingo Doce passes overrides for the two that differ
   (`content/sites/pingodoce.js`). intermarche.pt, auchan.fr,
   tienda.mercadona.es, carrefour.es, carrefour.fr, and rewe.de don't use
   that shared file at all — their selectors live directly in
   `content/sites/intermarche.js`, `content/sites/auchan-fr.js`,
   `content/sites/mercadona.js`, `content/sites/carrefour-es.js`,
   `content/sites/carrefour-fr.js`, and `content/sites/rewe.js`
   respectively
5. Reload the extension (⟳ icon on `chrome://extensions`) and refresh the page

## Project layout

```
manifest.json                    # Chrome/Chromium MV3 manifest
manifest.firefox.json            # Firefox MV3 manifest — background.scripts instead of service_worker,
                                  # plus browser_specific_settings; kept in sync with manifest.json by hand
_locales/{pt_PT,en,es,de,it,fr}/messages.json   # chrome.i18n UI text, matched to browser language
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
content/sites/sfcc-common.js     # shared adapter for the three .pt SFCC sites
content/sites/continente.js
content/sites/auchan.js
content/sites/pingodoce.js       # sfcc-common.js + overrides for renamed classes
content/sites/intermarche.js     # standalone adapter — custom Next.js/React platform
content/sites/auchan-fr.js       # standalone adapter — different platform from auchan.pt
content/sites/mercadona.js       # standalone adapter — client-rendered React SPA
content/sites/carrefour-es.js    # standalone adapter — client-rendered Vue SPA
content/sites/carrefour-fr.js    # standalone adapter — unrelated markup to carrefour-es.js
content/sites/rewe.js            # standalone adapter — behind a Cloudflare challenge, uniform grid tiles
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
