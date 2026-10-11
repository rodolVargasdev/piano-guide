# PR 9b: Player shell, route and debug overlay

- Base branch: `feat/piano-guide-mvp-pr9a-transport-ui`
- Branch: `feat/piano-guide-mvp-pr9b-player-shell`
- Chain: tracker -> ... -> PR 9a -> **PR 9b (this)**
- Start: the engine and the transport controls exist. End: `#/song/<id>` opens a working player (audio, transport, readout) with no keyboard scene or score yet.
- Out of scope: the 3D scene (PR 11 and PR 12), the score (PR 13 and PR 14), the level selector (PR 15), the practice panel (PR 16), the lesson card (PR 17). Last PR of this batch (PR 5 to 9).

## Summary

Adds `src/ui/player.js` and `tests/ui/player.test.js`, rewires `src/main.js`, extends `styles/app.css` and the README route row. Tasks 9.2 to 9.4.

- `playerView({ load, makeEngine, win })` returns a router view. It re-validates the song on open (a broken song shows the same reason as the "Unavailable" card; an unknown id shows "Song not found"; a failing index shows its error), picks the level (`pickLevel`: the URL level if the song has it, else the default), creates the engine and renders the head, two placeholder slots, the transport and the optional debug overlay.
- ONE `requestAnimationFrame` loop reads `engine.position()` once per frame and feeds the transport, a no-op score and a no-op scene. It runs while playing and once after each interaction or state change.
- `dispose()` cancels the frame, removes the transport and calls `engine.dispose()` (stops audio, releases voices, suspends the context). A single page-wide `AudioContext` is reused, so repeated navigation does not create contexts.
- `?debug=1` (page query or hash query) shows `drift max n ms | frame n ms | tier n/a`. Drift is the musical time between two drawn positions (about one frame period when healthy); the scene tier is `n/a` until PR 22.
- Player styles, including a compact two-column layout for 844 x 390 landscape.

## Dependency diagram

```
... -> PR 9a -> 📍 PR 9b
```

## Size

About 183 source lines (player 155, main 28 changed), 37 test lines, 83 CSS lines, 2 README lines, 38 of this description and 6 of task checkboxes: 349 authored lines. Within the 400-line budget.

## Checks run

- `node --test`: 385 pass, 0 fail (5 new in `tests/ui/player.test.js`, with a counter-proof for `debugRequested`).
- Headless Chrome (DevTools protocol, scratch script) against the dev server on port 8790, with the page's `AudioContext` wrapped to observe it: the catalog opens Cancer; Play leaves the context `running` (autoplay flag on) and the readout advances; BPM 50 then 72 are kept and 500 shows 240; seeking while playing moves the position; Pause holds the readout; Stop returns to 0; the browser back button leaves the player with the context `suspended`; 20 open and close cycles in 3 batches after a warm-up keep the heap flat (1068, 1072, 1075, 1078 KB) with a single `AudioContext`; debug overlay only with `debug=1`; an unknown level falls back to Beginner; an unknown id and a hostile id (`<script>`) show "Song not found" with no script nodes; 844 x 390 has no horizontal scroll and the transport is fully visible; no three.js request; no console errors besides the favicon 404. Screenshots at 844 x 390 and 1280 x 800 were read.
- Container: `docker build -t piano-guide .` succeeds with the suite inside; the container on port 8790 serves `application/javascript` for `src/ui/player.js` and `src/audio/engine.js`, and under its CSP the catalog opens Cancer and Play reaches `playing` with no console errors besides the favicon 404.
- Observed drift: the overlay showed a worst case of 21.3 ms in one 10-frame window (budget 20 ms). It was measured in headless Chrome with no scene; recheck with the scene in PR 12.
- Not checked: any sound (headless), a real 10 s hidden tab, keyboard-only operation by hand and a real touch device.

## Rollback

Revert this commit: `src/main.js` returns to the "player is not available yet" notice; remove `src/ui/player.js`, its test and the player block in `styles/app.css`.
