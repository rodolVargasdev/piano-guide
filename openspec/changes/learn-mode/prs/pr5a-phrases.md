# PR 5a: Phrases and a translator that renders in either language

Branch: `feat/learn-mode-pr5a-phrases`. Base: `feat/learn-mode-pr4a2-fingering`. Tasks: 5.1, 5.4. Specs: learn-mode (phrases derived from song data), learner-language (templates).

## Chain context

```
feat/learn-mode-pr4a2-fingering
  ^
feat/learn-mode-pr5a-phrases            📍 this PR
  ^
feat/learn-mode-pr5a2-steps-instructions (next)
```

- Start: fingering exists. End: a level can be cut into phrases, and the translator can render a key in an explicit language.
- Follow-up: pr5a2 (steps and instructions use both).
- Out of scope: steps, instructions, any UI.

## Why the original PR 5a was split

Phase 5 measured about 500 authored lines, over the budget. The cut is at a coherent boundary: phrases (this PR) and steps plus instructions (pr5a2).

## What changes

- `src/learn/phrases.js` (new): `derivePhrases(timeline)`. Authored `learn.phrases` win unchanged (with `title` and `hint`). Otherwise a phrase is about two bars (a pickup belongs to the first phrase). It ends at a rest when a silence of at least an eighth note starts within half a bar of the two-bar mark; the next phrase begins at the first note after the rest. The silence is computed over both hands, so a pause in one hand is not a rest while the other hand sounds. A phrase with no onset is dropped (trailing silence), and the result is never empty.
- `src/i18n/i18n.js`: `t(key, params, lang)` takes an optional third argument. An unsupported language uses the current one; a missing value still falls back to English. The current language is untouched. Needed so one translator renders both languages (the instruction limit guard in pr5a2).
- `src/i18n/strings.js`: `step.fingerOn` ("{finger} on {note}") for the hands-together instruction (task 5.4, the other `step.*` keys already existed from pr3a2).
- `tests/fixtures/learn-songs.js` (new): `learnSong({ notes, bars, pickupTicks, learn })` builds a valid synthetic public song (plain scales, no real melody) plus its resolved timeline. The task text names `tests/fixtures/learn-*.json`; code fixtures were used because the notes are generated from a few lines instead of repeated as JSON.
- `tests/learn/phrases.test.js` (new, 8 tests) and one test in `tests/i18n/i18n.test.js`.

## Counter-proofs

- A rest far from the two-bar mark, and a silence shorter than an eighth, each leave the cut at two bars (the same fixtures with a qualifying rest do cut).
- A silence in one hand while the other sounds does not cut.
- The fixtures themselves are checked with `validateSong`, so the tests run over valid data.
- An unsupported language in `t` falls back to the current language.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/learn/phrases.test.js tests/i18n/*.test.js`: 38 tests, 38 pass |
| Full suite | `node --test`: 1013 tests, 1013 pass, 0 fail |
| Runtime harness | N/A: pure module, no user-visible surface in this PR (the local-song harness runs in pr5a2) |
| Rollback boundary | `src/learn/phrases.js`, its test and fixture; the `t` third argument and `step.fingerOn` |

## Review budget

187 authored changed lines including tests (source about 80, tests and fixture about 107), plus this description.
