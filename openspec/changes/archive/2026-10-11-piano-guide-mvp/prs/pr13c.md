# PR 13c: Score layout, ties, tuplets, grace notes and ornaments

- Base branch: `feat/piano-guide-mvp-pr13b-score-layout-engraving`
- Branch: `feat/piano-guide-mvp-pr13c-score-layout-marks`
- Chain: tracker -> ... -> PR 13b -> **PR 13c (this)** -> PR 14a
- Start: layout has pitches, accidentals, stems, beams and rests. End: the pure layout is complete. Tasks 13.1 and 13.2 are checked here.
- Out of scope: any SVG or glyph (PR 14).

## Summary

- `src/score/engraving.js`: `placeTies` (from a note marked `tie: true` to the next note of the same pitch in the voice; a tie to nowhere is dropped; it goes opposite the stem), `placeTuplets` (a bracket per `n` consecutive events with the same ratio, on the stem side; an incomplete group has no bracket), `placeGraces` (small, at their written tick, drawn just before the main note) and `placeOrnaments` (sign above the note or its stem; a `fioritura` bracket also spans the following notes whose `role` is `ornament`, a rule PR 19 can adjust once the Chopin data exists).
- `src/score/layout.js` returns `ties`, `tuplets` and `ornaments`.
- Task 13.1 and 13.2 are checked; the tests are split over `layout.test.js` and `engraving.test.js`.

## Dependency diagram

```
... -> PR 13b -> [PR 13c, this PR] -> PR 14a -> PR 14b -> PR 15
```

## Size

83 lines of engraving, 42 of tests, 10 in layout, 2 task lines and this description: about 170 authored lines.

## Checks

- `node --test tests/score/*.test.js`: 32 pass, 0 fail. Full suite: 479 pass, 0 fail.
- Counter-proofs run: a bracket for an incomplete tuplet group fails 1 test; letting the fioritura run past a note without the `ornament` role fails 1 (after tightening the assertion to the exact end). Removing the `tick >= end` condition of `placeTies` is an equivalent mutation (the voice list is already ordered), so it has no failing case.
- Runtime harness: N/A, pure module with no runtime boundary.

## Rollback

Delete the four functions in `src/score/engraving.js`, their tests and the three returned fields in `layoutScore`; uncheck 13.1 and 13.2.
