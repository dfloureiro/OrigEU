# BuyEU

Chrome (Manifest V3) extension that annotates products on Portuguese
supermarket websites with:

- 🇪🇺 whether the product's country of origin is in the EU
- gluten-free / contains-gluten status
- lactose-free / contains-milk status

Badges appear both on search/listing pages (compact) and on individual
product pages (full, with a link to the source record).

## How it works

1. A content script scans the page for product cards (listings) or the
   product detail block (PDP), and extracts a barcode (EAN/GTIN) when
   available, falling back to the product name.
2. It asks the background service worker to look the product up.
3. The background worker queries [Open Food Facts](https://world.openfoodfacts.org)
   — first the product API by barcode (exact match, `world.openfoodfacts.org`),
   then the newer search API by name if no barcode was found
   (`search.openfoodfacts.org` — the legacy `cgi/search.pl` endpoint is
   deprecated/unreliable).
4. In parallel, it checks the product name/brand against a curated
   brand-level EU/non-EU list (see below). If Open Food Facts didn't return
   a confirmed origin, a curated-list match fills that gap.
5. The merged result is cached in `chrome.storage.local` for 30 days
   (3 days for misses, so those get retried sooner) and translated into
   EU-origin / gluten / lactose badges injected next to the product.

Open Food Facts is a free, open, community-maintained database. Coverage is
good for major branded products but incomplete for some private-label items,
and — importantly — its `origins`/`manufacturing_places` fields are populated
for only a small minority of products, even well-known ones (verified this
by spot-checking real entries for Compal and Mimosa). Two fallbacks handle
that gap, in order of confidence:

- **Curated brand list** (see below): brand-level, but has explicit
  EU/non-EU answers for well-known brands OFF leaves blank.
- **Sold-in-country inference**: if a product is registered as sold only in
  a single EU country, that's shown as a lower-confidence "🇪🇺~ provável"
  badge (dashed border) rather than a confident one — sold-in isn't the same
  as made-in, so this is never used to claim non-EU, only a soft EU signal.

Treat every badge as a helpful signal, not a certified guarantee — the
tooltip on each one explains exactly where its verdict came from. The
lactose badge specifically uses "contains milk" as a proxy for "not
lactose-free" (Open Food Facts has no direct lactose-content field).

### Curated brand list (escolho.eu)

`data/curated-brands.json` is a structured snapshot of
[escolho.eu](https://escolho.eu)'s list of non-European brands to avoid and
their national/European alternatives (only the `Alimentação`, `Higiene
pessoal & Cosmética`, and `Limpeza` categories are used — the rest, e.g.
digital services and fashion, won't appear on a grocery site).
`lib/curated-brands.js` indexes it and matches product names/brands against
it with word-boundary matching (accent- and case-insensitive).

**This dataset is meant to be updated without shipping a new extension
version.** Currently it only loads the bundled snapshot, since it isn't
hosted anywhere yet. To make it remotely updatable:

1. Host `data/curated-brands.json` somewhere with a stable URL (a raw GitHub
   URL from this repo once it's pushed, a Gist, or your own hosting).
2. Set `REMOTE_URL` at the top of `lib/curated-brands.js` to that URL.
3. Add that host to `host_permissions` in `manifest.json`.

Once set, the background worker fetches it with a 24h cache, falling back to
the last good cached copy (or the bundled snapshot) if the fetch fails — so
a broken/unreachable URL never breaks the extension, just staleness.

To refresh the data from an updated CSV export, re-run the conversion: the
CSV has columns `Categoria, Subcategoria, Marca(s) a Evitar (separated by
" - "), Alternativas Nacionais/Europeias a Escolher (separated by "; ", each
formatted as "Brand (Country)" or "Brand (Country1/Country2)")`.

## Sites

| Site | Platform | Status |
|---|---|---|
| continente.pt | Salesforce Commerce Cloud (confirmed) | Shared SFCC adapter |
| auchan.pt | Salesforce Commerce Cloud (confirmed) | Shared SFCC adapter |
| pingodoce.pt | Unknown (blocks automated fetches) | Best-effort generic adapter — **needs live verification** |

Continente and Auchan both run on Salesforce Commerce Cloud, which uses a
standardized storefront markup (SFRA), so they share one adapter
(`content/sites/sfcc-common.js`). Pingo Doce's platform couldn't be
fingerprinted remotely, so `content/sites/pingodoce.js` uses generic
heuristics (data-testid patterns, JSON-LD product schema) that will likely
need a tweak after inspecting the live site.

## Load it in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this folder
4. Visit continente.pt / auchan.pt / pingodoce.pt, search for a product, and
   open a product page

## If badges don't show up on a site

This usually means the CSS selectors in the adapter don't match that site's
current markup (retailers restyle their sites over time).

1. Open the site, right-click a product card → Inspect
2. Find the repeating card element and note its class name / `data-pid` /
   `data-testid` attributes, and the element holding the product name
3. Open `chrome://extensions`, click the service worker / inspect views for
   this extension to see console warnings
4. Update the relevant selectors:
   - Continente / Auchan: `content/sites/sfcc-common.js` (`cardSelector`,
     `nameSelectors`, `pdpNameSelectors`)
   - Pingo Doce: `content/sites/pingodoce.js` (`CARD_SELECTORS`,
     `NAME_SELECTORS`, `PDP_NAME_SELECTORS`)
5. Reload the extension (⟳ icon on `chrome://extensions`) and refresh the page

## Project layout

```
manifest.json
background/background.js      # service worker: OFF lookups + curated-brand merge + caching
lib/openfoodfacts.js          # Open Food Facts API client + EU/allergen logic
lib/curated-brands.js         # escolho.eu brand list: indexing, matching, remote fetch
lib/eu-countries.js           # EU-27 country tag list
lib/cache.js                  # chrome.storage.local cache with TTL
data/curated-brands.json      # bundled snapshot of the curated brand list
content/common.js             # shared badge rendering, messaging, scanning
content/common.css            # badge styles
content/sites/sfcc-common.js  # shared adapter for Continente + Auchan (SFCC)
content/sites/continente.js
content/sites/auchan.js
content/sites/pingodoce.js    # generic best-effort adapter
```

## Extending to other sites / browsers

- **New supermarket site**: add a `content/sites/<site>.js` adapter (reuse
  `sfcc-common.js` if the site also runs Salesforce Commerce Cloud), and
  register it in `manifest.json`'s `content_scripts`.
- **Firefox**: the codebase avoids MV3-only APIs beyond the manifest and
  service worker background, so porting mainly means adding a
  `manifest.firefox.json` (Firefox still supports MV2 background scripts,
  or MV3 with `background.scripts` instead of `service_worker`) — the
  `lib/` and `content/` code should work unchanged.

## Known limitations (v0.1)

- Barcode extraction relies on heuristics (`data-pid` length, JSON-LD
  `gtin`/`sku` fields) since these sites don't expose a documented API.
- Name-based fallback search picks Open Food Facts' top result, which can
  occasionally mismatch for generic/private-label product names.
- Pingo Doce selectors are unverified against the live site.
