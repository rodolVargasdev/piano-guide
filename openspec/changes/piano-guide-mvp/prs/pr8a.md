# PR 8a: Audio context and metronome

- Base branch: `feat/piano-guide-mvp-pr7-cancer-beginner`
- Branch: `feat/piano-guide-mvp-pr8a-audio-base`
- Chain: tracker -> ... -> PR 7 -> **PR 8a (this)** -> PR 8b -> PR 8c -> PR 8d -> PR 8e -> PR 9a -> PR 9b
- Start: Cancer Beginner data exists (PR 7). End: the lazy audio context, the metronome click generator and the node-side fake audio exist.
- Out of scope: the synth (PR 8b), the engine (PR 8c to PR 8e), any UI.

PR 8 of the task list is split into five because audio source and tests together came to about 1,000 authored lines: 8a holds task 8.1 and the metronome sound of 8.3, 8b holds 8.2, 8c to 8e hold 8.4 and 8.5.

## Summary

- `src/audio/context.js`: `createAudio()` with lazy `ensure()` (create and resume inside the Play click), `context`, `outputLatency()` (outputLatency, then baseLatency, then 0), `suspend()`.
- `src/audio/metronome.js`: `createMetronome(ctx)` with `click(when, { accent, sub })` (1500 Hz accent, 1000 Hz normal, 800 Hz quieter subdivision, 30 ms burst) and `cancelPending(now)`. When to click is decided by the engine from `beatGrid` (PR 8d).
- `tests/audio/fake-audio.js`: a recording stand-in for `AudioContext` so audio code runs under `node --test`.

## Dependency diagram

```
... -> PR 7 -> 📍 PR 8a -> PR 8b -> PR 8c -> PR 8d -> PR 8e -> PR 9a -> PR 9b
```

## Size

About 75 source, 186 test and helper lines and this description: about 310 authored lines. Within the 400-line budget.

## Checks run

- `node --test tests/audio/*.test.js`: 7 pass in this PR. Full `node --test`: no failures.
- Not checked: real sound. Web Audio cannot be heard headless; only timing, frequencies and cancellation are asserted against the fake. The autoplay warning check (task 8.1) needs an interactive browser and was not run.
- Runtime harness: the module has no runtime until the engine lands (PR 8c).

## Rollback

Remove `src/audio/context.js`, `src/audio/metronome.js` and `tests/audio/`.
