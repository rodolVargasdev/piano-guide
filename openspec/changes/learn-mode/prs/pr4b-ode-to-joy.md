# PR 4b: Ode to Joy, public domain, beginner level in C major

Branch: `feat/learn-mode-pr4b-ode-to-joy`. Base: `feat/learn-mode-pr2b3-stage-view`. Tasks: 16.1 to 16.6. Specs: song-data-model (transcribed provenance), song-catalog. The public catalog is NOT changed here (`songs/index.json` is untouched; pr6b swaps it).

## Chain context

```
feat/learn-mode-pr2b3-stage-view
  ^
feat/learn-mode-pr4b-ode-to-joy              this PR
  ^
feat/learn-mode-pr5b-test-migration
```

## Source record (task 16.1, measured by reading the file myself on 2026-10-11)

| Field | Value |
|---|---|
| Piece page | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528 |
| File | https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode.ly (LilyPond, `text/x-lilypond`, 2907 bytes) |
| Mutopia id | `Mutopia-2009/08/05-528`, last updated 2009/Aug/05, typeset with LilyPond 2.12 |
| Composer, typesetter | L. V. Beethoven (1770 to 1827); typeset by Peter Chubb |
| License | Public Domain. The page says "Copyright: Public Domain" and the file footer says the sheet music "has been placed in the public domain by the typesetter" (http://creativecommons.org/licenses/publicdomain) |
| SHA-256 of the exact file read | `a0c865aa9f71221605362622d281405071e0734540e86ce131131757cc803a71` |
| SHA-256 of the piece page HTML read (5675 bytes, for the record only) | `858fa8d6ba0868eab2cff036e9d69599d2781227f90083e311ecca5fd9f41857` |
| Access date | 2026-10-11 |
| Content | `\key g \major`, `\time 4/4`, `\tempo 4=100`, 16 bars, four voices (SATB); the soprano is `sop = \transpose c c' { ... }` |

The snapshot of the file stays outside the repository (scratchpad). It qualifies under the rule of task 16.1 (Mutopia, "Public Domain"). Nothing was written from memory: the melody was read from the file by a script (`\transpose c c'` raises every note one octave, so the first soprano pitches are B4 B4 C5 D5 D5 C5 B4 A4, which matches the first pitches the orchestrator measured).

## What changes

- `tests/fixtures/mutopia-ode-to-joy-onsets.json`: the soprano as `tick:pitch:duration` (62 notes, 16 bars), with the source record above, the byte count and the SHA-256.
- `songs/ode-to-joy.json`: the right hand is the soprano moved down a perfect fifth (G major to C major: four letter names and seven semitones, `transposeInterval(pitch, -4, -7)`), recorded in the `what` of the source, so the tune sits on the white keys C4 to G4; one note, bar 12, goes down to G3 exactly as the source does. `transcribed: true`, level `beginner` only, `defaultLevel: "beginner"`, tempo 100 (the source's 4=100), eight authored two-bar phrases (7 to 9 steps each) with a one-sentence hint in English and Spanish, bilingual summary, posture, label and description. The left hand is NOT from the source: an editorial arrangement of one whole note per bar, C3 or G2 (a second source of kind `original-arrangement` says so, and the confidence entry for it is `low`). One chord per bar (C or G) matches those roots.
- `songs/LICENSE-ode-to-joy.md`: the source, license, SHA-256, what was taken, what was changed.
- `tests/songs-ode.test.js` (11 tests), see the counter-proofs.
- Small fix found in the walkthrough, `src/learn/instructions.js` and `src/i18n/strings.js` (see below).

### Decisions where the task text left room

- Eight phrases of two bars instead of four of four: a four-bar phrase has 15 or 16 steps, which is what the learner complained about ("not didactic"); two bars is 7 to 9 steps (the automatic limit is 8; authored phrases are never split, and bars 9 and 10 hold 9).
- No `transposeTo`: the song is already in C. The original key (G major) could be offered later as a transposition target.
- Original-arrangement source URL: the schema requires a URL for every source, so it points at the same Mutopia page and says in words that the left hand is not from it.

## Fix found in the browser

At the jump down to G3 the screen said "Move the right hand: thumb on G (Sol). Then thumb on G (Sol)." (the same sentence twice). When the key to press is the very key the thumb moves to, the second sentence is now "Then press that key." ("Luego, presione esa tecla."); another key still says "Then middle finger on B (Si)." Counter-proof test for the other case, English and Spanish.

## Counter-proofs

- The right hand is compared note by note with the fixture moved by the recorded interval; a copy with one changed pitch, one moved onset, the wrong interval (a fourth) or a missing note fails (4 assertions).
- Provenance fields are complete and the SHA-256 in the song equals the one in the fixture; the left hand is declared editorial with `low` confidence.
- No `lyrics` key and none of the poem's German words anywhere in the song or the fixture.
- Every text exists in English and Spanish with plain punctuation and no voseo.

## Beginner walkthrough (headless Chrome, real GPU flags, port 8790, a temporary local index entry that is NOT committed and was reverted with `git checkout songs/index.json`)

At 1440 x 900, 844 x 390 and 390 x 844, English (and Spanish at 1440). Screenshots `lmB-od-*` were opened and read:

- Catalog lists Ode to Joy with Learn and Play along. Learn: "Phrase 1 of 8." / "Right hand, slowly. It climbs to G and walks back down." with Listen and My turn.
- Listen lights one key at a time (the sounding key is solid amber, no badge), then My turn starts by itself: "Right hand: index finger on E (Mi)." with a circled 2 on E (the first phrase spans D to G, so the thumb rests on D).
- A wrong key: "Try again / Use the shaded key." and the shaded key stays. The right-hand stage ends with "Correct. Stage done: Right hand." / "Now the left hand, slowly." The left hand: "Left hand: little finger on C (Do)." Both hands: an `L5` square and an `R2` circle at once.
- Phrase 6, step 8: "Move the right hand: thumb on G (Sol). Then press that key." (and in Spanish "Mueva la mano derecha: pulgar en Sol (G). Luego, presione esa tecla.").
- Console clean at the three sizes (no error, no warning).

Observed and left alone: in landscape the finger badge of a white key in a both-hands step ("R2") is partly covered by the computer-key letter box of the same key (the key is short there). The finger number is still readable but half hidden; it needs a layout decision for the 844 x 390 case.

Not verified here (user-only): hearing Listen (no audio output was listened to), the piano voice (synth only; the sampled piano is not part of this chain yet).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/songs-ode.test.js tests/learn/instructions.test.js tests/learn/steps.test.js`: all pass |
| Full suite | `node --test`: 1344 tests, 1344 pass, 0 fail |
| Runtime harness | the headless Chrome walkthrough above |
| Rollback boundary | `songs/ode-to-joy.json`, `songs/LICENSE-ode-to-joy.md`, the fixture and `tests/songs-ode.test.js`; separately the one-sentence fix in `instructions.js`, `strings.js` and its tests |

## Review budget

537 authored changed lines including tests and the data file (the song JSON is 311 lines, one note per line), plus this description. A data file with a source record: the split would separate the song from the test that proves it, so `size:exception` is recommended.
