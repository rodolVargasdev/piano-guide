# PR 2a3: Hooktheory converter module and synthetic fixture

Branch: `feat/learn-mode-pr2a3-import-converter`. Base: `feat/learn-mode-pr2a2-import-chords`. Tasks: 2.2, 2.3. Specs: song-import (pure conversion module, degree to pitch, beats to ticks and rests, sections, chords and left hand, valid private song with honest provenance, malformed input, tests never use the private data).

## Chain context

```
feat/learn-mode-pr2a-converter
  ^
feat/learn-mode-pr2a2-import-chords
  ^
feat/learn-mode-pr2a3-import-converter   📍 this PR
  ^
feat/learn-mode-pr2a4-import-cli
  ^
feat/learn-mode-pr3a-i18n ...
```

- Start: pitch helpers and `deriveChord` exist. End: `convertHooktheory(source, opts)` returns a validated private song or errors with paths.
- Follow-up: pr2a4 (thin CLI, adversarial output paths, local check on the real capture).
- Out of scope: reading or writing files, the index upsert, the real capture.

## What changes

- `tests/fixtures/hooktheory-synthetic.json` (new): synthetic input in the real shape (1-based beats, a pickup section, a rest, `b` prefix, chord fields, an extra `lyric` and a `hash`). It is not a real song and holds no lyrics beyond the planted marker used by the "lyrics are dropped" test.
- `src/import/hooktheory.js` (new): the pure converter. Fixed section order (intro, verse, pre-chorus, chorus, bridge, outro), each section `endBeat - 1` beats, pickup bar kept as a full bar, `pickupTicks: 0`, rests as gaps, overlaps clipped with a warning, whole-bar `lengthTicks`, left-hand roots in octave 2 (`role: "bass"`), whitelisted output in a fixed key order, `visibility: "private"`, one `user-submitted` source, confidence `medium`, `learn.transposeTo: ["C"]` for 3 or more accidentals, validation with `validateSong` before returning.
- `tests/import/hooktheory.test.js` (new, 43 tests): every Import scenario of the design Testing Strategy that belongs to the pure module, plus a table of 21 malformed inputs, each failing on its path (the unmodified capture converting is the counter-proof).

## Deviations from the spec text

- The summary counts every source note entry (rests included): the real capture reports verse 52 and 14 chords, which are source array lengths. A second field `pitched` gives the sounding notes, so nothing is hidden.
- A section whose note or chord starts after its own `endBeat` fails (not specified; the alternative was silently dropping data).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/import/hooktheory.test.js`: 43 tests, 43 pass |
| Full suite | `node --test`: 891 tests, 891 pass, 0 fail |
| Runtime harness | the converter run on the real private capture from a scratchpad script (counts only): ok, 0 warnings, verse 52 notes and 14 chords, chorus 34 and 11, bridge 39 and 13, intro 10 chords; the CLI harness is pr2a4 |
| Rollback boundary | `src/import/hooktheory.js`, the fixture and the test file; `chords.js` and `pitch.js` stay |

## Review budget

About 540 authored changed lines before this description (converter about 245, tests about 225, fixture about 70). That is above the 450 split threshold. It does not split cohesively further: the fixture and tests are the proof of the module, and the chord rules were already moved to pr2a2. Recommendation: `size:exception` for this slice.
