# PR 11b: Pure scene helpers

- Base branch: `feat/piano-guide-mvp-pr11a-vendored-three`
- Branch: `feat/piano-guide-mvp-pr11b-scene-core`
- Chain: tracker -> ... -> PR 11a -> **PR 11b (this)** -> PR 11c -> PR 11d
- Start: three.js is vendored but unused. End: the scene's pure math exists and is tested under `node --test`; no three.js import yet.
- Out of scope: stage, keyboard and facade (PR 11c), player wiring and layout (PR 11d).

PR 11 of the task list is split in four (11a vendor, 11b, 11c, 11d): the scene, wiring and styles came to about 745 authored lines together, so the pure, node-testable part lands first.

## Summary

Adds `src/scene/dims.js`, `src/scene/camera.js`, `src/scene/key-state.js` and their tests. Part of task 11.5 (the camera framing here is also what task 12.2 needs; `camera.js` is created now and extended in PR 12).

- `dims.js`: key lengths and heights, the key-top line (`LANDING_Y`), the wall height of the look-ahead, hand colors (left `#3b82f6` blue, right `#f59e0b` orange) and key rest colors. World axes: x along the keys, y up, z toward the player; key back edges at z = 0.
- `camera.js`: `framePose(width, aspect)` returns `{ position, target, fov }` as plain numbers. The camera looks down 30 degrees; its distance is the smallest at which every corner of the framed box (keybed front, cheeks, top of the note wall) fits the field of view with a 6 percent margin, perspective-correct. Tested by projecting the corners back through the pose.
- `key-state.js`: `updateKeyState(state, timeline, tick, playing, handModes)` fills a reusable `Uint8Array(128)` with the hand bits pressing each key and returns the reused list of keys that changed (zero allocations per frame). A hidden hand lights nothing, a muted hand still does, and a paused scene lights nothing.

## Dependency diagram

```
... -> PR 11a -> [PR 11b, this PR] -> PR 11c -> PR 11d
```

## Size

56 + 25 + 35 source and 73 + 80 test lines: 269 authored lines plus this description. Within the 400-line budget.

## Checks run

- `node --test tests/scene/camera.test.js tests/scene/key-state.test.js`: 13 pass. Full `node --test` on the whole PR 11 working set: 437 pass, 0 fail.
- Counter-proofs (run then restored): shrinking the framing margin fails 2 camera tests (the framing must be tight); lighting keys while paused fails 1 key-state test; ignoring `hidden` fails 1. A test shows a pose computed for a landscape viewport clips on a portrait one.
- Runtime harness: N/A for this PR (pure modules); the browser checks are in PR 11d.

## Rollback

Remove the three modules and their two suites; nothing imports them yet.
