# Technology stack

Every third-party component of Piano Guide, with its exact version, why it is used, the alternative that was rejected, and how its safety was checked. This file is updated in the same commit that adds or changes a dependency.

The application itself has no npm dependency: no `node_modules`, no lockfile. Node is used only to run the built-in test runner (`node --test`) and the dev server.

## Container images

| Component | Exact tag and digest | Where it is used | Why | Rejected alternative |
|-----------|----------------------|------------------|-----|----------------------|
| Node (Alpine) | `node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1` | `test` stage of the `Dockerfile` only, never shipped | Runs `node --test` inside the build so the shipped image is the tested build | Host-only tests (the image would not be the tested build); Node inside the runtime image (larger, more attack surface) |
| nginx (Alpine slim) | `nginx:1.30.5-alpine-slim@sha256:32463212baf0e7d91aded2e9b843a4f2b9e017804b8c9d5bae7b51dcef64389c` | Runtime stage, serves the static site as user `nginx` on port 8080 | Small static file server; 1.30 is the current stable line | `nginxinc/nginx-unprivileged` (a second maintainer, not needed because `nginx.conf` already moves pid and temp paths to `/tmp`); `nginx:1.30.5-alpine` (see audit note below) |

Selection notes (checked 2026-10-10 against Docker Hub and nodejs.org):

- Node 24 (Krypton) is the newest line marked LTS in `https://nodejs.org/dist/index.json`; 24.21.0 is its newest patch. Node 26 is not LTS yet.
- nginx 1.30.x is the stable line (1.31.x is mainline); 1.30.5 is its newest patch.
- The digests are the multi-architecture index digests published for those tags on Docker Hub.
- The `-alpine-slim` variant was chosen over `-alpine` because the full variant ships `libxml2` (xslt module), whose advisory CVE-2026-86140 (HIGH) has no fix yet. The site needs none of the extra modules.

### Vulnerability audit

Method: `docker scout cves <image>` (Docker Scout v1.25.0). Date: 2026-10-10.

| Image as pinned (before `apk upgrade`) | Critical | High | Medium | Result |
|----------------------------------------|----------|------|--------|--------|
| `nginx:1.30.5-alpine` | 0 | 6 | 5 | Rejected: includes unfixed HIGH CVE-2026-86140 (libxml2) |
| `nginx:1.31.6-alpine` | 0 | 6 | 5 | Rejected: same unfixed libxml2 advisory |
| `nginx:1.30.5-alpine-slim` | 0 | 2 | 0 | Both HIGH have an Alpine fix (see below) |
| `node:24.21.0-alpine` | 0 | 9 | - | Build stage only; see below |

Fixed-in-Alpine advisories on the pinned slim image: CVE-2026-85091 (zlib, fixed in 1.3.2-r1) and CVE-2026-103111 (pcre2, fixed in 10.49-r0). The `Dockerfile` runs `apk upgrade --no-cache` right after the pinned base so these fixes are applied.

Node image: the HIGH advisories were zlib CVE-2026-85091 (fixed by `apk upgrade`) and eight advisories in packages bundled with npm (`brace-expansion`, `tar`, `undici`, `http-cache-semantics`, `ip-address`). The test stage never runs npm and is not shipped, so the `Dockerfile` deletes npm, npx and its bundled packages from that stage.

Result on the built images (after `apk upgrade`, npm removed), `docker scout cves` on 2026-10-10:

| Built image | Critical | High | Medium | Low |
|-------------|----------|------|--------|-----|
| `piano-guide` (final, shipped) | 0 | 0 | 0 | 0 |
| `piano-guide` test stage (`--target test`) | 0 | 0 | 0 | 0 |

Unfixed advisories accepted: none. Because the result depends on the Alpine package index at build time, the audit is repeated on the final image in the last PR of the chain, and again whenever the pinned digests change.

### Final audit (last PR of the chain, PR 22g)

Date: 2026-10-10 (local time; the container clock reads 2026-10-11 UTC). Both images were built from a clean clone of the repository at commit `COMMIT_A` (`docker build`, whose test stage ran `node --test` inside the build), then scanned with `docker scout cves` (Docker Scout v1.25.0, a newer 1.26.0 exists and was not needed):

