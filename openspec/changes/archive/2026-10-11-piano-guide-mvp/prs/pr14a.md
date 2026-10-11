# PR 14a: Score glyphs

- Base branch: `feat/piano-guide-mvp-pr13c-score-layout-marks`
- Branch: `feat/piano-guide-mvp-pr14a-score-glyphs`
- Chain: tracker -> ... -> PR 13c -> **PR 14a (this)** -> PR 14b -> PR 14c -> PR 14d
- Start: pure layout exists, nothing draws. End: `src/score/glyphs.js` holds the hand-authored path data the renderer will use. Task 14.1 is checked here.
- Out of scope: the draw list, the DOM renderer, the cursor and the wiring (PR 14b to 14d).

## Summary

- `src/score/glyphs.js`: G and F clefs, flat, double flat, sharp, natural, double sharp, whole, half, quarter and eighth rests, up and down flags, and the ornament signs `turn`, `mordent` and `inverted-mordent`; plus `waveLine(width)` (the wavy line after "tr"), `bracketPath(width)` (the fioritura bracket), `restGlyph` and `restHooks`. Units are staff spaces with y down; each glyph is stroke data, fill data or both.
- `tests/score/glyphs.test.js` parses every path (command letters, whole argument groups, no stray characters) with a checker that has its own counter-proof, and asserts that every accidental the layout can produce has a glyph.

## Dependency diagram

```
... -> PR 13c -> [PR 14a, this PR] -> PR 14b -> PR 14c -> PR 14d -> PR 15
```

## Size

67 lines of glyphs, 74 of tests, 1 task line and this description: about 170 authored lines.

## Checks

- `node --test tests/score/glyphs.test.js`: 6 pass, 0 fail. Full suite passes.
- Visual check, manual and honest: a temporary glyph sheet (not committed) in headless Chrome at 8790; screenshot read. The clefs, flats, sharp, double sharp, rests, flags and ornaments are recognisable. The natural and the quarter rest are rough shapes and will be judged again inside the real score. Nothing was compared against a typeset reference.
- Runtime harness: N/A for the committed code (pure data).

## Rollback

Delete `src/score/glyphs.js` and its suite; uncheck 14.1.
