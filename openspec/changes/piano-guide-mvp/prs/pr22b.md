# PR 22b: stage reflections, shadows and tier settings

- Base branch: `feat/piano-guide-mvp-pr22a-engraving-glyphs`
- Branch: `feat/piano-guide-mvp-pr22b-stage-reflections`
- Chain: ... -> PR 22a -> **PR 22b (this)** -> PR 22c to 22f
- Start: a flat dark stage with matte keys. End: a sober dark stage with lacquered black keys, ivory white keys, a glossy floor, soft shadows, a warm pool of light and a faint backdrop, each effect tied to a tier. Task 22.1 is checked here.
- Out of scope: the frame-time watchdog and the Auto choice (PR 22c), camera tweens and the reduced-motion wiring (PR 22d), the catalog page (PR 22e), docs and the final scan (PR 22f).

## Summary

- `src/scene/stage.js`: procedural studio through `PMREMGenerator.fromScene()` (long back strip, warm and cool softboxes, ceiling strip), `scene.environment` for the keys and an own `envMap` for the floor (roughness 0.22 on High, 0.9 once reflections are off), key light shadow map 1024 with soft radius, nearly overhead cool light, radial backdrop, additive pool of light under the keyboard, `applyTier(settings)`, `fitKeyboard(width)`.
- `src/scene/keyboard.js`: `MeshPhysicalMaterial` white keys (roughness 0.35, clearcoat 0.3), black keys (roughness 0.18, clearcoat 0.8), lacquered body, casting and receiving shadows, `setGlow(on)`.
- `src/core/quality.js`: `TIER_SETTINGS` and `tierSettings(tier)` (pure): Medium removes the reflections; Low removes shadows, rim light and glow; Minimum sets the pixel ratio to 1 and the horizon to one bar. No tier has a switch for notes, keys or markers.
- `src/scene/index.js`: `setQuality(tier)` applies a tier (the manual selector of PR 16 now works; Auto means High until PR 22c); a rebuild keeps the tier.
- `src/ui/player.js`: changing the quality while paused redraws the scene (it did not, found while checking).
- `design.md`: the stage lighting notes (below).

## Dependency diagram

```
... -> PR 22a -> [PR 22b, this PR] -> PR 22c
```

## Checks (headless Chrome, dev server on 8790, real GPU ANGLE d3d11; 1440 x 900 and 844 x 390)

- Full suite: 701 pass, 0 fail (two new tests for `tierSettings`).
- Draw calls per frame (WebGL draw functions wrapped): High 18, Medium 18, Low 11, Minimum 11, on both songs at both sizes; the budget is under 20.
- Screenshots read for High, Medium, Low and Minimum on the Nocturne and Cancer at both sizes (`22-stage-f-*`, `22-stage-g-cancer-high-844x390`, zooms `22-stage-zoom-high` and `22-stage-zoom-medium`): lacquered black keys show a soft gleam on High and a matte black on Medium; notes, markers and the pool of light do not overlap (markers are drawn last).
- Four traps found while looking and fixed: (1) `material.envMapIntensity` does nothing for `scene.environment` in three r186, so the floor mirrored the studio at full strength (the whole background went gray) until it got its own `envMap`; (2) a glossy floor mirrors a directional light into a hot spot, at the right edge on 844 x 390, until the light moved nearly overhead; (3) `PCFSoftShadowMap` was removed in r186 (a console warning), the default filter softens with `radius`; (4) a tier change while paused did not redraw.
- Console: the driver prints a `THREE.WebGLProgram` info-log warning (X4122, a double-precision note from the D3D shader compiler on the physical material); it is not an error and does not change the picture. No other message.
- Not checked: other GPUs, a real phone, Safari or Firefox; frame time under CPU throttle (PR 22c).

## Rollback

Revert the commit: the stage returns to the flat look, `setQuality` to a no-op.
