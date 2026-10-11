# PR 9a3: Learn keyboard, styles

Branch: `feat/learn-mode-pr9a3-keyboard-styles`. Base: `feat/learn-mode-pr9a2-keyboard-states`. Tasks: 9.2, 9.3. Specs: learn-keyboard (readable at phone width, states not by color alone, reduced motion).

## Chain context

```
feat/learn-mode-pr9a2-keyboard-states
  ^
feat/learn-mode-pr9a3-keyboard-styles   this PR
  ^
feat/learn-mode-pr10a-catalog-private (next)
```

- Start: the keyboard emits classes and an overlay with no look. End: the stylesheet gives each class its look; the keyboard is complete for Learn.
- Follow-up: pr11a (the Learn view puts it on screen; the learner-level check in the browser at the three viewports happens there).
- Out of scope: the Learn layout (pr11a).

## What changes

- `styles/app.css`: keyboard block appended. White and black keys; two-line names (letter and solfege) and the black-key strip; the shading per hand (amber tint for the right hand, blue for the left, a darker tint on black keys); pressed fill; the hatch pattern for a wrong key; outlines (3 px, the left hand adds an inner line); finger badges and digits (dark digits on amber and light blue, 4.5:1 or more); the quiet position digit; the computer-key letter box; the cross and the check; the visually hidden live region; `touch-action: none` on the SVG; a landscape rule (`max-height: 480px`) with a tighter vertical margin. Nothing animates (no `transition` or `animation` in any keyboard rule), so reduced motion changes nothing.
  - The sizes of the labels and the white keys are decided in `keyboard-labels.js` (12 px minimum, 36 px minimum at 360 px width) because the SVG is drawn in CSS pixels; the stylesheet does not rescale it.
- `tests/ui/learn-keyboard.test.js`: three stylesheet guards.

## Counter-proofs

- The guard detects a keyboard rule that animates (fixture) and finds none in the real sheet.
- A missing rule is reported as missing (so the "every state has a shape" guard can fail).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/learn-keyboard.test.js`: 14 tests, 14 pass |
| Full suite | `node --test`: 1183 tests, 1183 pass, 0 fail |
| Runtime harness | Deferred to pr11a by design (task 9.3): the keyboard is only on screen once the Learn view exists |
| Rollback boundary | the keyboard block at the end of `styles/app.css` and the three guards |

## Review budget

219 authored changed lines (CSS 192, tests 27), plus this description.
