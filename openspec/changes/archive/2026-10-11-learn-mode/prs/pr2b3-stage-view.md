# PR 2b3: Metronome and the beginner walk through the stages

Branch: `feat/learn-mode-pr2b3-stage-view`. Base: `feat/learn-mode-pr2b2-stage-reducer`. Tasks: 14.3 (metronome), 14.4, 14.5. Specs: learn-mode (Stages per phrase and per song: "a metronome toggle MUST be available").

## Chain context

```
feat/learn-mode-pr2b2-stage-reducer
  ^
feat/learn-mode-pr2b3-stage-view             this PR (last of the stages)
  ^
feat/learn-mode-pr4b-ode-to-joy
```

## What changes

- `src/ui/learn-view.js`: a "Metronome" toggle in the top bar (`data-toggle="metronome"`, `aria-pressed`, a title that says what it does). While My turn is open and the toggle is on, the engine clock runs over a copy of the timeline with NO notes at the stage tempo (`stageBpm`: half the song tempo for slow stages, the song tempo for full-tempo stages), so the song itself is never scheduled and a private song may click when the learner asked for it. Leaving My turn stops the clock; Listen takes the clock over (loading the real timeline halts the click) and is not stopped by it; the click restarts when My turn comes back. Tempo only paces (A1): nothing is measured.
- `src/i18n/strings.js`: `learn.metronome`, `learn.metronomeTitle` (English and Spanish).
- `src/ui/learn-keyboard.js`: outline rectangles never get a negative size (found in the browser, below).

The "Next stage" action, the stage in the progress line and the explicit full-tempo Listen were delivered in pr2b2 with the reducer they depend on.

## Bug found in the browser (fixed here)

On the 390 x 844 emulation a both-hands step of the Chopin nocturne (hands more than three octaves apart, more than thirty white keys in 390 px) logged one error per redraw: `<rect> attribute width: A negative value is not valid`. The black-key outline used `width: g.w - 3` on a key about one pixel wide. The widths are now clamped at zero; the unit test draws a thirty-key region at 390 px and checks every rectangle (mutation run: without the clamp it fails).

## Limitation recorded (not fixed, user decision needed)

When the two hands of a both-hands step are further apart than the screen can show at 36 px per key (phone in portrait, Chopin), the keys shrink instead of the keyboard scrolling: the spec says "fewer keys is allowed, hiding one is not". On a phone the both-hands stages of such a song are hard to play; landscape, a tablet, the computer keys or MIDI are fine. Ode to Joy keeps its hands within about ten white keys.

## Beginner walkthrough (headless Chrome, real GPU flags, port 8790, language forced by `localStorage`, lesson zero marked done)

Chopin (public, both hands) and the private song (shape only, nothing from its notes recorded here), at 1440 x 900, 844 x 390 and 390 x 844, English and Spanish. Screenshots `lmB-st-*` and `lmB-stp-*` were opened and read:

- Start, Start: "Phrase 1 of 6." with "Right hand, slowly." and Listen first, My turn second (public). Private: straight to My turn, no Listen anywhere, in any stage.
- Right hand done: "Correct. Stage done: Right hand." and "Now the left hand, slowly." with "Next stage" as the amber primary button, "Next phrase" and "Repeat phrase" beside it. The same in Spanish ("Correcto. Terminó esta etapa: Mano derecha." / "Ahora la mano izquierda, despacio.").
- Left hand done, then "Now both hands together, slowly."; a both-hands step shows an `R5` circle badge and an `L5` square badge on two keys at once, and the instruction names both hands; a step where one hand rests names only the other.
- After finishing both hands slowly: "Now both hands together at the song speed." and the intro "Both hands, song speed."
- Reload in the middle of the full-tempo intro: the first screen offers "Continue"; it resumes exactly at that stage (saved `{ phrase 0, stage 3, hand T }`).
- The Metronome toggle turns amber when on and the page logged no error (no sound was listened to here).
- Console after the clamp: no error and no warning at the three sizes (the first public runs used `NO_PRIVATE=1` and logged only the expected `/songs-private/` 404).

Not verified here (user-only): hearing the click, Listen at full tempo, a real touch device.

## Counter-proofs

- Metronome off starts nothing (no `play`, no `setMetronome`); the click clock never carries the song's notes; a private song never calls `playRange`; Listen again does not call `stop`.
- The tempo list over four stages is slow, slow, slow, song tempo.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/learn-view.test.js tests/ui/learn-keyboard-states.test.js`: all pass |
| Full suite | `node --test`: 1333 tests, 1333 pass, 0 fail |
| Runtime harness | the headless Chrome walkthrough above |
| Rollback boundary | the metronome block of `learn-view.js`, its strings and tests, and the clamp in `learn-keyboard.js` |

## Review budget

144 authored changed lines including tests (138 added, 6 removed), plus this description.
