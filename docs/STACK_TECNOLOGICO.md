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

## Front-end libraries

| Component | Exact version | Where it is used | Why | Audit | Status |
|-----------|---------------|------------------|-----|-------|--------|
| three.js | 0.186.1 (vendored under `assets/vendor/`) | 3D keyboard scene | Renders the keyboard and falling notes | OSV query, SHA-256 of both files | Pending: added in PR 11 |
