# PR 19a: tied notes sound once

- Base branch: `feat/piano-guide-mvp-pr18b-cancer-analysis`
- Branch: `feat/piano-guide-mvp-pr19a-chopin-tied-notes`
- Chain: ... -> PR 18b -> **PR 19a (this)** -> PR 19b -> PR 19c -> PR 20a -> PR 20b
- Start: a note with `tie: true` and the note that continues it are two separate sounding notes, so the second half is struck again. End: they sound once for both lengths. This is groundwork for task 19.4: the Nocturne ties a dotted-quarter G to an eighth G in bar 1.
- Out of scope: the Chopin data (PR 19b), its verification (PR 19c), Beginner, lesson and analysis (PR 20).

## Summary

- `src/core/practice.js`: new pure `mergeTies(notes)`; `audibleNotes` now returns the merged list. A note with `tie: true` absorbs the next note of the same hand and pitch that starts where it ends (chains too); the input is not mutated. Only the sounding list changes: the score, the falling notes and the active-note queries still see two notes.
- `tests/core/practice.test.js`: pair, chain, dangling flag, and three counter-proofs (no flag, other pitch, other hand).
- `tests/audio/engine.test.js`: through the engine rig, a tied pair makes one `playNote` of 960 ticks, and the same notes without the flag make two.
- `README.md`: one line in "Adding a song".

## Dependency diagram

```
... -> PR 18b -> [PR 19a, this PR] -> PR 19b -> PR 19c -> PR 20a -> PR 20b
```

## Checks

- Full suite: 633 pass, 0 fail.
- Not checked here: listening. The browser check of the tie (oscillator onsets over the Nocturne bar 1) is recorded in PR 19c, where the first tied song exists.

## Rollback

Revert `mergeTies` and the `audibleNotes` line in `src/core/practice.js` with its tests.
