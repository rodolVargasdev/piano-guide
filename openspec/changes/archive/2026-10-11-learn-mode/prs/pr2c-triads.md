# PR 2c: Triads, inversions and arpeggios

Branch: `feat/learn-mode-pr2c-triads`. Base: `feat/learn-mode-pr1c-scales`. Tasks: 20.1. Spec: music-theory-generators (triads, inversions and arpeggios). Pure module, no UI, no audio.

## Chain context

```
feat/learn-mode-pr1c-scales
  ^
feat/learn-mode-pr2c-triads                  this PR (📍)
  ^
feat/learn-mode-pr2c2-progressions
```

## What changes

- `src/theory/triads.js`: `triad(tonic, quality, inversion, hand)` for major, minor, diminished and augmented triads in root position, first and second inversion (and 3, the root an octave up, for the up-and-back exercise). Right hand fingers 1-3-5, 1-2-5, 1-3-5; left hand 5-3-1, 5-3-1, 5-2-1 (the amended spec). A root sits in a one-octave window (A3 to G#4 right hand, A2 to G#3 left) so C major is C4 E4 G4 and C3 E3 G3 and A minor is A3 C4 E4, as the scenarios say. Minor and dim triads on Db, Ab and Eb are written C#, G#, D# so no Fb, Cb or Gb appears.
- `arpeggio(tonic, quality, { octaves, hand, direction })`: root, third, fifth and the root again (4 notes, 7 for two octaves), descending is the ascending sequence reversed. Fingers come from the standard table of the design (1 2 3 5 and 5 4 2 1 per octave; 2 1 2 4 for the right hand of Db, Eb, Ab, Bb). Rows the table does not have are fingered by the five-finger assigner and returned with `suggested: true`; so is the left hand two-octave crossing finger.
- **Flagged for a teacher or book (user-only list, 28.1 item 5):** the left hand arpeggio of Db, Eb, Ab and Bb, the left hand two-octave crossing finger (3 or 4) of every key, and the minor arpeggios of B, F# and the flat roots. They ship as "Suggested fingering". The assigner's answer for a left hand flat root is 5 3 1 5 (a hand move on the octave): playable but not the usual shape, which is why it is flagged.

## Tests and counter-proofs

`tests/theory/triads.test.js` (13 tests): the C major right and left hand scenarios with their fingers, A minor A3 C4 E4, spelling (Eb, F# minor, C# minor for Db, dim, aug), every tonic times quality times inversion times hand (pitch classes, ascending, three letters, root in its window, within an octave), null for bad input, arpeggio notes and fingers for both hands, two octaves, reverse, the flat roots, the flagged rows (and the counter-proof that not everything is flagged), every tonic times quality times hand times size with the right intervals. Mutation checks, each making the suite fail: left hand inversion fingers swapped (1), left hand two-octave flag removed (1), Bb dropped from the flat roots (1), root window moved (2), minor named without sharps (1).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/theory/triads.test.js`: 13 pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: pure module, no user-visible surface yet |
| Rollback boundary | `src/theory/triads.js` and its test |
