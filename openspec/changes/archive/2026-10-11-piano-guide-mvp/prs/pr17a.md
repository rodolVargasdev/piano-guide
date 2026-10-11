# PR 17a: Chord parser

- Base branch: `feat/piano-guide-mvp-pr16b-practice-panel`
- Branch: `feat/piano-guide-mvp-pr17a-chords`
- Chain: ... -> PR 16b -> **PR 17a (this)** -> PR 17b
- Start: chord symbols are plain strings. End: `parseChord` and `chordMidis` turn a symbol into spelled notes and MIDI numbers. Tasks 17.1 and 17.2 are checked here.
- Out of scope: the scene highlight, the lesson card and the Cancer lesson (PR 17b and 17c).

## Summary

- `src/core/chords.js`: `parseChord(symbol, octave = 4)` returns `{ symbol, root, quality, bass?, names, pitches }`. Tones are spelled by letter steps from the root (E gives G#, not Ab; B7 gives A, not G##). Qualities: major, minor, 7, maj7, m7, dim, dim7, m7b5, aug, sus2, sus4, add9, and a slash bass placed within an octave below the root. Unknown or malformed input (and non-strings) returns `null` and never throws. `chordMidis` gives the MIDI numbers, bass included.
- The octave is a parameter because the card lights chords in octave 3, where they fit the fitted keyboard range of the Cancer levels.

## Dependency diagram

```
... -> PR 16b -> [PR 17a, this PR] -> PR 17b -> PR 17c -> PR 18a
```

## Checks

- `node --test tests/core/chords.test.js`: 23 pass, 0 fail.
- Counter-proof: capping the letter steps (so thirds and fifths land on the wrong letters) fails 20 of 23 cases; restored.
- Runtime harness: N/A, pure module.

## Rollback

Remove `src/core/chords.js` and its suite; nothing imports them yet.
