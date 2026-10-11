# PR 6c6: The circle of fifths as a key picker

Branch: `feat/learn-mode-pr6c6-circle-of-fifths`. Base: `feat/learn-mode-pr6c5-practice-run-page`. Tasks: part of 24.1 and 24.2 (key rotation around the circle of fifths). Specs: practice-exercises (key rotation; scale order suggested, not enforced). A self-contained component; the page uses it in pr6c7.

## Chain context

```
feat/learn-mode-pr6c5-practice-run-page
  ^
feat/learn-mode-pr6c6-circle-of-fifths       this PR (📍)
  ^
feat/learn-mode-pr6c7-practice-tempo-keys
```

## What changes

- `src/ui/circle-of-fifths.js`: `createCircleOfFifths({ i18n, onPick })` draws twelve buttons around a circle, C at the top and a fifth further for each step clockwise (C G D A E B F# Db Ab Eb Bb F). `set({ current, done, next })` marks the selected key (pressed), the keys already practiced (a green ring) and the keys suggested next (a dashed outline); the middle says "G major". None of it relies on color alone: the ring and the dashed outline are shapes, and every button says its state in words for a screen reader and in its tooltip ("G major, selected, practiced", "F major, suggested next"). The labels follow the language at once. The positions come from CSS classes `cof-pos-0` to `cof-pos-11`, because the page CSP forbids inline styles (the CSS itself lands with the page in pr6c7).
- `src/i18n/strings.js`: the four state words and the group label, English and Spanish.

## Tests and counter-proofs

`tests/ui/circle-of-fifths.test.js` (6): the twelve keys in the order of fifths with the middle label, tapping picks a key, the states and their spoken labels (and that the selected key is not also "suggested"), Spanish labels switching with the language, counter-proof that with nothing marked no key claims a state, and a disposed circle ignoring a language change. The check that every position has a CSS rule and no more than twelve exist is in pr6c7 with the CSS. Mutation check: marking the selected key as suggested too makes the suite fail (1).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/circle-of-fifths.test.js`: 6 pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | the headless Chrome walkthrough of pr6c7 uses it at three viewports |
| Rollback boundary | `src/ui/circle-of-fifths.js`, its test and the five strings |
