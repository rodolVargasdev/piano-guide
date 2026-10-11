# PR 5c2: Bilingual doc cards and the missing-key guard

Branch: `feat/learn-mode-pr5c2-doc-cards`. Base: `feat/learn-mode-pr5c-exercise-catalog`. Tasks: 23.2, 23.3. Specs: practice-exercises (doc card for every exercise), learner-language. Strings and tests only; the screens that show them come in pr6c.

## Chain context

```
feat/learn-mode-pr5c-exercise-catalog
  ^
feat/learn-mode-pr5c2-doc-cards              this PR (📍)
  ^
feat/learn-mode-pr6c-practice-view
```

## What changes

- `src/i18n/strings.js`: 101 new entries, English and Spanish (formal "usted", no voseo, plain straight punctuation), all passing the existing guards (completeness, placeholders, typography, register):
  - the doc card of every exercise: `ex.<id>.title`, `goal`, `why`, `how`, `good` (ten exercises, 50 strings), each field one or two plain sentences, no theory words assumed (a beginner reads "the note the chord is named after" before ever hearing "root");
  - the card headings (`practice.card.*`), the tempo line with `{steps}`, `practice.standardFingering` ("Standard fingering; some books differ."), `practice.suggestedFingering` ("Suggested fingering") and its one-line explanation;
  - the four group names and their one-line hints, `practice.back`, `practice.notFound` ("Exercise not found" / "Ejercicio no encontrado");
  - the twelve interval names with a plain line each (for example "Major third: Bright and happy (4 semitones)") and the four chord qualities with theirs, for the ear drill buttons.
- `src/practice/catalog.js`: `missingCardFields(exercises, table)` names each exercise and field that lacks text in either language.
- A new guard, `tests/i18n/keys-used.test.js` (the missing-key guard): every string key written as a literal in a translator call anywhere under `src/` exists in the catalog (plain, or as a plural pair). Keys built at run time are covered by the modules that build them.

## Tests and counter-proofs

`tests/practice/cards.test.js` (7): every card complete in both languages; a fixture exercise without "what good looks like" is flagged naming the exercise and field, a blank Spanish text counts as missing, and deleting a real field from a copy of the table is caught; groups, intervals and qualities have name and plain line; titles fit one line and no field passes 45 words; Spanish mode never falls back to English; each interval line states its size. `tests/i18n/keys-used.test.js` (2): the scan of the whole tree finds 85 literal keys and none is missing; counter-proof that the scanner reports a key that is not in the table, understands plural pairs, rejects half a pair and ignores built keys. Checked by mutation: renaming one key in `learn-view.js` makes the guard fail.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/practice/cards.test.js tests/i18n/*.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: strings and tests; the cards are read on screen in pr6c |
| Rollback boundary | the strings appended to `src/i18n/strings.js`, `missingCardFields`, the two test files |
