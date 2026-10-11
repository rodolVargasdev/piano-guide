# PR 9a: Transport controls

- Base branch: `feat/piano-guide-mvp-pr8e-engine-loop-hands`
- Branch: `feat/piano-guide-mvp-pr9a-transport-ui`
- Chain: tracker -> ... -> PR 8e -> **PR 9a (this)** -> PR 9b
- Start: the audio engine is complete (PR 8e). End: transport controls exist and drive an engine; the player that hosts them is PR 9b.
- Out of scope: the player view, hash route wiring, the rAF loop and the debug overlay (PR 9b). Task 9.1 is checked here; 9.2 to 9.4 are in PR 9b.

PR 9 of the task list is split in two because the transport plus the player came to about 600 authored lines.

## Summary

Adds `src/ui/transport.js`, `tests/ui/transport.test.js` and the transport styles in `styles/app.css`.

- `createTransport({ engine, timeline, onChange })` returns `{ element, update(pos), setHandModes(modes), dispose() }`: Play, Pause, Stop (enabled by the engine `state` event), seek bar with section marks (a `datalist`, no inline styles), BPM field (typing 500 shows 240), Slow with a `Slow: n BPM` note, Metronome and Count-in toggles (`aria-pressed`), the "Both hands muted" notice and the readout (bar, beat, m:ss; the pickup reads "Pickup").
- Pure helpers `formatTime`, `formatReadout`, `parseBpmField`, `sectionMarks`, `handsMessage` and `slowNote` are tested under `node --test`.
- The seek thumb is not rewritten while the user drags it.
- Styles: buttons, toggles, seek, BPM field and the compact variant for 844 x 390 landscape.

## Dependency diagram

```
... -> PR 8e -> 📍 PR 9a -> PR 9b
```

## Size

About 138 source, 57 test and 94 CSS lines plus this description: about 330 authored lines. Within the 400-line budget.

## Checks run

- `node --test tests/ui/transport.test.js`: 8 pass. Full `node --test`: no failures. Counter-proof: removing the clamp in `parseBpmField` fails 2 tests; restored.
- Headless Chrome (DevTools protocol driven from a scratch script) on port 8790 with a temporary harness page that is not part of the PR: Play (context running, position advances), Pause (position held), Stop (back to 0), seek from the range input, BPM 500 shows 240 and 50 stays 50, Slow shows `Slow: 25 BPM`, Metronome and Count-in toggle, the hands notice appears only when both hands are muted, no horizontal scroll at 844 x 390 and the whole transport fits above the fold. A screenshot was read.
- Console: only `/favicon.ico` 404 (no favicon is declared; harmless).
- Not checked: that sound is audible (headless), keyboard operation by hand and the browser back button (PR 9b).

## Rollback

Remove `src/ui/transport.js`, `tests/ui/transport.test.js` and the transport block at the end of `styles/app.css`.
