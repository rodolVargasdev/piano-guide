# PR 6a: Key matcher and saved progress

Branch: `feat/learn-mode-pr6a-matcher-progress`. Base: `feat/learn-mode-pr5a2-steps-instructions`. Tasks: 6.1, 6.2. Specs: learn-mode (the app waits for the right keys, progress saved and resumable).

## Chain context

```
feat/learn-mode-pr5a2-steps-instructions
  ^
feat/learn-mode-pr6a-matcher-progress   📍 this PR
  ^
feat/learn-mode-pr6a2-region (next)
```

- Start: steps exist. End: a step can be matched against note events, and the learner's position can be saved and read.
- Follow-up: pr6a2 (keyboard region), pr6a3 (lesson reducer, which uses both).
- Out of scope: the reducer, any UI.

## Why the original PR 6a was split

Phase 6 is about 800 authored lines with tests. The task text names the reducer (6.4) as the split point; the rest is cut again into matcher plus progress (this PR) and the region (pr6a2).

## What changes

- `src/learn/matcher.js` (new): `startStep(expectedMidis, heldMidis, { match })` and `matchEvent(m, event)`. Outcomes `progress`, `satisfied`, `wrong`, `octave`, `ignored`. No clock: a step is never failed by waiting and chord keys count in any order and at any distance in time. A wrong key clears the accumulation. Keys held when the step begins neither satisfy nor spoil it until released and pressed again. A repeated note-on of a key that is down is ignored (auto-repeat), so a held wrong key reports once. The same pitch class in another octave is reported as `octave` (a wrong key, feedback variant only, exact mode). `pitchClass` mode serves "any C counts" in lesson zero. The state is immutable.
- `src/learn/progress.js` (new): `readProgress`, `writeProgress`, `clearSong`, plus small pure helpers (`emptyProgress`, `positionOf`, `withPosition`, `withTranspose`, `withLessonZero`) the reducer will use. Key `piano-guide:learn:v1`. Absent, corrupt, wrong-version or blocked storage reads as empty; a failed write is swallowed and reported as `false`. Reads keep only well-formed entries, so a hand-edited value cannot break the lesson. Only ids, indexes, tonic names, hand letters, stage numbers and dates are stored.
- Tests: `tests/learn/matcher.test.js` (11), `tests/learn/progress.test.js` (9).

## Counter-proofs

- Matcher: an expected key held from before is ignored and then counts after release (same fixture); an unexpected held key does not spoil but counts as wrong after release and re-press; exact mode refuses the other C while pitch-class mode accepts it; two right keys then a wrong one need all three again (the same two keys alone are not enough after the clear).
- Progress: the privacy pattern for a spelled pitch is checked against three leaking strings and against a progress that carries a pitch as its tonic, so the clean result of the real serialization means something.
- Malformed values (six kinds of corrupt text, a hand-edited store with bad entries) never throw and never leak a bad entry through.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/learn/matcher.test.js tests/learn/progress.test.js`: 20 tests, 20 pass |
| Full suite | `node --test`: 1055 tests, 1055 pass, 0 fail |
| Runtime harness | N/A: pure modules driven by event tables, no user-visible surface in this PR |
| Rollback boundary | `src/learn/matcher.js`, `src/learn/progress.js` and their tests |

## Review budget

342 authored changed lines including tests (source 156, tests 186), plus this description.
