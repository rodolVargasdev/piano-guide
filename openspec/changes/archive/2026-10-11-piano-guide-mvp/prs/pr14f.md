# PR 14f: Score in the player

- Base branch: `feat/piano-guide-mvp-pr14e-score-virtualization`
- Branch: `feat/piano-guide-mvp-pr14f-score-wiring`
- Chain: tracker -> ... -> PR 14e -> **PR 14f (this)** -> PR 15
- Start: the renderer exists but the player shows a placeholder. End: the score is in the page, driven by the single animation loop, styled, documented and checked in the browser. Task 14.3 is checked here. Last PR of Phase 14.
- Out of scope: level switching, the names and Analysis controls and the `view` switch (PR 15), the live reduced-motion wiring of the scene and the card (PR 22).

## Summary

- `src/ui/player.js`: the score slot replaces the placeholder; `createScore` runs right after the slot is in the page (it measures the slot), `score.render(pos.tick)` is called from the existing loop, `resize` and `dispose` are wired, `route.names` (`names=letters` in the hash) is passed through, and a `prefers-reduced-motion` listener calls `score.setReducedMotion` (removed on dispose).
- `styles/app.css`: the score slot (paper background, height `clamp(13rem, 34vh, 21rem)`), hand colors on the labelled noteheads (hollow rings for half and whole notes), ink for the engraved notation, finger, chord, roman and callout text, the red playhead. The scene slot is a little shorter (`clamp(14rem, 36vh, 28rem)`) so scene and score are both on screen at 1440 x 900.
- `README.md`: the route row and a Score section.

## Dependency diagram

```
... -> PR 14e -> [PR 14f, this PR] -> PR 15 -> PR 16
```

## Size

20 lines of player, 158 of CSS, 12 of README, 1 task line and this description: about 235 authored lines.

## Checks (headless Chrome driven over the DevTools protocol, dev server on port 8790, real GPU: ANGLE on an NVIDIA GeForce RTX 3050 Laptop, Direct3D11)

- Full `node --test`: 525 pass, 0 fail.
- Cancer Beginner at 1440 x 900 and 844 x 390: `role="img"`, title "Cancer, Beginner score", description "E major, 4/4, 72 quarter beats per minute, 11 bars.", names "Mi Mi Sol# Si ..." inside the noteheads, finger rows (1 3 5 above, 5 below), chord row E B E B C#m Am, 210 SVG nodes, no console errors. Screenshots read (`14-score-cancer-paused-*`, `14-score-cancer-playing-*`).
- Cursor: while playing the scroll translation moves smoothly (17 distinct positions in 1.5 s) and a seek to the start returns exactly to the paused position (`translate(297 0)`).
- Drift and frame time from the overlay: drift max 21.3 ms (the inter-frame step, same definition and value as PR 12b, so above the 20 ms budget as defined there), frame avg 16.7 ms, p95 16.9 ms at both sizes.
- Reduced motion emulated: 3 distinct positions in 1.5 s (one per beat, 33 px steps), switching it on and off while the page is open takes effect immediately.
- `names=letters` in the hash gives E, G#, B in the noteheads. Leaving the route removes the SVG; after five visits no SVG remains.
- Original (engraved): no Original level exists yet in the data (PR 18 and PR 19), so a temporary demo page (not committed) rendered a 12/8 Eb fragment with ornaments, a grace note, rests, beaming in threes, roman numerals and callouts, plus Cancer in letters at 844 x 390; screenshots read (`14-score-demo-*`).
- Container: `docker build` succeeds with the suite inside; the container on port 8792 serves `application/javascript` for `src/score/render.js` and, under its CSP, the score renders (210 nodes, paper fill applied by the stylesheet, scroll translation moves while playing) with no console errors.
- Not checked: sound, a real phone, bar-by-bar comparison against a published edition (PR 19), and the memory curve of repeated visits beyond the SVG count.
- Known limits: on a phone in landscape the score is small (324 x 144 px, unit clamped at 6); the `view` switch of PR 15 will give it the whole stage. The quarter rest and the natural sign are rough shapes.

## Rollback

Revert `src/ui/player.js`, the score hunk of `styles/app.css` and the README additions; the score modules stay unused.
