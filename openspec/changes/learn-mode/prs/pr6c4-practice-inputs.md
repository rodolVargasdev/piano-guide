# PR 6c4: Inputs and sound of a practice page

Branch: `feat/learn-mode-pr6c4-practice-inputs`. Base: `feat/learn-mode-pr6c3-practice-screen`. Tasks: the wiring half of 24.1. Specs: note-input, practice-exercises (no input device). Shared wiring, no page yet.

## Chain context

```
feat/learn-mode-pr6c3-practice-screen
  ^
feat/learn-mode-pr6c4-practice-inputs        this PR (📍)
  ^
feat/learn-mode-pr6c5-practice-run-page
```

## What changes

- `src/ui/practice-inputs.js`: `createPracticeInputs({ i18n, win, storage, makeEngine })` builds what every practice page needs and the Learn view builds for itself: the note bus, the learner's own sound (first subscriber, so a press is never delayed; MIDI sounds only when the learner turned that on), Web MIDI (permission only from the "Connect piano" click), the input panel with its chips and the single Connect action, the computer keys with a map the page can move, and the printed letters (US letters until `navigator.keyboard.getLayoutMap()` answers, then the learner's own, and the page is told to redraw). The ear drills and the routine reuse it. Learn is not changed.
- `defaultMakeEngine`: the real engine on one shared audio context.

## Tests and counter-proofs

`tests/ui/practice-inputs.test.js` (6): a note on the bus sounds through the engine and its release stops it; the computer keys play the key of the current map and a key-up releases the note it pressed even after the map moved (counter-proof: an unmapped key does nothing); the panel shows Computer keys: on and the MIDI chip with the MIDI sound off; MIDI with the setting off calls nothing on the engine while a screen key does; the layout map letters arrive and a disposed page is not told; dispose removes the listeners, disposes the engine and releases held notes.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/practice-inputs.test.js`: 6 pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | the headless Chrome walkthrough of pr6c5 uses it (taps and computer keys) |
| Rollback boundary | `src/ui/practice-inputs.js` and its test |
