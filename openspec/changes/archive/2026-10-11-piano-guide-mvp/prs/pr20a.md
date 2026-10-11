# PR 20a: Chopin Nocturne, Beginner level

- Base branch: `feat/piano-guide-mvp-pr19c-chopin-verification`
- Branch: `feat/piano-guide-mvp-pr20a-chopin-beginner`
- Chain: ... -> PR 19c -> **PR 20a (this)** -> PR 20b
- Start: the Nocturne has only the Original level. End: it has a Beginner level and the index lists `["beginner", "original"]`. Task 20.1 is checked here.
- Out of scope: analysis, lessons, the card's ornament section and the level-switch, loop and ramp checks (PR 20b).

## Summary

- `songs/chopin-nocturne-op9-no2.json`, level `beginner` (E-flat major kept, `labelled`, `strictBars`): the Original melody with the tie merged into one half-note G, the turn sign dropped and the sixteenth figure of bar 4 reduced to Bb5 and D5. The left hand plays, on each of the 16 big beats, the bass eighth and then the beat's last chord held for the rest of the beat (the first chord of the beat is left out). Right-hand fingers that exist in the source are kept (`fingeringSource: "source"`); C5 in bar 2, D5 and Eb5 in bar 4 and all left-hand fingers are editorial (5 on the bass, 5 2 1 or 5 1 on the chord). The pedal marks are the Original ones. New `beginner` confidence entry (low, editorial simplification) and the `fingering` entry now says which fingers are editorial.
- `songs/index.json`: levels `["beginner", "original"]`. `defaultLevel` stays `original`, as task 19.4 set it.
- `tests/songs.test.js`: Beginner is labelled, strict, has no ornament, tie, grace or note shorter than an eighth; the melody equals the Original melody pair by pair except one D5 (with a counter-proof); on all 16 beats the bass is the Original bass and the chord is the last Original chord of the beat; source fingers equal the Original fingers and the editorial ones are exactly three; the pedal equals the Original pedal.

## Dependency diagram

```
... -> PR 19c -> [PR 20a, this PR] -> PR 20b
```

## Checks (headless Chrome, dev server on 8790, real GPU ANGLE d3d11; 1440 x 900 and 844 x 390)

- Full suite: 653 pass, 0 fail.
- Beginner page: title "Beginner score", labelled noteheads with solfege names, finger rows for both hands (26 right, 32 left), no ornament, no tie, no console errors. Screenshots read: `20-beginner-score-bar2-1440x900` and `20-beginner-both-844x390`.
- Scheduled sound (oscillator start log) at 120 BPM: 42 onsets, each with exactly the pitches the Beginner data says, 0 mismatches (Original: 52 of 52 again).
- Not checked: listening, a real beginner trying the left-hand shapes (a chord of 5 2 1 after a bass on 5 is a large jump), level switch and loop (PR 20b).

## Rollback

Remove the `beginner` block and the added tests, and put `["original"]` back in the index.
