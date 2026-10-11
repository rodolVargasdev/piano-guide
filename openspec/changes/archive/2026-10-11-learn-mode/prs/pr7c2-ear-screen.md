# PR 7c2: What the ear drill page says (screen model)

Branch: `feat/learn-mode-pr7c2-ear-screen`. Base: `feat/learn-mode-pr7c-ear-session`. Tasks: the text half of 25.2. Specs: practice-exercises (ear drills), learner-language. Plain data and strings: no DOM yet.

## Chain context

```
feat/learn-mode-pr7c-ear-session
  ^
feat/learn-mode-pr7c2-ear-screen             this PR (📍)
  ^
feat/learn-mode-pr7c3-ear-page
```

## What changes

- `src/ui/ear-screen.js`: `earModel(state, { i18n })` says, for each moment of an ear drill, the heading, the one-line help, "Question 3 of 10 | Score 2/2", the Correct / Try again chip, the choices and only the actions that make sense now.
  - Before the first Play: "Press Play to hear it." with Play. After: "How far apart are the two notes?" (or "What kind of chord is it?") with "Pick a name, or play it back on the keyboard. Listen again as often as you like." and Listen again.
  - The choices are big buttons: the name in the learner's language and a plain line each ("Major third: Bright and happy (4 semitones)."). A wrong pick is marked with the words "Not this one", the right answer after an answer with "Right answer", so the state never relies on color alone. After a first wrong pick the help says "Listen again and try another." and the right answer is **not** shown; the second wrong pick reveals it ("It was: Perfect fifth.").
  - After an answer: the name and its plain line, "Next question" (or "See the result" on the tenth), and Listen again. At the end of a round: "Round finished: 7/10.", the choice just unlocked ("New choice unlocked: Perfect fourth.") or how to unlock ("Get 8 of 10 right to unlock a new choice.") or "Every choice is unlocked.", and "Another round".
- `src/i18n/strings.js`: 19 strings in both languages (formal Spanish, no voseo).

## Tests and counter-proofs

`tests/ui/ear-screen.test.js` (9): each moment and its actions, the questions for intervals and chords, a first wrong pick (struck, answer hidden), the right answer on the first try (name, plain line, score, tag), the reveal, the question count and the last "See the result", the end of a round with the unlock, a weak round and a fully unlocked vocabulary, Spanish for every part, and a counter-proof that a model before the answer never names the answer in its heading, help or progress and marks no choice. Mutation check: marking the right choice before the question is answered makes 3 tests fail.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/ui/ear-screen.test.js tests/i18n/*.test.js`: all pass |
| Full suite | `node --test`: all pass (count in the batch notes) |
| Runtime harness | N/A: plain data; the page comes in pr7c3 |
| Rollback boundary | `src/ui/ear-screen.js`, its test and the 19 strings |
