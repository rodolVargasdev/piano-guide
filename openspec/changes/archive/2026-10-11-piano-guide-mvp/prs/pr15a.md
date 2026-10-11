# PR 15a: Level resolution, position mapping and hash helpers

- Base branch: `feat/piano-guide-mvp-pr14f-score-wiring`
- Branch: `feat/piano-guide-mvp-pr15a-level-resolution`
- Chain: tracker -> ... -> PR 14f -> **PR 15a (this)** -> PR 15b
- Start: the player picks a level from the hash only. End: the pure rules of level selection exist and are tested. Task 15.1 is checked here; 15.2 and 15.3 are completed in PR 15b.
- Out of scope: the selector controls, the level switch in the player and the `view` handling (PR 15b).

## Summary

- `src/ui/level-select.js` (pure; storage is injected): `resolveLevelId(song, requested, remembered)` (hash level, then session memory, then default; unknown ids and inherited names such as `toString` fall through), `levelChoices(song)` (only the levels present, beginner first, `single` for the static chip), `mapPosition(tick, from, to)` (same bar and beat through `barBeatOf` and `tickOfBarBeat`, clamped to the new length), `updateHash(hash, changes)` (writes level, names and view, keeps other parameters such as `debug=1`, encodes values so a hostile value cannot add a parameter), `levelKey`, `readRemembered` and `remember` (a blocked storage reads as nothing).

## Dependency diagram

```
... -> PR 14f -> [PR 15a, this PR] -> PR 15b -> PR 16
```

## Size

71 lines of module, 87 of tests, 1 task line and this description: about 190 authored lines.

## Checks

- `node --test tests/ui/level-select.test.js`: 8 pass, 0 fail. Full suite passes.
- Counter-proofs run: ignoring the session memory fails 2 tests; copying the raw tick instead of mapping bar and beat fails 1; using `in` instead of `Object.hasOwn` fails 1. All restored.
- Runtime harness: N/A, pure module (the browser check is in PR 15b).

## Rollback

Delete `src/ui/level-select.js` and its suite; uncheck 15.1.
