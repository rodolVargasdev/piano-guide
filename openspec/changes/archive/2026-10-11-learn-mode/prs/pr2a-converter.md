# PR 2a: Pitch spelling helpers

Branch: `feat/learn-mode-pr2a-converter`. Base: `feat/learn-mode-pr1a2-privacy-guards`. Tasks: 2.1. Specs: song-import (scale degree to spelled pitch). This is the "Split point" of phase 2 in tasks.md ("2.1 (pitch) as its own PR if the converter exceeds budget"); the rest of the converter is split further in pr2a2, pr2a3 and pr2a4.

## Chain context

```
feat/learn-mode (tracker)
  ^
feat/learn-mode-pr1a-silent-rule
  ^
feat/learn-mode-pr1a2-privacy-guards
  ^
feat/learn-mode-pr2a-converter          📍 this PR
  ^
feat/learn-mode-pr2a2-import-chords
  ^
feat/learn-mode-pr2a3-import-converter
  ^
feat/learn-mode-pr2a4-import-cli
  ^
feat/learn-mode-pr3a-i18n ...
```

- Start: pr1a2. End: `core/pitch.js` can spell scale degrees and move a pitch by letter steps. Existing exports unchanged.
- Follow-up: pr2a2 (chord symbols from degrees), pr2a3 (converter module), pr2a4 (CLI and local check).
- Out of scope: any consumer of the new functions.

## What changes

- `src/core/pitch.js`: export `MAJOR_STEPS`; add `pitchFromParts`, `transposeInterval`, `spellDegree`.
- `tests/core/pitch.test.js`: the design scenarios (D5 moved by -2 steps and -4 semitones is Bb4 and the key-based `transpose` gives A#4 as the counter-proof; F# major has E#; E major degrees 1, 3, 5, b7 and offset -1; Eb major 3 and 4; nulls beyond a double accidental or outside octaves -1 to 9; all 12 tonics against the major scale).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/core/pitch.test.js`: 25 tests, 25 pass |
| Full suite | `node --test`: 815 tests, 815 pass, 0 fail |
| Runtime harness | N/A: pure functions, no runtime boundary |
| Rollback boundary | the three added functions, the `MAJOR_STEPS` export and the added tests |

## Review budget

About 140 authored changed lines including tests, plus this description.
