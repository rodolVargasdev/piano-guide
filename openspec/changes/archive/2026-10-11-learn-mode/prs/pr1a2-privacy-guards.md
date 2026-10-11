# PR 1a2: Privacy guards and index visibility test

Branch: `feat/learn-mode-pr1a2-privacy-guards`. Base: `feat/learn-mode-pr1a-silent-rule`. Tasks: 1.6, 1.7, 1.8. Specs: private-song-library (guards), song-data-model (index and file visibility). This PR is the "Split point if over budget" of phase 1 in tasks.md.

## Chain context

```
master
  ^
feat/learn-mode (tracker, draft, no merge)
  ^
feat/learn-mode-pr1a-silent-rule
  ^
feat/learn-mode-pr1a2-privacy-guards   📍 this PR
  ^
feat/learn-mode-pr2a-converter
```

- Start: pr1a (schema, silent rule).
- End: tests fail when the private folder could reach git or the public index.
- Follow-up: pr2a (pitch helpers and converter). The `.dockerignore` and Dockerfile guards arrive in pr12a.
- Out of scope: production code. This PR only adds tests and one pure helper module for them.

## What changes

- `tests/privacy-guards.js` (new): pure guards (`ignoresPrivateFolder`, `privatePathsIn`, `privateRefsInIndex`, `declaresPrivate`, `trackedPaths`).
- `tests/privacy.test.js` (new): `.gitignore` has `songs-private/`; no `songs/*.json` declares private; the public index never names `songs-private/`; no tracked path starts with `songs-private/` (from `git ls-files -z`, spawned without a shell in the repo root taken from `import.meta.url`).
- `tests/songs.test.js`: every index entry declaring `visibility` matches its song file through `visibilityMismatch`.

## Threat matrix response

| Case | Response |
|---|---|
| Git repository selection (`git -C`, relative or absolute paths) | The test spawns `git ls-files -z` with `cwd` fixed to the repo root from the test file URL; nothing comes from input; no shell |
| No `.git` (Docker build stage) | `trackedPaths` returns a skip reason; asserted on a temp directory without `.git` |
| A private path in the tracked list | Counter-proof fixture list with `songs-private/cancer-private.json` (also dot-slash and backslash forms) makes the guard report it |

## Spec scenarios covered

Ignore entries present (`.gitignore` half); private flag in the public folder; index and file disagree; public index never points into the private folder; a private file is staged; clean clone (no `songs-private/` needed).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/privacy.test.js tests/songs.test.js`, all pass, 0 skipped on a machine with git |
| Full suite | `node --test`: 805 tests, 805 pass, 0 fail |
| Counter-proofs | every guard has a failing fixture asserted in the same file; the skip path is asserted without `.git` |
| Runtime harness | N/A: guard tests only; the real `git ls-files` run is part of the test itself |
| Rollback boundary | `tests/privacy-guards.js`, `tests/privacy.test.js` and the three added tests in `tests/songs.test.js` |

## Review budget

About 150 authored changed lines including this description; tests only.
