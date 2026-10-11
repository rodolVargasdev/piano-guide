# PR 11a: Vendored three.js 0.186.1

- Base branch: `feat/piano-guide-mvp-pr10b-quality-tiers`
- Branch: `feat/piano-guide-mvp-pr11a-vendored-three`
- Chain: tracker -> ... -> PR 10b -> **PR 11a (this)** -> PR 11b -> PR 12a
- Start: no third-party code in the repository. End: three.js 0.186.1 is vendored, audited, documented and pinned by a test; nothing imports it yet.
- Out of scope: the scene code (PR 11b).

PR 11 of the task list is split in two: the vendored files and their audit are a different kind of review (hashes and an advisory lookup) from the scene code.

## Summary

Tasks 11.1 to 11.4, all in one commit as the dependency rule requires.

- `assets/vendor/three.module.min.js` and `assets/vendor/three.core.js` are copied from the portfolio's audited copy (core build only, no addons).
- SHA-256 computed on the copies (PowerShell `Get-FileHash` and `sha256sum` agree), equal to the expected values: module `3bc833fceb6577bd1a380388f832ae61cd6e2f78ad02b0bf0d5adf5a4a9334fe`, core `3b346151f65ffdfca3e4c002bd58966b78c423087fb48a873f83200de1bffc48`. The stored git blobs hash the same.
- OSV query for npm `three` 0.186.1, run on 2026-10-10: HTTP 200 with an empty result, so no advisory.
- `docs/STACK_TECNOLOGICO.md` records version, hashes, source, why vendored, rejected alternatives, audit method, date and result.
- `tests/vendor.test.js` pins both hashes and requires them (and the version) in the stack document.
- Additions beyond the task text, all small and tied to the guard: `.gitattributes` (`assets/vendor/* -text`) so the `core.autocrlf` setting used on this machine can never rewrite the hashed bytes; the Dockerfile test stage now copies `assets/vendor/` and the stack document, and `.dockerignore` lets that one document through, so the guard also runs inside the image.

## Dependency diagram

```
... -> PR 10b -> [PR 11a, this PR] -> PR 11b -> PR 12a
```

## Size

Authored: 73 lines (41 test, 18 stack document, 8 task checkboxes, 5 Dockerfile, `.dockerignore` and `.gitattributes`) plus this description: about 115. The two vendored files (26 lines of minified code, about 800 KB) are excluded from the budget per the tasks file.

## Checks run

- `node --test tests/vendor.test.js`: 5 pass. Full `node --test`: 419 pass, 0 fail.
- Counter-proof: changing the last hex digit of the core hash in the stack document fails 1 test; restored. A one-byte change to the file is shown by a test to produce a different hash.
- `docker build -t piano-guide .`: succeeds with the guard running in the test stage.
- Not checked: that the browser loads the files (nothing imports them until PR 11b).

## Rollback

Remove `assets/vendor/`, `tests/vendor.test.js`, `.gitattributes`, the two Dockerfile `COPY` lines, the `.dockerignore` exception and the three.js section of the stack document.
