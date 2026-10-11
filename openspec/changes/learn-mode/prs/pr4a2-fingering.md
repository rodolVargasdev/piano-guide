# PR 4a2: Fingering assigner

Branch: `feat/learn-mode-pr4a2-fingering`. Base: `feat/learn-mode-pr4a-transpose-fingering`. Tasks: 4.3, 4.4. Specs: music-theory-generators (fingering assigner with positions and shifts), learn-mode (instructions name the finger; data side).

## Chain context

```
feat/learn-mode-pr4a-transpose-fingering
  ^
feat/learn-mode-pr4a2-fingering         📍 this PR (last of the batch phases 1 to 4)
  ^
feat/learn-mode-pr5a-phrases-steps (next, outside this batch)
```

- Start: transposition exists. End: `assignFingering(groups, { hand, key })` gives fingers, positions and shifts for one hand.
- Follow-up: pr5a (phrases, steps and instructions use it).
- Out of scope: scales, triads and arpeggio tables (Milestone C), any UI.

## What changes

- `src/theory/fingering.js` (new): `assignFingering`, plus `stepOf` and `stepToPitch` helpers. Steps are `octave * 7 + letter`, so a chromatic note takes its letter's step. A run of groups shares one five-step window; the run grows while some anchor still fits every group (greedy longest run, optimal for window coverage). Right hand finger = step - anchor + 1, left hand finger = anchor + 4 - step + 1. Wider groups (up to 12 semitones and three notes) use the stretch rule, everything else is `unplayable` with `null` fingers. Authored fingers pin the anchor, and are always reported as written; pins that disagree end the run.
- `tests/theory/fingering.test.js` (new, 24 tests): the design list (five-finger melody, leap shift, left-hand mirror, triad inversions 1-2-5, 1-3-5, 5-3-1, 5-2-1, octave bass, unplayable split, authored wins, no black-key thumb), plus repeated notes, positions spelled in the key, and 150 seeded random lines for both hands checked against an independent reference counter (the number of positions equals the optimum, fingers stay 1 to 5, and fingers are monotonic inside a position). The reference counter has its own counter-proof test.

## Deviation from the design text (flagged)

The design tie rule (2) says "the thumb on a played note". For the left hand that gives C3 D3 E3 the fingers 3 2 1, but the spec scenario "Left hand mirrors" requires C3 = 5 and E3 = 3. The implemented rule is "the position starts as close as possible to the run's lowest note" (on it when it can): the right thumb or the left little finger takes the lowest note. It satisfies every scenario of the spec and the same rule (1) (no thumb on a black key it plays) comes first. Rules (3) closest to the previous anchor and (4) lowest anchor follow unchanged.

Other decisions: a lone black key is never given the thumb (it gets finger 2 with the position starting one white key lower); two notes on the same step (E4 with Eb4) are `unplayable`, because one finger cannot press both; a group with more than three notes wider than five steps is `unplayable` (arpeggio and scale tables arrive in Milestone C).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/theory tests/core/pitch.test.js`: 83 tests, 83 pass |
| Full suite | `node --test`: 1004 tests, 1004 pass, 0 fail |
| Runtime harness | N/A: pure module, no user-visible surface in this PR |
| Rollback boundary | `src/theory/fingering.js` and `tests/theory/fingering.test.js` |

## Review budget

367 authored changed lines including tests (module about 175, tests about 190), plus this description.
