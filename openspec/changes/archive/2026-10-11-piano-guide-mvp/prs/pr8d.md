# PR 8d: Engine tempo, slow mode, metronome and count-in

- Base branch: `feat/piano-guide-mvp-pr8c-engine-transport`
- Branch: `feat/piano-guide-mvp-pr8d-engine-tempo-metronome`
- Chain: tracker -> ... -> PR 8c -> **PR 8d (this)** -> PR 8e -> PR 9a -> PR 9b
- Start: the engine plays a timeline (PR 8c). End: tempo, slow mode, metronome and count-in work.
- Out of scope: loop, hand modes, loop-pass events, hidden-tab look-ahead and the README engine section (PR 8e). Tasks 8.3 (clicks scheduled, 12/8, muted hands) and 8.4 stay open until PR 8e.

## Summary

Extends `src/audio/engine.js` and adds `tests/audio/engine-tempo.test.js`.

- `setBpm(n)` clamps to 20 to 240 and returns the shown value; `getBpm()`; `setSlow(on)` plays half of the user BPM and disabling restores it.
- A tempo change re-anchors at the current tick and re-queues only what has not started (`cancelPending` with `releaseSounding: false`), so the position stays continuous and sounding notes play on.
- `setMetronome({ enabled, countIn, subdivision })`: clicks come from `beatGrid` with the song's `tempo.beatUnit` (4 per bar for 12/8 dotted quarter, 12 for an eighth beat unit as the counter-proof), accent on beat 1, optional subdivision click half a beat later, and an optional one-bar count-in that does not move the position and does not play notes that lie inside its span (also when starting mid-song).
- `tests/audio/engine-rig.js` gains the recording metronome and a compound-meter timeline.

## Dependency diagram

```
... -> PR 8c -> 📍 PR 8d -> PR 8e -> PR 9a -> PR 9b
```

## Size

About 98 source lines changed, 101 test lines and 25 rig lines, plus this description: about 265 authored lines. Within the 400-line budget.

## Checks run

- `node --test tests/audio/*.test.js`: 37 pass. Full `node --test`: 360 pass, 0 fail.
- Counter-proofs: not clamping the BPM fails 1 test, dropping the start clamp fails 1 (count-in mid-song), removing the accent fails 2; each was restored.
- Not checked: the actual click sound and the console script of task 8.3. Only click times, accents and counts are asserted against the fake.

## Rollback

Revert this commit: the engine returns to the transport-only form of PR 8c and the extra test file and rig parts go away.
