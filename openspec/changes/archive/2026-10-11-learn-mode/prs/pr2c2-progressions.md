# PR 2c2: Cadences and progressions with voice leading

Branch: `feat/learn-mode-pr2c2-progressions`. Base: `feat/learn-mode-pr2c-triads`. Tasks: 20.2, 20.3. Spec: music-theory-generators (cadences and progressions with voice leading). Pure module, no UI, no audio.

## Chain context

```
feat/learn-mode-pr2c-triads
  ^
feat/learn-mode-pr2c2-progressions           this PR (📍)
  ^
feat/learn-mode-pr3c-intervals-drills
```

## What changes

- `src/theory/progressions.js`: `progression(tonic, numerals)` (a list of I, ii, iii, IV, V, vi, or a name from `PROGRESSIONS`: `I-IV-V-I`, `I-vi-IV-V`, `I-V-vi-IV`). Each chord has a left hand root (finger 5, window A2 to G#3, so C major gives C3 F3 G3 C3) and a right hand triad. The first chord is the root position triad of the right hand window (C4 E4 G4); the other chords are chosen by dynamic programming (Viterbi) over every close position voicing in G3 to G5, minimizing the total semitone movement of the whole progression, ties going to the lower voicing. Because the all-root-position sequence is one of the candidates, the optimum can never be worse than it (the spec scenario holds by construction and a brute-force test proves it for 12 tonics times 3 progressions).
- Chords are spelled in the key from the chord root (G vi is Em, Bb vi is Gm, F# vi is D#m, IV in Bb is Eb); the minor chords here are not renamed with sharps (Eb minor stays Ebm inside Db major), unlike the triad exercises where minor on Db, Ab, Eb is C#, G#, D#.
- Sample outputs, for the user to hear later: C I-V-vi-IV is C4 E4 G4 | B3 D4 G4 | C4 E4 A4 | C4 F4 A4 (total movement 9), the textbook voice leading.

## Tests and counter-proofs

`tests/theory/progressions.test.js` (9 tests): the C scenario (chords, left hand roots, pitch classes, first chord), the common tone kept from C to F (movement 3), the brute-force bound over 12 tonics times 3 progressions plus the check that the reported movement is the real sum, G vi is Em, Bb and F# spelling, every voicing ascending, inside the region, with the right fingers and the bass a root in its window, determinism, null for bad input, and a counter-proof that the comparison sees a worse sequence. Mutation checks, each making the suite fail: picking the maximum movement (2), bass octave dropped (2), minor third not lowered (1), first inversion fingered like the root (1). The region bounds are an implementation limit that the optimum never reaches, so widening them changes nothing observable (checked, 0 failures, left as a property test).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/theory/*.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: pure module; a throwaway script printed the four sample progressions above |
| Rollback boundary | `src/theory/progressions.js` and its test |
