# PR 20c: Chopin chords, analysis and lessons

- Base branch: `feat/piano-guide-mvp-pr20b-chopin-lesson-card`
- Branch: `feat/piano-guide-mvp-pr20c-chopin-analysis-lesson`
- Chain: ... -> PR 20b -> **PR 20c (this)** -> PR 21 (not in this batch)
- Start: the Nocturne has two levels, no analysis and no lesson. End: it has a chord track, 13 analysis entries on Original and a lesson for each level. Tasks 20.2 to 20.4 are checked here; this is the last PR of the batch (PR 19 and 20).
- Out of scope: finger markers (PR 21), polish (PR 22).

## Summary

- `songs/chopin-nocturne-op9-no2.json`: song-level `chords` (12 spans, symbols such as `Bdim7/Eb`, `Eb/D`, `G7/B`, with roman numerals and functions; bar 2 beat 3 is left unnamed on purpose); Original `analysis` (harmony, voice-leading, ornament, dynamics, rubato; titles of 11 characters at most so callouts fit one beat); lessons for both levels (Beginner: four big beats, each simplification, left-hand jumps, practice plan; Original: attribution, pedal, interpretation, `ornaments` with bars); an `analysis` confidence entry.
- Bar 1 harmony read from the source first: beat 2 is an Eb3 bass under Ab, D and Cb (the B natural) with the F of the melody, so the diminished color is confirmed and written (no discrepancy; only the Cb spelling differs).
- `tests/songs.test.js` (13 tests): the chord track parses and both lessons list exactly its symbols; every left-hand note of each span is a tone of its chord and the bass is its bass (the bar 4 suspension is checked on its own); roman numerals and functions equal the chord track; the diminished seventh is checked interval by interval; the bass steps, half-step resolutions and the 4-3 suspension are true of the notes; ornament entries sit on the right bar and note; every hand position names a note its level plays at that tick; lesson content (four big beats, each simplification, the attribution and license, rubato and dynamics). Counter-proofs for the wrong numeral, a foreign chord note and a note the level does not play.
- `tests/ui/lesson-card.test.js`: the real Nocturne card (Ornaments with bars, analysis on request, the Mutopia link and license text, no Ornaments or Analysis on Beginner).

## Dependency diagram

```
... -> PR 20b -> [PR 20c, this PR]
```

## Checks (headless Chrome, dev server on 8790, real GPU ANGLE d3d11; 1440 x 900 and 844 x 390)

- Full suite: 679 pass, 0 fail.
- Beginner: labelled, chord row Eb, Bdim7/Eb, Eb, Eb/D, C7, Fm, Bb7, G7/B, Cm, Adim7, Bb7, Eb; no Analysis button, no callout, no Ornaments section. Original with Analysis on: 12 roman numerals and 13 callouts, no overlapping callout boxes at five scroll positions at either size; the card lists Ornaments ("Bar 2, Chromatic turn", "Bar 4, Fioritura"), Analysis ("Bar 1, Diminished ...") and three sources with the license text. Screenshots read: `20-original-analysis-t240-1440x900`, `20-original-analysis-t9600-844x390`, `20-beginner-chords-1440x900`, `20-card-ornaments-1440x900`, `20-card-sources-844x390` (and the Beginner shots of PR 20a). No console error and no horizontal scroll.
- Level switch (task 20.4): paused at bar 3 beat 1 (tick 6000) the position and readout are identical on both levels (also at 844 x 390); while playing, the first onset after the switch was 0 ms late at three phases (900, 1500, 2100 ms).
- Loop on the pickup plus bar 1 (A at the pickup, B in bar 1: "Pickup, beat 4 to bar 1, beat 4", 3120 ticks) at 120 BPM: the pickup Bb4 returns every 2.167 s, the seam has no gap, and with the metronome on there are four clicks per bar (one accent at the downbeat and three at 0.5 s, the dotted-quarter beat).
- Ramp 100 by 20 to 140 on that loop: 100, 120, 140, then holds at 140; four clicks per bar on every pass. Note: with the Ramp button pressed the first pass plays at the tempo set when it was pressed, and the Ramp from field must be edited after the Ramp to field (existing rule, PR 16).
- Scheduled sound only: onsets of both levels equal the data (Beginner 42 of 42, Original 52 of 52 at 120 BPM). Not checked: listening, a real phone, a real beginner reading the lessons, the harmonic labels against a published analysis (none was consulted).

## Size

About 411 authored lines including this file (the Nocturne data is 190 lines of JSON and the guards 178 lines of tests): at the budget, not split further because the analysis, the lessons and the tests that tie them to the data belong together.

## Rollback

Revert the `chords`, `analysis`, `lesson` blocks and the `analysis` confidence entry of the song file, with the added tests.
