# PR 1c: Key orders, major scales and five-finger patterns

Branch: `feat/learn-mode-pr1c-scales`. Base: `feat/learn-mode-pr0c-learn-polish`. Tasks: 19.1 to 19.3. Spec: music-theory-generators (major scales, five-finger patterns, key orders). First pure module of Milestone C: no UI, no audio.

## Chain context

```
feat/learn-mode-pr0c-learn-polish
  ^
feat/learn-mode-pr1c-scales                  this PR (📍)
  ^
feat/learn-mode-pr2c-triads
```

## What changes

- `src/theory/keys.js`: `keyOrder({ kind, direction, start, list, seed, count })` with the three orders of the spec (fixed list repeated, circle of fifths or of fourths wrapping after twelve, seeded random with every key once before any repeat and no key following itself; with `start` the random order opens with the key being played, so "Next key" never repeats it), and `minorTonic` (Db, Ab, Eb are written C#, G#, D# for minor material so no Fb, Cb or Gb appears).
- `src/theory/scales.js`: `SCALE_FINGERING` (the design table, all 12 keys, both hands), `majorScale(tonic, { octaves, hand, direction })` (8 or 15 notes, up, down or up and back, spelled with `spellDegree`), `fiveFinger(tonic, hand, { minor })`, and `directed(notes, direction)` shared by the later generators. Every result carries `suggested`.
- The two fingerings the design flags are returned with `suggested: true`: **Bb major right hand start** (2 here; some books start on 4) and **F# major left hand start** (4 here; some books start on 3). They are shown as "Suggested fingering" in the practice screens (pr6c). A teacher or a book should confirm them (user-only list, task 28.1 item 5).

## Tests and counter-proofs

`tests/theory/key-order.test.js` (10 tests) and `tests/theory/scales.test.js` (14 tests): every scenario of the spec (circle of fifths and of fourths, the wrap at 13, the fixed list C F G for 5 steps, random over 200 seeds in blocks of 12, C and F and B and Bb and F# rows, two octaves with 15 notes, F# spelling, all twelve tonics times both hands times one and two octaves with fingers 1 to 5 and each note one letter step above the previous, five-finger G right and D left). Mutation checks, each making the suite fail: no swap at a block boundary (2), `start` ignored by the circle (1), Bb start 4 (1), F# no longer flagged (1), second octave dropped (2), minor third not lowered (1).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/theory/*.test.js`: 83 pass, 0 fail |
| Full suite | `node --test`: 1377 tests, 0 fail |
| Runtime harness | N/A: pure modules with no user-visible surface yet (a plain Node import is asserted by a test) |
| Rollback boundary | `src/theory/scales.js`, the `keyOrder` and `minorTonic` additions of `src/theory/keys.js`, the two test files |

## Out of scope

Triads, arpeggios and progressions (pr2c); intervals (pr3c); anything on screen.
