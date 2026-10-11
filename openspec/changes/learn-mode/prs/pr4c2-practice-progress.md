# PR 4c2: Practice progress (streaks, best tempo, routine days)

Branch: `feat/learn-mode-pr4c2-practice-progress`. Base: `feat/learn-mode-pr4c-timeline-runner`. Tasks: 22.3, 22.4. Spec: practice-exercises (local progress per exercise and key; the day streak of the routine, A5). Pure module plus injected storage: no screen yet.

## Chain context

```
feat/learn-mode-pr4c-timeline-runner
  ^
feat/learn-mode-pr4c2-practice-progress      this PR (📍)
  ^
feat/learn-mode-pr5c-exercise-catalog
```

## What changes

- `src/practice/progress.js`, key `piano-guide:practice:v1`: `{ v: 1, exercises: { [id]: { [key]: { cleanStreak, bestTempo, cleanRuns, lastPracticed } } }, routine: { lastDate, dayStreak, lastWarmupKey, scaleLastPracticed } }`.
  - `recordRun(progress, { exerciseId, key, bpm, clean, date })`: a clean run adds to `cleanStreak` and `cleanRuns` and raises `bestTempo`; an unclean run sets the streak to 0 and leaves the best tempo and the count; both set `lastPracticed`. Pure: it returns a new progress.
  - `recordRoutine(progress, { date, blocks })`: a no-op (the same object) when no block was done; otherwise the day is recorded (`dayStreak` +1 when the last day was yesterday, unchanged on the same day, else 1; a clock that went backwards changes nothing), and `lastWarmupKey` and `scaleLastPracticed` change only for blocks that were done.
  - `readPracticeProgress` / `writePracticeProgress` / `clearPracticeProgress`: corrupt JSON, a wrong version, a hand-edited entry, or a blocked store read as empty (entries are validated one by one, so a bad one does not drop a good one); writes and the reset never throw; the reset also works on a store without `removeItem`.
  - `summaryOf`, `entryOf`, `localIsoDate` (the learner's local calendar day, not UTC), `daysBetween`.
- Only exercise ids, tonic names, counts, tempos and dates are stored; a test asserts that no spelled pitch can appear (a key must be a tonic name, so `C#4` is refused).

## Tests and counter-proofs

`tests/practice/progress.test.js` (16): the spec scenario (two clean runs at 60 and one at 72 give streak 3, best 72, and it is all there the next day), unclean reset, slower runs keep the best tempo, keys and exercises kept apart, purity and bad input, corrupt and hand-edited stores, blocked storage, reset, the summary, privacy, day helpers, and the routine rules (first day, next day, same day, gap, last block skipped, everything skipped, done-only updates, clock backwards, bad block keys). Mutation checks (each fails the suite): streak not reset (1), best tempo overwritten (1), all-skipped recorded (1), streak not incremented (2), skipped blocks counted as done (2), key names not validated (1).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/practice/progress.test.js`: 16 pass |
| Full suite | `node --test`: 1449 tests, 0 fail |
| Runtime harness | N/A: pure module with injected storage; the browser reload check comes with pr6c |
| Rollback boundary | `src/practice/progress.js` and its test |