| Image | Digest (short) | Packages indexed | Critical | High | Medium | Low | Result |
|-------|----------------|------------------|----------|------|--------|-----|--------|
| `piano-guide` final, shipped | `52bde68f6c35` | 26 | 0 | 0 | 0 | 0 | No vulnerable package detected |
| `piano-guide` test stage (`--target test`) | `a6df419ac05f` | 27 | 0 | 0 | 0 | 0 | No vulnerable package detected |

The commit that records this section changes only documentation, which is not copied into the shipped image (the test stage copies this file only for the vendor hash guard). Unfixed advisories accepted: none.

Changes to the container configuration since the first audit: `nginx.conf` now enables `gzip` for JavaScript, JSON, CSS and SVG (a built-in nginx directive, no module and no new component). No dependency, image or library was added in PR 19 to PR 22: the Chopin data is content (see below), the finger markers, the stage reflections (`PMREMGenerator`) and the catalog hero use code already in the repository or in the vendored three.js core build, and the score glyphs are hand-drawn SVG paths.

## Front-end libraries

| Component | Exact version | Where it is used | Why | Audit | Status |
|-----------|---------------|------------------|-----|-------|--------|
| three.js | 0.186.1 (vendored under `assets/vendor/`, core build only, no addons) | 3D keyboard scene, loaded lazily by the player through the import map | Renders the keyboard and falling notes | OSV query, SHA-256 of both files | In use from PR 11 |

### three.js (vendored)

- Files and SHA-256, computed on the copies in this repository on 2026-10-10 (they match the values recorded for the audited copy in the portfolio):

  | File | SHA-256 |
  |------|---------|
  | `assets/vendor/three.module.min.js` | `3bc833fceb6577bd1a380388f832ae61cd6e2f78ad02b0bf0d5adf5a4a9334fe` |
  | `assets/vendor/three.core.js` | `3b346151f65ffdfca3e4c002bd58966b78c423087fb48a873f83200de1bffc48` |

- Source: the same copy already audited in the portfolio site (`portafolio-site/assets/vendor/`), a jsDelivr build of `three@0.186.1` (`build/three.module.js` and `build/three.core.js`, minified with Terser). `three.module.min.js` imports `./three.core.js`, so both files travel together.
- Why vendored: a CDN import would add a runtime third party; the import map points at `./assets/vendor/three.module.min.js`.
- Rejected alternatives: CDN import (runtime third party); vendoring the `examples/jsm` addons (more files to audit; the scene uses the core build only); Babylon.js or raw WebGL (weight and effort); a canvas-2D-only keyboard (no 3D reflections or perspective).
- Audit: OSV query `POST https://api.osv.dev/v1/query` with package `three`, ecosystem `npm`, version `0.186.1`, run on 2026-10-10: HTTP 200, empty result (`{}`), so no advisory is published for this version on that date. Re-run on 2026-10-10 in the last PR of the chain: HTTP 200, empty result (`{}`) again. Re-run whenever the version changes.
- Unfixed advisories accepted: none.
- Integrity guard: `tests/vendor.test.js` fails if either file changes by one byte or if the hashes above disappear from this document; `.gitattributes` marks `assets/vendor/*` as `-text` so line-ending conversion can never alter the hashed bytes. The portfolio's own stack document prints the core hash with an extra leading character (65 characters); the 64-character value above is the one computed here.

## Content sources (not code dependencies)

| Content | Source | License | Where it is credited | Note |
|---------|--------|---------|----------------------|------|
| Notes of the Nocturne in E-flat major, Op. 9 No. 2 (pickup and bars 1 to 4) | Mutopia Project piece 1590, Mutopia-2014/12/18-1590 (`https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590`), read from the LilyPond file, SHA-256 `f35863a752f5b2805cd50272909b06bb8b1b1a8412d2b549fd13969a4481ab65`, accessed 2026-10-10 | CC BY-SA 3.0 | The song's `sources`, the Original lesson's arrangement note and the README | The share-alike term may reach the derived data (`songs/chopin-nocturne-op9-no2.json`). No `LICENSE` file has been added: how to license the repository against that term is a pending decision of the owner. |
| Cancer (My Chemical Romance) | Chord names and a generic accompaniment only: no lyrics, no melody, not a transcription | Not assessed here (the data holds no lyrics and no melody, which `contentPolicy: "chords-only"` and `tests/songs.test.js` enforce) | The lesson's arrangement note | A decision about the song's rights is the owner's |
