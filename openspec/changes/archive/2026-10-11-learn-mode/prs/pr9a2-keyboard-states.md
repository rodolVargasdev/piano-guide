# PR 9a2: Learn keyboard, states, finger badges and pointers

Branch: `feat/learn-mode-pr9a2-keyboard-states`. Base: `feat/learn-mode-pr9a-learn-keyboard`. Task: 9.1 (second half). Specs: learn-keyboard (finger numbers on the keys to press, computer-key letters, key states, taps and clicks).

## Chain context

```
feat/learn-mode-pr9a-learn-keyboard
  ^
feat/learn-mode-pr9a2-keyboard-states   this PR
  ^
feat/learn-mode-pr9a3-keyboard-styles (next)
```

- Start: the keyboard draws names only. End: it shows what to press, how, and reacts to every press and every wrong key.
- Follow-up: pr9a3 (the stylesheet that gives each class its look), pr11a (the Learn view drives it).
- Out of scope: the CSS (pr9a3), the region choice (`learnRegion`, already built), the Learn view.

## What changes

- `src/ui/learn-keyboard.js`:
  - `setStepKeys([{ midi, finger, hand }])`: the key to press is shaded (`lk-expected lk-hand-R|L`), outlined and shows its finger number on a badge: a **circle** for the right hand, a **rounded square with a double outline** for the left hand; when both hands play, each badge also carries the hand letter (R1 / L5 in English, D1 / I5 in Spanish).
  - `setPositionKeys`: a quiet digit on the keys of the hand position that are not required now.
  - `setLetters(Map midi -> text)`: the computer key that plays each key, in a small box on the key (the letters follow the map when it moves; a key outside the region draws nothing).
  - Key states: pressed (from any source on the bus, 2 px lower), wrong (hatch plus a cross for 1.2 s), correct (check mark for 0.7 s), sounding (hand tint without outline or badge, for Listen). `flashWrong` and `flashCorrect` also put "Try again" / "Correct" (translated) in a polite live region (`role="status"`, `aria-live="polite"`), hidden visually.
  - Pointers: each key listens to `pointerdown`, `pointerup`, `pointercancel` and `pointerleave`; one pointer is one finger, tracked by `pointerId`; the note goes to the bus with the source `screen`. A touch is released from its implicit capture so sliding off a key ends the note. A note held by two pointers ends with the last one.
  - Timers are injectable (`timers`) and cleared on `dispose`.
- `src/ui/keyboard-labels.js`: a narrow phone key is taller (4.6 times its width instead of 3.8) so the badge, the letter and the names fit below the black keys.
- `tests/ui/learn-keyboard-states.test.js` (new, 17 tests).

## Counter-proofs

- Grayscale: on a plain keyboard the overlay has no outline and no digit; with a step set it has both (the state is not carried by color).
- An up without a down, a non-primary button and a repeated down send nothing extra.
- After the timers fire, the wrong and correct marks disappear; after `dispose`, a timer is cleared and a bus event changes nothing.
- A redraw while a key is held (width or language change) keeps the note and the pointer works on the redrawn key.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/learn-keyboard.test.js tests/ui/learn-keyboard-states.test.js`: 28 tests, 28 pass |
| Full suite | `node --test`: 1180 tests, 1180 pass, 0 fail |
| Runtime harness | N/A for this slice: no style yet; the keyboard is checked in the browser in pr11a |
| Rollback boundary | `src/ui/learn-keyboard.js`, `src/ui/keyboard-labels.js` (the taller phone key), `tests/ui/learn-keyboard-states.test.js` |

## Review budget

402 authored changed lines including tests (source 209, tests 193), plus this description. 2 over the budget; it does not split cleanly (the pointer and state code share the paint function).
