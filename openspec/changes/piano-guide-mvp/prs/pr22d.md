# PR 22d: section camera tweens and reduced motion

- Base branch: `feat/piano-guide-mvp-pr22c-quality-watchdog`
- Branch: `feat/piano-guide-mvp-pr22d-camera-reduced-motion`
- Chain: ... -> PR 22c -> **PR 22d (this)** -> PR 22e, PR 22f
- Start: the camera has one fixed pose and only the score honors reduced motion. End: the camera frames each section and tweens between them; the live reduced-motion preference reaches the scene as well. Task 22.3 is checked here.
- Out of scope: the catalog page (PR 22e), docs, the drift metric and the final scan (PR 22f).

## Summary

- `src/scene/camera.js`: pure helpers `sectionIndexAt`, `sectionSpan`, `focusPose`, `smoothstep`, `lerpPose` (writes into a given pose) and `TWEEN_MS` (1400).
- `src/scene/camera-director.js`: `createCameraDirector({ apply })` with `layout`, `at(tick, nowMs)`, `setReducedMotion`, `animating`, `info`; one reused pose, a cut on the first call, under reduced motion and on a new layout, a tween otherwise.
- `src/scene/index.js`: the director replaces the fixed pose (re-laid on build, resize and range change), `animating()` and `setReducedMotion` reach it. `src/ui/player.js`: the live `matchMedia` listener also calls `scene.setReducedMotion` (and applies a preference set before the scene loaded); the frame loop keeps running while the camera moves, even when paused; the debug overlay shows `camera section N` and `moving`, refreshed on every paused frame.
- Tests: 10 director tests (first cut, ease with the half way point at the middle, small steps with no jump, reduced cut, turning it on mid-move, clearing it resumes at the NEXT boundary only, one-section songs never move, relayout drops a move, empty section, one pose object) and 6 camera tests (`sectionIndexAt`, `sectionSpan` with clamp and null, `focusPose` slide with a counter-proof, narrower focus never farther, `smoothstep`, `lerpPose`). `design.md`: the section framing.

## Dependency diagram

```
... -> PR 22c -> [PR 22d, this PR] -> PR 22e
```

## Checks (headless Chrome, real GPU, dev server on 8790, `?debug=1`; Cancer Original, which has three sections; 1440 x 900 and 844 x 390)

- Full suite: 728 pass, 0 fail.
- Motion allowed, playing across intro to verse: the overlay went `camera section 0`, then `1 moving` at 1.3 s, then `1` at 2.8 s (a 1.5 s move at both sizes; the polling is 80 ms).
- Reduced motion emulated (`Emulation.setEmulatedMedia`): the same boundary showed no `moving` state at either size (a single cut). Cleared live (no reload): the next boundary, verse to chorus, tweened (`2 moving`, then `2`).
- Paused seek across sections: tweens and settles by itself in 1.4 to 1.5 s; the settled frame is byte for byte the frame of a page loaded directly at that tick (scene region compared at both sizes), so the tween lands on the exact framing.
- Reduced motion also reaches the score: distinct score positions in 2.5 s of playback at 72 BPM: 48 normally, 3 under reduced motion (a step per beat), 53 after clearing it live. Keys still depress and notes still fall in all three. The stylesheet's global reduced-motion rule (no animations or transitions) covers the lesson card, which has none of its own.
- Screenshots read: `22-camera-before-boundary-1440x900`, `22-camera-after-boundary-1440x900`, `22-camera-chorus-after-paused-seek-1440x900`, `22-camera-chorus-direct-1440x900`.
- Known limit: the wall of falling notes, not the keyboard width, limits the zoom, so a section mostly pans the camera; a real zoom would need a shorter wall. Not checked: a real phone.

## Rollback

Delete `camera-director.js` and revert the helpers in `camera.js`; restore the fixed `framePose` call in `index.js` and the score-only motion listener in `player.js`.
