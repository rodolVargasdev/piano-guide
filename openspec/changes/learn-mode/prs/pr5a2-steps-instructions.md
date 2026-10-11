# PR 5a2: Steps and instructions

Branch: `feat/learn-mode-pr5a2-steps-instructions`. Base: `feat/learn-mode-pr5a-phrases`. Tasks: 5.2, 5.3, 5.5. Specs: learn-mode (steps, one instruction at a time), learner-language (templates).

## Chain context

```
feat/learn-mode-pr5a-phrases
  ^
feat/learn-mode-pr5a2-steps-instructions 📍 this PR
  ^
feat/learn-mode-pr6a-matcher (next)
```

- Start: phrases and the explicit-language translator exist. End: a phrase and a hand give steps with keys, fingers, positions, shifts and a language-neutral instruction that renders in English and Spanish.
- Follow-up: pr6a (matcher), pr6a2 onward (lesson reducer and progress).
- Out of scope: any UI, the lesson reducer.

## What changes

- `src/learn/steps.js` (new): `deriveSteps(timeline, phrase, hand, { key })`. One step per onset group of the hand inside the phrase, keys lowest first. Ties produce one step (continuations are absorbed with the existing `mergeTies`), rests and grace notes produce none, a hand with no notes gives `[]`. Fingers, position and shift come from `assignFingering`. A group no hand can span (`unplayable`) is split into consecutive single-note steps, lowest first, and the whole line is fingered again, so every step has fingers 1 to 5. Authored fingers pass through.
- `src/learn/instructions.js` (new): `instructionFor(step, prevStep)` gives `{ key, params }` (language-neutral); `renderInstruction(t, instr, lang)` composes at most two sentences: sentence 1 names the hand, the finger and the note (or the move), sentence 2 is the key count or, after a single-note move, the first finger to play. The note renders "E (Mi)" in English and "Mi (E)" in Spanish with the written spelling (E# stays E#). Hands together (`hand: "T"`, used from Milestone B) use `step.both` with `step.fingerOn`.
- Tests: `tests/learn/steps.test.js` (11), `tests/learn/instructions.test.js` (11).

## Counter-proofs

- No move on the first step of a phrase, and none when the anchor equals the previous step's, and none when the shift flag is off while the anchor differs.
- Without the tie, the repeated note is a step of its own (same fixture).
- A one-key step never mentions keys; a chord after a move keeps two sentences.
- The limit enumeration (every hand, finger, count 1 to 5, move or not, both languages) passes on the real table, and the same enumeration flags a table whose template adds a third sentence.

## Decision to confirm

Sentence 2 of a chord after a move is the key count, not the first finger (the design allows one or the other; the count is the one the spec requires for chords). The finger and note named in a chord instruction are those of its lowest key.

## Runtime harness (task 5.5)

Throwaway script in the scratchpad (not committed) on the local private file, in its own key (E major) and transposed to C. COUNTS ONLY are recorded, no melody:

| Item | Observed |
|---|---|
| Phrases | 14 in both keys; the first two are left-hand intro phrases with no right-hand note, so the first phrase with a melody is phrase 3 |
| Right-hand steps per phrase | 0, 0, 11, 14, 11, 11, 11, 5, 13, 1, 10, 10, 13, 5 (same in both keys) |
| Left-hand steps per phrase | 5, 5, 4, 2, 6, 2, 4, 2, 4, 1, 2, 5, 2, 4 |
| Phrase 3, right hand | 11 steps, every finger 1 to 5, 1 shift (1 move instruction), no chord, longest instruction 2 sentences and 14 words (13 in C) |
| Phrase 3, left hand | 4 steps, fingers 1 to 5, no shift, 1 sentence, 7 words |
| Placeholders left unrendered | none, in both languages |
| `silent` | `true` in both keys (the private song stays silent) |

For the by-hand review (risk table): the automatic cuts give uneven phrases (1 to 14 right-hand steps, one phrase of a single step). Authoring `learn.phrases` for the private song would even them out; the shift and the finger choices should be read on screen once pr11a lands, because the pitches are not recorded here.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/learn`: 30 tests, 30 pass |
| Full suite | `node --test`: 1035 tests, 1035 pass, 0 fail |
| Runtime harness | scratchpad script above on the local private file: no unrendered placeholder, all fingers 1 to 5, instructions within 2 sentences |
| Rollback boundary | `src/learn/steps.js`, `src/learn/instructions.js` and their tests |

## Review budget

320 authored changed lines including tests (source 108, tests 212), plus this description.
