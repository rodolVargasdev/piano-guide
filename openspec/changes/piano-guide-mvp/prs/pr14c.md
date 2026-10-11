# PR 14c: Score draw list, rows and marks

- Base branch: `feat/piano-guide-mvp-pr14b-score-draw-core`
- Branch: `feat/piano-guide-mvp-pr14c-score-draw-marks`
- Chain: tracker -> ... -> PR 14b -> **PR 14c (this)** -> PR 14d
- Start: the draw list has staves, noteheads and names. End: it also draws ties, tuplets, ornament signs, the finger rows, the chord row and the analysis rows. Task 14.2 is checked in PR 14d, which completes it.
- Out of scope: the SVG elements, scrolling, playhead, reduced motion, virtualization, title and description, CSS and wiring (PR 14d).

## Summary

- `src/score/draw.js` gains: ties (arc above or below, opposite the stem), tuplet numbers with a bracket only when the notes are not beamed, ornament signs (turn, mordent and inverted mordent glyphs, trill as "tr" plus a wavy line, fioritura as a bracket), and grace notes are small and carry no name.
- Finger rows: RH numbers sit in a row above the treble staff and LH numbers in a row below the bass staff, lowest note first; a note without `finger` contributes nothing and an event without any draws no row.
- Chord row above the treble staff: the chord `symbol` only, never `roman` or `function`. On by default in Beginner, off in Original, and the `chords` option overrides either way.
- Analysis (Original, option `analysis`): a roman-numeral row under the bass staff from the analysis entries, filled from the chord track where an entry has no numeral at that tick, plus a callout per entry (title in a box, full text as a `title` tooltip child, a span line when `endTick` is present).
- `node` accepts `children` so a callout can be one group. All song text stays a text string.

## Dependency diagram

```
... -> PR 14b -> [PR 14c, this PR] -> PR 14d -> PR 15
```

## Size

70 added and 5 removed lines of draw list, 113 of tests and this description: about 225 authored lines.

## Checks

- `node --test tests/score/draw-marks.test.js`: 10 pass, 0 fail. Full suite: 510 pass, 0 fail.
- Counter-proofs run: counting unfingered notes fails 1 test; printing the roman in the chord row fails 1; always bracketing a beamed tuplet fails 1; always drawing the analysis rows fails 2. All restored.
- Runtime harness: N/A, pure module (the browser check is in PR 14d).

## Rollback

Revert the mark functions and the added `drawScore` lines in `src/score/draw.js` and delete `tests/score/draw-marks.test.js`.
