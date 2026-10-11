# PR 17b: highlightNotes on the keyboard

- Base branch: `feat/piano-guide-mvp-pr17a-chords`
- Branch: `feat/piano-guide-mvp-pr17b-highlight-notes`
- Chain: ... -> PR 17a -> **PR 17b (this)** -> PR 17c
- Start: keys light only for playback. End: `scene.highlightNotes(midis)` outlines keys independently. Task 17.3 is checked here.
- Out of scope: the lesson card and its chord chips (PR 17c), the lesson data and wiring (PR 17d).

## Summary

- `src/scene/keyboard.js`: one flat frame quad per key (an instanced mesh sharing the glow geometry), tinted `HIGHLIGHT_COLOR` (teal, no hand uses it), scaled to zero when off; `highlight(midis)` applies a diff.
- `src/scene/key-state.js`: pure `diffHighlight(lit, wanted, hasKey)` (drops duplicates, non-integers and keys outside the range; `[]` clears).
- `src/scene/index.js`: `highlightNotes(midis)` on the real scene and a no-op on the null scene; the set is re-applied when the keyboard is rebuilt (range or level change). The player's placeholder view gets the same no-op.
- `README.md`: scene section (also fixes the Full 88 line that still pointed at the debug button).

## Dependency diagram

```
... -> PR 17a -> [PR 17b, this PR] -> PR 17c -> PR 17d
```

## Checks

- Full suite: 593 pass, 0 fail. The scene interface test now lists `highlightNotes`; the no-three-import guard still passes.
- Counter-proof: `diffHighlight` without the range filter keeps an out-of-range key lit (test).
- Browser (temporary harness page, not committed; real GPU, 1440 x 900): E in octave 3 outlines E3, G#3, B3; F#/A# outlines A#2, F#3, A#3, C#4; the outline survives a Full 88 rebuild; `[]` clears it. Screenshots `17-highlight-*` read.
- Not checked: 844 x 390 for the outline, the chip that triggers it (PR 17c). The cleared frame equals the first frame to the eye, not byte for byte.

## Rollback

Revert the halo mesh in `keyboard.js`, `diffHighlight`, the facade method and the no-ops.
