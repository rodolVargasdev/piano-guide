# PR 4: Shell, router, store, catalog

- Base branch: `feat/piano-guide-mvp-pr3-schema-validator`
- Branch: `feat/piano-guide-mvp-pr4-shell-router-catalog`
- Chain: tracker -> PR 1 -> PR 2 -> PR 3 -> **PR 4 (this)**
- Last PR of the batch (PR 1 to 4); PR 5 onward continues from this branch.

## Summary

Adds the app shell: `index.html` (import map, mount node, module entry), `styles/app.css` (dark theme, catalog layout, `prefers-reduced-motion` rules), `src/main.js`, the observable store (`src/ui/state.js`), the hash router (`src/ui/router.js`: pure `parseHash` plus the dispatcher that disposes the previous view first, also on back), a DOM helper that only uses text nodes (`src/ui/dom.js`), and the catalog (`src/ui/catalog.js`: fetch index, validate, fetch and validate each song in parallel, cards, "Unavailable" cards, error panel). `songs/index.json` starts as `{ "songs": [] }`.

Until the player exists (PR 9), `#/song/<id>` shows: "Song not found" for an id not in the index, the validation reason for a broken entry, and "The player is not available yet" for a valid one.

nginx and Docker:
- The CSP in `nginx.conf` now allows the inline import map by its SHA-256 (closes the placeholder from PR 1). Security headers moved to server level only and cache rules use `expires` (a location-level `add_header` would drop the inherited headers). `location ^~ /assets/vendor/` wins over the `.js` regex location.
- `tests/csp.test.js` fails when the import map and the CSP hash drift apart, with counter-proofs. The Docker test stage now also copies `index.html` and `nginx.conf` so that guard runs in the image build.
- The import map is written on one line on purpose: the hash must not depend on line endings (this machine converts LF to CRLF on checkout).

Deviation from the task list: an extra file `src/ui/dom.js` (tiny element helper) and extra tests (`tests/ui/router-dispatch.test.js`, `tests/ui/catalog.test.js`, `tests/csp.test.js`).

## Size

About 900 authored lines (source and CSS about 480, tests about 420), against the 400-line advisory and the 300 estimate. Cohesive unit; not split or compressed. Recommendation: `size:exception`, or accept as is.

## Checks run

- `node --test`: 272 pass, 0 fail.
- Counter-proof: removing the dispose-before-mount step from the router fails 2 tests; restored.
- `docker build -t piano-guide .` succeeds with the suite inside.
- Container on 8790: `/` 200 `text/html` with `Cache-Control: no-cache`, CSP and nosniff; `/src/main.js` and `/src/ui/router.js` `application/javascript`; `/songs/index.json` `application/json`, no-cache; `.js` under `assets/vendor/` (mounted test file) `application/javascript` with `max-age=31536000`. The nginx access log shows no `three` request on the catalog.
- Headless Chrome (`--dump-dom`) against the container with the real CSP: no CSP or console errors; empty state rendered.
- Headless Chrome against the dev server on 8790, DOM inspected: empty index ("No songs yet"); malformed `index.json` and wrong-shape index (error panel "Song list could not be loaded"); valid card (title, composer, key, BPM, level chip, Open), missing-file card and invalid-song card ("Unavailable" with first reason and full list in `title`); routes `#/song/<known>`, `#/song/<missing file>`, `#/song/<invalid>`, `#/song/nope`, `#/foo` and an encoded `<script>` id (rendered as text, "Song not found").
- Not checked in a real interactive browser: the back button and the Network tab (the dispatcher is covered by `tests/ui/router-dispatch.test.js` with a fake window; the request list comes from the nginx access log). Visual layout was not reviewed on screen.

## Rollback

Remove `index.html` (back to the placeholder), `styles/app.css`, `src/main.js`, `src/ui/*`, the new UI and CSP tests, and restore `nginx.conf` and the `Dockerfile` test stage from PR 3.
