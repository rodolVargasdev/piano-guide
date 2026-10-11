# PR 8c2: The routine page (block by block, Skip, summary)

Branch: `feat/learn-mode-pr8c2-routine-page`. Base: `feat/learn-mode-pr8c-routine-session`. Tasks: 26.2 and the browser check of 26.3. Specs: practice-exercises (the 10-minute routine, progress visible the next day). The Today card on the list follows in pr8c3.

## Chain context

```
feat/learn-mode-pr8c-routine-session
  ^
feat/learn-mode-pr8c2-routine-page           this PR (📍)
  ^
feat/learn-mode-pr8c3-today-card
```

## What changes

- `src/ui/practice-routine.js`: `#/practice/routine` opens an intro with today's four things ("Warm-up: Five-finger patterns in C major, 2 minutes", "Scale: ...", "Chords: ...", "Ear: ..."), the total ("About 10 minutes"), the days in a row when there are some and "You practiced today." when the day is already recorded, and "Start the routine". Each block then runs with **the same page as its own exercise** (the run page or the ear page, hosted without its own title bar, choices, key picker or progress, with the key fixed and no Next key), with the step marks (Warm-up Done, Scale Now, Chords To do, Ear To do: a ring for done, a dashed outline for skipped, a thick border for the current one, always with the word), "Skip block" at any moment, and "Next block" (or "Finish the routine" on the last) once the block is done: a run block when its run ends, the ear block after at least one answered question. At the end a summary lists each block as Done or Skipped and says "Today counts: 2 days in a row."; when every block was skipped it says "Every block was skipped, so today does not count." and records nothing. The day is recorded with `recordRoutine` (pr4c2): only done blocks move the warm-up key and the scale dates. The page has its own language selector like every practice page (the header one is hidden), the block page repaints itself on a language change so the step and the keys already pressed survive, and leaving disposes the block page.
- `src/ui/practice-run.js` and `src/ui/practice-ear.js`: an `embedded` option ({ options, onState }): the page opens with the block's options, tells `onState` the session state after every change, and leaves out what the routine provides itself.
- `src/ui/practice-view.js`: the routine kind opens this page; `styles/app.css`: the routine list, the step marks, the compact hosted page, and a landscape layout that puts the controls beside the block name so the keyboard stays in reach.
- Date: the routine takes today's local date from an injectable `today()`. There is no `?today=` hook in the shipped page; the next-day check below moves the saved dates back by one day instead.

## Tests and counter-proofs

`tests/ui/practice-routine.test.js` (15), with a fake DOM, window, engine and storage (one engine per block): the intro for a new learner, Start and the first block (Block 1 of 4, the marks, no second title bar, Skip, Next block hidden), playing the warm-up to its end and moving on (the first block page disposed, no Next key inside a block), Skip, a whole routine (four done, the summary, "Today counts: 1 day in a row.", the day recorded with the keys), skipping the ear block after three done (still recorded), skipping all four (nothing recorded), the next day (G, streak shown, "2 days in a row"), the same day again ("You practiced today.", no extra day), Spanish ("1 día seguido"), a language switch in the middle of a block keeping the step, the practice view opening it and disposing it, block lines, a bad date, and the route marker. Mutation checks (each fails the suite): the day not recorded (5), Next block always visible (2), readiness always true (2), the block page not disposed (2), the end of the routine ignored (7), the rotation not fixed inside a block (1). One mutation is equivalent and survives: the per-block ear seed (any answered question makes the ear block ready).

## Browser check (26.3; headless Chrome, real GPU flags, port 8790, `NO_PRIVATE=1`)

Screenshots `lmC-routine-*` (intro, block 1 done, block 2, summaries, the next day) at 1440 x 900, 844 x 390 (English) and 390 x 844 (Spanish) were opened and read. Walkthrough: day 1 (C warm-up, C scale, cadence in C, chord ear drill; all four done; "Today counts: 1 day in a row."; saved `dayStreak 1`, `lastWarmupKey C`, `scaleLastPracticed C`); the saved dates moved back one day; day 2 opens with the warm-up and the scale in G and "1 day in a row" in the intro, the chord block skipped on purpose, the summary shows it Skipped and "Today counts: 2 days in a row." Findings fixed during the walk: a second language selector showed because the routine did not mark its route (the header one is now hidden); in landscape the step marks and the controls pushed the keyboard out of reach (the marks hide and the controls sit beside the block name); the controls moved above the hosted page so Skip needs no scroll past the keyboard. Sound is user-only.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/practice-routine.test.js tests/ui/practice-run.test.js tests/ui/practice-ear.test.js tests/ui/practice-view.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | headless Chrome: two sessions (day 1 and the next day) at three viewports in two languages |
| Rollback boundary | `src/ui/practice-routine.js`, the `embedded` option of the two pages, the routine branch of the view, the routine CSS, the page test |
