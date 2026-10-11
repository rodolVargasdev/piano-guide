# PR 1b: Lesson zero, logic

Branch: `feat/learn-mode-pr1b-lesson-zero`. Base: `feat/learn-mode-pr12a-docs-docker`. Tasks: 13.1, 13.2 and the reducer half of 13.3 (the view half is pr1b2). Specs: learn-mode (Lesson zero), learner-language.

## Chain context

```
feat/learn-mode-pr12a-docs-docker
  ^
feat/learn-mode-pr1b-lesson-zero             this PR (first of Milestone B)
  ^
feat/learn-mode-pr1b2-lesson-zero-view
```

Order note: the sampled piano (phase 15, pr3b) is not approved yet, so it is skipped here and will be appended at the end of the chain. Milestone B runs pr1b, pr1b2, pr2b, pr2b2, pr2b3, pr4b, pr5b, pr5b2, pr6b.

## What changes

- `src/learn/lesson-zero.js` (new): the four parts as data (find C, posture, fingers 1 to 5, inputs) and a small pure reducer `reduceZero`. Part 1 uses the matcher in `pitchClass` mode, so any C counts; part 3 is five single-key steps C4 D4 E4 F4 G4 with fingers 1 to 5 in exact mode. `blackGroups` and `zeroKeyboard` say what the keyboard shows (the groups of two black keys outlined in part 1, the finger key shaded in part 3). Nothing is timed.
- `src/learn/lesson.js`: phase `lessonZero`, actions `LESSON_ZERO` (from the first screen only), `ZERO_NEXT`, `ZERO_SKIP`, effect `lessonZero { value }`. Skip and completion return to the first screen and mark `lessonZero` as "skipped" or "done" in the progress (once for the learner). Key and hand changes are ignored inside lesson zero, and its keys never advance a step of the song.
- `src/i18n/strings.js`: the `lz.*` keys, English and Spanish, simple words, with the Casio line and the "audio only" line.

## Counter-proofs

- Another key (D, C#, B, F) does not advance part 1; with exact matching the C of another octave stops counting (mutation run: 2 tests fail).
- A key held when lesson zero opens, or the C that finished part 1 and is still down, does not count until released and pressed again.
- Out-of-order finger keys are "wrong"; the C of another octave in part 3 is "octave".
- Completion is not saved after only the first part; the actions do nothing outside the first screen.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/learn/lesson-zero.test.js tests/learn/lesson.test.js tests/i18n/*.test.js`: all pass |
| Full suite | `node --test`: 1284 tests, 1284 pass, 0 fail |
| Runtime harness | N/A: pure reducer; the browser check is in pr1b2 where the view exists |
| Rollback boundary | `src/learn/lesson-zero.js`, the lesson-zero additions of `src/learn/lesson.js`, the `lz.*` strings and their tests |

## Review budget

334 authored changed lines including tests, plus this description.
