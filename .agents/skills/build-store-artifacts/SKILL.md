---
name: build-store-artifacts
description: Prepare OrigEU extension releases, including version bumps, Git tags, GitHub release notes, and verified Chrome and Firefox ZIPs. Use for a new release or store package; store submission is a separate action.
---

# Release OrigEU and build store artifacts

Produce separate ZIP files from the same reviewed source revision. `manifest.json` is the Chrome manifest; `manifest.firefox.json` is the Firefox manifest and must be staged under the name `manifest.json`. The two manifests intentionally use different `background` entries. Read `README.md` and both manifests before packaging.

## Preflight

- Check the working tree, latest published release and tag, source revision, and intended version. For a requested new release, choose the next version from the actual changes, bump **both** manifests before packaging, and confirm the new version/tag does not already exist. For packaging alone, do not silently change versions. Ensure browser-independent metadata, permissions, content script patterns, and file paths stay in sync. Preserve Firefox's `browser_specific_settings` and each browser's distinct background configuration.
- Confirm `lib/config.js` exists and `BACKEND_URL` points to the intended deployed backend rather than the `YOUR-SUBDOMAIN` example. It is gitignored but imported at runtime by `lib/own-brands.js` and `lib/eu-status.js`. If the correct release URL is unavailable, report the missing input and do not present a placeholder package as publishable.
- Before packaging or rollout, review `extDescription` in every `_locales/*/messages.json` against the current manifest site matches and supported-sites table. Each translation should describe brand-level origin accurately, name only relevant supported supermarkets for that locale's country, or use generic wording when none is relevant. Check the current store length limits, then verify the finalized descriptions inside both ZIPs; a valid manifest alone does not catch stale localized copy.
- Check current official Chrome Web Store and Mozilla Add-ons packaging requirements when preparing a submission, especially if manifests, permissions, or submission rules have changed. Treat the repository's existing manifests as the starting point, not proof of current store acceptance.

## Package

- Stage each browser in a fresh temporary directory. Copy the runtime tree needed by the manifests and module imports: selected manifest as `manifest.json`, `_locales/`, `background/`, `content/`, `data/`, `icons/`, `lib/` (including `config.js`), `popup/`, and `LICENSE`. Include other runtime files only if current code actually requires them. Exclude `lib/config.example.js`, `.git`, `.claude`, `.wrangler`, `backend/`, `node_modules/`, documentation, screenshots, logs, local build output, and `manifest.firefox.json` from both ZIPs. Do not include Chrome's manifest in the Firefox ZIP.
- Zip the contents of each stage directory so `manifest.json` is at the ZIP root. Give the artifacts distinct browser and version names in an output directory outside the stage directories. Do not modify the checked-out manifests just to build the Firefox package.

## Verify and report

- Inspect both ZIP inventories and parse each ZIP's root `manifest.json`. Confirm the expected version, browser-specific background, Firefox Gecko ID, all referenced local assets, and `lib/config.js`. Check that the ZIPs contain no repository metadata, backend code, alternate manifest, or placeholder backend URL.
- Run the browser or store validators available for the two packages. If unavailable, report that limit rather than implying store acceptance. Install or load the staged packages in each browser when practical and check that the extension starts and reads its backend.
- Return links to both ZIPs, their version and SHA-256 hashes, the validation performed, and any remaining release blockers. Artifact generation does not authorize uploading, submitting, or publishing to either store.

## Publish a requested GitHub release

- Compare the release commit with the last published release and write concise notes from that diff. Keep the release commit limited to intended tracked changes; never add `lib/config.js` or generated ZIPs to Git.
- Commit the version bump and any release-workflow edits, then create an annotated `v<version>` tag **at that commit**. Verify the tag points to the commit whose two manifests declare the same version. Push the commit and tag to the established repository remote, then create the GitHub release from that tag with the verified Chrome and Firefox ZIPs attached when they were requested or prepared for this release.
- Confirm the published tag, notes, and assets on GitHub. Publishing a GitHub release does not submit the extension to the Chrome Web Store or Mozilla Add-ons; do that only when requested.
