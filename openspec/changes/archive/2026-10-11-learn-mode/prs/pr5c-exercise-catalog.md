# PR 5c: The exercise catalog

Branch: `feat/learn-mode-pr5c-exercise-catalog`. Base: `feat/learn-mode-pr4c2-practice-progress`. Tasks: 23.1. Spec: practice-exercises (exercise catalog). The doc card texts follow in pr5c2 (task 23.2); no screen yet.

## Chain context

```
feat/learn-mode-pr4c2-practice-progress
  ^
feat/learn-mode-pr5c-exercise-catalog        this PR (📍)
  ^
feat/learn-mode-pr5c2-doc-cards
```

## What changes

- `src/practice/catalog.js`: the ten exercises (`five-finger`, `scale-major`, `triads`, `arpeggios`, `cadence-i-iv-v-i`, `progression-i-vi-iv-v`, `progression-i-v-vi-iv`, `ear-intervals`, `ear-chords`, `routine`) in four groups (technique, harmony, ear, routine). Each has its `kind` (run, ear or routine), whether it rotates through keys, the choices it offers with their defaults (hand, octaves, quality, direction), the `tempoSteps` of its card (50 60 72 88 for the line exercises, 40 50 60 72 for chords) and, for the runs, `generate`, which calls the theory generators.
- `generateExercise(id, options)` returns `{ exercise, options, steps, suggested }`: `steps` are `[{ keys: [{ midi, pitch, finger, hand }], label? }]` for the runner; a choice the exercise does not offer or a key outside the twelve falls back to its default; an unknown id (it comes from the address bar) is only compared and gives null.
  - Scales: one or two octaves, up or up and back, right hand, left hand or together (both hands' keys in every step).
  - Triads: root, first, second, the root an octave up and back (7 chords), major or minor, any hand choice.
  - Arpeggios: one or two octaves, major or minor.
  - Five-finger: up and back by default, major or minor.
  - Cadence and the two progressions: one step per chord with its symbol as `label`; both hands by default (left hand root plus right hand voicing), or right hand chords only, or roots only.
- `suggested` is true exactly when the run contains a fingering the books disagree on: the Bb right hand and F# left hand scale starts, the left hand arpeggio of the flat roots, the left hand two-octave crossing finger, and minor arpeggios without a table row. The practice screens show it as "Suggested fingering" (pr6c).
- `keysToPractice(done, order)`: the keys not practiced yet in the order of introduction; the first is pre-selected and the next three are marked as next ("G, D, F" after C), every key stays selectable.

## Tests and counter-proofs

`tests/practice/catalog.test.js` (13): ids, groups and order; the five card string keys and valid tempo steps (with a counter-proof that the check rejects 300, 10, a repeat and a descending list); the lookup never trusts an id (`__proto__`, markup, unknown); the C major scenario; scale options; the suggested flag in both directions; five-finger, triads and progressions in detail; every run exercise times 12 keys times every combination of choices gives playable steps (fingers 1 to 5, a hand on every key); fallback to defaults; the order of introduction. Mutation checks (each fails the suite): the together flag ignoring the left hand (1), a shorter inversion list (1), an unchecked key (1), a lookup that falls back to the first exercise (1), a tempo step of 288 (1). The check that every card field has a string in both languages needs the strings and lands in pr5c2.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/practice/catalog.test.js`: 13 pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: data and pure functions; the screens come in pr6c |
| Rollback boundary | `src/practice/catalog.js` and its test |
