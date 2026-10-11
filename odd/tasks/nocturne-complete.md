# Feature: nocturne-complete

Objective: complete Chopin's Nocturne Op. 9 No. 2 in piano-guide. Today the song holds the pickup and bars 1 to 4 (11760 ticks, Original 128 notes, Beginner 91 notes). The goal is the whole piece (34 bars) in both levels, with lesson and analysis updated.

Problem: a learner can only practise the opening four bars.

Constraints:
- Notes come ONLY from the Mutopia source already recorded (Mutopia-2014/12/18-1590, LilyPond file SHA-256 f35863a7...ab65, CC BY-SA 3.0), cross-checked against the MIDI LilyPond generates from the same file. Never from memory.
- The song file stays CC BY-SA 3.0 with its attribution (songs/LICENSE-chopin-nocturne-op9-no2.md).
- No new dependency. Existing schema; any extension (for example cross-staff notes or long free-time fioriture) goes through a design note and tests first.
- Builds on the current main (includes learn mode, PR #125).

TDD mode: off (repository has no strict TDD). Runner: `node --test "tests/**/*.test.js"` (or the glob the repo uses). Checks: full suite, onset fixture against the Mutopia MIDI, browser check on tools/serve.mjs port 8790 (never 8765).

Delivery: work-unit commits on `feat/nocturne-complete`, chained PR slices of about 400 authored lines (song data counts), feature-branch-chain if more than one PR.

## Tasks
- [ ] T1 Map the current code (learn mode, schema limits, tests that pin the Nocturne length) and fetch the full source again (same SHA-256). Route: delegated (4+ files).
- [ ] T2 Original level, bars 5 to 34, in slices of a few bars, each pinned by the MIDI onset fixture. Route: delegated writer.
- [ ] T3 Beginner level for the same bars. Route: delegated writer.
- [ ] T4 Lesson, ornaments and analysis for the new sections; lengthTicks, sections and loops. Route: delegated writer.
- [ ] T5 Browser verification, README and STACK/content-sources update, PRs. Route: delegated writer, orchestrator pushes.

## Progress
- 2026-10-11: branch created from main 9f33fab.
