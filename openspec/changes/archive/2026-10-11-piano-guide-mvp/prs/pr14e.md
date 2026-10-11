# PR 14e: Score virtualization and readable chords in the labelled notation

- Base branch: `feat/piano-guide-mvp-pr14d-score-render`
- Branch: `feat/piano-guide-mvp-pr14e-score-virtualization`
- Chain: tracker -> ... -> PR 14d -> **PR 14e (this)** -> PR 14f
- Start: the renderer mounts every measure and chords of large labelled heads overlap. End: very large scores mount only the measures near the playhead, and chord heads and accidentals no longer collide. Found by looking at the first real render of Cancer Beginner in the browser (screenshots in PR 14f).
- Out of scope: the CSS, the player wiring and the README (PR 14f).

## Summary

- `src/score/render.js`: when the drawing exceeds 5000 nodes (`NODE_LIMIT`, children counted by `countNodes`), each measure is a lazily built group and only the measures within 8 of the playhead (`mountedWindow`) stay in the DOM; a seek mounts the new window and unmounts the old one. Below the limit every measure is mounted once.
- `src/score/engraving.js` and `layout.js`: `metrics.chordStep` is the vertical distance in half-spaces under which two heads of a chord must not share a column, `floor(headW * 2)`: 2 for engraved heads (a second, as before) and 4 for the large labelled heads, so a triad of thirds zigzags (the middle head steps to the other side of the stem) instead of stacking circles on top of each other. The labelled head is a little larger (2.1 sp) so the name stays legible.
- `src/score/draw.js`: accidentals of a chord stack in columns to the left of the whole chord instead of sitting on top of their own head; ledger lines are drawn before the heads so a head covers the line that crosses it (the line used to strike through the name); names use a larger font for one or two characters.

## Dependency diagram

```
... -> PR 14d -> [PR 14e, this PR] -> PR 14f -> PR 15
```

## Size

126 added and 21 removed lines across the renderer, layout, draw and their suites, plus this description: about 175 authored lines.

## Checks

- `node --test tests/score/*.test.js`: 78 pass, 0 fail. Full suite passes.
- Counter-proofs run: disabling virtualization fails 1 test; writing every accidental in the same column fails 1; using the engraved chord step for the labelled heads fails 1. All restored.
- Runtime harness: exercised in the browser in PR 14f.

## Rollback

Revert the virtualization hunks of `src/score/render.js`, the `chordStep` metric, the accidental columns and the draw order of ledger lines.
