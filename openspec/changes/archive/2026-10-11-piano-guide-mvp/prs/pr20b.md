# PR 20b: lesson card ornaments section

- Base branch: `feat/piano-guide-mvp-pr20a-chopin-beginner`
- Branch: `feat/piano-guide-mvp-pr20b-chopin-lesson-card`
- Chain: ... -> PR 20a -> **PR 20b (this)** -> PR 20c
- Start: the lesson card cannot list ornaments, which `specs/lesson-guide/spec.md` requires for the Nocturne (each ornament with its bar). End: a lesson may carry `ornaments[{ tick, name, text }]` and the card shows an Ornaments section with the bar of each. This is a small design extension (the lesson shape gains one optional field), recorded in `design.md`.
- Out of scope: the Nocturne chords, analysis and lessons that use it (PR 20c).

## Summary

- `src/core/schema.js`: `lesson.<level>.ornaments`, when present, must be an array of `{ tick (integer >= 0), name, text }`; a malformed list is an R1 error with its path.
- `src/ui/lesson-card.js`: a section "Ornaments" after Interpretation, one line per entry, `Bar N, <name>: <text>` (the pickup reads "Pickup"); no section without entries.
- Tests: three malformed cases in the schema table (each with its counter-proof through `disabledRules`) and a well-formed pass; the card test checks the bar labels, the heading order, and that a lesson with no ornaments has no section.
- `design.md` and `README.md`: the lesson shape.

## Dependency diagram

```
... -> PR 20a -> [PR 20b, this PR] -> PR 20c
```

## Checks

- Full suite: 664 pass, 0 fail.
- Not checked here: the card in the browser with real Nocturne text (PR 20c).

## Rollback

Revert the `ornaments` check in `schema.js`, the one line in `lesson-card.js` and their tests.
