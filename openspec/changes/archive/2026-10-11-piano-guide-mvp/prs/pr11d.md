# PR 11d: Scene wired into the player

- Base branch: `feat/piano-guide-mvp-pr11c-scene-modules`
- Branch: `feat/piano-guide-mvp-pr11d-scene-wiring`
- Chain: tracker -> ... -> PR 11c -> **PR 11d (this)** -> PR 12a
- Start: the scene modules exist but nothing uses them. End: opening a song shows the lit 3D keyboard, with a message and a working player when WebGL is unavailable. Tasks 11.5 and 11.6 are checked here.
- Out of scope: falling notes, camera reframing on the range toggle and the sync check (PR 12).

## Summary

Changes `src/ui/player.js`, `styles/app.css` and `tasks.md`.

- `playerView({ ..., loadScene })`: after mounting, an async block does `await loadScene()` (default `import("../scene/index.js")`) and `createScene(sceneSlot, { timeline })` inside `try`. A failed import leaves the message "3D view unavailable on this device"; `createScene` itself returns a null scene when WebGL fails. If the player was closed meanwhile, the created scene is disposed.
- The single rAF loop now calls `scene.render(pos.tick, engine.isPlaying())`. A `resize` listener calls `scene.resize()` and requests a frame; `dispose()` removes it and calls `scene.dispose()`.
- CSS: the scene slot has a fixed height (`clamp(16rem, 52vh, 34rem)`; 9rem in phone landscape so the transport stays on screen), the canvas fills it, and the landscape stage grid is now `3fr 2fr`.

## Dependency diagram

```
... -> PR 11c -> [PR 11d, this PR] -> PR 12a
```

## Size

38 added and 8 removed lines in the player, 24 and 1 in CSS, 4 in `tasks.md` and this description: about 110 authored lines. Within the 400-line budget.

## Checks run

- Full `node --test`: 437 pass, 0 fail.
- Headless Chrome (DevTools protocol, scratch scripts; software WebGL through SwiftShader, so frame times are not those of a real GPU), dev server on port 8790:
  - Desktop 1440 x 900 and 844 x 390: the keyboard renders in the player, keys depress and take the hand colors (right orange, left blue) with a soft additive glow while playing; both screenshots were read. No horizontal scroll; at 844 x 390 the transport is fully visible (page height 390).
  - The catalog requests no three.js (0 matching resources); opening a song downloads `three.module.min.js` (384 KB) and `three.core.js` (406 KB).
  - WebGL disabled (`--disable-3d-apis --disable-webgl`): the slot shows "3D view unavailable on this device", no canvas, Play reaches `playing`, the readout advances and the `AudioContext` is `running`. three.js logs its own context error to the console in this case (expected).
  - Navigation catalog to player to catalog: 0 canvases left in the document. Heap over 15 cycles after a warm-up: 2856, 3198, 3435, 3463 KB (converging); over 40 cycles in 8 batches of 5: 3004 to 3513 KB with batch growth falling to 2 to 10 KB (the 9b baseline without a scene was flat at about 1070 KB). A first version that created a `WebGLRenderer` per visit grew linearly (about 25 KB and one retained canvas per visit even with `dispose()` and `forceContextLoss()`); bisecting showed it only happens once something is drawn, and a plain WebGL canvas without three.js does not leak. The fix is the single shared renderer of PR 11c.
  - Container: `docker build -t piano-guide .` succeeds (suite inside, vendor guard included); the container on port 8790 serves `application/javascript` for `src/scene/index.js` and the vendored files with a one-year cache, and under its CSP the scene renders with no console errors.
- Not checked: a real GPU, a real phone, sound, and the 6x CPU throttle (PR 22).

## Rollback

Revert this commit: the player returns to the placeholder slot and no module imports `src/scene/index.js`.
