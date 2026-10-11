# PR 2: Core timing and pitch

- Base branch: `feat/piano-guide-mvp-pr1-tooling-container`
- Branch: `feat/piano-guide-mvp-pr2-core-timing-pitch`
- Chain: tracker -> PR 1 -> **PR 2 (this)** -> PR 3 -> PR 4

## Summary

Adds the pure `src/core/timing.js` (PPQ = 480, bar and beat-unit ticks, ticks/seconds, `barBeatOf` and `tickOfBarBeat` with the pickup as bar 0, `beatGrid` with downbeat accent) and `src/core/pitch.js` (`parsePitch`, `noteName` in solfege or letters from the written spelling, `transpose` following the target key, plus `inPianoRange` and `keyFifths` helpers). Malformed pitch input returns `null` (documented in the module).

Out of scope: schema validation (PR 3), scheduling (PR 5).

## Checks run

- `node --test tests/core/timing.test.js tests/core/pitch.test.js`: 60 tests pass; full `node --test`: 63 pass, 0 fail.
- Counter-proof: with the dotted-quarter unit changed to 480 ticks and the flat-key spelling disabled, 6 tests fail; restored afterwards.
- `docker build -t piano-guide .` still succeeds (the suite runs inside the image).

## Rollback

Remove `src/core/timing.js`, `src/core/pitch.js` and their two suites.
