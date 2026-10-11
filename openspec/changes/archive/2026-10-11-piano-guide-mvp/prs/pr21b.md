# PR 21b: finger markers drawn and wired

- Base branch: `feat/piano-guide-mvp-pr21a-marker-plan`
- Branch: `feat/piano-guide-mvp-pr21b-finger-markers`
- Chain: ... -> PR 21a -> **PR 21b (this)** -> PR 22a to 22f
- Start: the plan exists, nothing is drawn. End: the 3D scene draws finger markers and shift rings. Tasks 21.1 and 21.3 are checked here (21.2 in PR 21a). This closes PR 21.
- Out of scope: stage polish, quality tiers and the reduced-motion wiring from the player (PR 22; the scene already takes `setReducedMotion`).

## Summary

- `src/scene/markers.js`: one `InstancedMesh` over a canvas atlas (fingers 1 to 5 for each hand plus a ring) with a billboard vertex shader; instance data lives in reused `Float32Array`s. Right hand circle, left hand rounded square, each with a corner R or L (a hand cue that does not depend on color); ghost at 40 percent; the ring has a dark outline under a bright stroke so it reads on white and black keys; drawn last with `depthTest: false`.
- `src/scene/index.js`: builds the markers with the keyboard, updates them in `render`, disposes them; `setReducedMotion` keeps the ring steady.
- `design.md`: the markers are one instanced mesh, not pooled `Sprite`s (decision changed by measurement, below).

## Dependency diagram

```
... -> PR 21a -> [PR 21b, this PR] -> PR 22a
```

## Checks (headless Chrome, dev server on 8790, real GPU ANGLE d3d11; 1440 x 900 and 844 x 390)

- Full suite: 692 pass, 0 fail.
- Draw calls per frame (counted by wrapping the WebGL draw functions): a first version with pooled `Sprite`s measured 20 to 27 on the Nocturne Beginner (design budget: under 20); the instanced version measures 11, constant from tick 0 to 6000.
- Allocation sampling over 10 s of playback (Nocturne Beginner, includeObjectsCollected): the only allocation site in the marker code is the pulse `Math.cos` boxing, 7 to 8 KB in 10 s (about 12 bytes per frame); no growth, no per-marker allocation.
- Beginner (Nocturne): the marker with number 5 on its key, the ghost of the next beat at 40 percent, rings on the shift destinations (C6 with its 5); Original: LH has no `finger`, so those shift keys show a ring and no number, and the keys still light; Cancer: markers on both levels. No console error. Screenshots read: `21-markers-chopin-beginner-t3440-1440x900`, `21-markers-zoom-chopin-beginner-3840`, `21-markers-chopin-original-t3840-1440x900`, `21-markers-cancer-beginner-844x390`.
- Seen and fixed during the check: the first marker size was too small and the white ring was invisible on a white key (now larger, with a dark outline).
- Known limits: ghosts at 40 percent over a pale key are faint (as the spec asks); the shift rule rings almost every left-hand chord of the Nocturne (the bass-to-chord leap), so the left-hand rings pulse nearly every beat; the markers sit on the key front, small on a 1440 px wide page because the keyboard fills only part of the stage (PR 22b re-frames).

## Rollback

Remove `markers.js` and its four lines in `src/scene/index.js`.
