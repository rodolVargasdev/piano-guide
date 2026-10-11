# PR 5a: Schedule core

- Base branch: `feat/piano-guide-mvp-pr4-shell-router-catalog`
- Branch: `feat/piano-guide-mvp-pr5a-schedule`
- Chain: tracker -> PR 1 -> PR 2 -> PR 3 -> PR 4 -> **PR 5a (this)** -> PR 5b -> PR 6 -> PR 7 -> PR 8 -> PR 9
- Start: the app shell and catalog exist (PR 4). End: the pure look-ahead scheduling math exists with tests.
- Out of scope: the timeline queries (PR 5b), practice rules (PR 6), any audio or DOM code (PR 8).

PR 5 of the task list is split in two because the pair came to about 450 authored lines: 5a holds tasks 5.1 and 5.2, 5b holds 5.3 and 5.4.

## Summary

Adds the pure `src/core/schedule.js` and `tests/core/schedule.test.js`.

- `makeAnchor`, `tickAt`, `timeAt` and a small `reanchor` helper (BPM change keeps the current tick; not in the design signatures, added so the engine and the test share one definition).
- `windowEvents(notes, fromAbsTick, toAbsTick, loop)`: half-open windows, so consecutive windows return every event exactly once. With a loop, absolute ticks keep growing across passes; a note straddling the loop end is cut at the loop end; a note at the loop start belongs to the pass that starts at the boundary; a note exactly at the loop end is not part of the loop. Rest events are skipped. A zero-length or inverted loop behaves as no loop.
- `songTickOf(absTick, loop)` maps an absolute tick back to the song.

## Dependency diagram

```
PR 1 -> PR 2 -> PR 3 -> PR 4 -> 📍 PR 5a -> PR 5b -> PR 6 -> PR 7 -> PR 8 -> PR 9
```

## Size

About 211 authored lines (80 source, 129 tests, 2 task checkboxes). Within the 400-line budget.

## Checks run

- `node --test tests/core/schedule.test.js`: 14 pass, 0 fail.
- Property test: windows split at pseudo-random cuts give the same result as one window, with no loop, with a mid-song loop and with a loop at tick 0. Counter-proof: overlapping windows do duplicate (a case that must fail the property if the guard breaks).
- Manual mutation: changing the window end comparison from `>=` to `>` fails 1 test; restored.
- Runtime harness: N/A (pure module, no runtime).

## Rollback

Remove `src/core/schedule.js` and `tests/core/schedule.test.js`; nothing depends on them until PR 8.
