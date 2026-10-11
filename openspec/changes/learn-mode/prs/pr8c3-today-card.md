# PR 8c3: The Today card on the practice list

Branch: `feat/learn-mode-pr8c3-today-card`. Base: `feat/learn-mode-pr8c2-routine-page`. Tasks: the "10-minute routine" entry and progress visible the next day of 26.2 and 26.3, plus the visual circle of fifths that highlights today's key (the creative addition of this batch). Spec: practice-exercises (the 10-minute routine, progress visible the next day).

## Chain context

```
feat/learn-mode-pr8c2-routine-page
  ^
feat/learn-mode-pr8c3-today-card             this PR (📍)
  ^
feat/learn-mode-pr9c-practice-docs
```

## What changes

- `src/ui/practice-today.js`: a "Today" card first on `#/practice`. On the left today's routine ("Warm-up: Five-finger patterns in A major, 2 minutes", "Scale: ... in F major", "Chords: ...", "Ear: ..."), "About 10 minutes | 3 days in a row", "Today's key: F major", how the learner is doing in that key (best tempo, clean streak, runs) when there is a record, "You practiced today." once the day is recorded, and "Start the routine" (a link to `#/practice/routine`). On the right (below on a phone) a **circle of fifths with today's key highlighted** and the keys already practiced ringed. The key of the day is the key of today's scale; keys count as practiced after a clean scale on their own page or a scale block the routine ended with. `todayModel` is plain data; the card follows the language and is redrawn with the progress (so "Reset progress" below it empties the streak too).
- `src/ui/circle-of-fifths.js`: a `readOnly` option (the buttons are disabled and keep their labels); the card only shows.
- `src/ui/practice-view.js`: the Today card is created once per list and redrawn on each render; the view takes an injectable `today()` for tests.
- `styles/app.css`: the card (two columns on a wide screen) and the read-only circle; `src/i18n/strings.js`: one string (`routine.todayKey`).

## Tests and counter-proofs

`tests/ui/practice-today.test.js` (10): a new learner (C, four lines, "About 10 minutes", no streak, no chips); the next day after a routine (G, "1 day in a row", the practiced keys, "You practiced today." on the same day); the chips of today's key (best tempo 72, streak 2, 2 clean runs, the date, with C practiced longest ago); a scale practiced on its own page moving the key of the day on while only a clean run marks the circle; a bad date hiding the card; the card (four lines, the link to the routine, twelve disabled keys, today's key selected); the circle moving for another day; Spanish and a language switch redrawing in place; the list opening with the card first and "Reset progress" removing the streak; and disposal leaving the card alone. Existing list tests were adjusted to count only the exercise entries. Mutation checks (each fails the suite): the key of the day taken from the warm-up (2), the circle not read-only (1), the routine's scale record ignored (1), the injected date ignored (1), a bad date not hiding the card (2), the card not redrawn with the progress (1).

## Browser check (26.3; headless Chrome, real GPU flags, port 8790, `NO_PRIVATE=1`)

Screenshots `lmC-today-*` (a new learner, and a learner with three days in a row, C, G and D practiced) at 1440 x 900, 844 x 390 (English) and 390 x 844 (Spanish) were opened and read: the card on the left with the circle on the right on a desktop (F highlighted, C G D ringed), stacked on a phone, Spanish text ("HOY", "Rutina de 10 minutos", "3 días seguidos", "Tonalidad de hoy: F mayor"), the exercise cards below with their chips (best tempo 72, clean streak 3, 8 clean runs).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/practice-today.test.js tests/ui/practice-view.test.js tests/ui/circle-of-fifths.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | headless Chrome: the list for a new learner and for a learner with a streak, three viewports, two languages |
| Rollback boundary | `src/ui/practice-today.js`, the `readOnly` option, the Today wiring of the view, the card CSS, one string, the test |
