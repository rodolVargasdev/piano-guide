# PR 11a: Small phrases and a beginner start

Branch: `feat/learn-mode-pr11a-beginner-phrases`. Base: `feat/learn-mode-pr10a3-dev-server`. Task: groundwork for 11.2 (decision recorded below). Specs: learn-mode (phrases, flow).

## Chain context

```
feat/learn-mode-pr10a3-dev-server
  ^
feat/learn-mode-pr11a-beginner-phrases  this PR
  ^
feat/learn-mode-pr11a2-input-panel (next)
```

## Decision (user complaint: "not didactic, nothing useful for someone who cannot play")

The previous batch found that the automatic phrases of the private song begin with two left-hand-only intro phrases and are uneven (1 to 14 right-hand steps). Decision:

1. **Keep phrases small**: an automatic phrase never has more than 8 onset groups (`MAX_PHRASE_STEPS`); longer ones are cut into the fewest equal parts at an onset. On the local private song, the right hand goes from phrases of 1 to 14 steps to phrases of 4 to 7 (one 1-step tail phrase remains), 21 right-hand phrases in all. Counts only, no melody.
2. **Start at the melody**: the default hand is the right hand and the first phrase is the first one with right-hand steps (this already held in `initLesson`; it is now pinned by a test).
3. **Number honestly**: `phraseNumber(state)` counts only the phrases that have steps for the hand, so the first screen says "Phrase 1 of 21" and not "Phrase 3 of 23". Choosing the left hand brings the intro phrases back, numbered from 1 as well. The intro needs no special label because it is just the left hand's first phrase.
4. Authored `learn.phrases` are never split (an author decides).

## What changes

- `src/learn/phrases.js`: `MAX_PHRASE_STEPS = 8` and the split step in `derivePhrases`.
- `src/learn/lesson.js`: `phraseNumber`.
- Tests: `tests/learn/phrases.test.js` (4 new, 1 adjusted: the pickup fixture now splits 5 and 4), `tests/learn/lesson.test.js` (2 new).

## Counter-proofs

- A phrase of exactly 8 onsets is not split, 9 is (5 and 4); 16 gives 8 and 8; 20 sixteenths give 7, 7 and 6 starting on onsets, contiguous.
- Authored phrases with 16 notes stay one phrase.
- The onsets of both hands count (six right plus four left gives a split).
- Choosing the left hand brings the left-hand intro back.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test "tests/learn/*.test.js"`: all pass |
| Full suite | `node --test`: 1221 tests, 1221 pass, 0 fail |
| Runtime harness | the local private song, counts only (above); on screen in pr11a3 |
| Rollback boundary | `src/learn/phrases.js`, `phraseNumber` in `src/learn/lesson.js`, their tests |

## Review budget

104 authored changed lines including tests (source 30, tests 74), plus this description.
