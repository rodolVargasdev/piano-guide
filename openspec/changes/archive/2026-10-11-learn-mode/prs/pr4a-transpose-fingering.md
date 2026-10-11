# PR 4a: Seeded random, keys and transposition

Branch: `feat/learn-mode-pr4a-transpose-fingering`. Base: `feat/learn-mode-pr3a2-i18n-strings`. Tasks: 4.1, 4.2. Specs: music-theory-generators (transposition preserves intervals and respells, key orders), learn-mode (transposition toggle, data side). Fingering (4.3 and 4.4) moves to pr4a2 to keep each slice reviewable.

## Chain context

```
feat/learn-mode-pr3a2-i18n-strings
  ^
feat/learn-mode-pr4a-transpose-fingering   📍 this PR
  ^
feat/learn-mode-pr4a2-fingering
  ^
feat/learn-mode-pr5a-phrases-steps (next, outside this batch)
```

- Start: i18n done. End: `transposeSong` can produce a letter-correct copy of a level in another key; the seeded generator and the key list exist.
- Follow-up: pr4a2 (fingering), then Milestone A phase 5.
- Out of scope: any UI, fingering, `keyOrder` (completed in the practice slice).

## What changes

- `src/theory/random.js` (new): `mulberry32(seed)`, `shuffle(list, rng)`.
- `src/theory/keys.js` (new): `TONICS` (circle of fifths), `circleOfFifths()`, `introOrder()`, `scaleOf(tonic)`.
- `src/theory/transpose.js` (new): `smallestMove`, `transposeChordSymbol`, `transposeSong(song, levelId, targetTonic)`.
- Tests: `tests/theory/random.test.js`, `keys.test.js`, `transpose.test.js` (23 tests: E to C scenario, D5 to Bb4 with the key-based `transpose` as counter-proof, all 144 tonic pairs, chord round trips over the 12 targets, intervals preserved over 12 seeded random melodies times 12 targets, range-first fixture and its counter-proof, low-bass protection, per-hand octave rule, identity, privacy kept, RangeError naming the hand).

## Decisions and deviations

- `transposeSong` returns a song holding only the chosen level (other levels are in the old key and would mislead), drops `transposeTo`, empties `lesson.<level>.handPositions` (their texts name the original key) and drops authored `finger`, `fingeringSource` and `label` (all belong to the original key). Identity returns the notes untouched, authored fingers included.
- The octave rule is implemented as designed (range first, then closest to C4 right or C3 left, ties to 0 then lower). The spec sentence "the winner MUST be no farther from C4 than the original whenever such an in-range candidate exists" cannot hold in general for shifts of {0, +12, -12} (a hand already centered on C4 moved by 5 semitones is always farther). The test covers the scenario as written (a melody above C4 moved down a third). Flagged for the verify phase.
- A mutation check was run by hand: removing the range filter makes the range-first and the RangeError tests fail (2 failures), then restored.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/theory`: 34 tests, 34 pass |
| Full suite | `node --test`: 980 tests, 980 pass, 0 fail |
| Runtime harness | N/A: pure modules, no user-visible surface yet |
| Rollback boundary | `src/theory/random.js`, `keys.js`, `transpose.js` and their tests |

## Review budget

518 authored changed lines before this description (random and keys 148, transposition and its tests 370). Above the 450 threshold; the transposition module and its tests do not split cohesively (the tests are the specification of the octave rule). Recommendation: `size:exception` for this slice.
