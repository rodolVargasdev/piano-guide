# PR 1: Tooling, dev server, container, stack doc

- Base branch: `feat/piano-guide-mvp` (tracker)
- Branch: `feat/piano-guide-mvp-pr1-tooling-container`
- Chain: tracker -> **PR 1 (this)** -> PR 2 -> PR 3 -> PR 4

## Summary

Adds the zero-dependency project skeleton: `package.json` with the `node --test` script, a smoke test with its counter-proof, a static dev server (`tools/serve.mjs`), the multi-stage `Dockerfile` (Node test stage, nginx runtime, non-root, port 8080), `nginx.conf`, `.dockerignore`, a placeholder `index.html`, `docs/STACK_TECNOLOGICO.md` (images, digests, audit) and `README.md` (Docker first).

Not in scope: any application code, the import-map CSP hash (PR 4), three.js (PR 11).

## Images (blocking dependency notice)

- `node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1` (test stage only)
- `nginx:1.30.5-alpine-slim@sha256:32463212baf0e7d91aded2e9b843a4f2b9e017804b8c9d5bae7b51dcef64389c` (runtime)
- `docker scout cves` 2026-10-10: final image and test stage 0 critical, 0 high, 0 medium, 0 low after `apk upgrade`. Details in `docs/STACK_TECNOLOGICO.md`.

## Checks run

- `node --test`: 3 tests pass.
- `docker build -t piano-guide .`: succeeds. Counter-proof: with a forced failing test the build fails (exit 1), restored afterwards.
- `docker run` on 8790: `curl -I /` returns 200 with `Cache-Control: no-cache`, `X-Content-Type-Options: nosniff` and the CSP; process runs as `nginx` (uid 101); `.js` and `.mjs` are served as `application/javascript`.
- Dev server on 8790: `/package.json` returns `application/json`; `..%2f..%2fetc` returns 403.

## Rollback

Revert the commit; nothing else depends on it.
