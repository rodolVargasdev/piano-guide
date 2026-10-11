# PR 15b: Level selector, names, Analysis and view controls

- Base branch: `feat/piano-guide-mvp-pr15a-level-resolution`
- Branch: `feat/piano-guide-mvp-pr15b-level-select-ui`
- Chain: tracker -> ... -> PR 15a -> **PR 15b (this)** -> PR 16
- Start: the pure level rules exist and the player opens one level. End: the player has a selector under the title and switches level without losing the musical position. Tasks 15.2 and 15.3 are checked here. Last PR of this batch (PR 13 to 15).
- Out of scope: the practice panel (PR 16), the lesson card and its analysis section (PR 17), the real second Cancer level (PR 18).

## Summary

- `src/ui/level-select.js`: `controlsFor` (names only on the labelled notation, Analysis only when the level has entries) and `createLevelSelect`: a button per level present (a single level is a static chip), the names toggle (`Do Re Mi` or `C D E`), the Analysis toggle and the View control (`Both`, `Keyboard`, `Score`). Each control calls its callback and redraws at once.
- `src/ui/player.js`: `switchLevel` maps the position by bar and beat (`mapPosition`), calls `engine.setTimeline(next, { tick })` (which keeps BPM, loop, metronome and hand state and, while playing, drops pending voices and schedules the new notes from that tick in the same call), then `scene.setTimeline` and `score.setTimeline`; remembers the level for the session and rewrites the hash with `history.replaceState` (no new history entry). `names`, `view` and `level` from the hash are applied at mount. The View control sets `data-view` on the stage (the other slot is hidden and not drawn); a scene that finishes loading after a level switch is brought to the current level. `pickLevel` is now `resolveLevelId`, so its old tests still apply.
- `styles/app.css`: the selector sits in the player head; single-view layouts use the whole stage width (in phone landscape too, 12rem tall).
- `README.md`: the route row and a "Levels and view" section.

## Dependency diagram

```
... -> PR 15a -> [PR 15b, this PR] -> PR 16 -> PR 17
```

## Size

67 lines of selector, 74 of player, 46 of CSS, 96 of tests, 10 of the fake DOM, 8 of README, 2 task lines and this description: about 330 authored lines.

## Checks (headless Chrome over the DevTools protocol, dev server on port 8790, real GPU ANGLE d3d11, RTX 3050 Laptop; 1440 x 900 and 844 x 390)

- `node --test tests/ui/level-select.test.js`: 15 pass, 0 fail. Full suite: 540 pass, 0 fail. `docker build` succeeds with the suite inside.
- Counter-proofs run: a doubled negation in the Analysis toggle fails 1 test; showing the names toggle on every level fails 1.
- The only real level is Cancer Beginner, so for the multi-level checks a temporary Original level (engraved, with analysis entries) was added to a local copy of `songs/cancer.json` and the file was restored with `git checkout` before committing (it is not in any commit).
- Switch paused at bar 4 beat 1 (BPM 50, metronome on): position, BPM and metronome unchanged, title "Cancer, Original score", names toggle gone, Analysis toggle shown; with Analysis on the score shows the roman numerals (from the entries first, from the chord track otherwise) and 2 callouts, off removes them. The hash became `#/song/cancer?level=original` and the history length did not grow.
- Switch while playing (Beginner to Original and back): the position kept advancing without a jump (6118 to 6154 ticks in about 120 ms at 50 BPM, 400 ticks per second) and the transport stayed in Play. Synchronous cost of the switch 4.7 to 20 ms across runs and sizes (engine, scene rebuild and score rebuild). The audible gap was NOT measured by listening, so the "under 250 ms" budget is bounded by this main-thread cost only.
- Session memory: choose Original, leave the song and come back: Original opens. Deep link `#/song/cancer?level=beginner&names=letters&view=score`: Beginner, letters in the noteheads (E, E, G#, B), View "Score" pressed, the scene slot hidden, the score 468 px tall at 1440 x 900 and 192 px at 844 x 390; choosing Both brings the scene back with its canvas and writes `view=both` to the hash.
- Phone landscape: moving the selector into the player head keeps the whole transport on screen at 844 x 390.
- Screenshots read: `15-both-beginner`, `15-both-original`, `15-original-analysis`, `15-deeplink-score` at 1440 x 900 and 844 x 390.
- Not checked: sound at the switch, a real phone, a second real level (PR 18 and PR 19), and the lesson card's analysis section (PR 17).

## Rollback

Revert `src/ui/player.js`, the selector part of `src/ui/level-select.js`, the CSS block and the README section; the pure rules of PR 15a stay.
