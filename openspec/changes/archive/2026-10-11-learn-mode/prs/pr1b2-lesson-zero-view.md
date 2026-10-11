# PR 1b2: Lesson zero, the screen

Branch: `feat/learn-mode-pr1b2-lesson-zero-view`. Base: `feat/learn-mode-pr1b-lesson-zero`. Tasks: 13.3 (view half), 13.4, 13.5. Specs: learn-mode (Lesson zero), learner-language, learn-keyboard.

## Chain context

```
feat/learn-mode-pr1b-lesson-zero
  ^
feat/learn-mode-pr1b2-lesson-zero-view       this PR
  ^
feat/learn-mode-pr2b-stages
```

## What changes

- `src/ui/lesson-zero-view.js` (new): `zeroModel(z, { i18n })`, the plain data of each part (heading, one line, the list of part 4, the posture image, progress "Lesson zero, part 2 of 4", feedback chip, actions `ZERO_NEXT` and `ZERO_SKIP`). Part 1 shows the hint "Look for a group of 2 black keys. C is the white key on its left." after a wrong key.
- `assets/img/posture.svg` (new): original, text-free drawing of a person sitting tall at a piano, with a dashed line for a forearm level with the keys.
- `src/ui/learn-screen.js`: the first screen offers "Lesson zero" as a secondary action until it is done, with one sentence ("New to the piano? Try lesson zero first. It takes about two minutes.") only for someone who never opened it; the lesson-zero phase delegates to `zeroModel`.
- `src/ui/learn-view.js`: draws lesson zero (its own keyboard region C3 to B4 or C4 to D5, no key context so black keys show both spellings, hints on the groups of two black keys, finger shading in part 3), shows the title "Lesson zero", hides the hand, key and level selectors, saves `lessonZero` through the new effect.
- `src/ui/learn-keyboard.js`: `setHints(midis)` (dashed outline plus a class, not color alone) and a document-level `pointerup` and `pointercancel` listener (see the bug below).
- `styles/app.css`: hint outline, drawing size (shorter in landscape), the list of part 4.
- `docs/USABILITY_CHECK.md` and `tests/docs-guard.test.js`: T1 is available now; the guard keeps the availability note for T3 and T5 only.

## Bug found in the browser (existing since pr9a, fixed here)

On the 390 x 844 emulation the last key of lesson zero stayed pressed. The press changed the card above the keyboard (part 3 to part 4), the keyboard moved, and the release landed on something that was not a key, so no `pointerup` reached a key and the note never ended (the next press of that key would have been ignored as held). The keyboard now also listens for `pointerup` and `pointercancel` on the document. The unit test fires the release on the document only and checks that the note ends, that a release of a pointer that never pressed does nothing, and that `dispose` removes the listener.

## Beginner walkthrough (headless Chrome, real GPU flags, port 8790, dev server with `NO_PRIVATE=1`, Chrome profile in Spanish, language forced by `localStorage`)

Chopin as the song, lesson zero opened from the first screen. Screenshots `lmB-lz-*` at 1440 x 900, 844 x 390 and 390 x 844 were opened and read:

- Part 1: "Find a C: it is the white key just left of the two black keys." The four black keys of the two groups of two are teal with a dashed outline; nothing else is shaded. A wrong key (D) shows the hatched key, "Try again" and the hint line; the shaded outline stays. Any C (even the low one) says "Correct" and moves on.
- Part 2: the drawing and one sentence; "Next" is the primary button, "Skip lesson zero" next to it. In landscape the drawing pushes the keyboard below the fold; this part needs no key, so it was left as is.
- Part 3: "Right hand: thumb on C (Do)." with a circled 1 on C and quiet 2 3 4 5 on the next keys; each finger acknowledged; the progress line says "Finger 4 of 5".
- Part 4: four short lines (tap, computer keys, connect a piano with USB TO HOST, audio-only pianos do not appear as MIDI) and a single "Done".
- After Done the first screen offers only "Start"; after a reload it does not come back. Skip saves "skipped" and keeps offering the button without the long sentence.
- The console showed only the expected 404 of `/songs-private/index.json` (the server ran with `NO_PRIVATE=1`).

Not verified here (user-only): sound, the Casio over MIDI, a real touch screen.

## Counter-proofs

- The hint is a class and a dashed outline: clearing it removes both.
- Lesson zero is offered until done (done hides it, skipped keeps it); the offer sentence only when never opened.
- A guard checks that every part heading and line is at most two sentences and 30 words in both languages with no typographic dashes (a rambling line fails the same check).
- The drawing guard rejects text, script, links or embedded images in the SVG.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/lesson-zero-view.test.js tests/ui/learn-view.test.js tests/ui/learn-screen.test.js tests/ui/learn-keyboard-states.test.js tests/docs-guard.test.js`: all pass |
| Full suite | `node --test`: 1297 tests, 1297 pass, 0 fail |
| Runtime harness | the headless Chrome walkthrough above (three viewports, English and Spanish, reload) |
| Rollback boundary | `src/ui/lesson-zero-view.js`, `assets/img/posture.svg`, the lesson-zero parts of `learn-screen.js` and `learn-view.js`, the hint and document-release parts of `learn-keyboard.js`, the CSS block, the T1 note |

## Review budget

424 authored changed lines including tests (405 added, 19 removed), plus this description.
