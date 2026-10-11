# PR 11a2: Input panel

Branch: `feat/learn-mode-pr11a2-input-panel`. Base: `feat/learn-mode-pr11a-beginner-phrases`. Task: 11.1. Specs: note-input (input panel, graceful states without MIDI).

## Chain context

```
feat/learn-mode-pr11a-beginner-phrases
  ^
feat/learn-mode-pr11a2-input-panel      this PR
  ^
feat/learn-mode-pr11a3-learn-view (next)
```

## What changes

- `src/ui/input-panel.js` (new): `createInputPanel({ i18n, storage, connect, midi })` returns `{ element, setMidiState, setComputerKeys, midiSound, dispose }`. A chip for the computer keys ("Computer keys: on"), a chip for MIDI (one aligned line per state, the device name and "+N" when connected), the single "Connect piano" button (shown only where pressing it can help: not connected, denied, no device, could not start), the "Sound from the app for MIDI" checkbox persisted through `writeMidiSound`, and one hint line "No MIDI device found..." only after a Connect attempt ended with no device. `connect()` is called only from the click; a throw is swallowed. `midiSound()` feeds `createLearnerSound` as its setting. Everything redraws on a language change.
- `tests/ui/input-panel.test.js` (new, 7 tests): each state in both languages, the panel contents (no paragraph, one button), permission only on click, hint after an attempt, toggle persistence and read back.

## Counter-proofs

- No Connect call at construction; one per click.
- `no-device` without a prior attempt shows the chip but no hint; `connected` and `unsupported` hide the button; `denied` offers a retry.
- A rejecting `connect` does not throw; a disposed panel stops following the language.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/input-panel.test.js`: 7 tests, 7 pass |
| Full suite | `node --test`: 1228 tests, 1228 pass, 0 fail |
| Runtime harness | in pr11a3 (browser, fake navigator for MIDI; the real Casio stays user-only) |
| Rollback boundary | `src/ui/input-panel.js`, `tests/ui/input-panel.test.js` |

## Review budget

207 authored changed lines including tests (source 94, tests 113), plus this description. Styles come with the Learn layout (pr11a4).
