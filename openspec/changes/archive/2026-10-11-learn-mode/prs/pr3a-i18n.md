# PR 3a: Translator and string guards

Branch: `feat/learn-mode-pr3a-i18n`. Base: `feat/learn-mode-pr2a4-import-cli`. Tasks: 3.1, 3.2. Specs: learner-language (language selector remembered, every string exists in both languages, instruction templates, Spanish text typography). The string catalog and the selector are split to pr3a2 to stay inside the review budget.

## Chain context

```
feat/learn-mode-pr2a4-import-cli
  ^
feat/learn-mode-pr3a-i18n               📍 this PR
  ^
feat/learn-mode-pr3a2-i18n-strings
  ^
feat/learn-mode-pr4a-transpose-fingering
  ^
feat/learn-mode-pr4a2-fingering
```

- Start: converter work done. End: `createI18n` and the pure guards exist and are tested on fixture tables.
- Follow-up: pr3a2 (the Milestone A catalog, the selector, lesson-card).
- Out of scope: the real string table, any DOM.

## What changes

- `src/i18n/i18n.js` (new): `pickLanguage` (saved wins, `es*` gives Spanish, else English), `format`, `createI18n` with `t` (plural keys `_one` and `_other` selected by `params.count`, English fallback, never a raw key: an unknown key returns an empty string and warns), `lang`, `setLang` (saves `piano-guide:lang`, swallows storage errors, sets `document.documentElement.lang`, ignores invalid values), `onChange` (synchronous, only on a real change).
- `src/i18n/guards.js` (new): `missingTranslations`, `placeholderMismatches`, `forbiddenTypography`, `voseoForms`, `instructionLimits(render)` plus `countSentences` and `countWords`.
- `tests/i18n/i18n.test.js` (11 tests) and `tests/i18n/guards.test.js` (10 tests): each guard has a clean table that passes and a fixture with one defect that it must flag (counter-proof); `es-SV` gives Spanish; a saved choice wins; blocked storage; fallback; plural forms; synchronous change.

## Deviations and decisions

- `createI18n` takes the table as a parameter (default empty) instead of importing the catalog, because the catalog arrives in pr3a2 and the same function then serves tests with fixture tables.
- The voseo list is the design list plus five more forms (`pulsá`, `apretá`, `usá`, `elegí`, `seleccioná`); whole-word matching with Unicode letter boundaries, so `avos` and `académica` are not flagged (asserted).
- The forbidden characters are built from code points with `String.fromCodePoint`, so the guard source and its tests are themselves free of them.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/i18n`: 21 tests, 21 pass |
| Full suite | `node --test`: 928 tests, 928 pass, 0 fail |
| Runtime harness | N/A: pure modules; the selector that exercises them in a browser arrives in pr3a2 and is shown in a view in pr10a and pr11a |
| Rollback boundary | `src/i18n/i18n.js`, `src/i18n/guards.js` and `tests/i18n/` |

## Review budget

About 390 authored changed lines including tests, plus this description.
