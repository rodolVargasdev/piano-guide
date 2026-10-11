# PR 6c5: The page of one exercise (run, feedback, hear it first)

Branch: `feat/learn-mode-pr6c5-practice-run-page`. Base: `feat/learn-mode-pr6c4-practice-inputs`. Tasks: the page half of 24.1 and the CSS of 24.2. Specs: practice-exercises (running an exercise, exercise catalog), learn-keyboard (reuse), note-input. The tempo row, the metronome, the circle of fifths and the progress summary follow in pr6c6.

## Chain context

```
feat/learn-mode-pr6c4-practice-inputs
  ^
feat/learn-mode-pr6c5-practice-run-page      this PR (📍)
  ^
feat/learn-mode-pr6c6-practice-tempo-keys
```

## What changes

- `src/ui/practice-run.js`: `createExercisePage` wires the session reducer, the screen model, the learn keyboard and the shared inputs for a run exercise (five-finger, scales, chords, arpeggios, the cadence and the two progressions). Taps, the computer keys and MIDI all feed one bus. The keys of the step are shaded with the finger number; the keyboard shows the whole exercise so it does not move between steps (with a margin when the keys stay 36 px, without it if that is what fits, otherwise it scrolls to the step, the pr0c behavior); the computer-key map moves only when the keys to press fall outside it. Each right key says "Correct", a wrong key "Try again. Use the shaded key." and keeps the step; the run is saved when it ends (key, hand, tempo, clean or not). The choices (hands, octaves, direction, chord type) are segments; the doc card is one tap away in a fold; the card shows "Suggested fingering" with its one-line reason only where the books disagree.
- Hear it first: "Listen" plays the generated notes through `engine.playNotes` one beat apart while the keys light up, then returns to ready; Stop cancels it. Only generated notes are played, so no song is touched; the guard that Learn modules never import `playNotes` still holds (the call is a method on the engine, in this Practice file).
- `src/ui/practice-doc.js`: the doc card as an element and as plain data (`cardModel` moved here from the view, which re-exports it), shared by the card page and the fold.
- `src/ui/practice-view.js`: a run exercise opens its page (the page repaints itself when the language changes, so the view does not redraw it and the step, key, tempo and presses survive); the ear drills and the routine still show their card until their own screens arrive.
- `styles/app.css`: the page reuses the Learn card, chip and button classes; while a run is going the choices and the fold are hidden, so the step, the keyboard and the input panel fit 390 x 844 and 844 x 390 without scrolling; in landscape the header is hidden (the page has its own language selector), as in Learn.

## Tests and counter-proofs

`tests/ui/practice-run.test.js` (17) drives the page end to end with a fake DOM, engine, window and storage: ready state, Start and the step text, each Correct and the sound of a press, a wrong key (chip, help line, the shaded key stays, recorded unclean), a clean run (heading, tempo to try, the five actions, record), Again and Faster, Next key ("Next key: G major", the G scale, a record per key), the next hand, hearing it first (the plan one beat apart, back to ready after the timer, Stop), choices regenerating the exercise (two octaves, left hand, hands together needing both hands), chords in any order, a progression with its chord symbol, the Suggested fingering line, the language switch in the middle of a scale and of a chord, presses before Start only sounding, dispose, and a source scan for `innerHTML`. `tests/ui/practice-view.test.js` now opens a run exercise through its page. Mutation checks (each fails the suite): the run recorded as clean (1), Listen not returning to ready (1), the resize listener not removed (1), the unclean sentence replaced (2), the next-hand action removed (5). Two mutations are equivalent and survive on purpose: skipping the redraw optimization for a release, and not passing the held keys to Start (the bus never repeats a key that is down).

## Browser check (headless Chrome, real GPU flags, port 8790, `NO_PRIVATE=1`)

A beginner walkthrough at 1440 x 900, 844 x 390 and 390 x 844 (English and Spanish), screenshots `lmC-run-*` opened and read: C major right hand (ready, step 1, a wrong key with the hatched key and "Try again / Use the shaded key", mid-run, a finished run with "Faster: 60", "Next: left hand", "Next key" and "Listen"), triads in Spanish, and the both-hands progression I V vi IV in landscape (the root and the three chord keys shaded with R and L badges, the keyboard scrolled to them). Findings fixed during the walk: the first version kept the doc card open and pushed the keyboard below the fold on a phone (now folded, the goal is the heading); a margin of one key made nine white keys scroll by 2 px at 390 px (the region now drops the margin before it scrolls); the walkthrough script read the language only at load, so the first run showed the previous language (the script now reloads after setting it).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/practice-run.test.js tests/ui/practice-view.test.js tests/ui/practice-route.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | headless Chrome: the walkthrough above, three viewports, two languages, taps by mouse; computer keys and sound are user-only |
| Rollback boundary | `src/ui/practice-run.js`, `src/ui/practice-doc.js`, the view and CSS changes, the run and view tests |
| Review budget | 694 authored changed lines (page 261, doc card 29, view 42, CSS 65, tests 297), plus this description: 294 over the budget; `size:exception` recommended because the page, its CSS and its end-to-end test are one cohesive unit and cannot be shown half working |
