# PR 11a3: Screen model for the Learn view

Branch: `feat/learn-mode-pr11a3-screen-model`. Base: `feat/learn-mode-pr11a2-input-panel`. Task: 11.2 (first part). Specs: learn-mode (instructions, feedback, flow), private-song-library (no Listen for a private song), learner-language.

## Chain context

```
feat/learn-mode-pr11a2-input-panel
  ^
feat/learn-mode-pr11a3-screen-model     this PR
  ^
feat/learn-mode-pr11a4-learn-wiring (next: the view itself)
```

## Beginner rule

The user's complaint about the previous version was "not didactic, unclear what it does". The screen model is where the answer lives: at every moment the screen says ONE thing in plain words and offers only the actions that make sense then.

| Moment | Heading (the one instruction) | Sub line | Actions |
|---|---|---|---|
| Start | "Press Start. The screen tells you which finger goes on which key, one step at a time." | private: "The app does not play this song. It only tells you what to play." | Start (or Continue first, Start over second) |
| Phrase intro (public) | "Phrase 1 of N." | the authored hint | Listen, My turn |
| Listening | "Listen." | | My turn |
| My turn | the step: "Right hand: thumb on E (Mi)." | "Press the key marked with the finger number." | Listen again (public only), Repeat phrase; chip Correct / Try again + "Use the shaded key." |
| Phrase complete | "Correct. Phrase n of N done." | | Next phrase, Repeat phrase |
| Song complete | "You played the whole song." | | Start over |

## What changes

- `src/ui/learn-screen.js` (new): `screenModel(state, { i18n, hasSaved, showProgressReset })` returns `{ phase, heading, sub, progress, chip, actions }` as plain data; Spanish and English through the translator.
- `src/learn/position.js` (new): `stepMidi`, `positionKeys(position, hand)`: the five white keys of the hand position with their fingers (right thumb lowest, left thumb highest), for the quiet digits on the keyboard.
- `src/i18n/strings.js`: `learn.howTo`, `learn.hintKeys`, `learn.key`, `learn.hand`, `common.loading`.
- Tests: `tests/ui/learn-screen.test.js` (8), `tests/learn/position.test.js` (3).

## Counter-proofs

- A private song is never offered Listen or Listen again in any phase of a full walk (a public song, same walk, is offered Listen again).
- Every instruction of a phrase is at most two sentences and 25 words in both languages.
- A wrong key and the other-octave key give different kind lines; no feedback before any key means no chip.
- No position gives no keys; the hand is carried on each key.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/learn-screen.test.js tests/learn/position.test.js`: 11 tests, 11 pass |
| Full suite | `node --test`: 1239 tests, 1239 pass, 0 fail |
| Runtime harness | the whole screen on a real browser in pr11a5 |
| Rollback boundary | `src/ui/learn-screen.js`, `src/learn/position.js`, the five string keys, their tests |

## Review budget

206 authored changed lines including tests (source 81, tests 125), plus this description.
