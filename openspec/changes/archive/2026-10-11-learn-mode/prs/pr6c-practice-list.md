# PR 6c: The Practice route, the list and the doc cards

Branch: `feat/learn-mode-pr6c-practice-list`. Base: `feat/learn-mode-pr5c2-doc-cards`. Tasks: 24.2 and the list and card half of 24.1 (the run, tempo, key rotation and progress summary follow in pr6c2 and pr6c3). Specs: practice-exercises (exercise catalog, doc card for every exercise, unknown exercise id), song-catalog (the Practice link that pr10a kept hidden until the route existed).

## Chain context

```
feat/learn-mode-pr5c2-doc-cards
  ^
feat/learn-mode-pr6c-practice-list           this PR (📍)
  ^
feat/learn-mode-pr6c2-practice-run
```

## What changes

- `src/ui/practice-view.js`: `#/practice` lists the four groups and the ten exercises, each a card with a one-line goal and, once practiced, small chips (best tempo, clean streak, clean runs, last day); `#/practice/<id>` shows the doc card (goal, why it matters, how to do it, what good looks like, the tempo steps and, for scales and arpeggios, "Standard fingering; some books differ."). `listModel`, `cardModel` and `summaryChips` are plain data. An unknown id shows "Exercise not found" (Spanish "Ejercicio no encontrado") with a link back and never prints the id (text nodes only, no markup from the address bar). The page follows the language selector and keeps its place when the language changes; corrupt or blocked storage shows the list with no chips and no error.
- `src/main.js`: the `practice` route is lazy (the catalog does not download it) and the header gets a "Practice exercises" link on every page, which follows the language. `src/ui/catalog.js`: the hero has a "Practice exercises" button beside the start button, so the link does not appear on song cards (they stay Learn and Play along).
- `styles/app.css`: list, card and header link styles (no inline style, as the CSP requires); the whole list card is the click target.
- `src/i18n/strings.js`: the summary chips (`practice.summary.*`, with plural forms).

## Tests and counter-proofs

`tests/ui/practice-view.test.js` (12): groups and the ten links in order, goal lines, chips before and after runs (best 72, streak 3, three runs, date), the singular form and the dropped zero facts, corrupt and blocked storage, the C scale card with its five parts and its tempo steps and note, no note on chords and no tempo steps on the routine, all ten cards in Spanish with the Spanish headings, an unknown id with markup (no element is built from it, nothing printed), language switch and dispose, and a source scan that no `innerHTML` is used. `tests/ui/practice-route.test.js` (4): the router reaches the practice view with the raw id and disposes Learn first; `main.js` mounts it lazily and the header link follows the language; the catalog hero has the button in both languages, and a catalog with no usable song still offers it.

## Browser check (headless Chrome, real GPU flags, port 8790, `NO_PRIVATE=1`)

Screenshots `lmC-catalog-*`, `lmC-practice-list-*` and `lmC-practice-card-*` at 1440 x 900 and 844 x 390 in English and 390 x 844 in Spanish were opened and read: the list in three columns on a desktop with the header link at the right, the card readable in one column on a phone, the Spanish headings and texts, no console error (only the expected 404 of the private index with the private folder hidden), `#/practice/nope` says "Exercise not found" / "Ejercicio no encontrado".

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/practice-view.test.js tests/ui/practice-route.test.js`: 16 pass |
| Full suite | `node --test`: 1487 tests, 0 fail |
| Runtime harness | headless Chrome walk of the list, a card and an unknown id at three viewports in two languages |
| Rollback boundary | `src/ui/practice-view.js`, the `practice` route and header link of `src/main.js`, the hero button of `src/ui/catalog.js`, the new CSS rules, the six summary strings, the two test files |
