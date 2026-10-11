# PR 9a: Learn keyboard, names on every key

Branch: `feat/learn-mode-pr9a-learn-keyboard`. Base: `feat/learn-mode-pr8a4-learner-sound`. Task: 9.1 (first half). Specs: learn-keyboard (framed to the hand region, readable at phone width, names on every key).

## Chain context

```
feat/learn-mode-pr8a4-learner-sound
  ^
feat/learn-mode-pr9a-learn-keyboard     this PR
  ^
feat/learn-mode-pr9a2-keyboard-states (next)
```

- Start: the lesson core and the input bus exist, nothing draws a keyboard for the learner. End: a keyboard component draws a region of the piano with a readable name on every key.
- Follow-up: pr9a2 (states, finger badges, pointers, computer-key letters, styles), pr11a (the Learn view puts it on screen).
- Out of scope: shading, badges, pointers, styles (pr9a2).

## What changes

- `src/ui/keyboard-labels.js` (new, pure, no DOM):
  - `spellMidi(midi, key)`: spelled pitch of a key for a key context, sharps without one.
  - `namesFor({ midi, key, pitch, lang })`: letter and solfege of a key, spelled for the song's key (F# in E major, E# in F# major, Cb in Gb major); a pitch the data gives wins over the context; without any context a black key shows both spellings ("C#/Db"). English puts the letter first, Spanish the solfege first.
  - `keyboardMetrics({ whiteCount, width, height })`: sizes in CSS pixels for the three width classes of the design (white keys at most 88 px; labels never under 12 px; badge 30, 24 and 22 px). Below the black keys there is always room for a badge, a computer-key letter and the two names (the black key gets shorter instead of the names smaller).
- `src/ui/learn-keyboard.js` (new): `createLearnKeyboard({ mount, i18n })` draws an SVG in CSS pixels (the viewBox equals the size on screen, so a font size in the script is the size the learner reads) from `layoutRange`. Names sit on every white key (two lines, language order); black keys are named in a two-line strip above them; black keys are drawn after the white ones. `role="group"` with an `aria-label` naming the region ("Keyboard, C4 to D5", translated). `setRegion`, `setKeyContext`, `setSpellings`, `fit({ width, height })`; a language change redraws the names at once.
- `tests/ui/learn-keyboard.test.js` (new, 11 tests) with the fake DOM.

## Counter-proofs

- E major spells F# and never Gb; the same black key in Db major spells Gb and never F#.
- A narrower width really gives narrower keys, and a short room limits the key height (the text sizes never drop under 12 px at any width).
- Without a key context the black key shows both spellings (neither is invented).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/learn-keyboard.test.js`: 11 tests, 11 pass |
| Full suite | `node --test`: 1163 tests, 1163 pass, 0 fail |
| Runtime harness | N/A for this slice: the keyboard is on screen only in pr11a, where it is checked in the browser at the three viewports |
| Rollback boundary | `src/ui/keyboard-labels.js`, `src/ui/learn-keyboard.js`, `tests/ui/learn-keyboard.test.js` |

## Review budget

302 authored changed lines including tests (source 175, tests 127), plus this description.
