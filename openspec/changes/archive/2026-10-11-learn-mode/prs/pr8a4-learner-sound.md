# PR 8a4: Learner sound

Branch: `feat/learn-mode-pr8a4-learner-sound`. Base: `feat/learn-mode-pr8a3-midi`. Tasks: 8.4, 8.5. Specs: note-input (learner sound rules), playback-engine (single-note playback for the learner).

## Chain context

```
feat/learn-mode-pr8a3-midi
  ^
feat/learn-mode-pr8a4-learner-sound     📍 this PR (last of the batch phases 5 to 8)
  ^
feat/learn-mode-pr9a-learn-keyboard (next, outside this batch)
```

- Start: the bus has three sources. End: the learner hears their own presses according to the input rules.
- Follow-up: pr11a (the Learn view creates it first among the bus subscribers, so sound is never delayed, and shows the "Sound from the app for MIDI" toggle through `writeMidiSound`).
- Out of scope: the toggle (pr11a), the sampled voice (gated).

## What changes

- `src/input/learner-sound.js` (new): `createLearnerSound({ bus, engine, settings })` returns `{ dispose }`. Screen and computer presses call `engine.startNote(midi, { vel })` and releases call `engine.releaseNote(midi)`; MIDI does so only when `settings.midiSound()` is true, read at every press (the toggle takes effect at once). A note is released when the last source that pressed it lets go, and a release always follows a start even if the setting changed in between (no stuck note). The rule never consults the matcher: wrong keys sound like any key. Engine errors (no Web Audio) are swallowed so the press still reaches the matcher. `dispose` unsubscribes and releases what still sounds.
  - `readMidiSound(storage)` / `writeMidiSound(storage, on)`: the remembered setting at `piano-guide:input:midi-sound` (default off; only the value written by the app turns it on; blocked storage reads as off and the write reports `false`).
- `tests/input/learner-sound.test.js` (new, 9 tests).

## Counter-proofs

- MIDI with the setting off calls nothing on the engine (and the same events with the setting on do).
- A note started with the setting on is still released when the setting is off at key-up.
- A store holding a foreign value ("yes") reads as off.
- A second source holding the same note keeps it sounding until the last release.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/input/*.test.js`: 44 tests, 44 pass (9 new) |
| Full suite | `node --test`: 1152 tests, 1152 pass, 0 fail |
| Runtime harness | N/A: fake bus and engine; the audible check and the real Casio check happen in pr11a (Casio MIDI recorded as NOT verified here, it is user-only) |
| Rollback boundary | `src/input/learner-sound.js` and `tests/input/learner-sound.test.js` |

## Review budget

172 authored changed lines including tests (source 67, tests 105), plus this description.
