# PR 10a3: Dev server, private library switch

Branch: `feat/learn-mode-pr10a3-dev-server`. Base: `feat/learn-mode-pr10a2-router-player`. Tasks: 10.4, 10.5 (browser check recorded in pr10a2), 10.6. Specs: private-song-library (served from the working tree, never the raw sources).

## Chain context

```
feat/learn-mode-pr10a2-router-player
  ^
feat/learn-mode-pr10a3-dev-server       this PR
  ^
feat/learn-mode-pr11a-beginner-phrases (next)
```

## What changes

- `tools/serve.mjs`: `NO_PRIVATE=1` answers 404 under `/songs-private/`; `/songs-private/sources/` is always 404. `isHidden(fullPath, { root, noPrivate })` compares path segments the way Windows reads them (any case, trailing dots and spaces, a `:` stream suffix); the same check runs on the resolved file after a directory maps to its `index.html`. The file exports `resolveRequestPath`, `isHidden` and `createDevServer` and listens only when run as a script.
- `tests/serve.test.js` (new, 5 tests, whole file skipped with a reason when `tools/` is absent, as in the Docker test stage): pure guard cases and a real server on an ephemeral port over a temporary site.

## Counter-proofs

- The sources file exists on disk and is readable directly; only the guard hides it (404 through the server in any case, with a trailing dot, or percent-encoded letters).
- A name that merely looks alike (`sourcesX`, `songs-private.js`) is not hidden; public songs and `/` still answer 200 under `NO_PRIVATE`.
- Paths outside the root still answer 403, a NUL byte 400.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/serve.test.js`: 5 tests, 5 pass |
| Full suite | `node --test`: 1215 tests, 1215 pass, 0 fail |
| Runtime harness | the real server with `NO_PRIVATE=1` on 8790 (pr10a2, check b) |
| Rollback boundary | `tools/serve.mjs`, `tests/serve.test.js` |

## Review budget

171 authored changed lines including tests (source 88, tests 83), plus this description. The Windows 8.3 short name (`SONGS-~1`) is not folded: dev server only, the container uses nginx.
