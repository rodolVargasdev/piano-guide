# PR 6a3: Lesson reducer

Branch: `feat/learn-mode-pr6a3-lesson-reducer`. Base: `feat/learn-mode-pr6a2-region`. Tasks: 6.4, 6.5. Specs: learn-mode (flow, waiting, transposition, language switch, progress, private songs guided silently).

## Chain context

```
feat/learn-mode-pr6a2-region
  ^
feat/learn-mode-pr6a3-lesson-reducer    📍 this PR
  ^
feat/learn-mode-pr7a-audio-held-range (next)
```

- Start: phrases, steps, matcher, progress and region exist. End: the whole Milestone A lesson flow is one pure reducer with returned effects.
- Follow-up: pr11a (the Learn view feeds it actions and runs its effects).
- Out of scope: lesson zero and stages (`lessonZero`, `stageComplete`, `NEXT_STAGE`, hand "T" arrive in pr1b and pr2b), any UI.

## What changes

- `src/learn/lesson.js` (new): `initLesson({ song, levelId, keyTonic, hand, progress, silent })` and `reduce(state, action) -> { state, effects }`.
  - Phases: `start`, `phraseIntro`, `listening`, `yourTurn`, `phraseComplete`, `songComplete`.
  - Actions: `START`, `CONTINUE`, `LISTEN`, `LISTEN_DONE`, `MY_TURN`, `NOTE_ON`, `NOTE_OFF`, `LISTEN_AGAIN`, `NEXT_PHRASE`, `REPEAT`, `SET_LANG`, `SET_KEY`, `SET_HAND`, `LEAVE`.
  - Effects: `listen { phraseId, startTick, endTick, hand }` (no `bpm`: the default slow tempo), `stopListen`, `save { position, transpose? }`, `announce { kind: correct | wrong | octave | phraseDone | songDone }`, `releaseAll`.
  - The state holds the held keys, so a key down when a step begins (including the key that interrupted Listen) is passed to the matcher as held at start.
  - "Correct" is a transient flag: the state moves to the next step in the same call, so a fast learner never loses a press.
  - `SET_LANG` returns the very same state object: the view re-renders text and the accumulated presses are untouched.
  - `SET_KEY` accepts only the original tonic or a `learn.transposeTo` target, keeps the phrase index (the hand goes to that phrase's intro or first step) and saves the choice (`transpose: tonic`, or `null` for the original key). `SET_HAND` refuses a hand with no notes and moves to the next phrase that has steps for the hand.
  - Fail closed: `silent` is the OR of the `silent` argument and "the timeline is not explicitly `silent: false`". A silent lesson never emits `listen`: `LISTEN` and `LISTEN_AGAIN` change nothing and the phrase intro is skipped.
  - An action that does not apply in the current phase returns the same state; an unknown action throws `TypeError`.
- `tests/learn/lesson.test.js` (new, 20 tests): one test per design table row plus the spec scenarios named in the task, on a synthetic three-phrase song (left hand has no note in phrase 2).

## Counter-proofs

- Private never emits `listen`: five seeded random sequences of 400 events each over every action, for a private song and for a public song flagged silent. The same sequences on a public song do emit it. Sanity mutation (done once, not committed): removing both silent guards made three tests fail (the first-step phase, the fuzz and the refusal test).
- A tonic that is not a target, or the key already in use, leaves the very same state.
- A key held at the start of a step does not count; released and pressed again it does; a held key pressed again without a release is an auto-repeat.
- A wrong key in the middle of a chord clears what was pressed (the last key alone is not enough).

## Deviations and decisions to confirm

- Saved position: on a phrase completion the NEXT phrase index is saved (so "Continue" resumes at the phrase the learner has not done yet); on the last phrase the saved index is the last one.
- Finishing the last step of the last phrase goes straight to `songComplete` (no intermediate `phraseComplete`), with the `songDone` announcement.
- The design row "NOTE_ON while satisfied on last step" is covered by the satisfying press itself ending the phrase.
- `initLesson` keeps `song`, the derived `timeline` and `phrases` in the state (the reducer needs them to re-derive steps on `SET_KEY` and `SET_HAND`), so the state is not a small plain object; it is still data with no DOM, audio or storage.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/learn/*.test.js`: 78 tests, 78 pass (20 in this PR) |
| Full suite | `node --test`: 1083 tests, 1083 pass, 0 fail |
| Runtime harness | N/A: pure reducer driven by action tables and seeded random sequences |
| Rollback boundary | `src/learn/lesson.js` and its test |

## Review budget

424 authored changed lines including tests (source 188, tests 236), plus this description. Over the 400 budget by 24 lines; the reducer is the unit the task named as the split point and cannot shrink further without removing coverage or the transposition and hand rows. `size:exception` is recommended for this PR only if the maintainer counts the description.
