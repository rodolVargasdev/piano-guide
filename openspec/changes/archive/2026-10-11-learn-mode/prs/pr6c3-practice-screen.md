# PR 6c3: What the exercise page says (screen model)

Branch: `feat/learn-mode-pr6c3-practice-screen`. Base: `feat/learn-mode-pr6c2-practice-session`. Tasks: the text half of 24.1. Specs: practice-exercises (running an exercise, doc card), learner-language. Plain data and strings: no DOM yet.

## Chain context

```
feat/learn-mode-pr6c2-practice-session
  ^
feat/learn-mode-pr6c3-practice-screen        this PR (📍)
  ^
feat/learn-mode-pr6c4-practice-inputs
```

## What changes

- `src/ui/practice-screen.js`, the counterpart of the Learn screen model: `screenModel(state, { i18n, feedback })` says, for each phase, the heading, the one-line help, the step counter with the tempo, the Correct / Try again chip, and only the actions that make sense now.
  - Ready: the goal of the exercise in one sentence, "Press Start, then press the shaded key with the finger shown, one step at a time. Press Listen to hear it first.", with Start and Listen. Listening: "Listen." with Stop. Running: the instruction (the Learn templates: "Right hand: thumb on C (Do)."; chords add "Press these 3 keys together."; two hands say both), "Step 5 of 8 | Tempo 50", the chord symbol under a chord step, and Stop.
  - Done: "Clean run: no wrong key. Well done." or "Finished, with 1 wrong key. Try again for a clean run.", the next tempo to try ("Next tempo to try: 60." or "Top tempo of this card."), and Again, Faster (the main action while a faster tempo exists), Next hand (after a clean run, while a hand stage remains), Next key and Listen; after a wrong key Again is the main action and there is no Faster.
  - `announcement(effect)`: the one line for the polite live region ("Next key: G major", "Now: left hand", "Try again. Use the shaded key.").
  - `choiceModel`: the segments of the page (hands, octaves, direction, chord type) for the exercise, with their labels.
- `src/i18n/strings.js`: 24 strings in both languages (formal Spanish, no voseo), with the plural pair for "{count} wrong keys".

## Tests and counter-proofs

`tests/ui/practice-screen.test.js` (12): every phase and its actions, the feedback chips, the chord label, Faster as the main action, the top tempo, the last hand stage, the unclean result and its plural form, Same key hiding Next key, Spanish labels, the announcements, and the choices of a scale, a progression (Spanish) and the triads. Mutation checks (each fails the suite): the unclean sentence replaced by the clean one (2), the next-hand action removed (5).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/practice-screen.test.js tests/i18n/*.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: plain data; the page that shows it comes in pr6c5 |
| Rollback boundary | `src/ui/practice-screen.js`, its test and the 24 strings |
