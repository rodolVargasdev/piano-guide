# PR 4c: Metronome timeline and the exercise runner

Branch: `feat/learn-mode-pr4c-timeline-runner`. Base: `feat/learn-mode-pr3c-intervals-drills`. Tasks: 22.1, 22.2 (and the verification of 22.4 for these two). Spec: practice-exercises (running an exercise, metronome, tempo ramp). Pure code: no screen yet.

## Chain context

```
feat/learn-mode-pr3c-intervals-drills
  ^
feat/learn-mode-pr4c-timeline-runner         this PR (📍)
  ^
feat/learn-mode-pr4c2-practice-progress
```

## What changes

- `src/core/timeline.js`: `makeTimeline({ meter, bpm, bars })` returns the note-less, `silent: false` timeline of the design (whole bars, quarter-note tempo, `pickupTicks: 0`). With it the engine runs its clock and accented clicks for a practice exercise and has nothing to schedule, so a note can never sound from it.
- `src/practice/runner.js`:
  - `startRun(steps, { held })` and `runReduce(run, event)`: a generated sequence becomes steps for the Learn matcher (any order inside a step, no time limit, held keys excluded until released). A wrong key (or the right note in another octave) clears the step, never moves the run and makes it unclean for good; the run reports `finished` on the press that completes the last step. A key still down from the previous step must be released before it counts again.
  - `mergeHands(right, left)` for the hands-together stage, `STAGES` and `nextStage` (right hand, left hand, then together), `stepInstruction(step)` (one hand: "Right hand: thumb on C (Do)."; a chord adds the key count; two hands say both; it reuses the Learn instruction templates and so the same bilingual strings).
  - `nextTempo(steps, current, clean)`: 60 with steps 50 60 72 88 suggests 72; at or past the last step it stays with `top: true`; an unclean run stays; tempos are clamped to 20 to 240 and a step beyond 240 is not offered (A1: tempo is a pacing aid, nothing is timed).

## Tests and counter-proofs

`tests/core/make-timeline.test.js` (5): no notes, whole bars, `silent: false`, other meters, RangeError for bad input, and a run on the engine rig that schedules no note, reports `silent: false`, clicks with the first beat accented; counter-proof that a timeline without `silent: false` still schedules nothing. `tests/practice/runner.test.js` (15): a whole scale correct and clean, `finished` only on the last press, wrong key (step stays, unclean for good, right key completes), octave, the clean counter-proof, chord accumulation in any order, held keys, hands together, stages, empty run, instruction texts in English and Spanish, and every tempo scenario of the spec. Mutation checks (each fails the suite): wrong key leaving the run clean (3), keys still down not carried (1), `>` turned into `>=` in the ramp (3), unclean run ramping (1), left hand keys dropped from the merge (1).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/core/make-timeline.test.js tests/practice/runner.test.js`: 20 pass |
| Full suite | `node --test`: 1433 tests, 0 fail |
| Runtime harness | the engine rig (a recording synth and metronome with a manual timer) runs the timeline: no note, clicks with the accent; the browser path comes with pr6c |
| Rollback boundary | the `makeTimeline` addition to `src/core/timeline.js`, `src/practice/runner.js`, their tests |
