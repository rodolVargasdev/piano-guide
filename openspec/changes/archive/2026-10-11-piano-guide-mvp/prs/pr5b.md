# PR 5b: Timeline core

- Base branch: `feat/piano-guide-mvp-pr5a-schedule`
- Branch: `feat/piano-guide-mvp-pr5b-timeline`
- Chain: tracker -> PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5a -> **PR 5b (this)** -> PR 6 -> PR 7 -> PR 8 -> PR 9
- Start: scheduling math exists (PR 5a). End: a level resolves to a timeline with the queries views need.
- Out of scope: practice rules (PR 6), rendering, audio.

## Summary

Adds the pure `src/core/timeline.js` and `tests/core/timeline.test.js` (tasks 5.3 and 5.4).

- `resolveLevel(song, levelId)`: adds `midi` to every note, sorts by tick then pitch then hand, computes `range` (`{ low, high }` or `null`) and carries `lengthTicks`, `meter`, `pickupTicks`, `tempo`, `chords`, `sections`, `pedal`, `analysis` and `shifts` so views do not need the whole song. Does not mutate the song; throws `RangeError` for an unknown level.
- `activeAt(timeline, tick, out?)`: start inclusive, end exclusive, rests never active. The optional `out` array is reused so the render loop can avoid per-frame allocations.
- `shiftHints(notes, hand, threshold = 5)`: an event is a shift when its pitch is more than 5 semitones outside the span of the previous onset group of the same hand. The first group is never a shift, hands are independent, grace notes and rests are ignored.

## Dependency diagram

```
PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5a -> 📍 PR 5b -> PR 6 -> PR 7 -> PR 8 -> PR 9
```

## Size

About 210 authored lines (source about 100, tests about 110). Within the 400-line budget.

## Checks run

- `node --test tests/core/timeline.test.js`: 12 pass. Full `node --test`: 298 pass, 0 fail.
- Counter-proof: changing the shift comparison from `>` to `>=` fails 2 tests; restored.
- Runtime harness: N/A (pure module).

## Rollback

Remove `src/core/timeline.js` and `tests/core/timeline.test.js`.
