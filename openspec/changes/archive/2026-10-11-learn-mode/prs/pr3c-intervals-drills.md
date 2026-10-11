# PR 3c: Intervals and ear-drill questions

Branch: `feat/learn-mode-pr3c-intervals-drills`. Base: `feat/learn-mode-pr2c2-progressions`. Tasks: 21.1, 21.2. Spec: music-theory-generators (intervals and chord drills). Pure modules, no UI, no audio; the ear session and screen come in pr7c.

## Chain context

```
feat/learn-mode-pr2c2-progressions
  ^
feat/learn-mode-pr3c-intervals-drills        this PR (📍)
  ^
feat/learn-mode-pr4c-timeline-runner
```

## What changes

- `src/theory/intervals.js`: `INTERVALS` (m2 to P8, semitones 1 to 12), `semitonesOf`, `intervalNotes(low, id)` (the lower note and the note above it, from a MIDI number or a spelled pitch) and `midiPitch`.
- `src/theory/drills.js`: `intervalQuestion(seed, { options, directions })` and `chordQuestion(seed, { options })`, both seeded with `mulberry32`, so the same seed is the same question. A question carries its `answer`, its `options` (deduplicated, unknown ids dropped, always containing the answer exactly once, in size order so the buttons keep a stable place), the `root` and the `notes` in the shape `engine.playNotes` takes (`{ midi, at, dur }` in seconds). Directions: ascending, descending, or harmonic (together); chords sound as a block. Every note lies in C3 to C6. Also the vocabulary the ear session will use: the starting options (M3, P5, P8; major, minor) and the order they grow in (P4, m3, M6, M2, m6, m7, M7, TT, m2; then dim, aug).

## Tests and counter-proofs

`tests/theory/intervals.test.js` (5) and `tests/theory/drills.test.js` (9): reproducible by seed; the correct answer among four options exactly once over 500 seeds; dropped duplicates and unknown ids; the note order for each direction; every note in C3 to C6 for every interval, direction and 500 seeds; chord notes match their quality; the start and growth lists cover the twelve intervals once; every option and every direction is drawn a fair share of the time. Mutation checks, each making the suite fail: root range widened (1), descending order lost (1), the answer fixed to the first option (1), semitone table shifted (3).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/theory/intervals.test.js tests/theory/drills.test.js`: 14 pass |
| Full suite | `node --test`: 1413 tests, 0 fail |
| Runtime harness | N/A: pure modules, nothing on screen until pr7c |
| Rollback boundary | `src/theory/intervals.js`, `src/theory/drills.js` and their two tests |
