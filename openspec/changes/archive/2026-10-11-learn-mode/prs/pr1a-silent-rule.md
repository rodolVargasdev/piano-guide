# PR 1a: Silent rule and schema additions

Branch: `feat/learn-mode-pr1a-silent-rule`. Base: `feat/learn-mode` (tracker). Tasks: 1.1 to 1.5. Specs: song-data-model (visibility, LocalizedText, learn block), playback-engine (private refusal).

## Chain context

```
master
  ^
feat/learn-mode (tracker, draft, no merge)
  ^
feat/learn-mode-pr1a-silent-rule      📍 this PR
  ^
feat/learn-mode-pr1a2-privacy-guards
  ^
feat/learn-mode-pr2a-converter ... pr4a
```

- Start: tracker branch with planning artifacts only.
- End: a private song is silent in the engine, and the schema knows `visibility`, `LocalizedText` and the `learn` block.
- Follow-up: pr1a2 (privacy guards and the index visibility test, tasks 1.6 and 1.7), then pr2a (converter).
- Out of scope: any UI, the converter, privacy guard tests (pr1a2), range playback and held notes (pr7a).

## What changes

- `src/core/visibility.js` (new): `visibilityOf`, `isSilent`. There is no stored silent field.
- `src/core/text.js` (new): `isLocalizedText`, `textOf` with English fallback.
- `src/core/schema.js`: rules R12 (visibility), R13 (LocalizedText), R14 (learn block), R5 extension (private user-submitted cannot be transcribed), index `visibility`, `visibilityMismatch(entry, song)`.
- `src/core/timeline.js`: `resolveLevel` stamps `silent` and passes `learn`.
- `src/core/practice.js`: `schedulableNotes` fails closed (only `silent === false` schedules).
- `src/audio/engine.js`: schedules through `schedulableNotes`; `play()` returns `{ silent }`; `isSilent()`.

## Behavior note for reviewers

A timeline built by hand without a `silent` field now schedules nothing. That is the fail-closed rule from the design. One existing test helper (`quarters` in `tests/audio/engine-loop.test.js`) builds such a timeline and now declares `silent: false`; no production timeline is affected because `resolveLevel` always stamps the field.

## Spec scenarios covered

- Public by default; private song is silent; unknown visibility value (song-data-model, visibility).
- Both languages present; Spanish missing; plain string stays valid (localized text).
- Authored phrases validate; overlapping; outside the song; duplicate id; transpose target equals the song key; no learn block (learn block).
- User-submitted private song claims transcription (provenance).
- Cancer never sounds even by mistake; visual-only play keeps moving; public song unaffected; visibility cannot be bypassed by level or range (playback-engine, the phrase-range entry point itself arrives in pr7a).
- Not covered here: "Private flag in the public folder" and "Index and file disagree" (pr1a2).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/core/schema.test.js tests/core/visibility.test.js tests/core/practice.test.js tests/core/timeline.test.js tests/audio/engine-silent.test.js`, all pass |
| Full suite | `node --test` on this branch: 794 tests, 794 pass, 0 fail (baseline before the chain: 741) |
| Counter-proofs | each new schema rule has a `disabledRules` pair; changing `schedulableNotes` to open on anything but `silent === false` makes 2 tests fail (checked by hand, then restored) |
| Runtime harness | N/A: pure and engine-rig tests; the existing public songs still play (full suite green) |
| Rollback boundary | `src/core/{visibility,text}.js`, the schema/timeline/practice additions, the engine edit, the new tests and the one-line `quarters` helper change |

## Review budget

About 430 authored changed lines including tests (additions plus deletions), above the 400 target. It does not shrink cohesively: schema rules and their counter-proofs are about 170 lines, the engine rig tests about 110. Tasks 1.6 and 1.7 were already moved to pr1a2 at the split point named in tasks.md.
