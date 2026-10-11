# PR 2a4: Converter command and local check

Branch: `feat/learn-mode-pr2a4-import-cli`. Base: `feat/learn-mode-pr2a3-import-converter`. Tasks: 2.4, 2.5, 2.6. Specs: song-import (pure conversion module and thin command, tests never use the private data); private-song-library (the folder never reaches git).

## Chain context

```
feat/learn-mode-pr2a3-import-converter
  ^
feat/learn-mode-pr2a4-import-cli        📍 this PR
  ^
feat/learn-mode-pr3a-i18n
  ^
feat/learn-mode-pr3a2-i18n-ui
  ^
feat/learn-mode-pr4a-transpose-fingering ...
```

- Start: the pure converter exists. End: the owner can run one command and get `songs-private/cancer-private.json` plus its index entry, and a local test proves the real counts.
- Follow-up: pr3a (strings and guards).
- Out of scope: the catalog loading the private index (pr10a).

## What changes

- `tools/convert-hooktheory.mjs` (new): reads the capture (read-only), converts and validates everything in memory, resolves the output and requires it to start with `resolve(root, "songs-private") + sep` (also rejects a `songs-private/` that is a link leaving the repository), exit code 2 on refusal, exit code 1 on any other failure, writes nothing on failure, upserts the entry in `songs-private/index.json`. `--root` replaces the repository root for the tests.
- `tests/import/cli.test.js` (new, 13 tests): spawned with `process.execPath` and a fixed argv into a temporary root. Adversarial outputs (`songs/x.json`, `songs-private/../songs/x.json`, a look-alike folder name, the folder itself, an absolute path elsewhere, a junction to another folder) all exit non-zero and leave the tree unchanged. Missing input, missing URL, failed conversion, invalid index, unknown flag. Counter-proof: a custom output inside `songs-private/` is accepted. The whole file is skipped with a reason when `tools/convert-hooktheory.mjs` is absent.
- `tests/private-local.test.js` (new, 3 tests): skipped with a reason when `songs-private/` is absent. Asserts the real section counts (verse 52 and 14, chorus 34 and 11, bridge 39 and 13), that no lyric field exists and no capture string is copied into the song (the URL and the `user-submitted` kind constant are excluded as intended provenance), and that the generated file validates and equals a fresh conversion byte for byte. It reports counts only.

## Threat matrix response (filesystem write boundary)

| Case | Result |
|---|---|
| `songs/x.json` | refused, exit 2, tree unchanged |
| `songs-private/../songs/x.json` | refused, exit 2 (resolved path leaves the folder) |
| absolute path elsewhere | refused, exit 2, file not created |
| symlinked (junction) `songs-private/` | refused, exit 2, nothing written through the link (skipped with a reason if the OS refuses to create the link) |
| look-alike folder `songs-private-evil/` | refused: the prefix check includes the separator |

## Runtime harness

`node tools/convert-hooktheory.mjs` on the real capture, run once on this machine on 2026-10-11: exit 0, wrote `songs-private/cancer-private.json` and `songs-private/index.json` (both gitignored), summary `intro: 0 notes, 10 chords; verse: 52 notes, 14 chords; chorus: 34 notes, 11 chords; bridge: 39 notes, 13 chords`, 0 warnings. `git status` shows nothing under `songs-private/`. Counts only are recorded here, never melody.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/import tests/private-local.test.js`: all pass, 0 skipped on this machine |
| Full suite | `node --test`: 907 tests, 907 pass, 0 fail; with `songs-private/` temporarily renamed: 907 tests, 904 pass, 0 fail, 3 skipped (the local test, with its reason) |
| Rollback boundary | `tools/convert-hooktheory.mjs`, `tests/import/cli.test.js`, `tests/private-local.test.js` |

## Review budget

About 270 authored changed lines for the command and its tests, about 60 for the local test, plus this description.
