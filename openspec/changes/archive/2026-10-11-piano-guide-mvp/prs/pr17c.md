# PR 17c: Lesson card module

- Base branch: `feat/piano-guide-mvp-pr17b-highlight-notes`
- Branch: `feat/piano-guide-mvp-pr17c-lesson-card`
- Chain: ... -> PR 17b -> **PR 17c (this)** -> PR 17d
- Start: chords and `highlightNotes` exist; nothing shows a lesson. End: `createLessonCard` renders a lesson from song data and is covered by node tests. Not yet in the player, so task 17.4 stays open until PR 17d.
- Out of scope: the Cancer lesson text and the player wiring (PR 17d).

## Summary

- `src/ui/lesson-card.js`: sections Overview, Chords, Hands, How to sit, Practice plan, Arrangement and Interpretation (when present), Analysis (only when Analysis is on and the level has entries), Sources, Confidence. One-line headings; all text through `el()` text nodes.
- Chord chips are buttons: a click outlines the chord keys through `onHighlight(midis)` (octave 3), shows its notes (and the bass of a slash chord) and a second click clears; an unknown symbol is a plain chip with no button and no error. A level change or `dispose()` clears an active outline.
- Sources become links only for `https:` (`safeHttpsUrl`); `javascript:`, `data:`, `http:` and garbage stay plain text. Lower-confidence chord entries are labelled in the Chords section and every confidence entry carries its label.
- A level without lesson shows "No lesson for this level yet". The card has no transitions or animations, so it already swaps instantly under reduced motion.
- `styles/app.css`: card layout (responsive columns), chips and the lower-confidence color.

## Dependency diagram

```
... -> PR 17b -> [PR 17c, this PR] -> PR 17d -> PR 18a
```

## Checks

- `node --test tests/ui/lesson-card.test.js`: 14 pass, 0 fail. Full suite: 607 pass, 0 fail.
- Counter-proofs by mutation: letting any URL scheme through fails 2 tests (https link and javascript: text); making the second chip click re-send the notes fails 1.
- Runtime harness: the card runs under a small fake DOM here; the real browser check comes with the wiring in PR 17d.

## Rollback

Remove `src/ui/lesson-card.js`, its suite and the card CSS block; nothing imports them yet.
