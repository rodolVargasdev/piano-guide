# PR 19c: Chopin Original, harmony guards and browser verification

- Base branch: `feat/piano-guide-mvp-pr19b-chopin-original-data`
- Branch: `feat/piano-guide-mvp-pr19c-chopin-verification`
- Chain: ... -> PR 19b -> **PR 19c (this)** -> PR 20a -> PR 20b
- Start: the Nocturne Original data exists and is pinned by onset tests. End: the bar 1 harmony, the fingering and ornament, the pedal and the IMSLP honesty are pinned too, and the render and the scheduled sound were checked in the browser. Task 19.6 is checked here.
- Out of scope: Beginner, lesson and analysis (PR 20).

## Summary

- `tests/songs.test.js` (four tests): bar 1 beat 2 has an Eb3 bass under B, D, F and Ab (the B is spelled Cb4 in the source, same pitch class); the right hand carries only source fingering (25 notes) and the left hand none, and the only ornament is the turn on the C5 of bar 2; the 15 pedal ranges follow the source marks (one per beat, then beats 3 and 4 of bar 4 together); the IMSLP entry says it was not read and the notes confidence stays medium.
- No source or data change: the browser check found nothing that needed a data fix.

## Dependency diagram

```
... -> PR 19b -> [PR 19c, this PR] -> PR 20a -> PR 20b
```

## Checks (headless Chrome, dev server on 8790, real GPU ANGLE d3d11; 1440 x 900 and 844 x 390)

- Full suite: 647 pass, 0 fail.
- Catalog: two cards (Cancer and the Nocturne: Eb major, 44 BPM, chip `original`), none unavailable.
- Nocturne Original page, no console errors: title and description "Eb major, 12/8, 44 dotted-quarter beats per minute, 4 bars after a pickup", readout "Pickup, beat 4", no lesson yet (the card says so), key signature of three flats, 12/8 time signature, bar numbers 2 to 4, 1 tie, 1 ornament sign, 20 beams, 25 right-hand fingers drawn and none for the left hand. Screenshots read: `19-catalog-1440x900`, `19-original-both-1440x900`, `19-original-both-844x390`, score-only at pickup, bar 2, bar 3 and bar 4 (1440 x 900) and bar 2 (844 x 390), and a zoom of the clef area.
- Bar by bar against the Mutopia PDF (rendered by headless Chrome from the downloaded file, page 1 read): same pickup, bar 1 (G5 dotted tied to G, F, G, F, Eb, Bb), bar 2 (G5, C5 with the turn, C6, G, Bb, Ab, G), bar 3 (F, G, D, Eb, C) and bar 4 (Bb, D6, C6, the sixteenth figure, Eb, rest, Bb); the left hand has an eighth bass and two chords on every beat; naturals on E in bar 2 and the Cb chord in bar 1 are drawn.
- Scheduled sound (oscillator start log, three oscillators per note), whole piece at 120 BPM and again at 20 BPM: 52 onsets, each with exactly the pitches of the Mutopia MIDI fixture (0 mismatches at both tempos), 375 oscillators. The tied G is struck once: tick 960 holds only the Eb3 bass, no G5.
- Engraving limits seen, not fixed here: slurs, hairpins, dynamics, pedal signs and the chromatic-turn accidentals are not drawn (the score has no such symbols); the turn sign sits close to the finger number of the C6 that follows; the eighth and quarter rest glyphs are still rough.
- Not checked: listening (sound was never heard, only its schedule), a real phone, a second edition (IMSLP scans could not be read).

## Rollback

Delete the four added tests.
