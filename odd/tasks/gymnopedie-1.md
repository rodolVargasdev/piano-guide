# Feature: gymnopedie-1

Objective: add Erik Satie's Gymnopedie No. 1 (1888) to piano-guide, complete, in Beginner and Original levels, with lesson and harmonic analysis. The user asked for "the song that sounds like Minecraft's music": Satie's Gymnopedies are the pieces C418's Minecraft soundtrack is most often compared to.

Constraints:
- The composition is public domain. Notes come ONLY from a public-domain or CC BY / CC BY-SA machine-readable source (Mutopia LilyPond plus its MIDI preferred), with URL, ID, license and SHA-256 recorded; cross-checked against the MIDI. Never from memory. Any other license or no source: stop and report.
- If the source is CC BY-SA, the song file carries that license and attribution like the Nocturne.
- No new dependency; existing schema unless a minimal tested extension is unavoidable.
- Based on feat/nocturne-complete (PR #126) so both songs do not conflict in the index and tests.

TDD mode: off. Runner: `node --test`. Checks: full suite, MIDI onset fixture with counter-proof, Docker build if running, browser check on tools/serve.mjs (free port, never 8765).

Delivery: work-unit commits; chained branches `feat/gymnopedie-1-prN-<slug>` if a slice exceeds about 400 authored lines.

## Tasks
- [ ] T1 Find and verify the source (license gate, hashes). Route: delegated.
- [ ] T2 Original level, whole piece, pinned by the MIDI fixture. Route: delegated writer.
- [ ] T3 Beginner level. Route: delegated writer.
- [ ] T4 Index entry, lesson (3/4 felt slowly, left-hand leaps bass to chord, the Gmaj7 and Dmaj7 sway), analysis, sections. Route: delegated writer.
- [ ] T5 Browser verification, README, STACK content-sources row. Route: delegated writer, orchestrator pushes.

## Progress
- 2026-10-11: branch created from feat/nocturne-complete 19d0900.
