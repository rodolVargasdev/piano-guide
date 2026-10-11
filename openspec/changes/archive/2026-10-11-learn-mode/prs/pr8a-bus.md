# PR 8a: Note bus

Branch: `feat/learn-mode-pr8a-bus`. Base: `feat/learn-mode-pr7a2-engine-range`. Task: 8.1. Specs: note-input (one bus, three sources).

## Chain context

```
feat/learn-mode-pr7a2-engine-range
  ^
feat/learn-mode-pr8a-bus                📍 this PR
  ^
feat/learn-mode-pr8a2-computer-keys (next)
```

- Start: the engine has learner notes. End: one bus carries `noteOn` and `noteOff` for every input source.
- Follow-up: pr8a2 (computer keys), pr8a3 (Web MIDI and learner sound), pr9a (screen keys), pr11a (the Learn view wires the bus to the matcher and the sound).
- Out of scope: any source of events, any consumer.

## Why the original PR 8a was split

Phase 8 has four modules with tests (about 900 authored lines). Cut by module: bus (this PR), computer keys (pr8a2), Web MIDI and learner sound (pr8a3).

## What changes

- `src/input/bus.js` (new): `createNoteBus({ now })` gives `noteOn(midi, { source, velocity })`, `noteOff(midi, { source })`, `releaseAll(source?)`, `held()`, `on(type, fn)` (returns the unsubscribe function) and `dispose()`.
  - Events are `{ type, midi, source, velocity, time }`; consumers never learn more than the source.
  - A note is held per (source, midi). A second `noteOn` of a held pair (auto-repeat) and a `noteOff` of a pair that is not held are ignored and return `false`, so the same key from two sources is two independent notes.
  - `releaseAll` can be limited to one source and emits in press order. `dispose` emits `noteOff` for every held note, then drops the listeners and refuses new notes.
  - Dispatch is synchronous and in subscription order; the held set is already updated when a listener runs. A listener that throws does not stop the others; the first error is rethrown afterwards, so it is not hidden.
- `tests/input/bus.test.js` (new, 7 tests).

## Counter-proofs

- A `noteOff` from another source does not release a note it did not press; a note can be pressed again after its release.
- After `dispose` nobody is listening and a new note is refused.
- An unsubscribed listener stops receiving, and an unknown event type throws `TypeError`.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/input/bus.test.js`: 7 tests, 7 pass |
| Full suite | `node --test`: 1115 tests, 1115 pass, 0 fail |
| Runtime harness | N/A: pure module, no user-visible surface in this PR |
| Rollback boundary | `src/input/bus.js` and `tests/input/bus.test.js` |

## Review budget

170 authored changed lines including tests (source 69, tests 101), plus this description.
