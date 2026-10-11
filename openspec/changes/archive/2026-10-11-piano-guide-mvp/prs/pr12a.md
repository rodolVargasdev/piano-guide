# PR 12a: Falling notes

- Base branch: `feat/piano-guide-mvp-pr11d-scene-wiring`
- Branch: `feat/piano-guide-mvp-pr12a-falling-notes`
- Chain: tracker -> ... -> PR 11d -> **PR 12a (this)** -> PR 12b
- Start: the lit 3D keyboard is in the player. End: notes fall to the key-top line in sync with the audio position. Task 12.1 is checked here.
- Out of scope: the frame statistics, the `?debug=1` Full 88 button, the README scene section and tasks 12.2 to 12.4 (PR 12b).

PR 12 of the task list is split in two (falling notes; measurement tooling and docs).

## Summary

- `src/scene/notes-layout.js` (pure): `unitsPerTick(meter, bars = 2)` makes 2 bars fill the wall in both 4/4 and 12/8 (constant beats on screen at any BPM); `groupY(tick)` is the only per-frame value; `noteBox` gives a bar's lower edge (`tick * upt`) and height (`dur * upt` minus a small repeat gap); `fallingNotes` keeps pitched notes inside the range and drops hidden hands (muted hands stay).
- `src/scene/falling-notes.js`: one `InstancedMesh` per hand placed once in tick space; per frame only `group.position.y` changes. Two world-space clipping planes (the key-top line and the 2-bar horizon, `setHorizonBars` for the Minimum tier of PR 22) bound what is drawn, `frustumCulled = false`. Hand cue besides color: left-hand bars carry long dark stripes, right-hand bars are plain; a brighter lower (leading) edge and a slight emissive tint. Deviation from the design text ("one InstancedMesh"): one per hand, 2 draw calls, so the hand color can drive the emissive tint and the stripe texture without per-instance texture lookups. Still well under the 20 draw-call budget.
- `src/scene/index.js`: loads `falling-notes.js` with the other scene modules, rebuilds the notes when the timeline, range or hand modes change, and calls `notes.update(tick)` before drawing. The render loop uses indexed loops (no iterator objects).
- `src/scene/keyboard.js` exposes `centerX[midi]`, `keyWidth[midi]` and `hasKey(midi)` so notes sit over their keys.
- `src/scene/key-state.js` scans notes in place with the same rule as `core/timeline.activeAt`; a test compares both over a dense sweep. Reason: the allocation measurement (below) showed `activeAt` filling a reused array still allocated on every call.

## Dependency diagram

```
... -> PR 11d -> [PR 12a, this PR] -> PR 12b
```

## Size

85 + 42 + 24 + 11 + 11 source and 81 + 15 test lines, 2 task lines: about 270 authored lines plus this description. Within the 400-line budget.

## Checks run

- `node --test tests/scene/*.test.js`: all pass; full `node --test`: 446 pass, 0 fail.
- Counter-proofs (run then restored): scaling the group move by 1.01 fails 2 notes-layout tests (arrival and ahead-of-line); ignoring `hidden` fails 1; hard-coding a 4/4 bar length fails 1 (12/8 horizon).
- Headless Chrome through the DevTools protocol, dev server on 8790, **real GPU** (ANGLE, NVIDIA GeForce RTX 3050 Laptop, Direct3D11; also run on SwiftShader): Cancer Beginner at 1440 x 900 and 844 x 390, screenshots read. Notes fall as bars whose lower edge meets the keys' top line exactly where the lit keys are (paused at tick 0 the lower edges of all tick-0 notes touch the key-top line and no key is lit); left-hand bars are blue and striped, right-hand bars are orange; bars are cut flat at the 2-bar horizon and sunk into the keys at the line. Seeking while playing to the start redraws the notes and lit keys for the new position in the same frame (screenshot read); pausing lights no key.
- Allocation sampling (HeapProfiler sampling profile with collected objects included, 10 s of playback, real GPU): no allocation site in `src/scene/` after the `key-state` fix. three.js itself allocates about 365 KB per second in its renderer (module 2.28 MB plus core 1.4 MB over 10 s); that is outside our code. `ui/player.js` `frame` shows about 3 KB per second (probably boxed numbers); the readout in `ui/transport.js` allocates strings every frame (about 12 KB per second), a PR 9a item that is not in the scene path and is left as is. Main-thread time: about 67 ms per second of playback (about 1.1 ms per frame).
- Not checked: any sound, a real phone, a long seek storm.

## Rollback

Remove `src/scene/notes-layout.js`, `src/scene/falling-notes.js` and their test, and revert the hunks in `keyboard.js`, `index.js` and `key-state.js`.
