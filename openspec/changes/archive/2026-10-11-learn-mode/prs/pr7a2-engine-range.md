# PR 7a2: Engine range playback, learner notes and generated notes

Branch: `feat/learn-mode-pr7a2-engine-range`. Base: `feat/learn-mode-pr7a-synth-held`. Tasks: 7.2, 7.3, 7.4. Specs: playback-engine (bounded phrase-range playback, single-note playback for the learner, private songs never scheduled).

## Chain context

```
feat/learn-mode-pr7a-synth-held
  ^
feat/learn-mode-pr7a2-engine-range      📍 this PR
  ^
feat/learn-mode-pr8a-bus-computer-keys (next)
```

- Start: the synthesizer has held voices. End: the engine can play a phrase range (Listen), the learner's own keys and generated notes, with the private rule intact.
- Follow-up: pr8a onward (note input and learner sound call `startNote` / `releaseNote`), pr11a (Learn view calls `playRange`).
- Out of scope: sampled voice (gated), any UI.

## What changes

- `src/audio/engine.js`:
  - `playRange({ startTick, endTick, hand, bpm })` resolves `{ status }`: `completed`, `cancelled`, `silent`, `empty`. It reuses the transport: the same clock, scheduler and anchor, so `position()` advances from the range start and is restored to the previous position at the end. Notes are limited to onsets in the range and cut at `endTick` (a sounding note is released through the normal fade, no click). Without `bpm` it plays at the slow-mode fraction of the song tempo; an explicit `bpm` is allowed. The loop is set aside while the range plays and restored. The metronome toggle still applies (A2).
  - `stopRange()`, `isRangePlaying()`. The transport and a range take turns: `play`, `pause`, `stop`, `seek`, a new `playRange` and `setTimeline` cancel the active range (it resolves `cancelled`); `playRange` stops a playing song. `dispose` cancels it.
  - Private rule: a silent timeline (private, or without the `silent` field: fail closed) resolves `silent` before any audio is created. A range with no onsets resolves `empty` at once with no clock and no sound.
  - `startNote(midi, { vel })`, `releaseNote(midi)`, `releaseAllNotes()`: the learner's own keys, started at the audio clock inside the gesture (`audio.ensure()` resumes the context), working with a private song open or no song. A key pressed again while held restarts.
  - `playNotes([{ midi, at, dur, vel }])`, `stopNotes()`: generated notes (ear drills), `at` and `dur` in seconds from now; they never read the loaded song.
  - `setTimeline` and `setHandModes` now compute the audible set through one helper (`computeAudible`), which also applies the range's hand.
- `tests/audio/engine-rig.js`: the recording synth also records learner voices (`heldCalls`).
- `tests/audio/engine-range.test.js` (new, 16 tests) and `tests/learn-guard.test.js` (new, 2 tests): task 7.3, a static scan that fails when a module under `src/learn/` mentions `playNotes` or `stopNotes`.

## Counter-proofs

- Private versus public with the same range: silent (zero scheduled notes, also with an explicit `bpm`, also with a timeline lacking the `silent` field) versus sounding.
- Mutation check done once and not committed: removing the clip of the scheduling window to the range end failed one test; removing the silent refusal failed two. Both restored.
- No audio is woken before the first learner key (`ctx.resumed` is 0, then 1).
- The learn-guard scan flags strings that import or call the forbidden entry points and passes other engine calls and plain words.
- A range does not finish early (the promise is pending while it sounds), and `stopRange` leaves no later scheduling.

## Deviations and decisions to confirm

- `pause()` and `stop()` during a range cancel it rather than pausing it (a range is one bounded action, not a transport state).
- `stop()` after a range emits two `stopped` state events (one from the range, one from the transport). Listeners treat it as idempotent; if the view does not, the second can be removed in pr11a.
- Edits to `playNote` scheduling use the clipped end only when a range is active; the song transport path is unchanged and every existing engine test passes unmodified.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/audio/*.test.js tests/learn-guard.test.js`: 88 tests, 88 pass |
| Full suite | `node --test`: 1108 tests, 1108 pass, 0 fail |
| Runtime harness | N/A: recording rig with a manual timer; the audible check happens in pr11a |
| Rollback boundary | `src/audio/engine.js` additions, `tests/audio/engine-rig.js` recording lines, `tests/audio/engine-range.test.js`, `tests/learn-guard.test.js` |

## Review budget

419 authored changed lines including tests (source 150 added and 11 changed, tests 257), plus this description. Over the 400 budget by about 19 lines; the engine entry points and their tests belong together, so no further split was made (`size:exception` recommended only if the description is counted).
