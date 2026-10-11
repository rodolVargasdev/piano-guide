# PR 17d: Cancer Beginner lesson and card wiring

- Base branch: `feat/piano-guide-mvp-pr17c-lesson-card`
- Branch: `feat/piano-guide-mvp-pr17d-cancer-lesson-wiring`
- Chain: ... -> PR 17c -> **PR 17d (this)** -> PR 18a
- Start: the card module exists and Cancer has an empty lesson. End: the player shows the Cancer Beginner lesson. Tasks 17.4 to 17.6 are checked here.
- Out of scope: the Cancer Original level, its lesson and analysis (PR 18).

## Summary

- `songs/cancer.json`: the Beginner lesson for someone who only knows the basics: how to sit, the finger numbers 1 to 5 (1 thumb to 5 little finger, both hands), which chord each hand plays and where, and how to practice (hands apart with Mute, Slow and Metronome, Loop a section, Ramp). The summary and `arrangementNote` state that it is a generic chord-based accompaniment, not a transcription, and that the vocal line is left out. No lyrics, no melody.
- `src/ui/player.js`: the card sits under the practice panel, follows the level and the Analysis toggle, and clears a chord outline when the player is left; the chip redraws a paused scene (a bug found in the browser: the outline appeared only at the next frame).
- `src/scene/index.js`: `highlightNotes` tolerates a disposed keyboard.
- `tests/songs.test.js`: the lesson validates; `chordsUsed` equals the chord track and every chord parses; every hand position names a note the level really plays at that tick (with a counter-proof); posture, finger numbers, hands separate, slow, loop and ramp are taught; the generic-accompaniment statement is present.
- `README.md`: a Lesson card section.

## Dependency diagram

```
... -> PR 17c -> [PR 17d, this PR] -> PR 18a -> PR 18b
```

## Checks (headless Chrome, dev server on 8790, real GPU ANGLE d3d11; 1440 x 900 and 844 x 390)

- Full suite: 613 pass, 0 fail (plus the later fix commit).
- The card shows eight sections with one-line headings; chips E and F#/A# list their notes and outline their keys; a second click clears; the chorus is labelled lower confidence; two https links. No horizontal scroll at 844 x 390. Leaving the song removes the card without console errors. Screenshots read: `17-card-card`, `17-chip-E`, `17-chip-slash`, `17-chip-cleared` at both sizes, `17-card-hostile`.
- Counter-proof (temporary local copy, restored): an unknown chord Xyz renders as text only and a `javascript:` source renders as plain text.
- Not checked: reading the lesson with a real beginner, the Analysis section of the card with real entries (PR 18).

## Rollback

Revert the lesson block in `songs/cancer.json` and the card wiring in `src/ui/player.js`.
