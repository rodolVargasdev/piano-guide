# PR 6: Practice core

- Base branch: `feat/piano-guide-mvp-pr5b-timeline`
- Branch: `feat/piano-guide-mvp-pr6-practice`
- Chain: tracker -> PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5a -> PR 5b -> **PR 6 (this)** -> PR 7 -> PR 8 -> PR 9
- Start: schedule and timeline cores exist. End: the pure practice rules exist with tests.
- Out of scope: the practice panel UI (PR 16), engine wiring of loops and ramps (PR 8 and PR 16).

## Summary

Adds the pure `src/core/practice.js` and `tests/core/practice.test.js` (tasks 6.1 and 6.2).

- `clampBpm` (20 to 240, integer, non-numeric gives 20), `effectiveBpm` (slow mode, default factor 0.5, not clamped).
- `normalizeLoop(range, { snap, meter, pickupTicks, lengthTicks, tempo })`: swap, snap A down and B up on the bar or beat grid anchored at the first full bar (the pickup is the tail of a virtual bar), clamp to the song, `null` for a zero-length result. `loopFromSection`.
- `passesBetween(prevAbsTick, absTick, loop)`: a pass completes exactly at its end boundary, counted once; summing split steps equals one big step.
- Ramp: `canRamp`, `normalizeRamp` (clamp, swap, step at least 1), `nextRampBpm` (`max(start, min(target, current + step))`), plus a small `defaultRamp(songBpm)` helper for the panel (start 60 percent rounded, step 5, target song tempo). `defaultRamp` is not in the design signatures; it carries the documented defaults in one tested place.
- `audibleNotes` and `visibleNotes` filter by the two independent per-hand flags.

## Dependency diagram

```
PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5a -> PR 5b -> 📍 PR 6 -> PR 7 -> PR 8 -> PR 9
```

## Size

About 97 source plus 161 test lines, 301 authored lines with this description and the task checkboxes. Within the 400-line budget.

## Checks run

- `node --test tests/core/practice.test.js`: 20 pass. Full `node --test`: 318 pass, 0 fail.
- Counter-proofs: removing the BPM upper cap fails 2 tests; snapping B down instead of up fails 3; restored.
- Runtime harness: N/A (pure module).

## Rollback

Remove `src/core/practice.js` and `tests/core/practice.test.js`.
