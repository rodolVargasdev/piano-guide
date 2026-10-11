# PR 8e: Engine loop, hand modes, hidden tab and engine contract

- Base branch: `feat/piano-guide-mvp-pr8d-engine-tempo-metronome`
- Branch: `feat/piano-guide-mvp-pr8e-engine-loop-hands`
- Chain: tracker -> ... -> PR 8d -> **PR 8e (this)** -> PR 9a -> PR 9b
- Start: the engine has transport, tempo and metronome. End: the audio engine is complete (tasks 8.3 to 8.5).
- Out of scope: any UI (PR 9a and PR 9b), the practice panel that drives loops and ramps (PR 16).

## Summary

Extends `src/audio/engine.js`, adds `tests/audio/engine-loop.test.js` and the README "Engine contract" section.

- `setLoop(range or null)`: scheduling over an unwrapped timeline (`windowEvents` with the loop), the straddling note cut at the loop end, one `loop-pass` event per completed pass (`passesBetween`), no `ended` while a loop is active, `stop()` and out-of-loop seeks go to the loop start, and setting a loop past B moves playback to A without cutting sounding notes.
- `setHandModes({ L, R })` with independent `muted` and `hidden` flags. Muting filters scheduling (`audibleNotes`) and fades that hand's sounding notes only when it becomes muted; hiding does not change audio. State survives seek and loop wraps; the metronome still plays with both hands muted.
- Hidden tab: on `visibilitychange` the look-ahead widens from 120 ms to 1.5 s and returns when visible; the listener is removed in `dispose()`. A late timer wake-up schedules each event once and `position()` depends only on the audio clock.
- README: "Engine contract" (methods and events). Tasks 8.3, 8.4 and 8.5 are checked with a note that browser audio checks were not run.

## Dependency diagram

```
... -> PR 8d -> 📍 PR 8e -> PR 9a -> PR 9b
```

## Size

About 67 source lines changed, 188 test and rig lines, 20 README lines and this description: about 320 authored lines. Within the 400-line budget.

## Checks run

- `node --test tests/audio/*.test.js`: 49 pass. Full `node --test`: 372 pass, 0 fail.
- Counter-proofs (each restored): removing the loop argument from scheduling fails 3 tests, removing the `loop-pass` emit fails 1, setting the hidden look-ahead back to 120 ms fails 2, bypassing the hand filter fails 2.
- Not checked: any real sound, a real hidden tab for 10 s and the browser console scripts of tasks 8.3 and 8.4 (seek mid-note, end of song in a browser). Web Audio cannot be heard headless; the engine is covered with a fake clock and a recording synth and metronome.

## Rollback

Revert this commit: the engine returns to the tempo and metronome form of PR 8d; remove the README section.
