# Privacy Policy — OrigEU

_Last updated: 2026-09-04_

OrigEU is a browser extension that shows the country of origin of
supermarket products, directly on Continente, Auchan, Pingo Doce, and
Intermarché's websites. This page explains what the extension does and
does not do with your data.

## Short version

OrigEU does not collect, transmit, or sell any personal data. Everything
it needs to show a badge is already in the extension or fetched as public,
non-personal data. Nothing you browse or buy is ever sent anywhere.

## What the extension reads

On continente.pt, auchan.pt, auchan.fr, pingodoce.pt, and intermarche.pt,
the extension's content script reads the product name text already visible on
the page — the same text you can see yourself — to check it against a
local database of brands. This check happens entirely inside your
browser. The product name
is never sent to our server, to us, or to anyone else.

## What gets sent over the network, and why

- **Brand database updates**: the extension periodically fetches the
  public brand-to-country database and the EU/EFTA country list from our
  own Cloudflare Worker API. This is a plain, anonymous download of public
  data — the request carries no information about you, what you're
  browsing, or what you've looked up.
- **Suggesting a brand**: if you use the "suggest a brand" form on an
  "unknown origin" badge, only then does the extension send what you
  typed (brand name, country, optional source link, optional notes) to
  our API, to be reviewed before it's added to the database. This only
  happens if you fill in and submit that form yourself — never
  automatically.

The brand-database fetch doesn't use your IP address for anything.
Submitting the suggestion form does: your IP is used for up to 60 seconds
to enforce a rate limit (max 5 submissions per minute) that stops
automated spam — it's discarded immediately after and never linked to
what you submitted, logged long-term, or used to identify or track you.

## What's stored locally on your device

The extension uses your browser's local storage (`chrome.storage.local`,
never synced or uploaded) to keep:

- Your preferences (whether badges are shown, badge style, whether
  "unknown origin" badges are hidden).
- A cache of brand lookups and the brand database itself, so the
  extension doesn't have to re-fetch data on every page.

This data stays on your device. Uninstalling the extension removes it.

## What we don't do

- No analytics, tracking pixels, or advertising SDKs.
- No cookies set by the extension.
- No account, sign-in, or user identifiers of any kind.
- No data is sold or shared with third parties.

## Permissions

The extension requests:

- **`storage`** — for the local preferences/cache described above.
- **Host access to continente.pt, auchan.pt, auchan.fr, pingodoce.pt,
  intermarche.pt** — to inject the badge into those sites' pages.
- **Host access to `*.workers.dev`** — to fetch the public brand database
  from our own Cloudflare Worker.

No other permissions are requested.

## Open source

OrigEU's full source code — extension and backend — is public at
[github.com/dfloureiro/OrigEU](https://github.com/dfloureiro/OrigEU), so
everything described here can be verified directly in the code rather
than taken on faith.

## Contact

Questions about this policy or the extension's data handling can be
raised as an issue on the
[GitHub repository](https://github.com/dfloureiro/OrigEU/issues).
