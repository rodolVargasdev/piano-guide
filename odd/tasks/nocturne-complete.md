# Feature: nocturne-complete

Objective: complete Chopin's Nocturne Op. 9 No. 2 in piano-guide. At the start the song held the pickup and bars 1 to 4 (11760 ticks, Original 128 notes, Beginner 91 notes). The goal is the whole piece (34 printed bars) in both levels, with lesson and analysis updated.

Problem: a learner could only practise the opening four bars.

Constraints:
- Notes come ONLY from the Mutopia source already recorded (Mutopia-2014/12/18-1590, LilyPond file SHA-256 f35863a7...ab65, CC BY-SA 3.0), cross-checked against the MIDI LilyPond generates from the same file (SHA-256 e202d394...2548e). Never from memory. Both files were fetched again on 2026-10-11 and both hashes matched.
- The song file stays CC BY-SA 3.0 with its attribution (songs/LICENSE-chopin-nocturne-op9-no2.md).
- No new dependency. Existing schema: no extension was needed (see the design notes).
- Builds on main 9f33fab (includes learn mode, PR #125).

TDD mode: off (repository has no strict TDD). Runner: `node --test`. Checks: the full suite at every slice, the onset fixture against the Mutopia MIDI, a browser check with tools/serve.mjs (port 8790 was held by another session's server, so 8791 was used; 8765 never), the Docker build.

Delivery: a feature-branch-chain of ten branches, each of about 400 authored lines or fewer (song data counts). Nothing was pushed and no pull request was created.

| Slice | Branch | Content |
|-------|--------|---------|
| 0 | `feat/nocturne-complete` | the Nocturne tests measure lengthTicks and the MIDI fixture pins the whole piece |
| 1 | `feat/nocturne-complete-pr1-content-tests` | the tests of the later bars (sections, forms, tuplets, graces, cadenza), each one skipped until the file reaches its bar |
| 2 | `feat/nocturne-complete-pr2-bars-5-8` | bars 5 to 8 |
| 3 | `feat/nocturne-complete-pr3-bars-9-12` | bars 9 to 12 |
| 4 | `feat/nocturne-complete-pr4-bars-13-16` | bars 13 to 16 |
| 5 | `feat/nocturne-complete-pr5-bars-17-20` | bars 17 to 20 |
| 6 | `feat/nocturne-complete-pr6-bars-21-24` | bars 21 to 24 |
| 7 | `feat/nocturne-complete-pr7-bars-25-28` | bars 25 to 28 |
| 8 | `feat/nocturne-complete-pr8-bars-29-31` | bars 29 to 31 |
| 9 | `feat/nocturne-complete-pr9-cadenza-end` | the cadenza and the last printed bars (app bars 32 to 37) and the README |

## Design notes

- **Method.** A throwaway parser (in a scratch folder, not committed) reads the two relative LilyPond staves and produces events with absolute pitch, tick, duration, fingering, ties, grace notes, tuplets, voices and pedal marks. It reproduced the 128 hand-made notes of bars 0 to 4 exactly (fingers and the tie included), and every onset of its output equals the MIDI onsets: 406 right-hand groups, 396 left-hand groups and 15 grace notes.
- **Free time, the cadenza.** Printed bar 32 is a cadenza (cadenzaOn, tiny sixteenths, fermatas) that the MIDI stretches to 11520 ticks, four bars of time. The data keeps that timing, so the app counts bars 32 to 35 for it and the printed bars 33 and 34 are bars 36 and 37; the whole piece is 106800 ticks (pickup plus 37 bars). The lessons and the analysis use the app's numbers and say so. Rejected: squeezing the cadenza into one bar (it would not be "as the MIDI times it" and needs non-notatable durations).
- **Tuplets.** `times 3/4` (four in the time of three), `times 2/3` and `times 6/8` (eight in the time of six) are stored as `tuplet: { n, inSpaceOf }` with `dur` the sounding length; the nominal values are all notatable, so the existing rule W1 stays silent.
- **Grace notes.** Stored as `grace: true` 32nds (60 ticks), each group ending exactly where its main note starts. The MIDI gives LilyPond's own duration (about 27 ticks), which cannot be written as a notatable value, so the fixture pins only their pitches, their order and the main note they lead to.
- **Octaves under 8va (bars 30 to 32).** The source writes the sounding pitches and prints them an octave lower with an 8va bracket; the MIDI confirms the sounding pitches. The data holds the sounding pitches (up to D7); the bracket is not drawn and the notes get many ledger lines.
- **Cross-staff.** The last left-hand notes of the cadenza (a long D5) are written on the treble staff in the source. The schema can represent them, because `hand` says who plays the note, so no extension was made. The score draws them on the bass staff with ledger lines. Drawing the staff change would need a per-note staff field and a voice rule in the layout: left as a known limit.
- **Voices.** The left hand has a second voice in bar 31 (an F3 quarter under two eighth chords) and in printed bars 33 and 34 (bars 36 and 37). A unison that both voices write at the same tick (a B flat 3 in bar 36) is stored once, in voice 1, the way the MIDI sounds it. R10 (strictBars) checks every bar of every used voice, so the Original sets `strictBars` to false from the slice that has a second voice; a test checks that no event crosses a barline.
- **Roles, ornaments, pedal.** The left-hand bass is a single low note on its own; chord notes are accompaniment. Trills, inverted mordents (LilyPond prall) and turns are the signs of the source; the long flourishes are `fioritura` runs whose first note carries the sign and whose other notes are role ornament. The pedal goes down on the note with a pedal mark and up at the end of the note with the pedal-up mark, as printed.
- **Beginner.** One right-hand line: tied notes are one note, graces and signs are cut, a run of short notes keeps its first note and, when long enough, a last note one eighth before the next one; chords keep the top note and octaves the lower note. Left hand: bass eighth plus the last chord of the beat held, except the listed beats (bars 12 and 20 beats 3 and 4, beat 2 of bars 29 and 30, bars 32 to 37). The 27 moved notes are pinned in the tests.
- **Limits.** The 8va bracket and the staff change are not drawn; the cadenza plays as evenly spaced sixteenths; Learn mode derives its phrases automatically (54 in Beginner and 77 in Original), with no authored phrases.

## Tasks
- [x] T1 Map the current code (learn mode, schema limits, tests that pin the Nocturne length) and fetch the full source again (same SHA-256). Proof: both SHA-256 matched; the tests that pinned the length were in tests/songs.test.js and tests/core/timeline.test.js and now measure `lengthTicks`.
- [ ] T2 Original level, bars 5 to 34 (app bars 5 to 37), in slices, each pinned by the MIDI onset fixture. Done up to app bar 28.
- [ ] T3 Beginner level for the same bars. Done up to app bar 28.
- [ ] T4 Lesson, ornaments and analysis for the new sections; lengthTicks, sections and loops. Done up to app bar 28.
- [ ] T5 Browser verification, README and STACK/content-sources update. Orchestrator pushes.

## Progress
- 2026-10-11: branch created from main 9f33fab.
- 2026-10-11: slice 0 on `feat/nocturne-complete`: the Nocturne tests measure lengthTicks and the MIDI fixture pins the whole piece. About 200 authored lines: tests/songs.test.js +195 and -47, the fixture (4 long lines) and tests/core/timeline.test.js +2 and -1. The 68 song tests pass on the unchanged four-bar file.
- 2026-10-11: slice 1 on `feat/nocturne-complete-pr1-content-tests`: the tests of the later bars (sections, forms, tuplets, graces, cadenza), each one skipped until the file reaches its bar. About 250 authored test lines, all in tests/songs.test.js; 18 of the 89 song tests are skipped on the four-bar file and run from the slice that reaches their bar.
- 2026-10-11: slice 2 on `feat/nocturne-complete-pr2-bars-5-8`: bars 5 to 8, both levels, with chords, analysis and lesson text. Authored lines (song file, licence note and stack row): +399 and -40.
- 2026-10-11: slice 3 on `feat/nocturne-complete-pr3-bars-9-12`: bars 9 to 12, both levels, with chords, analysis and lesson text. Authored lines (song file, licence note and stack row): +374 and -24.
- 2026-10-11: slice 4 on `feat/nocturne-complete-pr4-bars-13-16`: bars 13 to 16, both levels, with chords, analysis and lesson text. Authored lines (song file, licence note and stack row): +324 and -20.
- 2026-10-11: slice 5 on `feat/nocturne-complete-pr5-bars-17-20`: bars 17 to 20, both levels, with chords, analysis and lesson text. Authored lines (song file, licence note and stack row): +297 and -21.
- 2026-10-11: slice 6 on `feat/nocturne-complete-pr6-bars-21-24`: bars 21 to 24, both levels, with chords, analysis and lesson text. Authored lines (song file, licence note and stack row): +304 and -17.
- 2026-10-11: slice 7 on `feat/nocturne-complete-pr7-bars-25-28`: bars 25 to 28, both levels, with chords, analysis and lesson text. Authored lines (song file, licence note and stack row): +353 and -23.

