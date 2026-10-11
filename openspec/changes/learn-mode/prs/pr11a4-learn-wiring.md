# PR 11a4: Learn view wiring

Branch: `feat/learn-mode-pr11a4-learn-wiring`. Base: `feat/learn-mode-pr11a3-screen-model`. Task: 11.2. Specs: learn-mode, learn-keyboard, note-input, private-song-library (silent in Learn).

## Chain context

```
feat/learn-mode-pr11a3-screen-model
  ^
feat/learn-mode-pr11a4-learn-wiring     this PR
  ^
feat/learn-mode-pr11a5-learn-route (next: route, styles, browser check)
```

## What changes

- `src/ui/learn-view.js` (new): `learnView({ i18n, load, makeEngine, win, storage })` returns a router view. It loads the catalog entry (not found, unavailable, no notes, load error each give one plain message and a way back), then wires:
  - the lesson reducer (`initLesson`, `reduce`): the view feeds actions and runs the returned effects (`listen`, `stopListen`, `save`, `announce`, `releaseAll`); it decides nothing about what a press means;
  - the note bus with three sources (screen, computer keys, Web MIDI), learner sound first, then the keyboard, then the reducer;
  - the keyboard: region from `learnRegion` (width-aware `maxWhite`: 72 / 54 / 36 px minimum), key context and spellings, shaded step keys with finger badges, quiet position digits, computer-key letters from the layout map (US fallback), flashes and the live region ("Correct. <next instruction>");
  - the screen model for the card, and the controls: hand selector (only when both hands have notes), key toggle (the original key and `learn.transposeTo`, taken from the ORIGINAL song because a transposed copy does not carry the block), level selector (only with more than one level with notes), language selector;
  - progress: saved on the reducer's `save` effect per song, level and key; "Continue", "Start over" and "Reset progress"; the key choice is remembered;
  - Listen (public songs only): `engine.setTimeline` then `playRange`, keys light while it plays, My turn when it ends; stale completions are ignored by a token;
  - leaving: `LEAVE` effects, listeners removed, every held note released, engine disposed.
- `tests/ui/learn-view.test.js` (new, 13 tests) with the fake DOM, a fake engine, fake storage and a fake navigator for MIDI.

## Counter-proofs

- A private song: zero `playRange` and zero `setTimeline` calls, no Listen action in any phase, while the learner's own presses call `startNote`.
- A wrong key keeps the shaded key; two of three chord keys do not complete; a language switch mid-chord keeps the keys already pressed.
- MIDI: no permission request until the button is clicked; MIDI does not sound by default.
- Typing in a text box and a Ctrl combination play nothing; a window blur releases the held note.
- After dispose, the engine is disposed, the held note released, and the keydown and resize listeners gone.
- Static scan: no `playNotes` in the view, one `playRange` call site; the scan itself is shown to detect a call.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/learn-view.test.js`: 13 tests, 13 pass |
| Full suite | `node --test`: 1252 tests, 1252 pass, 0 fail |
| Runtime harness | Browser, in pr11a5 (the route and styles land there) |
| Rollback boundary | `src/ui/learn-view.js`, `tests/ui/learn-view.test.js` |

## Review budget

642 authored changed lines including tests (source 355, tests 287), plus this description. **`size:exception` recommended**: the view, its effects executor and its tests are one cohesive unit; splitting the tests from the code would leave unverified code in a PR.
