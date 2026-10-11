# PR 13a: Pure score layout, pitch placement and spacing

- Base branch: `feat/piano-guide-mvp-pr12b-debug-range-docs`
- Branch: `feat/piano-guide-mvp-pr13a-score-layout-core`
- Chain: tracker -> ... -> PR 12b -> **PR 13a (this)** -> PR 13b
- Start: no score code. End: `src/score/layout.js` places notes on the grand staff, builds the key signature, decides accidentals and produces the `tickToX` table. Tasks 13.1 and 13.2 are checked in PR 13b, which completes them.
- Out of scope: stems, beaming, rests from gaps, ties, tuplets, grace notes and ornament positions (PR 13b); any SVG (PR 14).

## Summary

- `src/score/layout.js` (pure, no DOM): `staffPos` (E4 is the first treble line, G2 the first bass line), `keySignature` (flats and sharps with their staff positions for both staves), `durationShape` (value, dots, tuplet aware), `barsOf` (pickup is bar 0), `layoutScore` returning events (one per chord or rest of one hand and voice), ledger lines, accidentals (once per bar per letter and octave, per staff, again after a barline) and the complete anchor table with `tickToX` (monotonic, linear between anchors).
- `src/core/timeline.js`: `resolveLevel` now also copies the song `key`, which the signature needs.
- Spacing grows with the gap to the next onset and is wider for the labelled notation (noteheads carry a name).

## Dependency diagram

```
... -> PR 12b -> [PR 13a, this PR] -> PR 13b -> PR 14a ...
```

## Size

215 lines of layout, 149 of tests, 1 of timeline and this description: about 400 authored lines.

## Checks

- `node --test tests/score/layout.test.js`: 17 pass, 0 fail. Full suite (`node --test tests/*.test.js tests/*/*.test.js`): all pass.
- Counter-proofs run: disabling the accidental comparison fails 5 tests; comparing only against the key signature (ignoring earlier accidentals in the bar) fails 2; both restored.
- Runtime harness: N/A, pure module with no runtime boundary.

## Rollback

Delete `src/score/layout.js` and its suite and drop the `key` line from `resolveLevel`.
