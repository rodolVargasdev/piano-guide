# PR 10b: Quality-tier decision core

- Base branch: `feat/piano-guide-mvp-pr10a-keyboard-layout`
- Branch: `feat/piano-guide-mvp-pr10b-quality-tiers`
- Chain: tracker -> ... -> PR 10a -> **PR 10b (this)** -> PR 11a
- Start: the keyboard geometry exists. End: the pure tier decision exists and is tested; the scene that applies tiers arrives in PR 22.
- Out of scope: applying tiers to the renderer, the frame sampler and the manual selector (PR 22).

## Summary

Adds `src/core/quality.js` and `tests/core/quality.test.js`. Tasks 10.3 and 10.4.

- `TIERS` is `high, medium, low, minimum`.
- `decideTier(frameTimesMs, currentTier, state)` returns `{ tier, state }`. Call it once per frame with the rolling 120-frame sample (newest last). An average above 22 ms for 2 consecutive seconds steps down exactly one tier (never below minimum). An average below 10 ms for 20 consecutive seconds steps up one tier, once per session. Anything in between resets both counters.
- After a step the sample must refill (120 frames) before the next decision, so one slow period cannot cascade through every tier.
- A frame longer than 100 ms (hidden tab, stall) adds at most 100 ms to the sustained counters.
- `createQualityState()` and `initialTier({ hardwareConcurrency, coarsePointer })` (Medium at 4 cores or fewer, or a coarse pointer; High otherwise).

## Dependency diagram

```
... -> PR 10a -> [PR 10b, this PR] -> PR 11a
```

## Size

76 source and 152 test lines, 4 lines of task checkboxes and this description: about 270 authored lines. Within the 400-line budget.

## Checks run

- `node --test tests/core/quality.test.js`: 14 pass, 0 fail. Full `node --test`: 414 pass, 0 fail.
- Counter-proofs (each run, then restored): the slow threshold made inclusive (`>=`) fails 1 test (a trace at exactly 22 ms must never step down); removing the once-per-session guard fails 2 tests; removing the settle period fails 1 test. A trace hovering at 22 ms for 1 s and for 30 s, an alternating 8 and 30 ms trace and a seeded noisy trace (8 to 30 ms) never change tier.
- Runtime harness: N/A, pure module with no runtime boundary.
- Behavior note: the first spike test written (ten 120 ms frames) did step down, because the 120-frame average stayed above 22 ms for over 2 s; the test now uses five such frames. This is the intended window behavior, not a bug.

## Rollback

Remove `src/core/quality.js` and its suite; nothing imports them yet.
