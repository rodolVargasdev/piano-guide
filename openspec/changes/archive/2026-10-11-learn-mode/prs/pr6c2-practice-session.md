# PR 6c2: The practice session (what a run means)

Branch: `feat/learn-mode-pr6c2-practice-session`. Base: `feat/learn-mode-pr6c-practice-list`. Tasks: the logic half of 24.1 (running an exercise, hearing it first, tempo ramp, key rotation). Specs: practice-exercises (running an exercise, metronome, tempo ramp and key rotation, language and state during an exercise). Pure reducer: no screen yet.

## Chain context

```
feat/learn-mode-pr6c-practice-list
  ^
feat/learn-mode-pr6c2-practice-session       this PR (📍)
  ^
feat/learn-mode-pr6c3-practice-screen
```

## What changes

- `src/practice/session.js`: `initSession` and `reduceSession(state, action) -> { state, effects }`, the same shape as the Learn lesson reducer, so every scenario of the spec is asserted without a DOM or audio.
  - Actions: `SET_OPTION` (hand, octaves, quality, direction, key: the exercise is generated again and the page returns to ready), `SET_BPM` (clamped to 20 to 240), `SET_METRONOME`, `SET_ROTATION`, `START`, `STOP`, `AGAIN`, `FASTER`, `NEXT_KEY`, `NEXT_STAGE`, `LISTEN`, `LISTEN_DONE`, `NOTE_ON`, `NOTE_OFF`, `LEAVE`.
  - A run ends on the last correct key: it is recorded once (a `record` effect with the key, hand, tempo and whether it was clean), the metronome stops, and the next tempo is suggested with `nextTempo` (60 gives 72; at the top it stays and says so; a wrong key keeps the tempo).
  - "Again" keeps the key and tempo and restarts at step 1; "Faster" applies the suggestion and starts; "Next key" goes around the circle of fifths or fourths or at random (every key once before a repeat, none following itself, beginning with the key being played), keeps the tempo of the run, announces the key and shows its scale with its fingering; "Next hand" goes right, left, then together.
  - Hearing the exercise first: `listenPlan(steps, bpm)` gives one beat per step (chords sound together, each note a little shorter than the beat) in the shape `engine.playNotes` takes; hearing is not offered in the middle of a run, and after hearing a finished run the page goes back to its result.
  - The language is not an action: switching it cannot change the exercise, step, key, tempo or presses (a test sends a language action mid-run and the state is identical).
  - The tempo starts at the learner's best clean tempo for that exercise and key when there is one, else at the first step of the card.
- Decision: the rotation default is the circle of fifths (so "Next key" is always offered after a run, as the spec asks); "Same key" removes the button. The fixed list of the spec lives in the pure `keyOrder` (pr1c); the screen lets the learner choose any one key, which is a fixed choice, and does not build a list.

## Tests and counter-proofs

`tests/practice/session.test.js` (24): initial state and rotation, best tempo as the start tempo, Start and its effects, a clean scale (eight Correct announcements, one record, the ramp), a wrong key (the step stays, recorded unclean, same tempo suggested), octave as a wrong key, the top tempo, Again and Faster, Next key on the circle of fifths (C then G with F sharp, tempo kept), fourths, same key, random over twelve keys, choosing a key by hand restarting the rotation, the hand stages, options regenerating the exercise, tempo clamping and the metronome effect following the run, the hearing plan and its return to ready or done, chords sounding together, held keys, a chord exercise, the language action ignored, leaving, tempo choices. Mutation checks (each fails the suite): tempo not kept on Next key (1, after adding that case), the ramp ignoring a wrong key (1), a skipped key in the rotation (3), the rotation not rebuilt on a manual key (1), Listen allowed mid-run (1), the record effect dropped (2).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/practice/session.test.js`: 24 pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: pure reducer; the page that runs it comes in pr6c5 |
| Rollback boundary | `src/practice/session.js` and its test |
| Review budget | 441 authored changed lines (176 code, 265 tests): 41 over the budget, one cohesive reducer and its transition table; `size:exception` recommended |
