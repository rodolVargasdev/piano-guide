# PR 6a2: Keyboard region

Branch: `feat/learn-mode-pr6a2-region`. Base: `feat/learn-mode-pr6a-matcher-progress`. Task: 6.3. Specs: learn-keyboard (framed to the hand region, readable at phone width).

## Chain context

```
feat/learn-mode-pr6a-matcher-progress
  ^
feat/learn-mode-pr6a2-region            📍 this PR
  ^
feat/learn-mode-pr6a3-lesson-reducer (next)
```

- Start: matcher and progress exist. End: the visible key range of the learn keyboard is a pure function.
- Follow-up: pr9a (the SVG keyboard uses it), pr11a (the Learn view feeds it `maxWhite` from the width).
- Out of scope: the keyboard itself, any UI.

## What changes

- `src/learn/region.js` (new): `learnRegion({ phraseMidis, positionMidis, stepMidis, maxWhite, minWhite = 9, marginWhite = 1 })` gives `{ low, high, mode }`, the MIDI numbers of the lowest and highest white key shown. Computed in white-key indexes, so edges always land on white keys (a black key at the edge extends to the white key beyond it). Phrase mode frames the whole phrase plus the margin, at least nine white keys, centered. When that is wider than `maxWhite`, position mode frames the current position and step instead. The keys of the step and the position are always inside, even above `maxWhite` ("fewer keys is allowed, hiding one is not"); a margin that does not fit is dropped; the range is kept inside A0 to C8 with its width.
- `tests/learn/region.test.js` (new, 8 tests): the fixed cases of the design plus a property test of 300 seeded random inputs (edges white, step and position keys inside, piano range respected, phrase keys inside in phrase mode).

## Counter-proofs

- The same phrase gives phrase mode with a wide screen and position mode with a narrow one.
- A margin that would not fit is dropped (width 5 shows exactly the five-key position) while at width 7 it is kept.
- With a width below the position, the required keys are still visible.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/learn/region.test.js`: 8 tests, 8 pass |
| Full suite | `node --test`: 1063 tests, 1063 pass, 0 fail |
| Runtime harness | N/A: pure function, no user-visible surface in this PR |
| Rollback boundary | `src/learn/region.js` and its test |

## Review budget

147 authored changed lines including tests (source 60, tests 87), plus this description.
