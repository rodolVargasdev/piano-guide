# PR 21a: marker plan and real shift hints

- Base branch: `feat/piano-guide-mvp-pr20c-chopin-analysis-lesson`
- Branch: `feat/piano-guide-mvp-pr21a-marker-plan`
- Chain: ... -> PR 20c -> **PR 21a (this)** -> PR 21b -> PR 22a to 22f
- Start: no code decides which keys carry a finger marker. End: a pure plan answers that for any tick, and `shiftHints` is tested on the real Nocturne. Task 21.2 is checked here.
- Out of scope: drawing the markers (PR 21b), the scene wiring and the browser check (PR 21b).

## Summary

- `src/scene/marker-plan.js`: `createMarkerPlan(timeline)` returns reused typed arrays (`midi`, `hand`, `finger`, `ghost`, `ring`) and `update(tick, handModes)`. A sounding note is a full marker, a note starting within one beat is a ghost (40 percent), a note without `finger` has no marker, a note flagged by `shiftHints` also gets a ring over the same window (one beat early). Hidden hands show nothing, muted hands still do, a repeated note shows one marker, capacity 24. `ringStrength(tick, beat, reduced)` pulses once per beat in musical time and is a steady 1 under reduced motion.
- `tests/scene/marker-plan.test.js` (11 tests) and one case in `tests/core/timeline.test.js` on the real Nocturne: the right-hand leaps (240 G5, 3120 G5, 3600 C5, 3840 C6, 9120 D6, 10080 C5) are flagged, the G5 F5 G5 F5 Eb5 melody is not, and a threshold of 40 flags nothing (counter-proof).

## Dependency diagram

```
... -> PR 20c -> [PR 21a, this PR] -> PR 21b -> PR 22a
```

## Checks

- Full suite: 692 pass, 0 fail.
- Observation, not a defect: the rule of the spec flags almost every left-hand chord of the Nocturne (55 of 128 events, the bass-to-chord leap of more than 5 semitones). The rings therefore pulse on the left hand almost every beat. The rule is kept as specified; PR 21b reports how it looks.

## Rollback

Delete `marker-plan.js` and its test; nothing else uses them yet.
