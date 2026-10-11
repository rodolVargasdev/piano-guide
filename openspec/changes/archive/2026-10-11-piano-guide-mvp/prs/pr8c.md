# PR 8c: Engine transport and note scheduling

- Base branch: `feat/piano-guide-mvp-pr8b-synth`
- Branch: `feat/piano-guide-mvp-pr8c-engine-transport`
- Chain: tracker -> ... -> PR 8b -> **PR 8c (this)** -> PR 8d -> PR 8e -> PR 9a -> PR 9b
- Start: synth, metronome sound and fake audio exist. End: an engine can play a timeline: transport, scheduling, position and events.
- Out of scope: user BPM, slow mode, metronome scheduling and count-in (PR 8d); loop, hand modes, loop-pass events, hidden-tab look-ahead and the README engine section (PR 8e). Tasks 8.3, 8.4 and 8.5 stay open until those land.

## Summary

Adds `src/audio/engine.js` (`createEngine`) and its tests (the first part of task 8.4).

- 25 ms timer, 120 ms look-ahead, scheduling from `core/schedule` (`makeAnchor`, `tickAt`, `timeAt`, `windowEvents`).
- `play()` creates and resumes the context synchronously (inside the click), with a 50 ms start delay; `pause()` keeps the tick and fades voices; `stop()` goes to 0; `seek(tick)` cancels pending voices and re-queues from the new anchor in the same call, clamped to the song.
- End of song without a loop: scheduling stops, the engine calls `stop()` (position 0, voices released) and emits `ended`.
- `position()` returns the same `{ tick, bar, beat, seconds }` object each time, using `ctx.currentTime - outputLatency`.
- `setTimeline(tl, { tick })` keeps the musical position; the BPM comes from the song for now. `on(name, fn)` returns an unsubscribe function. `dispose()` stops, disposes the synth and suspends the context.
- Pedal: a note whose note-off tick lies inside a `pedal` range is scheduled with the long release.
- Dependencies are injectable (`audio`, `timers`, `makeSynth`) so the engine runs under `node --test` with `tests/audio/engine-rig.js`.

## Dependency diagram

```
... -> PR 8b -> 📍 PR 8c -> PR 8d -> PR 8e -> PR 9a -> PR 9b
```

## Size

About 172 source, 182 test and rig lines and 39 of this description: 393 authored lines. Within the 400-line budget, close to the limit.

## Checks run

- `node --test tests/audio/engine.test.js`: 12 pass. Full `node --test`: 352 pass, 0 fail.
- Counter-proofs: removing the cancel call in the re-anchor path fails 1 test; disabling the end-of-song detection fails 2; both changes were restored.
- Not checked: sound, and the browser console script of task 8.4 (seek mid-note, end of song, hidden tab 10 s). Web Audio cannot be heard headless and no interactive browser was available; scheduling math is covered by the node tests with a fake clock only.

## Rollback

Remove `src/audio/engine.js`, `tests/audio/engine.test.js` and `tests/audio/engine-rig.js`.
