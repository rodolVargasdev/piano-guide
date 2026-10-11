# PR 8c: The 10-minute routine (what to practice today)

Branch: `feat/learn-mode-pr8c-routine-session`. Base: `feat/learn-mode-pr7c3-ear-page`. Tasks: 26.1. Spec: practice-exercises (the 10-minute routine, local progress). Pure functions and strings: no screen yet.

## Chain context

```
feat/learn-mode-pr7c3-ear-page
  ^
feat/learn-mode-pr8c-routine-session         this PR (📍)
  ^
feat/learn-mode-pr8c2-routine-page
```

## What changes

- `src/practice/routine.js`:
  - `buildRoutine(progress, isoDate)`: a pure function of the progress and the day. **Warm-up** (2 minutes): the five-finger pattern in the key after the last warm-up on the circle of fifths (C the first time). **Scale** (3): the major scale in the key practiced least recently or never, in the order of introduction C G D F A E B Bb Eb Ab Db F#; what counts as practiced is the routine's own record and any scale run on the exercise page, so the routine does not repeat the key the learner did on their own yesterday. **Chords** (3): in that same key, triads and inversions, the cadence I-IV-V-I or the I-V-vi-IV progression, a different one each day (a cycle of three by the number of the day). **Ear** (2): intervals or chords, alternating by the parity of the day. The total is 10 minutes (spec: 9 to 11). The same progress and day always give the identical routine.
  - `startRoutine`, `routineReducer` (`DONE_BLOCK`, `SKIP_BLOCK`, `END`) and `summaryOfRoutine`: the current block, each block as done or skipped, the routine ending when no block is pending (finishing or skipping the last open block ends it), and whether the day counts (at least one block done; the record itself is `recordRoutine` of pr4c2).
- Decision recorded: the design alternated the chord block between triads and the cadence by day parity. It now cycles three drills so the I-V-vi-IV progression with voice leading also appears; the spec only asks for "a chord or cadence drill".
- `src/i18n/strings.js`: 24 `routine.*` strings in both languages, with the plural pairs "1 day in a row / 2 days in a row" ("1 día seguido / 2 días seguidos") and "1 minute / 2 minutes".

## Tests and counter-proofs

`tests/practice/routine.test.js` (16): the first day (a C warm-up, a C scale, a chord drill in C, an ear drill, 10 minutes), identical for the same progress and day without touching the progress, the next day after a finished routine (scale G, warm-up G, a different chord and ear drill), the scale walking the order of introduction one key per recorded day and then going back to the key practiced longest ago, the warm-up walking the circle of fifths and wrapping, a scale practiced on its own page counting, skipped blocks not moving the keys, every day of a year valid (real keys, exercises that exist and generate, the chord and ear drills rotating), a non-date, the session, finishing the last block, skipping the ear drill after three done blocks (the day is recorded), skipping all four (nothing recorded, the streak unchanged, the same progress object back), END, "1 day in a row" and "2 days in a row" in both languages, and a skipped day leaving the next routine as for a new learner. Mutation checks (each fails the suite): the most recently practiced key chosen (3), the exercise page ignored (1), the warm-up not wrapping (1), the chord drill fixed (2), the ear drill fixed (2), the routine never ending (2), a six-minute scale (2).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/practice/routine.test.js tests/practice/progress.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: pure functions; the page comes in pr8c2 |
| Rollback boundary | `src/practice/routine.js`, its test and the 24 strings |
