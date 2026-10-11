# PR 18a: Cancer Original level (data)

- Base branch: `feat/piano-guide-mvp-pr17d-cancer-lesson-wiring`
- Branch: `feat/piano-guide-mvp-pr18a-cancer-original`
- Chain: ... -> PR 17d -> **PR 18a (this)** -> PR 18b
- Start: Cancer has only Beginner. End: Cancer has a second, engraved level and the selector offers two levels. No task is checked here (18.1 closes in PR 18b with the analysis and the lesson).
- Out of scope: the analysis entries, the Original lesson, the confidence entries for the arrangement (PR 18b).

## Summary

- `songs/cancer.json`: level `original` (engraved, `strictBars`, `role` bass and accompaniment only, no melody, no `transcribed`): per bar, a left-hand arpeggio of four quarter notes (root, fifth, octave, fifth, or the slash bass first for F#/A#) and a right-hand four-note chord held for the bar. The inversions keep every voice within a whole step from one chord to the next (for example C#m to Am moves only G# up to A and C# down to C). Every note is a tone of the chord of the source (no seventh or added tone, so no chord is invented). Fingering is editorial (5-2-1-2 left, 1-2-3-5 right).
- `songs/index.json`: levels `["beginner", "original"]`.
- `tests/songs.test.js`: every note of both levels is a tone of the chord at that tick (with a mutation counter-proof), the shape of each bar, the bass starting on the chord bass (slash bass included), engraved, strict bars, roles and no lyrics or melody.

## Dependency diagram

```
... -> PR 17d -> [PR 18a, this PR] -> PR 18b
```

## Size

96 lines of song data (88 notes), 53 of tests, 1 of index and this description.

## Checks

- `node --test tests/songs.test.js`: all pass; full suite 618 pass, 0 fail. `validateSong` passes with one warning that the Original level has no lesson yet (closed in PR 18b).
- Browser (headless Chrome, 8790, real GPU): `#/song/cancer?level=original` opens as "Cancer, Original score", no note names, 44 right-hand and 44 left-hand heads, whole-note chords and quarter-note arpeggios engraved under four sharps with a natural sign where Am needs it, keys light in both hand colors while playing, no console errors; the card shows "No lesson for this level yet" until PR 18b. Screenshots `18-original-playing` and `18-catalog` read (1440 x 900 only; 844 x 390 is checked in PR 18b). The catalog card shows both level chips.
- Not checked: sound.

## Rollback

Remove the `original` level from `songs/cancer.json`, restore the index levels and drop the new test cases.
