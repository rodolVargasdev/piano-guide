# PR 3: Schema validator

- Base branch: `feat/piano-guide-mvp-pr2-core-timing-pitch`
- Branch: `feat/piano-guide-mvp-pr3-schema-validator`
- Chain: tracker -> PR 1 -> PR 2 -> **PR 3 (this)** -> PR 4

## Summary

Adds the pure `src/core/schema.js` with `validateSong` and `validateIndex` (result shape `{ ok, errors: [{ path, message, rule }], warnings }`), the valid fixture `tests/fixtures/valid-song.json`, the mutation helper `tests/fixtures/helpers.js` and `tests/core/schema.test.js`.

Rules R1 to R11 follow `design.md` (required fields and types, levels, sources, confidence, transcribed provenance with exact host match, chords-only copyright guard with recursive `lyrics` scan, event bounds and fingering, overlaps, `strictBars` coverage, sections and chords). Index rules I1 and I2. Warnings W1 (duration outside the notation subset), W2 (key signature beyond 4 accidentals), W3 (level without lesson).

Design notes:
- `options.disabledRules` silences one rule. It exists so every malformed case has an automated counter-proof: with its rule disabled the same input must pass, and with an unrelated rule disabled it must still fail.
- The `lyrics` scan treats any non-empty text under a `lyrics` key (string, array or object) as lyrics, which is stricter than the spec's "string".
- `validateIndex` also requires `file` to be exactly `<id>.json` with no path (blocks `../` in the catalog fetch).

## Size

About 774 authored lines (schema 391, tests 317, fixtures 66), against the 400-line advisory and the 380 estimate. The validator and its rule-by-rule suite form one cohesive unit and were not split or compressed. Recommendation: `size:exception` for this PR, or accept as is.

## Checks run

- `node --test tests/core/schema.test.js`: 168 pass. Full `node --test`: 231 pass, 0 fail.
- Manual mutation: replacing the exact host match with `includes` and disabling the lyrics scan makes 9 tests fail; restored afterwards.
- `docker build -t piano-guide .` succeeds (the suite runs inside the image).

## Rollback

Remove `src/core/schema.js`, `tests/core/schema.test.js` and `tests/fixtures/`.
