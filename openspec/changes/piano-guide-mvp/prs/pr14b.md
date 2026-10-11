# PR 14b: Score draw list, staves, noteheads and names

- Base branch: `feat/piano-guide-mvp-pr14a-score-glyphs`
- Branch: `feat/piano-guide-mvp-pr14b-score-draw-core`
- Chain: tracker -> ... -> PR 14a -> **PR 14b (this)** -> PR 14c -> PR 14d
- Start: layout and glyphs exist. End: `drawScore` turns a layout into plain drawing descriptors for the grand staff in both notations. Task 14.2 is checked in PR 14d, which completes it.
- Out of scope: ties, tuplet brackets, ornament signs, finger and chord rows, analysis rows (PR 14c); the SVG elements, scrolling, playhead, reduced motion, virtualization, title and description, CSS and the wiring (PR 14d).

## Summary

- `src/score/draw.js` (no DOM): `node` and `glyph` helpers, `yOf`, and `drawScore(layout, timeline, { unit, names, handModes })` returning the header (clefs, key signature on both staves, time signature, system line), the staff line positions, and the measures, each holding its own nodes (barlines, bar numbers, noteheads, ledger lines, accidentals, dots, stems, flags, beams, rests).
- Beginner (`labelled`): larger noteheads colored by hand through the class, the name inside (solfege by default, letters on request, a `label` field wins, accidentals as written: Eb4 is "Mib"); half and whole notes are hollow. Original (`engraved`): small rotated heads and no names.
- Hidden hand: its notes, rests and beams are not drawn; staff lines, header and barlines stay.
- The drawing height is fixed per level (taller when the level has analysis entries) so toggling Analysis never rescales the score.
- Song text only ever becomes a `text` node's string; nothing builds markup.

## Dependency diagram

```
... -> PR 14a -> [PR 14b, this PR] -> PR 14c -> PR 14d -> PR 15
```

## Size

150 lines of draw list, 140 of tests and this description: about 325 authored lines.

## Checks

- `node --test tests/score/draw.test.js`: 15 pass, 0 fail. Full suite passes.
- Counter-proofs run: hiding the name inside the head fails 3 tests; ignoring the hidden-hand flag fails 1; dropping the hollow rule fails 2; drawing names in the engraved notation fails 1. All restored.
- Runtime harness: N/A, pure module with no runtime boundary (the browser check is in PR 14d).

## Rollback

Delete `src/score/draw.js` and its suite.
