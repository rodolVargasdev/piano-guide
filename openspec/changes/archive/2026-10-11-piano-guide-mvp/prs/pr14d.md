# PR 14d: Score SVG renderer

- Base branch: `feat/piano-guide-mvp-pr14c-score-draw-marks`
- Branch: `feat/piano-guide-mvp-pr14d-score-render`
- Chain: tracker -> ... -> PR 14c -> **PR 14d (this)** -> PR 14e
- Start: the draw list is pure data. End: `createScore(slot, ...)` builds the SVG, scrolls it under a fixed playhead and steps per beat under reduced motion. Task 14.2 is checked here; its browser check is recorded in PR 14e, where the score is wired into the player.
- Out of scope: virtualization beyond 5000 nodes, the CSS, the player wiring and the README (PR 14e).

## Summary

- `src/score/render.js`: `createScore(slot, { timeline, title, names, analysis, chords })` returning `{ setTimeline, setMode, setHandModes, setReducedMotion, resize, render, dispose }`. One continuous grand staff: staff lines and header (clefs, key signature, time signature) are fixed, the measures sit in a clipped group moved with `translate(playheadX - tickToX(tick) * unit)`, and a fixed playhead line marks the position. The translation is written through the SVG transform API, so the frame path allocates no strings.
- `render(tick)` is a pure function of the tick: a seek or a loop wrap lands in the same place as playing there.
- Reduced motion: the tick is quantized to the start of the current beat (`quantizeToBeat`, the beat unit of the tempo counted from the pickup, equal to the metronome grid) so the score steps per beat without easing.
- Accessibility: the root `<svg role="img">` carries `<title>` ("<song>, <level> score") and `<desc>` (key, meter, tempo, bars), rebuilt on song or level change.
- The unit shrinks to fit a short slot (and the drawing keeps one height per level); `resize()` rebuilds only when the slot size changed. All song text reaches the DOM through `textContent`.
- `tests/score/fake-dom.js`: a small SVG stand-in so the renderer runs under node (it has no `innerHTML` on purpose).

## Dependency diagram

```
... -> PR 14c -> [PR 14d, this PR] -> PR 14e -> PR 15
```

## Size

158 lines of renderer, 140 of tests, 61 of the fake DOM, 1 task line and this description: about 395 authored lines.

## Checks

- `node --test tests/score/render.test.js`: 11 pass, 0 fail. Full suite passes.
- Counter-proofs run: removing the beat quantization fails the reduced-motion test; rounding instead of flooring the beat fails 3 tests. Both restored.
- Runtime harness: the renderer ran in headless Chrome against Cancer Beginner before this split (details in PR 14e); in this PR it is exercised under node through the fake DOM only.

## Rollback

Delete `src/score/render.js`, `tests/score/render.test.js` and `tests/score/fake-dom.js`; uncheck 14.2.
