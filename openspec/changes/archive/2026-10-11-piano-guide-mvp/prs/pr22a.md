# PR 22a: score engraving polish

- Base branch: `feat/piano-guide-mvp-pr21b-finger-markers`
- Branch: `feat/piano-guide-mvp-pr22a-engraving-glyphs`
- Chain: ... -> PR 21b -> **PR 22a (this)** -> PR 22b to 22f
- Start: the score glyphs were rough (bass clef crowded the key signature, natural and rests crude, the turn sign sat on the next finger number, an accidental printed over a neighbouring chord). End: a clean engraving, still hand-drawn SVG paths with no font and no dependency. Not a numbered task: it is the polish the user asked for in PR 22.
- Out of scope: stage, tiers, motion, docs (PR 22b to 22f). Slurs, hairlines, dynamics and pedal signs are still not engraved.

## Summary

- `src/score/glyphs.js` redrawn. A glyph is now `{ strokes: [[path, width]], fill }`: calligraphic clefs made of several strokes whose widths change in small steps (no bump at the joins), a flat as an outline with an open bowl, sharp and natural as polygons that merge, a quarter rest with a heavy bend and a curl, an eighth rest with a ball and a leaf hook, slimmer flags, a turn and mordents with finer line.
- `src/score/layout.js`: the gap before an onset reserves room for its accidental columns (`accidentalRoom`: previous heads, margin, glyph columns, own displaced head). `src/score/draw.js`: a roomier header (clef, then key signature, then time signature), accidental columns 1.4 apart, ties drawn as crescents, finger row 3.2 spaces above the staff; `engraving.js`: ornament signs one space above the top line instead of 1.5.
- `styles/app.css`: tie fill, serif bold italic for the "tr" sign.
- Tests (`tests/score/engraving-polish.test.js`, 7): clockwise polygons (with a reversed-polygon counter-proof), the flat's counter, header clearances, ornaments between the staff and the finger row, and no accidental over a neighbour on both songs and both levels (with a counter-proof that squeezes a chord and must be caught). Existing glyph, draw and engraving tests updated for the new glyph shape.

## Dependency diagram

```
... -> PR 21b -> [PR 22a, this PR] -> PR 22b
```

## Checks (headless Chrome, dev server on 8790, real GPU ANGLE d3d11)

- Full suite: 699 pass, 0 fail.
- Compared before and after at 2x on the Nocturne (Original and Beginner) and Cancer Original: `22-before-score-chopin-original-t200`, `22-after3-score-chopin-original-t200`, `22-before-score-chopin-original-t1800`, `22-after3-score-chopin-original-t1800`, `22-after3-score-cancer-original-t3000`, `22-after3-score-chopin-beginner-t200`, all read. Clefs, three flats, four sharps, naturals, rests, flags, ties and the turn read cleanly; the bass clef no longer touches the key signature; the bar 1 flat no longer sits on a chord; the turn is clear of the finger numbers.
- Seen while iterating: the first sharp and natural had overlapping polygons wound the wrong way and printed hatched (even-odd or opposite winding cancels); fixed by winding every polygon clockwise and testing it.
- Not checked: a reference engraving side by side (the shapes are hand drawn, not traced from a font); small rests and 16th rests were checked only through the draw tests and the Nocturne's eighth rests.

## Rollback

Revert the commit; the glyph shape change is local to `glyphs.js`, `draw.js` and their tests.
