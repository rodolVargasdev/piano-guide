# PR 22c: frame-time watchdog and Auto quality

- Base branch: `feat/piano-guide-mvp-pr22b-stage-reflections`
- Branch: `feat/piano-guide-mvp-pr22c-quality-watchdog`
- Chain: ... -> PR 22b -> **PR 22c (this)** -> PR 22d to 22f
- Start: tiers exist (PR 22b) but only the manual selector changes them. End: Auto picks a first tier by device and degrades one tier at a time on sustained slow frames; a manual choice overrides it; the debug overlay shows the tier. Task 22.2 is checked here.
- Out of scope: camera tweens and the reduced-motion wiring (PR 22d), landing page (PR 22e), docs and the drift metric (PR 22f).

## Summary

- `src/scene/quality.js`: `createWatchdog({ initial, onTier })` keeps a 120-frame sample while the music plays and asks the pure `decideTier`. Frames over 250 ms (hidden tab, seek, stall) are not sampled, paused redraws are not sampled, a pause breaks the run. `choose(tier)` overrides and stops the watchdog; `choose("auto")` restarts it from the initial tier.
- `src/scene/index.js`: first tier from `initialTier()` (Medium with 4 cores or fewer or a coarse pointer, High otherwise), `setQuality(choice)`, `qualityInfo()`, one `watchdog.frame(performance.now(), playing)` per drawn frame. `src/ui/player.js`: the debug overlay reads `tier <name> (auto|manual)`.
- `tests/scene/quality.test.js` (11): downgrade order, one step per refill window, healthy frames hold, a stall does not drop a tier (with the counter-proof of many slow frames), paused redraws ignored, manual override and Auto restart.

## Dependency diagram

```
... -> PR 22b -> [PR 22c, this PR] -> PR 22d
```

## Checks (headless Chrome, real GPU ANGLE d3d11, dev server on 8790, `?debug=1`; 1440 x 900 and 844 x 390)

- Full suite: 712 pass, 0 fail.
- Unthrottled, 8 s of playback: tier High (auto), frame avg 16.7 ms, p95 16.9 ms, at both sizes.
- CPU throttle 6x (the design's number): the tier stayed High for 50 s at both sizes. On this machine (RTX 3050, desktop Chrome) the frame work is small enough that 6x does not push the average over 22 ms, so the design's "6x drops all four tiers" was NOT reproduced; this is not a defect of the watchdog but of the test load. After the first second (shader compilation) the average settles at 16.7 ms.
- CPU throttle 20x: High to Medium at 5 s, Low at 12 s (17 s at 1440), Minimum at 17 to 18 s, in order, one step each, then no further change; `22-tier-throttled-minimum-1440x900` read: notes still fall, keys still light, finger markers still drawn, horizon one bar.
- Manual High under 20x for 15 s: held (tier High (manual)); Auto afterwards: tier High (auto).
- No console error besides the known driver info log (see PR 22b).
- Not checked: a real phone or a genuinely slow GPU (the throttle slows the main thread only, not the GPU), the step back up after 20 s of headroom in the browser (covered by the `decideTier` unit tests only).

## Rollback

Revert the commit: tiers return to manual-only.
