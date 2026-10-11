# PR 18b: Cancer Original analysis, lesson and level-switch sound

- Base branch: `feat/piano-guide-mvp-pr18a-cancer-original`
- Branch: `feat/piano-guide-mvp-pr18b-cancer-analysis`
- Chain: ... -> PR 18a -> **PR 18b (this)** -> PR 19 (not in this batch)
- Start: Cancer has an Original level with no analysis or lesson. End: the Original level carries analysis, a lesson and confidence notes, and a level switch while playing no longer leaves the new level silent. Tasks 18.1 to 18.3 are checked here; this is the last PR of the batch (PR 16 to 18).
- Out of scope: Chopin (PR 19 and 20), finger markers (PR 21), polish (PR 22).

## Summary

- `songs/cancer.json`, level `original`: seven `analysis` entries on the chord changes (Tonic, Dominant, Relative minor, Borrowed iv with a span, C back to C#, Bass climbs, Supertonic), kinds `harmony` and `voice-leading`, roman numerals and functions equal to the chord track. The borrowed iv (Am) is explained as modal mixture from the parallel key, E minor, the point for advanced users. Lesson `original`: left-hand shape, right-hand fingers at each change, posture, a four-step practice plan, and the arrangement note (generic chord-based accompaniment, not a transcription, vocal line left out, chorus lower confidence). Confidence entries: fingering (both levels), voicings (low, editorial) and analysis (medium).
- `src/audio/engine.js`: `setTimeline` while playing now starts the new level's notes that are already sounding, for their remaining length and cut at a loop end (found while verifying 18.2: the first new onset came 445 and 489 ms after a switch, over the 250 ms budget). Seek keeps its rule.
- `tests/songs.test.js`, `tests/audio/engine.test.js`: see Checks. `README.md`: song-authoring section (levels, notation, strictBars, analysis, lesson, contentPolicy) and the engine row.

## Dependency diagram

```
... -> PR 18a -> [PR 18b, this PR] -> PR 19
```

## Size

82 lines of song data, 67 of song tests, 8 of README, 14 of engine, 34 of engine tests, 3 task lines and this description.

## Checks (headless Chrome, 8790, real GPU ANGLE d3d11; 1440 x 900 and 844 x 390)

- Full suite: 629 pass, 0 fail. Counter-proofs: removing the catch-up fails 2 engine tests; the analysis tests fail on a wrong numeral or a changed voicing (see the test names).
- Level selector with two real levels, paused switch at bar 4: tick, BPM, metronome and Mute right kept, hash rewritten without history growth; Analysis on shows 11 roman numerals and 7 callouts plus the card's Analysis section, off removes them; session memory returns Original. Hand state across the switch: right muted gives 3 oscillators per onset on Original (only the left hand), both hands 15 and 3.
- Switch while playing, first new onset after the switch: 51, 445, 489 ms before the fix; 0 ms in all three trials after it (scheduling only, sound was not listened to).
- Screenshots read: `18-original-analysis` (1440 x 900), `18-original-analysis-score` and `18-two-levels` (844 x 390), `18-original-playing`, `18-catalog`.
- Not checked: listening, a real phone, a comparison with the recording (the arrangement is generic by design).

## Rollback

Revert the analysis, lesson and confidence hunks of `songs/cancer.json` and the engine catch-up; PR 18a stays a working second level.
