# PR 7a: Held learner voices in the synthesizer

Branch: `feat/learn-mode-pr7a-synth-held`. Base: `feat/learn-mode-pr6a3-lesson-reducer`. Task: 7.1. Specs: playback-engine (single-note playback for the learner, voice cap).

## Chain context

```
feat/learn-mode-pr6a3-lesson-reducer
  ^
feat/learn-mode-pr7a-synth-held         📍 this PR
  ^
feat/learn-mode-pr7a2-engine-range (next)
```

- Start: the lesson reducer exists. End: the synthesizer can start a note that sounds until released, without touching the song voices.
- Follow-up: pr7a2 (engine entry points that use it).
- Out of scope: engine API, sampled piano (Milestone B, gated).

## Why the original PR 7a was split

Phase 7 touches two modules with their tests (about 450 authored lines). The cut is the layer boundary: synthesizer (this PR) and engine (pr7a2).

## What changes

- `src/audio/synth.js`: `startHeld({ midi, vel, when })` returns a voice id; the note starts at the audio clock by default (no look-ahead delay), has no scheduled end, does the attack and the same decay down to the sustain floor, and then holds. `releaseHeld(voiceId, now)` applies the release envelope (a smooth target ramp, then the oscillators stop). `releaseAllHeld(now)` releases every learner voice (used by `dispose`). Learner voices carry `learner: true`: `cancelPending` skips them in both modes, and they count toward the shared cap (`makeRoom` releases the oldest voice first, whatever its kind).
- Refactor with no behavior change: the oscillator graph (`buildVoice`) and the cap loop (`makeRoom`) are shared by `playNote` and `startHeld`. The automation order, the node graph and every value of `playNote` are as before (the 12 existing synth tests pass unchanged).
- `tests/audio/synth.test.js`: 7 new tests.

## Counter-proofs

- A song voice IS released by `cancelPending` (so the survival of the held voice is the learner flag, not an accident of timing).
- With a large cap the same 30 held voices all keep sounding; with a cap of 3 a fourth voice releases the oldest one, and twenty more never exceed the cap or throw.
- A second release of the same id and an unknown id do nothing (one release ramp only).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/audio/synth.test.js`: 17 tests, 17 pass (7 new) |
| Full suite | `node --test`: 1090 tests, 1090 pass, 0 fail |
| Runtime harness | N/A: recording fake audio context; the audible check happens in pr11a |
| Rollback boundary | `src/audio/synth.js` and `tests/audio/synth.test.js` |

## Review budget

196 authored changed lines including tests (source 105, tests 91), plus this description.
