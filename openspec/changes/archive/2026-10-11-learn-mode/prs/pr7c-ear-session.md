# PR 7c: The ear drill session

Branch: `feat/learn-mode-pr7c-ear-session`. Base: `feat/learn-mode-pr6c7-practice-tempo-keys`. Tasks: 25.1. Spec: practice-exercises (ear drills). Pure reducer and one saved number: no screen yet.

## Chain context

```
feat/learn-mode-pr6c7-practice-tempo-keys
  ^
feat/learn-mode-pr7c-ear-session             this PR (📍)
  ^
feat/learn-mode-pr7c2-ear-page
```

## What changes

- `src/practice/ear.js`: `initEar({ kind, seed, grown })` and `reduceEar(state, action) -> { state, effects }` over the seeded questions of pr3c (interval or chord).
  - A question is ready but not played until `LISTEN`; **Listen again is free**, any number of times, with no penalty.
  - `ANSWER { id }`: the right one says Correct (counted in the score only on the first try); a first wrong one says Try again; **a second wrong one reveals the right answer**; the same wrong choice twice or an unknown choice does nothing.
  - **Play-back** with `NOTE_ON`: an interval is answered by any two different notes at the right distance from the first one pressed, in any octave and either order (a single note, or the same note twice, is not an answer yet); a chord by its pitch classes in any octave and any order (a minor triad on A is A, C, E; two notes are not a chord yet); a wrong played answer counts like a wrong button and the played notes start over.
  - Rounds of ten (`ROUND`): after the tenth question `NEXT` ends the round with the count (the view shows "7/10"), emits `record { clean, correct }` (a round of 8 or more right is a clean round) and, with 8 of 10, **unlocks the next choice** in the design order (intervals start with major third, perfect fifth and octave and grow P4, m3, M6, M2, m6, m7, M7, TT, m2; chords start with major and minor and grow dim, aug); `save { grown }` is emitted so the choice stays unlocked; `ROUND` starts the next one with the count back at zero.
  - Questions use distinct seeds per question of one session, so the same seed always replays the same sequence.
- `src/practice/progress.js`: a small `ear` map, `earGrown` and `withEarGrown`: how many extra choices each drill has unlocked, validated on read like everything else (a count, never a pitch).

## Tests and counter-proofs

`tests/practice/ear.test.js` (19): starting choices, a reproducible sequence by seed, free Listen, Correct and the first-try rule, Try again then reveal, a right answer after a wrong one not counted, repeated and unknown picks ignored, Next, play-back of intervals (octave, order, one note, same note, wrong size and starting over) and of chords (any octave and order, the major chord is not the minor one, two notes are not a chord), releases and presses outside a question ignored, the end of the round with its record, 8 of 10 unlocking the perfect fourth and 7 of 10 not, the new round with the unlocked choice among the options, the growth order and its cap, the saved count round trip and refusing bad values, nothing to do between rounds, leaving. Mutation checks (each fails the suite): unlock at 7 (2), every right answer counted (1), reveal on the third wrong answer (2), play-back distance with a sign (1), chord pitch classes compared as notes (1), Listen allowed between rounds (1), a repeated wrong pick counted (1).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/practice/ear.test.js tests/practice/progress.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: pure reducer; the page comes in pr7c2 |
| Rollback boundary | `src/practice/ear.js`, the `ear` additions of `src/practice/progress.js`, `tests/practice/ear.test.js` |
