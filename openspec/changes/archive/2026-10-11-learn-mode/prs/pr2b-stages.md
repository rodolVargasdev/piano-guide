# PR 2b: Stage plan and both-hands steps

Branch: `feat/learn-mode-pr2b-stages`. Base: `feat/learn-mode-pr1b2-lesson-zero-view`. Tasks: 14.1 (and the both-hands steps that 14.2 needs). Specs: learn-mode (Stages per phrase and per song).

## Chain context

```
feat/learn-mode-pr1b2-lesson-zero-view
  ^
feat/learn-mode-pr2b-stages                  this PR
  ^
feat/learn-mode-pr2b2-stage-reducer
  ^
feat/learn-mode-pr2b3-stage-view
```

## What changes

- `src/learn/stages.js` (new), all pure:
  - `buildPlan(timeline, phrases)`: the ordered list of stages `{ id, scope, phraseIndex, startTick, endTick, hand, tempo }`. Per phrase: R slow, L slow, T slow, T full, filtered by the hands that have a pitched onset in the phrase; with one hand only that hand's slow stage remains (together would equal it). Then a stage per section and a stage for the whole song, at the song tempo.
  - `stageBpm(timeline, stage)`: slow is the slow-mode fraction of the song tempo (`effectiveBpm`), full is the song tempo, both clamped to 20 to 240. Tempo paces Listen and the metronome only (A1: nothing is measured).
  - `handsIn`, `findStage`.
- `src/learn/steps.js`: `deriveSteps(..., "T")` joins both hands: one step per tick where either hand starts, the keys of both hands, `positions` per hand, `step.both` when both play and the single hand's own sentence when only one does.

### Decisions where the task text left room

- A section stage exists only when the song has more than one section and that section has more than one phrase; the whole-song stage only when there is more than one phrase. Otherwise the stage would repeat the one before it (a 16-bar song with one section would drill the same bars twice).
- For a one-hand song the full-tempo stage is the section or song stage ("T full, or the only hand"), not a per-phrase stage.

## Counter-proofs

- One section alone has no section stage; a section with one phrase has none either.
- A hand with no notes in a phrase drops its stages in that phrase only; a left-hand-only song never gets a right-hand stage.
- Tempo limits: a 30 BPM song at slow gives 20, never below; 300 at full gives 240.
- Hands together with one hand silent gives exactly the other hand's steps and instructions.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/learn/stages.test.js tests/learn/steps.test.js`: 24 pass |
| Full suite | `node --test`: 1310 tests, 1310 pass, 0 fail |
| Runtime harness | N/A: pure modules, nothing user-visible yet (the reducer and screen follow in pr2b2 and pr2b3) |
| Rollback boundary | `src/learn/stages.js` and the `bothHands` part of `src/learn/steps.js` with their tests |

## Review budget

217 authored changed lines including tests, plus this description.
