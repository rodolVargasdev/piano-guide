# PR 0c: Learn keyboard polish (scroll on a phone, badge never covered)

Branch: `feat/learn-mode-pr0c-learn-polish`. Base: `feat/learn-mode-pr6b-catalog-swap`. First PR of Milestone C; it closes the two items the pr6b description left open. Specs: learn-keyboard (36 px minimum white key, labels, finger badge).

## Chain context

```
feat/learn-mode-pr6b-catalog-swap
  ^
feat/learn-mode-pr0c-learn-polish            this PR (📍)
  ^
feat/learn-mode-pr1c-scales
```

## What changes

- A both-hands step whose hands are far apart no longer shrinks the keys. `keyboardMetrics` never returns a white key narrower than 36 px; when the region is wider than the room the SVG keeps its width, the box scrolls sideways (`overflow-x: auto`, `touch-action: pan-x` only while it scrolls, so a tap still plays the key) and the keyboard centers on the keys to press. When the two hands do not fit together, the lowest key is put at the left edge.
- One hint line under the keyboard (outside the scrolling box): "Turn your phone sideways for a wider keyboard." when a phone is held upright and the keyboard scrolls; "A key to press is off screen. Drag the keyboard sideways." when a key to press is not visible. Both in English and Spanish (`keyboard.turnPhone`, `keyboard.scrollHint`).
- The room is the slot the keyboard lives in, not the window: on a desktop the page has a maximum width and a scrollbar, and the window width made the keyboard overflow its box.
- The white-key finger badge is no longer covered by the computer-key letter box. Stacked (badge above the box) when the key is tall enough; side by side on a wide key; on a narrow short key the box moves to the top of the key between the black keys; if even that is too narrow the box yields to the badge.

## Tests and counter-proofs

`tests/ui/learn-keyboard-scroll.test.js` (9 tests): minimum width with the total wider than the room; the nine-key counter-proof (no scroll, no hint, scrollLeft 0); centering and the lowest-key rule; each hint and its counter-proof; Spanish text; no badge/letter-box overlap over seven rooms (1168x600 to 358x200) and three steps (both hands, one key, chord); the overlap check itself is shown to see two crossing boxes; stylesheet rules. Mutation checks (each makes the suite fail): minimum width back to 1 px (5 failures), `stacked = true` (1), no `scrollLeft` assignment (2), hint without the portrait condition (1).

## Browser check (headless Chrome, real GPU flags, port 8790)

Screenshots `lmC-polish-*` were opened and read: Chopin both-hands step (G5 and Eb2, 25 white keys) at 390 x 844 and 844 x 390, English and Spanish: keys are 36 px, the keyboard scrolls, the left hand's key is at the left edge, the hint line reads "A key to press is off screen". Ode to Joy both-hands step (`lmC-polish-ode-*`) at 844 x 390 (the letter box "K" now sits at the top of the E key beside the badge "R2"), 1440 x 900 Spanish (no scroll, 76 px keys) and 390 x 844 (36 px keys, scroll). Before the change: 14 px keys at 390 x 844 and 32 px at 844 x 390 for the Chopin step.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/learn-keyboard-scroll.test.js`: 9 pass |
| Full suite | `node --test`: 1352 tests, 0 fail |
| Runtime harness | headless Chrome at 3 viewports in 2 languages, see above |
| Rollback boundary | `src/ui/keyboard-labels.js`, `src/ui/learn-keyboard.js`, the two `sizes()` lines of `src/ui/learn-view.js`, the keyboard rules in `styles/app.css`, two string keys |

## Out of scope

The Practice link on catalog cards waits for the practice route (pr6c). The other Learn layout items stay as they are.
