# PR 10a: Catalog with the private library and Learn actions

Branch: `feat/learn-mode-pr10a-catalog-private`. Base: `feat/learn-mode-pr9a3-keyboard-styles`. Task: 10.1. Specs: private-song-library (runtime-optional library), song-catalog (cards, Learn gating).

## Chain context

```
feat/learn-mode-pr9a3-keyboard-styles
  ^
feat/learn-mode-pr10a-catalog-private   this PR
  ^
feat/learn-mode-pr10a2-router-player (next)
```

- Start: the catalog lists only `songs/index.json` and opens every song with "Open". End: it also merges the local private library and offers "Learn" and "Play along" on each card.
- Follow-up: pr10a2 (router, header language selector wiring, "Play (no sound)"), pr10a3 (dev server).
- Out of scope: the Practice link (hidden: its route lands in pr6c, so no dead link ships).

## What changes

- `src/ui/catalog.js`:
  - `fetchJsonOrAbsent(url, fetchFn)`: absent for a network failure, a non-2xx answer or a non-JSON content type; invalid for a JSON body that does not parse; ok otherwise. Never throws.
  - `loadCatalog(fetchJson, { fetchPrivate })`: the public entries, then the private ones (`private: true`). Absent private index: no message and the result keeps its old shape. Invalid or not an index: `privateNotice: true`. Unavailable entries carry a `reasonKey` for the translated reason: id used by a public song, file not marked private, index and file disagree on visibility (`visibilityMismatch`), a public file marked private. A missing private song file only marks its own entry. With only `fetchJson` injected there is no private lookup (the existing tests are untouched).
  - `canLearn(song)`: some level has a pitched note; the card omits "Learn" otherwise.
  - Cards: "Learn" (`#/learn/<id>`) and "Play along" (`#/song/<id>`), the "Private" chip, a line "The app does not play this song. It only tells you what to play." on private cards and "Play along (no sound)" there. The hero says what the app is for ("Learn a song, one key at a time"). Everything goes through the translator, in English and Spanish, and the catalog redraws on a language change.
- `src/i18n/strings.js`: catalog, hero, level and plural keys (plus `common.play` and `common.playNoSound` used by pr10a2).
- `tests/ui/catalog-private.test.js` (new, 16 tests).

## Counter-proofs

- 404, network error and HTML 200 are all absent; a JSON body that does not parse is invalid.
- A private id equal to a public id is unavailable and the public song is untouched; a different private id beside it is available.
- Agreeing visibility is available, disagreeing is unavailable (both private-entry and public-entry directions); a public file declaring private is unavailable even when the index says nothing.
- A song whose levels have no pitched note gets no "Learn"; a private card never mentions Listen.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/catalog-private.test.js tests/ui/catalog.test.js "tests/i18n/*.test.js"`: 57 tests, 57 pass |
| Full suite | `node --test`: 1199 tests, 1199 pass, 0 fail |
| Runtime harness | Browser 8790 with the local private library (see pr10a2: the catalog, with and without `NO_PRIVATE=1`) |
| Rollback boundary | `src/ui/catalog.js`, the new keys in `src/i18n/strings.js`, `tests/ui/catalog-private.test.js` |

## Review budget

376 authored changed lines including tests (source 211, tests 165), plus this description.
