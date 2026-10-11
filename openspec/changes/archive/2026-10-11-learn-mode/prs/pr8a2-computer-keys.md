# PR 8a2: Computer keyboard input

Branch: `feat/learn-mode-pr8a2-computer-keys`. Base: `feat/learn-mode-pr8a-bus`. Task: 8.2. Specs: note-input (computer-keyboard map).

## Chain context

```
feat/learn-mode-pr8a-bus
  ^
feat/learn-mode-pr8a2-computer-keys     📍 this PR
  ^
feat/learn-mode-pr8a3-midi-sound (next)
```

- Start: the note bus exists. End: the computer keyboard plays the bus, by physical key position.
- Follow-up: pr8a3 (Web MIDI and learner sound), pr11a (the view calls `attachComputerKeys` and moves the map with the region).
- Out of scope: the README map (pr12a), the letters drawn on the keys (pr9a draws `legendFor` output).

## What changes

- `src/input/computer-keys.js` (new):
  - `keyMapFor(region, anchorMidi)` gives `Map<code, midi>`: eleven white keys on the home row (`KeyA` to `Quote`) from the white key at or below the anchor, and the black keys on the row above (`KeyW` to `BracketLeft`) wherever a black key lies between two mapped white keys (none between E and F, or B and C). The map stays inside the region: an anchor below it is raised, one too near the top is moved down so as many keys as the region has are mapped, a region of nine white keys is mapped whole.
  - `attachComputerKeys({ target, bus, getMap, doc })` returns `detach`. It ignores Ctrl, Alt and Meta, events aimed at `input`, `select`, `textarea` or contenteditable, `event.repeat` and codes outside the map, and leaves those events un-prevented (so Ctrl+R reloads and typing in the BPM box works). A mapped key is prevented (no quick-find, no scrolling). The note a key played is remembered at key-down, so key-up releases that note even if the map moved; key-up releases even after Ctrl was pressed or focus moved. Blur, a hidden page (`visibilitychange`) and `detach` release every computer note and leave other sources alone.
  - `legendFor(codes, nav)` gives the letters printed on the learner's keycaps from `navigator.keyboard.getLayoutMap()` (a Spanish layout shows its own letter on `Semicolon`), with a US table as fallback; it never rejects.
- `tests/input/computer-keys.test.js` (new, 13 tests): the home and upper rows from C and from E, region clamping, a fake event target for every filter and release path.

## Counter-proofs

- A button is not a text control (its key plays), unlike input, textarea, select and contenteditable.
- A visibility event while the page is visible releases nothing; hidden releases.
- A key mapped to no note from C4 (no black key between E and F) is not prevented.
- A key-up after Ctrl or an input focus still releases the note, so a note can never get stuck.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/input/*.test.js`: 20 tests, 20 pass (13 new) |
| Full suite | `node --test`: 1128 tests, 1128 pass, 0 fail |
| Runtime harness | N/A: fake event target; the real keyboard check happens in pr11a |
| Rollback boundary | `src/input/computer-keys.js` and `tests/input/computer-keys.test.js` |

## Review budget

272 authored changed lines including tests (source 105, tests 167), plus this description.
