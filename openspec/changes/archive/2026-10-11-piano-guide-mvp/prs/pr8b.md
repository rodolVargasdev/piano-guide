# PR 8b: Piano synth

- Base branch: `feat/piano-guide-mvp-pr8a-audio-base`
- Branch: `feat/piano-guide-mvp-pr8b-synth`
- Chain: tracker -> ... -> PR 8a -> **PR 8b (this)** -> PR 8c -> PR 8d -> PR 8e -> PR 9a -> PR 9b
- Start: lazy context, metronome and fake audio exist. End: notes can be synthesized, capped and cancelled.
- Out of scope: the engine that schedules notes (PR 8c to PR 8e).

## Summary

Adds `src/audio/synth.js` and `tests/audio/synth.test.js` (task 8.2).

- Voice: triangle plus a +3 cent sine plus an octave sine at -12 dB, into a lowpass whose cutoff is velocity-scaled (1.5 to 6 kHz) and closes as the note decays, into a gain envelope (attack 4 ms, decay from about 3.2 s at A0 to 0.8 s at C8, release 180 ms, 0.9 s when the pedal holds), into a master `DynamicsCompressorNode`.
- The decay ramp ends at note-off, so the release never overlaps it in the automation timeline.
- `playNote({ midi, vel, when, dur, pedal })`, voice cap 48 with the oldest released first, `cancelPending(now, { releaseSounding })` (future voices never start; sounding ones fade, or keep playing for tempo changes), `activeCount`, `dispose`.

## Dependency diagram

```
... -> PR 8a -> 📍 PR 8b -> PR 8c -> PR 8d -> PR 8e -> PR 9a -> PR 9b
```

## Size

About 135 source and 117 test lines plus this description: about 290 authored lines. Within the 400-line budget.

## Checks run

- `node --test tests/audio/*.test.js`: 17 pass (10 new). Full `node --test`: 340 pass, 0 fail at the time of the commit.
- Counter-proofs: without the cap, 60 voices stay held; raising the cap constant fails the cap test; removing the fade in `cancelPending` fails the fade assertion; each change was restored.
- Not checked: the sound itself (no clicks, tone quality). Web Audio cannot be heard headless; only automation shape and timing are asserted against the fake. The console script from task 8.2 (C major triad, 60 rapid notes) needs an interactive browser and was not run.

## Rollback

Remove `src/audio/synth.js` and `tests/audio/synth.test.js`.
