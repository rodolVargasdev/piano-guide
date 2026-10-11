# PR 10a: Keyboard layout core

- Base branch: `feat/piano-guide-mvp-pr9b-player-shell`
- Branch: `feat/piano-guide-mvp-pr10a-keyboard-layout`
- Chain: tracker -> ... -> PR 9b -> **PR 10a (this)** -> PR 10b
- Start: the player shell exists with no scene. End: the pure keyboard geometry and range fitting exist and are tested; nothing renders them yet.
- Out of scope: the quality-tier decision (PR 10b), any three.js code (PR 11).

PR 10 of the task list is split in two so each half is one reviewable behavior.

## Summary

Adds `src/core/keyboard-layout.js` and `tests/core/keyboard-layout.test.js`. Tasks 10.1 and 10.2.

- `keyGeometry(midi)` gives `{ midi, isBlack, x, width }` for A0 to C8 (`null` outside it). White keys are 1 unit wide and contiguous; black keys are 0.58 wide, centered on the seam between their two white neighbors with a small per-group offset.
- `layoutRange({ low, high })` splits a range into white and black keys with `x` measured from the first white key, plus the total width. It throws `RangeError` for an inverted or out-of-range request.
- `fittedRange(notes, { pad = 3, minSpan = 36 })` pads 3 semitones, snaps outward to C and B, grows by whole octaves to a 36-key minimum, clamps to A0 to C8 and ignores rests. Without pitched notes it returns C3 to B5.
- `FULL_RANGE` is A0 to C8 for the "Full 88" toggle.

## Dependency diagram

```
... -> PR 9b -> [PR 10a, this PR] -> PR 10b
```

## Size

91 source and 135 test lines, 4 lines of task checkboxes and this description: about 265 authored lines. Within the 400-line budget.

## Checks run

- `node --test tests/core/keyboard-layout.test.js`: 15 pass, 0 fail. Full `node --test`: 400 pass, 0 fail.
- Counter-proofs: setting the default `pad` to 0 fails 1 test; breaking a black-key offset to -0.7 fails 1 test; both restored.
- Runtime harness: N/A, pure module with no runtime boundary.

## Rollback

Remove `src/core/keyboard-layout.js` and its suite; nothing else imports them yet.
