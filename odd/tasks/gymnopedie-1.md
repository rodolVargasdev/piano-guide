# Feature: gymnopedie-1

Objective: add Erik Satie's Gymnopedie No. 1 (1888) to piano-guide, complete, in Beginner and Original levels, with lesson and harmonic analysis. The user asked for "the song that sounds like Minecraft's music": Satie's Gymnopedies are the pieces C418's Minecraft soundtrack is most often compared to.

Constraints:
- The composition is public domain. Notes come ONLY from a public-domain or CC BY / CC BY-SA machine-readable source (Mutopia LilyPond plus its MIDI preferred), with URL, ID, license and SHA-256 recorded; cross-checked against the MIDI. Never from memory. Any other license or no source: stop and report.
- If the source is CC BY-SA, the song file carries that license and attribution like the Nocturne.
- No new dependency; existing schema unless a minimal tested extension is unavoidable.
- Based on feat/nocturne-complete (PR #126) so both songs do not conflict in the index and tests.

TDD mode: off. Runner: `node --test`. Checks: full suite, MIDI onset fixture with counter-proof, Docker build if running, browser check on tools/serve.mjs (free port, never 8765).

Delivery: work-unit commits; chained branches `feat/gymnopedie-1-prN-<slug>` if a slice exceeds about 400 authored lines.

## Delivery

A feature-branch-chain of six branches, each starting at the tip of the one before (nothing was pushed and no pull request was created). Authored lines are additions and deletions of the commit, song data included.

| Slice | Branch | Content | Authored lines |
|-------|--------|---------|----------------|
| 0 | `feat/gymnopedie-1` | bars 1 to 12, the MIDI fixture and the core tests | +453 -1 |
| 1 | `feat/gymnopedie-1-pr1-bars-13-21` | bars 13 to 21, the bar-shape and Beginner-rule tests | +295 -14 |
| 2 | `feat/gymnopedie-1-pr2-bars-22-31` | bars 22 to 31, the chord, lesson, section and analysis tests | +361 -14 |
| 3 | `feat/gymnopedie-1-pr3-bars-32-55` | the first ending and the start of the written-out repeat | +402 -14 |
| 4 | `feat/gymnopedie-1-pr4-bars-56-78` | the rest of the repeat and the second ending | +377 -14 |
| 5 | `feat/gymnopedie-1-pr5-catalog-docs` | index entry, license note, README, STACK row, credits guard, this record | +65 -8 and this file |

## Tasks
- [x] T1 Find and verify the source (license gate, hashes). Route: delegated. Proof: Mutopia piece 37, Public Domain, SHA-256 of the .ly 420a5224...ce04 and of the .mid 09ce7337...7384, fetched 2026-10-11; the parser reproduces every onset of the MIDI.
- [x] T2 Original level, whole piece, pinned by the MIDI fixture. Route: delegated writer. Proof: 469 notes, 455 onsets equal to the unfolded MIDI (282 written onsets in the fixture), counter-proofs in tests/songs-gymnopedie.test.js.
- [x] T3 Beginner level. Route: delegated writer. Proof: 458 events (rests included); a test derives the Beginner from the Original by the stated rules and compares every note, with counter-proof; strictBars passes.
- [x] T4 Index entry, lesson (3/4 felt slowly, left-hand leaps bass to chord, the Gmaj7 and Dmaj7 sway), analysis, sections. Route: delegated writer. Proof: 80 chord entries, 28 analysis entries tied to the data by tests, 14 sections that tile the 78 bars, 23 hand positions in the Beginner lesson and 15 in the Original, the Minecraft comparison in one sentence.
- [x] T5 Browser verification, README, STACK content-sources row. Route: delegated writer, orchestrator pushes. Proof: see the observed checks below; nothing was pushed.

## Design notes

- **Source.** Mutopia Project piece 37, Mutopia-2014/12/14-37, LilyPond 2.18.2 by Evin Robertson from the Dover edition, license Public Domain (so no songs/LICENSE file is needed; the typesetter is still credited in the source entry). Files: `https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1.ly` and `.mid`, fetched 2026-10-11.
- **Method.** A throwaway parser (scratch folder, not committed) reads the three voices of the file (top, middle, bottom), resolves relative octaves, durations, ties, the pitched rests and the cross-voice `<< >>` in the bass, and unfolds the repeat. It reproduces the MIDI exactly: 282 note onsets in the written MIDI, both staves. The parse needed two relative-octave rules that the MIDI confirmed: the elements of `<< a b >>` are relative to each other in order, and the second alternative is relative to the end of the first.
- **The repeat.** The source writes a repeat with two endings (body of 31 bars, first ending 8 bars, second ending 8 bars). The MIDI LilyPond makes plays the music as written (47 bars: body, ending 1, ending 2, no repeat). The data writes the repeat out: 78 bars, body, ending 1, body, ending 2 (112320 ticks). The test unfolds the MIDI the same way before comparing, and a separate test pins that bars 40 to 70 are bars 1 to 31 again.
- **Bars of the app.** 1 to 31 body, 32 to 39 first ending, 40 to 70 the body again, 71 to 78 second ending. The lessons and the analysis use these numbers.
- **Surprising reading, reported and not forced.** (1) The key signature has two sharps and the source declares B minor, but the first ending closes on D major and the music alternates Gmaj7 and Dmaj7, so the data says D major and records the doubt in the confidence notes. (2) The second ending has no sharp at all (every note is a white key, D Dorian) and the last chord of the piece is D minor (D4 F4 A4 D5 over D2 A2 D3), where the first ending closed on D major. (3) Bars 37 and 76 have three streams of notes (a bass E2 held with B2 and E3 above it, two chords in the treble staff, and a held F sharp 4 in the melody); no single hand plays all of them. The data gives the two chords to the right hand in voice 2 and keeps the bass line in the left hand (voice 1 for B2 and E3, voice 2 for the held E2). This hand choice is editorial and the confidence notes say so.
- **Hands and staves.** The source writes the left-hand chords on the treble staff (bars 1 to 18 and the endings) and on the bass staff (bars 19 to 31). The data gives all of them to the left hand (voice 1 of the left hand, the bass note is voice 2 so it can be held for the whole bar). The score draws the left hand on the bass staff with ledger lines (known limit, as in the Nocturne). The Original sets strictBars to false because of the second voice; a test checks that no event crosses a barline.
- **Beginner.** Right hand: the melody, ties kept, the three upper notes of a final chord, no right-hand chords of bars 37 and 76. Left hand: the bass for one beat then the chord for two beats, a chord of four notes keeps its three upper notes, in bars 37 and 76 the left hand plays E2 and the two chords and drops B2 and E3. The test derives the Beginner from the Original by these rules and compares every note.
- **Tempo.** The source has the marking Lent et douloureux and no tempo number. 60 beats per minute (quarter note) is the default speed of the Mutopia MIDI; the confidence notes say it is not a printed tempo.
- **Fingering.** The source prints none, so every finger is editorial.
- **Schema.** No extension was needed.
- **Pedal and dynamics.** The source prints no pedal, so the data has no pedal ranges. Dynamics are not in the schema; the lesson text lists the marks read from the .ly (pp at bars 5 and 13, p at bar 22, an f under bar 9 that could not be checked).

## Progress
- 2026-10-11: branch created from feat/nocturne-complete 19d0900.
- 2026-10-11: slice 0 on `feat/gymnopedie-1`: the song file with the intro, the first melody phrase and the held F sharp (bars 1 to 12), both levels, with chords, sections, analysis, lesson text, sources and confidence; the MIDI onset fixture of the whole piece and the core tests (onsets against the MIDI with counter-proofs, hands, source record, typography).
- 2026-10-11: slice 1 on `feat/gymnopedie-1-pr1-bars-13-21`: bars 13 to 21 (melody again, the F sharp minor turn, E minor, E minor 7, D minor), both levels, with chords, analysis and lesson text; tests of the bar shapes and of the Beginner rules (derived from the Original, with counter-proof).
- 2026-10-11: slice 2 on `feat/gymnopedie-1-pr2-bars-22-31`: bars 22 to 31 (the rising line, the D pedal from bar 23 to 31), both levels, with chords, analysis and lesson text; tests of the chord track, the hand positions, the sections, the analysis numerals and the claims of bars 13 to 31.
- 2026-10-11: slice 3 on `feat/gymnopedie-1-pr3-bars-32-55`: the first ending (bars 32 to 39) and the start of the written-out repeat (bars 40 to 55), both levels, with chords, analysis and lesson text; the tests of the first ending and the repeat test (with counter-proof).
- 2026-10-11: slice 4 on `feat/gymnopedie-1-pr4-bars-56-78`: the rest of the repeat (bars 56 to 70) and the second ending (bars 71 to 78), the whole piece (78 bars, 112320 ticks); the tests of the second ending (no sharps, bar 76 against bar 37, the closing D minor).
- 2026-10-11: slice 5 on `feat/gymnopedie-1-pr5-catalog-docs`: the index entry (the catalog lists the three public songs), the public-set test of tests/songs.test.js, songs/LICENSE-satie-gymnopedie-1.md (Public Domain source record), the README (a Gymnopédie bullet and the License section), the STACK content-sources row and a credits guard with counter-proof.
- 2026-10-11: commits, one per slice, in chain order: 2ca6bb3 (0), 6c31004 (1), f50c1a9 (2), 26bcab0 (3), 685f598 (4), edd3fdb (5). Slice 0 is a little over 400 authored lines because it carries the fixture and the first tests together with the first song data; every file of the song grows slice by slice and the full suite passed at each one.
- Observed checks. Full suite (node --test) at every slice: 0 failures and 0 skipped; passes 1726 (0), 1739 (1), 1759 (2), 1764 (3), 1766 (4) and 1768 (5), the totals of the whole suite including the Nocturne. Docker build of the last slice: exit 0, and the test stage inside the image ran 1768 tests with 1745 passing, 0 failing and 23 skipped (the same environmental skips as the Nocturne build: tools, songs-private and a .git folder are not in the test stage).
- Observed MIDI match. The Original equals the unfolded MIDI at every slice: 455 onsets at the whole piece (the written MIDI has 282 note onsets in 92 treble and 64 bass groups; the hands fixture has 76 right-hand and 92 left-hand groups). A wrong octave, a shifted onset, a missing note and an extra note each break the comparison (counter-proofs).
- Observed in the browser (tools/serve.mjs on port 8792, headless pane of the session; 8765 never used; the server was stopped afterwards): the catalog shows the three public songs (the local songs-private folder adds a fourth card, the private Cancer, and the badge counts it); both levels draw the whole piece up to the final barline of bar 78, the Original with its two voices in the left hand and the right-hand voice 2 of bars 37 and 76, the Beginner with note names and chord names above the staff; the Analysis toggle draws the roman numerals and callouts (for example B half dim. and D minor at the end); the section list has 14 entries and the second ending sets the loop range to bar 71 beat 1 to bar 78 beat 3; Learn mode starts in both levels (36 right-hand phrases); the console had no message at all. Screenshots (gym-*.jpg) are in the session scratch folder and were read.
- Not done, by design: nothing was pushed, no pull request exists, and the audio was not listened to (the headless pane has no sound).
