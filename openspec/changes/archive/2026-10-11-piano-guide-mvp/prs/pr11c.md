# PR 11c: Stage, 3D keyboard and scene facade

- Base branch: `feat/piano-guide-mvp-pr11b-scene-core`
- Branch: `feat/piano-guide-mvp-pr11c-scene-modules`
- Chain: tracker -> ... -> PR 11b -> **PR 11c (this)** -> PR 11d
- Start: the pure scene helpers exist. End: the three.js scene modules and the facade with its no-WebGL fallback exist; the player does not use them yet.
- Out of scope: wiring into the player, layout styles and every browser check (PR 11d).

## Summary

Adds `src/scene/stage.js`, `src/scene/keyboard.js`, `src/scene/index.js` and `tests/scene/index.test.js`. The code of task 11.5.

- `stage.js`: `ACESFilmicToneMapping`, sRGB output, background `#0b0d12`, linear fog, warm `SpotLight` key light, cool `DirectionalLight` rim, `HemisphereLight` fill, matte floor, `localClippingEnabled` for the note field of PR 12. Deviation from the task text: ONE `WebGLRenderer` is shared by the whole page (like the shared `AudioContext`) and each visit frees only its own scene resources. Creating and disposing a renderer on every visit left one GL context and its canvas alive per visit in headless Chrome even after `renderer.dispose()` and `forceContextLoss()` (measured: 6 retained canvases after 6 visits and about 25 KB of heap per visit; with the shared renderer the canvas count stays at 1 and the heap converges). The measurements are in PR 11d.
- `keyboard.js`: white and black keys are two `InstancedMesh`es from `core/keyboard-layout`; a pressed key swaps to a precomputed matrix that rotates it about its back edge (always on, also under reduced motion) and takes its hand color through `instanceColor`; one additive glow quad per key (an `InstancedMesh` with a radial falloff drawn on a canvas, scaled to zero while the key is up); a dark keybed and two cheek blocks. No per-frame allocation: matrices and colors are copied from precomputed arrays.
- `index.js`: `createScene(container, { timeline })` never rejects. It confirms `import("three")`, loads the stage and keyboard lazily, builds the fitted keyboard and frames the camera. Any failure (three.js import, WebGL context, module error) shows "3D view unavailable on this device" and returns `nullScene()`, an object with the same interface whose methods do nothing. `render(tick, playing)` takes a second argument so a paused scene lights no key (a small extension of the design's `render(tick)`).
- The facade has no static `three` import, so `src/ui/player.js` can load it lazily and the catalog never downloads three.js. `tests/scene/index.test.js` guards this and has its counter-proof.

## Dependency diagram

```
... -> PR 11b -> [PR 11c, this PR] -> PR 11d
```

## Size

110 + 154 + 79 source and 62 test lines: 405 authored lines plus this description. About 1 percent over the 400-line budget; it is one cohesive module set (stage, keys, facade) and shrinking it would mean deleting comments or tests, which the budget rule forbids. No `size:exception` is requested.

## Checks run

- `node --test tests/scene/index.test.js`: 5 pass (nullScene interface, failed `three` import gives the message, node has no `three` specifier so the real path falls back too, no catalog-path module imports three statically, and the counter-proof that the guard detects a static import). Full `node --test`: 437 pass, 0 fail.
- Counter-proofs (run then restored): removing the message fails 2 tests; adding a static `three` import to the facade fails 1.
- Runtime harness: the modules run only in a browser; they are first exercised in PR 11d.

## Rollback

Remove `src/scene/stage.js`, `src/scene/keyboard.js`, `src/scene/index.js` and `tests/scene/index.test.js`; nothing imports them yet.
