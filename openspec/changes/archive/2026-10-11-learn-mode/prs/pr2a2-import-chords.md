# PR 2a2: Chord derivation for the Hooktheory converter

Branch: `feat/learn-mode-pr2a2-import-chords`. Base: `feat/learn-mode-pr2a-converter`. Tasks: part of 2.3 (the "Chords" rule of the converter). Specs: song-import (sections, chords and a simple left hand; chord quality derivation amended in the design).

## Chain context

```
feat/learn-mode-pr2a-converter
  ^
feat/learn-mode-pr2a2-import-chords     📍 this PR
  ^
feat/learn-mode-pr2a3-import-converter
  ^
feat/learn-mode-pr2a4-import-cli
```

- Start: pitch helpers exist (pr2a). End: a pure `deriveChord` turns the Hooktheory chord fields into a symbol and roman numeral.
- Follow-up: pr2a3 uses it inside `convertHooktheory`.
- Out of scope: notes, beats, sections, the song object, the CLI.

## What changes

- `src/import/chords.js` (new): `deriveChord(chord, key, path)` returns `{ ok: true, symbol, roman, rootName }` or `{ ok: false, errors: [{ path, message }] }`. Fields handled: `root`, `type` (5 or 7), `inversion` (0 to 3, as a slash bass), `applied` (0, 5 secondary dominant, 7 secondary leading-tone), `borrowed` (empty, `minor`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `locrian`, `harmonicMinor`, `phrygianDominant`), `adds` ([9] gives `add9` on a plain major triad), `suspensions` ([2] or [4] replace the third), `alterations` (["#5"] on a major triad gives `aug`). `omits`, `substitutions` and `alternate` are rejected when non-empty.
- `tests/import/chords.test.js` (new, 33 tests).

## Deviation note

The design lists `adds` and `suspensions`; the real capture also carries `alterations: ["#5"]`, which the design did not list. It is supported only on a major triad (`aug`); any other alteration fails naming its path. If the real capture carries it on another quality, the local run in pr2a4 will report it instead of guessing.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/import/chords.test.js`: 33 tests, 33 pass |
| Full suite | `node --test`: 848 tests, 848 pass, 0 fail |
| Runtime harness | N/A: pure module, exercised on the real capture in pr2a4 |
| Rollback boundary | `src/import/chords.js` and `tests/import/chords.test.js` |

## Review budget

About 330 authored changed lines including tests, plus this description.
