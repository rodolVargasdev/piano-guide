# PR 11a5: Learn route, layout and the beginner walkthrough

Branch: `feat/learn-mode-pr11a5-learn-route`. Base: `feat/learn-mode-pr11a4-learn-wiring`. Tasks: 11.3, 11.4, 11.5. Specs: learn-mode, learn-keyboard, note-input, private-song-library.

## Chain context

```
feat/learn-mode-pr11a4-learn-wiring
  ^
feat/learn-mode-pr11a5-learn-route      this PR
  ^
feat/learn-mode-pr12a-docs-docker (next)
```

## What changes

- `src/main.js`: the `learn` route, loaded lazily (a test pins that the catalog route has no static import of the view or the audio engine).
- `styles/app.css`: Learn layout, input panel and the `[hidden]` rule. Instruction 28 / 20 / 18 px, action buttons 48 / 48 / 36 px, the site header hidden in landscape, the chip colors (green Correct, red Try again, both with text).
- `src/ui/learn-view.js`: Learn opens the beginner level when the song has one with notes (the Chopin file opens on "original" in the player; a beginner should not land there).
- `src/ui/learn-keyboard.js`: a finger badge on a black key sits above the computer-key letter box (found in the browser: the letter covered it); the quiet position digits sit under the black keys so a letter box no longer hides them in landscape.
- `tests/ui/learn-layout.test.js` (new, 6 tests): the design sizes in the stylesheet, the landscape header rule, `[hidden]`, the lazy route.

## Beginner walkthrough (task 11.4): what a person who cannot play sees

Headless Chrome with the real-GPU flags against the dev server on 8790; the private song is the local Cancer (E major, then C major). Every screenshot was opened and read. Screenshots stay in the scratchpad and never in the repository.

| Check | Observed | Screenshot |
|---|---|---|
| First screen says what to do in one sentence | "Press Start. The screen tells you which finger goes on which key, one step at a time." plus, for the private song, "The app does not play this song. It only tells you what to play." One button: Start | `lm11-en-start-1440`, `lm11-en-start-390` |
| One instruction at My turn | one sentence naming the hand, the finger and the note (thumb first), with "Phrase 1 of 21. Step 1 of 6" above and "Press the key marked with the finger number." below | `lm11-en-step1-1440`, `lm11-en-step1-390` |
| Close, readable keyboard | 9 white keys at 1440 and 844 (88 px each), 9 at 390 (39 px); letter and solfege on every key; the shaded key outlined with a circled "1"; the other four position keys carry a quiet 2 to 5; computer-key letters on the keys | `lm11-en-step1-1440`, `lm11-en-wrong-844`, `lm11-en-step1-390` |
| Right key advances | "Correct" chip, the next sentence (the next finger and note), a check mark on the played key, the live region says "Correct. <next instruction>" | `lm11-en-correct-1440`, `lm11-en-correct-844`, `lm11-en-correct-390` |
| Wrong key is kind | the key hatched with a cross, chip "Try again", the line "Use the shaded key.", the shaded key stays, the step does not move | `lm11-en-wrong-1440`, `lm11-en-wrong-844`, `lm11-en-wrong-reduced-360` |
| Finishing a phrase | "Correct. Phrase 1 of 21 done." with Next phrase (primary) and Repeat phrase | `lm11-en-phrase-complete-1440` |
| E / C major toggle | the same phrase in C: the note in the first sentence changes, names and fingers recomputed; the choice is saved and restored after reload | `lm11-en-cmajor-1440` |
| English / Spanish selector | every learner text switches at once, mid-step: "Mano derecha: pulgar en ...", "Frase 2 de 21. Paso 1 de 5", the buttons, the input panel, the key names order (Spanish solfege first) | `lm11-es-step-1440` |
| Reload resumes | after reload: "Continuar / Empezar de nuevo / Reiniciar el progreso" in Spanish, C major still pressed, Continue returns to the same phrase and step | (text checked) |
| Cancer is silent | no Listen on any phase (private); the learner's own presses sound through the engine; the song itself is never scheduled (zero `playRange`, unit-tested) | |
| Public song (Chopin) | start, "Phrase 1 of 6.", Listen and My turn; Listen lights the sounding key; My turn: the thumb instruction | `lm11-chopin-start-1440`, `lm11-chopin-intro-1440`, `lm11-chopin-listen-844`, `lm11-chopin-myturn-390` |
| Fake MIDI | zero requests before the click; after Connect the chip reads "MIDI: Casio CDP-S100"; a wrong note says Try again, the right note advances, no app sound by default | (text checked) |
| Blur, Ctrl, text control | a window blur releases a held key; a Ctrl combination plays nothing; the letter D typed while the checkbox is focused plays nothing | |
| Reduced motion | emulated: the wrong state still shows (hatch, cross, chip); nothing in the keyboard animates | `lm11-en-wrong-reduced-360` |

Measured in the page (DOM, not estimated): at 360 x 740 the white keys are 36 px wide, the smallest label is 12 px, no horizontal scroll, the shaded key and the instruction are inside the screen. At 1440 x 900 the instruction is 28 px and buttons 48 px; 844 x 390: 18 px and 36 px (the document is 2 px taller than the screen: the input panel's last pixels); 390 x 844: 20 px and 48 px.

Not verified here (user-only): the real Casio over MIDI, hearing the learner's own key sound and Listen on the public song (no audio device was listened to), and the key legend on a non-US keyboard (the US fallback was seen).

## Findings fixed during the walkthrough

- The private song's level chip rendered `[object Object]` (LocalizedText label): fixed in pr10a2.
- The key toggle disappeared after switching to C (a transposed copy does not carry the author's block): the view now reads the original song.
- The badge on a black key hid behind the computer-key letter; quiet digits were hidden in landscape.
- Chopin opened on the "original" level; Learn now starts on "beginner".

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test "tests/ui/*.test.js"`: all pass |
| Full suite | `node --test`: 1259 tests, 1259 pass, 0 fail |
| Runtime harness | Browser 8790 as in the table (scripts in the scratchpad, not committed) |
| Rollback boundary | `src/main.js` route, the Learn block of `styles/app.css`, `tests/ui/learn-layout.test.js` |

## Review budget

300 authored changed lines including tests (CSS 230, source 7, tests 63), plus this description.
