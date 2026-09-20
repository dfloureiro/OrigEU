---
name: add-supermarket
description: Add or repair a supermarket website adapter in the OrigEU Chrome and Firefox extension. Use for new retailer sites, country storefronts, or broken product badge placement; not for adding brand records to the backend.
---

# Add a supermarket to OrigEU

Work from the current repository state. Read `ARCHITECTURE.md` (especially **Sites** and **Extending to other sites / browsers**), `content/common.js`, and the closest existing adapter before editing. A retailer's site in another country may use unrelated markup; choose the adapter from observed DOM and behavior, not the brand name.

## Establish the site's actual surfaces

- Get the exact shopping hostnames and inspect real product listing or search results, a product detail page or modal, and typeahead suggestions if the site offers them. Use a browser for client-rendered or challenge-protected pages; a server response alone may contain no product markup. Record any surface that cannot be accessed or verified.
- Find stable card, product name, brand, and injection targets. Confirm whether the displayed name already includes the brand. If it does not, combine the brand text with the product name for matching. Avoid ephemeral class hashes where a stable attribute or class prefix exists.
- Check whether badge placement preserves the site's cart controls and makes the badge clickable without triggering an enclosing product link or button. Inspect both compact and full badges where space is tight.

## Implement and register

- Add `content/sites/<site>.js` using `OrigEU.init(...)`; use `OrigEUSfcc.buildConfig(...)` only when the storefront is confirmed to use compatible Salesforce Commerce Cloud markup. Keep site-specific selectors and behavior in the site adapter. Change shared code or CSS only for behavior genuinely shared across sites.
- Add the exact HTTPS match patterns, script order, and `content/common.css` to `content_scripts` in **both** `manifest.json` and `manifest.firefox.json`. The script order is `content/countries.js`, `content/common.js`, optional `content/sites/sfcc-common.js`, then the site adapter. Add only the host permissions needed for the new site. Preserve the browsers' distinct `background` blocks and Firefox's `browser_specific_settings`.
- Update the supported-sites table and setup example in `README.md`, plus the site notes and file map in `ARCHITECTURE.md`. Brand origin records are managed through the backend; adding a site does not imply populating that database.

## Verify

- Parse both manifests and confirm their new host patterns and script entries agree. Check that every referenced local script and CSS file exists.
- Load the extension in Chrome and Firefox when available. Check a listing, detail view or modal, dynamic navigation, and suggestions where applicable. Confirm correct product text, a visible badge, a working badge click, and unaffected shopping controls. If live verification is unavailable, run the strongest checks possible and explicitly report which surfaces remain unverified.
- Summarize the site and hostnames added, the surfaces checked, and any limitations. Do not call selectors verified from a guess or from an empty server-rendered shell.
