# PR 8a3: Web MIDI input

Branch: `feat/learn-mode-pr8a3-midi`. Base: `feat/learn-mode-pr8a2-computer-keys`. Task: 8.3. Specs: note-input (Web MIDI detection and permission, graceful states without MIDI).

## Chain context

```
feat/learn-mode-pr8a2-computer-keys
  ^
feat/learn-mode-pr8a3-midi              📍 this PR
  ^
feat/learn-mode-pr8a4-learner-sound (next)
```

- Start: the bus and the computer keys exist. End: a MIDI piano feeds the bus, with every state of the input panel available as data.
- Follow-up: pr8a4 (learner sound), pr11a (the input panel renders the states with the strings from pr3a2 and calls `connect()` from the "Connect piano" click; the real Casio check happens there).
- Out of scope: the input panel, the real device check (user-only).

## What changes

- `src/input/midi.js` (new):
  - `parseMidiMessage(bytes)` gives `{ type, midi, velocity }` for note on (velocity scaled to 0..1, any channel) and note off; note-on with velocity 0 is a release. Pedal, pitch bend, clock, active sensing, short messages, out-of-range data bytes and `null` give `null`.
  - `deviceName(port)` puts the manufacturer first unless the name already contains it (case-insensitive); falls back to "MIDI input".
  - `createMidiInput({ navigator, isSecureContext, bus, onState })` returns `{ connect, state, names, dispose }`. Initial state: `insecure` when the page is known not to be secure, else `unsupported` without `requestMIDIAccess`, else `idle`. Permission is requested only inside `connect()`, once, with `{ sysex: false }`. A second `connect()` while pending waits for the first; after access is granted, `connect()` rescans (so "Connect piano" can be pressed again to retry after plugging in). `SecurityError` and `NotAllowedError` give `denied`, any other failure `unavailable`, a granted request with no input `no-device`, otherwise `connected` with the list of device names (the view shows the first and "+N").
  - Every connected input is listened to; `onstatechange` rescans, so a device plugged in later appears and one removed (or reporting itself disconnected) is dropped. A removed device releases the held `midi` notes through `bus.releaseAll("midi")` (other sources are untouched).
  - `dispose` clears the handlers, releases the notes and ignores a late permission answer.
- `tests/input/midi.test.js` (new, 15 tests) with a fake navigator, ports and `statechange`.

## Counter-proofs

- No request before `connect()` (zero calls recorded after construction, and for the unsupported and insecure pages); exactly one request with `{ sysex: false }` after it, also with two presses.
- Pedal, clock, short and malformed messages are ignored without error; velocity 0 is a release.
- A pulled cable releases only the MIDI note: a computer-key note held at the same time stays held.
- After `dispose`, plugging a device changes nothing and a permission answer that arrives late is dropped.

## Deviations and decisions to confirm

- Precedence of the first two states: a page known to be insecure reports `insecure` even if `requestMIDIAccess` is missing (Chrome hides it on insecure pages, so "not available in this browser" would be misleading there). Safari over plain HTTP would also say "needs a secure page" before saying "not available"; it says so correctly once served securely.
- A disconnect releases the held MIDI notes of all devices, not only the unplugged one, because the bus keys notes by source, not by device. With two devices connected a held key on the other one is released early.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/input/midi.test.js`: 15 tests, 15 pass |
| Full suite | `node --test`: 1143 tests, 1143 pass, 0 fail |
| Runtime harness | N/A: fake navigator; the real Casio check is user-only and happens in pr11a (recorded as NOT verified here) |
| Rollback boundary | `src/input/midi.js` and `tests/input/midi.test.js` |

## Review budget

314 authored changed lines including tests (source 119, tests 195), plus this description.
