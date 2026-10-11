# PR 3a2: String catalog, language selector, lesson card

Branch: `feat/learn-mode-pr3a2-i18n-strings`. Base: `feat/learn-mode-pr3a-i18n`. Tasks: 3.3, 3.4, 3.5, 3.6. Specs: learner-language (every string exists in both languages, instruction templates, names of music terms, Spanish typography, language selector), song-data-model (localized text values shown with English fallback).

## Chain context

```
feat/learn-mode-pr3a-i18n
  ^
feat/learn-mode-pr3a2-i18n-strings      📍 this PR
  ^
feat/learn-mode-pr4a-transpose-fingering
  ^
feat/learn-mode-pr4a2-fingering
```

- Start: translator and guards (pr3a). End: the Milestone A catalog exists and passes every guard, the selector component exists, the lesson card reads LocalizedText.
- Follow-up: pr4a (transposition).
- Out of scope: wiring the selector into a view (catalog in pr10a, Learn in pr11a), instruction rendering (pr5a), the Milestone B and C keys (`lz.*`, `stage.*`, `ex.*`, `interval.*`, `quality.*`, `routine.*`).

## What changes

- `src/i18n/strings.js` (new): about 100 keys: `common.*`, `lang.*`, `hand.*`, `finger.*`, `note.*` (fixed-do, `note.display` puts the letter first in English and the solfege first in Spanish), `key.major`, `keyboard.label`, `step.*` templates, `input.*` (chips, the aligned MIDI lines), `catalog.*`, `learn.*`.
- `tests/i18n/strings.test.js` (new, 8 tests): all four guards on the real table; the same guards flag a copy with one defect of each kind; plural pairs complete; the required pairs exist; the aligned MIDI texts equal the spec text; `instructionLimits` over a composition of the step templates for every hand, finger, count and move in both languages; the English and Spanish spec examples render exactly.
- `src/ui/language-select.js` (new) and `styles/app.css`: two buttons "English" and "Español" in a labelled group, the current one pressed, `setLang` on click, follows changes made elsewhere, 36 px minimum height. `tests/ui/language-select.test.js` (6 tests) uses `tests/score/fake-dom.js`.
- `src/ui/lesson-card.js`: `textOf(value, lang)` for summary, posture and analysis title and text; new `lang` option and `setLang`. `tests/ui/lesson-card.test.js`: 4 added tests.

## Deviations and decisions

- Instruction composition: sentence 1 names the hand, finger and note (or the move); sentence 2 adds the key count when the step has more than one key, otherwise, for a move, the first finger to play. A first version of the length test composed move + then-play + count (three sentences) and the guard rejected it, which is the design A8 guard doing its job. The instruction module in pr5a must follow the same rule.
- Spanish uses "computadora" (Latin American) and the formal imperative; `common.playAlong` is "Tocar junto a la canción".
- A language change redraws the lesson card and so clears an outlined chord; the Learn lesson state itself is unaffected (it lives in the reducer, pr6a).

## Browser check (task 3.6)

Deferred, as the task allows: the selector is not wired into a view yet, so there is no page to open. It is checked in a browser in pr10a (catalog) and pr11a (Learn). The selector logic, persistence and the document language attribute are covered by node tests with a fake DOM.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/i18n tests/ui/lesson-card.test.js tests/ui/language-select.test.js`: all pass |
| Full suite | `node --test`: 946 tests, 946 pass, 0 fail (`tests/csp.test.js` included: `index.html` untouched) |
| Runtime harness | N/A for now, see the browser check note |
| Rollback boundary | `src/i18n/strings.js`, `src/ui/language-select.js`, the `.language-select` CSS block, the `lang` and `setLang` additions in `src/ui/lesson-card.js`, and their tests |

## Review budget

189 (catalog and its test) + 125 (selector) + 69 (lesson card) = 383 authored changed lines including tests, plus this description.
