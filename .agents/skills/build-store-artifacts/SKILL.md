---
name: build-store-artifacts
description: Generate and verify Chrome Web Store and Mozilla Add-ons submission ZIPs for the OrigEU browser extension. Use when asked to build, package, or prepare release artifacts; not for submitting or publishing them.
---

# Build OrigEU store artifacts

Produce separate ZIP files from the same reviewed source revision. `manifest.json` is the Chrome manifest; `manifest.firefox.json` is the Firefox manifest and must be staged under the name `manifest.json`. The two manifests intentionally use different `background` entries. Read `README.md` and both manifests before packaging.

## Preflight

- Check the working tree and identify the exact source revision and intended version. Do not silently change either manifest's version. Ensure versions match and browser-independent metadata, permissions, content script patterns, and file paths stay in sync. Preserve Firefox's `browser_specific_settings` and each browser's distinct background configuration.
- Confirm `lib/config.js` exists and `BACKEND_URL` points to the intended deployed backend rather than the `YOUR-SUBDOMAIN` example. It is gitignored but imported at runtime by `lib/own-brands.js` and `lib/eu-status.js`. If the correct release URL is unavailable, report the missing input and do not present a placeholder package as publishable.
- Check current official Chrome Web Store and Mozilla Add-ons packaging requirements when preparing a submission, especially if manifests, permissions, or submission rules have changed. Treat the repository's existing manifests as the starting point, not proof of current store acceptance.

## Package

- Stage each browser in a fresh temporary directory. Copy the runtime tree needed by the manifests and module imports: selected manifest as `manifest.json`, `_locales/`, `background/`, `content/`, `data/`, `icons/`, `lib/` (including `config.js`), and `popup/`. Include other runtime files only if current code actually requires them. Exclude `.git`, `.claude`, `.wrangler`, `backend/`, `node_modules/`, documentation, screenshots, logs, local build output, and `manifest.firefox.json` from both ZIPs. Do not include Chrome's manifest in the Firefox ZIP.
- Zip the contents of each stage directory so `manifest.json` is at the ZIP root. Give the artifacts distinct browser and version names in an output directory outside the stage directories. Do not modify the checked-out manifests just to build the Firefox package.

## Verify and report

- Inspect both ZIP inventories and parse each ZIP's root `manifest.json`. Confirm the expected version, browser-specific background, Firefox Gecko ID, all referenced local assets, and `lib/config.js`. Check that the ZIPs contain no repository metadata, backend code, alternate manifest, or placeholder backend URL.
- Run the browser or store validators available for the two packages. If unavailable, report that limit rather than implying store acceptance. Install or load the staged packages in each browser when practical and check that the extension starts and reads its backend.
- Return links to both ZIPs, their version and SHA-256 hashes, the validation performed, and any remaining release blockers. Artifact generation does not authorize uploading, submitting, or publishing to either store.
