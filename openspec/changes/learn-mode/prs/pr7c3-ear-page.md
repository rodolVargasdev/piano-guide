# PR 7c3: The ear drill page

Branch: `feat/learn-mode-pr7c3-ear-page`. Base: `feat/learn-mode-pr7c2-ear-screen`. Tasks: the page half of 25.2 and 25.3 (browser check). Specs: practice-exercises (ear drills), note-input (play-back), learn-keyboard (reuse).

## Chain context

```
feat/learn-mode-pr7c2-ear-screen
  ^
feat/learn-mode-pr7c3-ear-page               this PR (📍)
  ^
feat/learn-mode-pr8c-routine-session
```

## What changes

- `src/ui/practice-ear.js`: `createEarPage` wires the ear reducer, the screen model, the shared inputs and the learn keyboard. Play and Listen again play the question through `engine.playNotes` (generated notes only, so no song is touched; the click is the gesture that resumes audio); Next question plays the next one at once. The learner answers with a button or by playing it back: the keyboard is a fixed two octaves from middle C (C4 to B5), the computer keys and MIDI work too, and **nothing is shaded and nothing lights while a question sounds**, so the keyboard gives no clue. A round is recorded as one practice run (clean when it earned a new choice, 8 of 10 right) and the number of unlocked choices is saved, so they come back on the next visit. The summary shows the streak of good rounds. The doc card is one tap away in a fold, and a language switch in the middle of a question keeps the question, the pick and the count (and does not play the question again).
- `src/ui/practice-view.js`: the ear drills open this page; the routine still shows its card until pr8c.
- `styles/app.css`: the choices as a responsive grid of big buttons (a struck name and a dimmed button for a wrong pick, a thick green border plus the words "Right answer" for the right one); in landscape the plain lines hide so the choices and the keyboard fit.
- `src/i18n/strings.js` was extended in pr7c2.

## Tests and counter-proofs

`tests/ui/practice-ear.test.js` (12), with a fake DOM, engine, window and storage: the page waits for Play and shows no clue (no shaded key, fourteen white keys from C4 to B5); Listen again any number of times with the same question and no penalty; a wrong button strikes that choice and hides the answer, the second reveals it; the right button gives Correct and the score, and Next plays a different question and the count goes up; play-back on the keyboard (right distance in another octave is Correct, a wrong one is Try again, the learner's keys sound); a chord drill answered by its three notes in any order; a perfect round (the question order is mirrored from the seed) unlocks the perfect fourth, saves it, records a clean run and the next round offers four choices and plays at once; a weak round unlocks nothing, is not a clean run and leaves three choices; a saved count of 2 starts with five choices; Spanish and a language switch in the middle; the practice view mounting this page for the ear drills and not for the routine; leaving. Mutation checks (each fails the suite): the question not played (1), the unlock not saved (1), every round recorded as clean (1), the right choice marked early (3), a narrower keyboard (1).

## Browser check (25.3; headless Chrome, real GPU flags, port 8790, `NO_PRIVATE=1`)

Screenshots `lmC-ear-*` (ready, asking, answered, playback, round) were opened and read at 1440 x 900, 844 x 390 and 390 x 844. Walkthrough of the interval drill: Play, a wrong button ("Try again", "Major third" struck with "Not this one"), the right one ("Correct", "Perfect fifth", "Strong and hollow (7 semitones).", "Right answer"), Next question, playing the answer back with the mouse on the keyboard (a major third from C4 is "Try again", a perfect fifth is "Correct"), a whole round ("Round finished: 2/10. Get 8 of 10 right to unlock a new choice."), the round saved. Nothing is heard by this check: the sound of the question and of the learner's keys is user-only.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/practice-ear.test.js tests/ui/ear-screen.test.js tests/ui/practice-view.test.js tests/learn-guard.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | headless Chrome: the walkthrough above |
| Rollback boundary | `src/ui/practice-ear.js`, the ear branch of `src/ui/practice-view.js`, the ear CSS, the page test |
