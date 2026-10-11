# PR 13b: Score layout, stems, beams and computed rests

- Base branch: `feat/piano-guide-mvp-pr13a-score-layout-core`
- Branch: `feat/piano-guide-mvp-pr13b-score-layout-engraving`
- Chain: tracker -> ... -> PR 13a -> **PR 13b (this)** -> PR 13c
- Start: `layoutScore` places notes and accidentals. End: it also decides stems, beams and rests for gaps. Tasks 13.1 and 13.2 are checked in PR 13c, which completes them.
- Out of scope: ties, tuplet brackets, grace notes and ornament positions (PR 13c); any SVG (PR 14).

## Summary

- `src/score/engraving.js` (pure): `placeStems` (farthest note from the middle line decides; with two voices in a staff voice 1 goes up and voice 2 down; adjacent steps of a chord alternate sides), `placeBeams` (12/8 and 6/8 in dotted-quarter groups of three, other meters per beat; a rest or a longer value ends a run; one beam line with slope at most 2 half-spaces and stems of at least 3 sp; secondary beams for sixteenths and shorter), `computedRests` (gaps of voice 1 in each staff with notes, split at barlines, longest values first).
- `src/score/layout.js` calls them and returns `beams`; computed rests are added only when the level is not `strictBars`.
- `src/core/timeline.js`: `resolveLevel` copies `strictBars`.

## Dependency diagram

```
... -> PR 13a -> [PR 13b, this PR] -> PR 13c -> PR 14a ...
```

## Size

139 lines of engraving, 103 of tests, 8 in layout, 1 in timeline, 2 in the older suite helper and this description: about 285 authored lines.

## Checks

- `node --test tests/score/*.test.js`: 28 pass, 0 fail. Full suite: 475 pass, 0 fail.
- Counter-proofs run: grouping 12/8 by beat instead of dotted quarter fails 2 tests; always computing rests fails 6; letting a rest count as beamable fails 1. All restored.
- Runtime harness: N/A, pure module with no runtime boundary.

## Rollback

Delete `src/score/engraving.js` and its suite, revert the calls in `layoutScore` and the `strictBars` line in `resolveLevel`.
