# PR 6c7: Tempo, metronome, key rotation, progress on the page, Reset

Branch: `feat/learn-mode-pr6c7-practice-tempo-keys`. Base: `feat/learn-mode-pr6c6-circle-of-fifths`. Tasks: the rest of 24.1 (metronome, tempo ramp UI, key rotation, progress summary, Reset progress) and 24.2 (CSS for the three viewports); the browser check of 24.3. Specs: practice-exercises (metronome, tempo ramp and key rotation, local progress per exercise and key, scale order suggested, not enforced).

## Chain context

```
feat/learn-mode-pr6c6-circle-of-fifths
  ^
feat/learn-mode-pr6c7-practice-tempo-keys    this PR (📍)
  ^
feat/learn-mode-pr7c-ear-session
```

## What changes

- `src/ui/practice-run.js`:
  - **Tempo**: the steps of the card as buttons (plus a tempo that is none of them, so the current one is always pressed); a clean run suggests the next step and "Faster: 72" starts at it.
  - **Metronome**: a toggle; while a run is going it clicks at the page tempo on a note-less timeline from `makeTimeline` (accent on the first beat), follows a tempo change, stops when the run ends, on Stop and when the page closes (A1: tempo paces, nothing is timed).
  - **Key**: the circle of fifths (pr6c6) in a fold that is open on a wide screen and closed on a phone (so Start stays near the top), with the order of "Next key" (circle of fifths, circle of fourths, random, same key). Choosing a key regenerates the scale in it and restarts the rotation from it.
  - **Progress of the key** under the choices: "Your progress in G major" with best tempo, clean streak, clean runs and last day, or "No clean run in G major yet."
- `src/practice/session.js`: the order of introduction. With no key given the page opens on the first key that has no clean run yet (C for a new learner, G after a clean C, D after C and G...), and the circle marks the next three (G, D, F for a new learner). It is an order, never a lock: every key can be chosen. `practiceOrder` is also exported.
- `src/ui/practice-view.js`: the list has "Reset progress" with an inline question ("Reset all practice progress? Yes No"), no dialog; Yes clears the saved value and the chips disappear, No keeps everything.
- `src/ui/practice-doc.js`: `summaryChips` moved here (shared by the list and the page).
- `styles/app.css`: the circle positions (twelve classes), the ring and dashed marks, the setup grid (choices left, circle right on a wide screen), the folds, the reset row; the choices, the keys and the progress hide while a run is going.
- `src/i18n/strings.js`: the tempo, rotation, progress and reset strings, English and Spanish.

## Tests and counter-proofs

`tests/ui/practice-tempo-keys.test.js` (14): tempo buttons and their effect; the tempo recorded and the suggestion as a button; the metronome (off until Start, a note-less `silent: false` timeline, the calls `setBpm`, `setMetronome`, `play`, a tempo change followed, `stop` when the run ends, `stop` when the page closes); the circle (selected, regenerates the scale: A scale starts on A4); a new learner sees C with G D F marked, and after a clean C the page opens on G with C ringed; the four rotations and fourths going C then F; Same key hiding Next key; the progress of the key (none, then best tempo 72, streak 3, 3 runs and the date, then streak 4 after a run); an unclean run resetting the streak and keeping the best tempo; Reset with No and Yes in English and Spanish and no dialog; and the CSS (twelve positions and no more, the ring and the dashed outline). `tests/practice/session-keys.test.js` (6): the order of introduction, per exercise, an unclean run not counting, an explicit key winning, all keys practiced. Mutation checks (each fails the suite): the click not stopping at the end of a run (2), a tempo change not followed (1), Reset not clearing (1), unclean runs counting as practiced (1), the current key also marked as next (1), closing the page not stopping the clicks (1).

## Browser check (24.3; headless Chrome, real GPU flags, port 8790, `NO_PRIVATE=1`)

Screenshots `lmC-tempo-*`, `lmC-nextkey-*`, `lmC-reload-*`, `lmC-reset-*` at 1440 x 900 and 844 x 390 (English) and 390 x 844 (Spanish) were opened and read. A beginner walkthrough: the page opens on C with G, D, F marked; tempo 60 and the metronome on; a clean C scale ("Next tempo to try: 72"); Next key announces "Next key: G major" and shows the G scale with F sharp at tempo 60; a clean G scale; after a reload the page opens on D with C and G ringed and A, E, F marked; the G progress shows best tempo 60, streak 1, 1 clean run, the date; the list shows the chips; Reset asks inline and Yes empties the chips and the storage. Findings fixed during the walk: the circle collapsed to a few pixels in the wide layout (a percentage width inside an auto column; it now has a fixed width), and the progress and the circle pushed the keyboard far below on a phone (the key picker is now a fold, closed on a phone). The metronome click and the practice sounds are user-only (not heard here).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/practice-tempo-keys.test.js tests/practice/session-keys.test.js tests/ui/practice-run.test.js tests/ui/practice-view.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | headless Chrome: the two-session walkthrough above at three viewports in two languages |
| Review budget | about 600 authored changed lines (CSS 152, tests 277, code about 170): 200 over the budget, one cohesive page feature (the choices, the circle, the clicks and the progress share one file and one walkthrough); `size:exception` recommended |
| Rollback boundary | the tempo, key, progress and metronome parts of `src/ui/practice-run.js`, the order of introduction in `src/practice/session.js`, the reset row of the view, the new CSS and strings, the two test files |
