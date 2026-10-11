# PR 19b: Chopin Nocturne Op. 9 No. 2, Original level data

- Base branch: `feat/piano-guide-mvp-pr19a-chopin-tied-notes`
- Branch: `feat/piano-guide-mvp-pr19b-chopin-original-data`
- Chain: ... -> PR 19a -> **PR 19b (this)** -> PR 19c -> PR 20a -> PR 20b
- Start: the catalog has one song. End: it has two; the Nocturne has an Original level with the pickup and bars 1 to 4. Tasks 19.1 to 19.5 are checked here; 19.6 (browser) is PR 19c.
- Out of scope: Beginner, lesson and analysis (PR 20), bars after bar 4.

## Source (task 19.1) and license gate

| Item | Value |
|---|---|
| Listing | https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=ChopinFF |
| Piece page | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590 |
| LilyPond file | https://www.mutopiaproject.org/ftp/ChopinFF/O9/chopin_nocturne_op9_n2/chopin_nocturne_op9_n2.ly |
| Mutopia ID | Mutopia-2014/12/18-1590 (G. Schirmer, New York, 1881, typeset by Renato Biolcati Rinaldi) |
| License | Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0) |
| SHA-256 of the .ly | f35863a752f5b2805cd50272909b06bb8b1b1a8412d2b549fd13969a4481ab65 |
| SHA-256 of the .mid | e202d3941ce5f26397f57f59f0e2e4e3ad9e19061fa3c4dc596c5ee6a6a2548e |
| Accessed | 2026-10-10 |

The gate allows CC BY-SA, so work proceeded. Consequence the maintainer should decide on: the transcribed data is adapted from a CC BY-SA file, so attribution is recorded in the song file (`sources[]`), in the README, and the data may carry ShareAlike terms. The `.ly` stays outside the repository.

## Summary

- `songs/chopin-nocturne-op9-no2.json`: E-flat major, 12/8, tempo 44 dotted quarters (the printed eighth = 132), marking Andante, pickup of one eighth plus bars 1 to 4 (11760 ticks). Original level: engraved, `transcribed`, `strictBars`, explicit rests (left-hand pickup, right-hand quarter rest in bar 4), the tied G in bar 1, the turn sign on the C of bar 2, the right-hand fingering printed in the source (`fingeringSource: "source"`), 15 pedal ranges. No cross-staff notes occur in these bars, so no design extension was needed. Sources: the Mutopia entry (`public-domain-score`), the Mutopia MIDI and an IMSLP pointer (`reference`). Confidence entries for notes, fingering, ornaments, pedal and structure. `lesson` is empty until PR 20.
- `songs/index.json`: the Nocturne entry, levels `["original"]`.
- `tests/fixtures/mutopia-chopin-op9n2-onsets.json`: the 30 right-hand and 48 left-hand onsets read from the Mutopia MIDI (LilyPond resolved the octaves, independent of the hand transcription).
- `tests/songs.test.js`: validation and timing; the source entry (names the bars, URL, ID, license, SHA-256, maintainer); each bar's first pitch and the bass of bar 1 (Eb2, Eb3, Eb2, D2); the bar 1 melody G, F, Eb; every onset against the MIDI fixture; counter-proofs (no source, mutated pitch, wrong octave, wrong tick, missing note).
- `README.md`: provenance and license note for transcribed songs.

## Cross-check results

- Mutopia MIDI: all 30 right-hand and 48 left-hand onsets match in tick and pitch (checked by script and pinned in tests).
- Verified facts: bar 1 melody G5, F5, Eb5 matches. Bar 1 beat 2 sounds B, D, F and Ab over an Eb3 bass: the source spells the B as Cb4 (the same pitch class), so the only difference is spelling, kept as the source writes it.
- IMSLP: the page answers, but the scans sit behind an interactive disclaimer and no PDF rasterizer was available, so no second edition was read. The `notes` confidence is medium for that reason.

## Dependency diagram

```
... -> PR 19a -> [PR 19b, this PR] -> PR 19c -> PR 20a -> PR 20b
```

## Checks

- Full suite: 643 pass, 0 fail.
- Not checked here: rendering, listening (PR 19c).

## Rollback

Delete `songs/chopin-nocturne-op9-no2.json`, its fixture and tests, and the index entry.
