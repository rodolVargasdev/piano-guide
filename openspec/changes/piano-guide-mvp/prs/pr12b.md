# PR 12b: Frame statistics, Full 88 toggle and scene docs

- Base branch: `feat/piano-guide-mvp-pr12a-falling-notes`
- Branch: `feat/piano-guide-mvp-pr12b-debug-range-docs`
- Chain: tracker -> ... -> PR 12a -> **PR 12b (this)**
- Start: notes fall in the scene. End: the debug overlay measures frame time and can reframe to the full keyboard; the README documents the scene. Tasks 12.2 to 12.4 are checked here. Last PR of this batch (PR 10 to 12).
- Out of scope: the regular Full 88 control (practice panel, PR 16), reduced motion, quality tiers and camera tweens (PR 22).

## Summary

- `src/ui/player.js`: `frameStats(samples)` (exported, tested) gives the average and 95th percentile over the last 120 frames; the `?debug=1` overlay now reads `drift max n ms | frame avg n p95 n ms | tier n/a` and has a "Full 88" button (`aria-pressed`) that calls `scene.setRange(FULL_RANGE | null)`, which rebuilds the keyboard and notes and reframes the camera. The overlay is the only place the toggle exists until PR 16. The no-scene placeholder gained the methods the player calls (`resize`, `setRange`, `setHandModes`, `setTimeline`).
- `styles/app.css`: the debug button.
- `README.md`: route row updated and a "Scene" section (colors, non-color cue, key press, falling notes and clipping, range, no-WebGL fallback, shared renderer).
- Task notes: 12.2 reuses the framing math that landed in PR 11b; 12.3 is wired through the facade (the timeline is applied at creation and PR 15 will call `setTimeline` on a level switch).

## Dependency diagram

```
... -> PR 12a -> [PR 12b, this PR]
```

## Size

35 added and 6 removed lines in the player, 17 CSS, 13 test, 12 README, 3 task lines and this description: about 125 authored lines. Within the 400-line budget.

## Checks run (real GPU, ANGLE on an NVIDIA GeForce RTX 3050 Laptop, Direct3D11; headless Chrome driven over the DevTools protocol; dev server on port 8790)

- Full `node --test`: 447 pass, 0 fail.
- Frame time from the overlay, 8 s samples every 400 ms after a 1.5 s settle, Cancer Beginner: at 72 BPM and at 50 BPM the median average is 16.7 ms and the worst p95 is 16.9 ms at 1440 x 900 and at 844 x 390 (one frame per 60 Hz refresh, no dropped frames); with Full 88 on, the same. On the software renderer (SwiftShader, `--use-angle=swiftshader`) the median average is about 29 ms with a p95 up to 42 ms: that is the CPU rasterizer, not a real device.
- Drift: the overlay's "drift max" is the largest step between two drawn positions, so it cannot be below one frame period. It read 21.3 ms on the real GPU in every window (frame period 16.7 ms plus about 4.6 ms of audio-clock granularity and jitter), above the 20 ms budget as the overlay defines it. There is no independent audio-versus-picture measurement: the scene reads the same `engine.position()` once per frame, so the visible lag is bounded by about one frame period plus the GPU pipeline, and the output latency is already subtracted by the engine. Recommendation for the final PR: define the budget as the inter-frame step minus the frame period, or measure the display lag with a flash-and-beep test on a real device.
- Main-thread cost: about 67 ms per second of playback (1.1 ms per frame) on this machine; allocation findings are in PR 12a.
- Full 88: toggling reframes the camera to the whole 52-key keyboard (screenshot read) and toggling back returns to the fitted range.
- Screenshots (read): 1440 x 900 and 844 x 390, paused, at 72 BPM, at 50 BPM, Full 88, after a seek and paused; no console errors. At 844 x 390 the page height equals the viewport (no vertical scroll) and the transport is fully visible; the keyboard and notes occupy a 487 x 144 px band, which is small but readable.
- WebGL disabled: the message is shown, Play reaches `playing` and the audio context is `running`. The catalog requests no three.js. After 15 visits (3 batches of 5 after a warm-up) the heap read 2979, 3366, 3557, 3577 KB (converging) and no canvas stays in the document.
- Container: `docker build -t piano-guide .` succeeds with the suite inside; the container on port 8790 serves `application/javascript` for the new modules and under its CSP the scene and notes render with no console errors.
- Not checked: sound, a real phone, the Docker image on a second machine, the 6x CPU throttle (PR 22) and reduced motion (PR 22).

## Rollback

Revert this commit: the overlay returns to its previous text and the README to the previous route row and without the Scene section.
