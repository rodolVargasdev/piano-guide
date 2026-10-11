# PR 5b2: UI and score tests stop naming the public chords-only song

Branch: `feat/learn-mode-pr5b2-ui-test-migration`. Base: `feat/learn-mode-pr5b-test-migration`. Task: 17.4. Specs: song-catalog (tests must stop depending on the public chords-only song).

## Chain context

```
feat/learn-mode-pr5b-test-migration
  ^
feat/learn-mode-pr5b2-ui-test-migration      this PR
  ^
feat/learn-mode-pr6b-catalog-swap
```

## What changes

Five test files used the lowercase id of the public song (and one a title) as a plain string, never reading its file (see the re-measure table in pr5b):

| File | Change |
|---|---|
| `tests/ui/level-select.test.js` | the storage-key id: `example-song` (17 occurrences) |
| `tests/ui/router.test.js` | hash and `isSongId` examples: `example-song`, and `Example-Song` for the uppercase-is-invalid case (10) |
| `tests/ui/router-dispatch.test.js` | hash ids of the fake views: `example-song` (9) |
| `tests/ui/player.test.js` | the debug-flag URLs: `example-song` (5) |
| `tests/score/render.test.js` | the score title: `Example Song` (4) |

The private id (`cancer-private`) and its cases are untouched: they belong to the private library design and the converter. `tests/songs.test.js` and the engraving guard were migrated in pr5b.

No assertion changed meaning: every expectation was rewritten with the same replacement as its input (for example `piano-guide:level:example-song`).

## Counter-proofs

A mechanical rename needs none of its own; the evidence that the dependency is gone is the full suite with the public song's file and index entry absent (run in pr5b, repeated in pr6b where the file is really deleted).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/level-select.test.js tests/ui/router.test.js tests/ui/router-dispatch.test.js tests/ui/player.test.js tests/score/render.test.js`: all pass |
| Full suite | `node --test`: 1339 tests, 1339 pass, 0 fail |
| Runtime harness | N/A: tests only |
| Rollback boundary | the five test files |

## Review budget

76 changed lines (38 added, 38 removed), plus this description.
