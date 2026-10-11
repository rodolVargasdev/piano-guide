# PR 2b2: The lesson walks the stages

Branch: `feat/learn-mode-pr2b2-stage-reducer`. Base: `feat/learn-mode-pr2b-stages`. Tasks: 14.2 and the "Next stage" and stage-label parts of 14.3 (the metronome and the browser check are pr2b3). Specs: learn-mode (Stages per phrase and per song; Progress saved and resumable).

## Chain context

```
feat/learn-mode-pr2b-stages
  ^
feat/learn-mode-pr2b2-stage-reducer          this PR
  ^
feat/learn-mode-pr2b3-stage-view
```

## What changes

- `src/learn/lesson.js` (rewritten around `state.plan`, `state.stage`, `state.focus`):
  - After the last step of a stage: `stageComplete` when another stage follows in the same phrase (or only the section and song stages remain), `phraseComplete` when the phrase is done and a later phrase has a stage for the hand the learner follows, `songComplete` after the last stage.
  - New action `NEXT_STAGE`; `NEXT_PHRASE` now also works from `stageComplete` (skip the other stages of the phrase) and lands on the followed hand (`focus`); `REPEAT` restarts the same stage.
  - Listen plays the stage's slice for its hand (`null`, both hands, for "T") and only a full-tempo stage passes `bpm` (the song tempo, explicitly). A slow stage passes none, so the engine plays slowly as before.
  - `CONTINUE` resumes `{ phrase, stage, hand }`; a stage that is missing, past the end or no longer belongs to the saved phrase and hand falls back to the old phrase-and-hand rule (positions saved before stages still resume).
  - `SET_KEY` keeps the same stage in the new key; `SET_HAND` jumps to that hand's stage of the phrase and becomes the followed hand.
  - Saved positions now carry `stage`, and name the stage to resume (after finishing the right hand, the left-hand stage).
  - In a both-hands step the matcher expects the union of both hands' keys in any order.
- `src/ui/learn-screen.js`, `src/i18n/strings.js`: `stage.*` strings and the screen model for `stageComplete` ("Correct. Stage done: Right hand." / "Now the left hand, slowly."), the stage named in the progress line and the intro ("Phrase 1 of 8. Left hand, slowly. Step 1 of 4") only when the phrase has more than one stage, "Next stage" as the primary action, "Next phrase" only when a later phrase exists.
- `src/ui/learn-view.js`: Listen passes `bpm` when given, the sounding keys cover both hands in a together stage, the quiet finger digits show each hand's own position, the keyboard context follows the stage.
- Tests: `tests/learn/lesson.test.js` (transition rows, the walk of every stage, Continue and its fallbacks, Listen per stage, silent lesson walk), `tests/learn/progress.test.js`, `tests/ui/learn-screen.test.js`, `tests/ui/learn-view.test.js` (the acceptance scenario below), existing expectations updated where the fixture's left hand now adds a stage.

## Changes of earlier behavior (deliberate)

In a song where a phrase has a left hand, finishing the right hand no longer says "Phrase done": it says the stage is done and offers the left hand. A learner who only wants the melody presses "Next phrase" (offered next to it). Single-hand phrases keep the old flow and wording. A progress line now names the stage only when it matters.

## Counter-proofs

- Mutation runs (the change is reverted afterwards): ignoring the saved stage fails 1 test; dropping the explicit full-tempo BPM fails 1; keeping the hand "T" in Listen (instead of both hands) fails 1; making "together full" a slow stage fails 6.
- Next stage does nothing while a stage is not finished; a stale or out-of-range saved stage is ignored; a one-hand phrase does not get stage labels; the private lesson walks every stage with no `listen` effect.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/learn/*.test.js tests/ui/learn-screen.test.js tests/ui/learn-view.test.js`: all pass |
| Full suite | `node --test`: 1327 tests, 1327 pass, 0 fail |
| Runtime harness | pr2b3 (browser walk of the stages with the metronome) |
| Rollback boundary | `src/learn/lesson.js`, the stage parts of `learn-screen.js`, `learn-view.js`, `strings.js`, and their tests |

## Review budget

590 authored changed lines including tests (497 added and 93 removed; 34 of the added lines are the progress tests, which are their own commit): `size:exception` recommended. It cannot shrink without leaving the suite red: the reducer rewrite (165 lines) changes what the screen and view tests must say, and those tests are the evidence for every transition.
