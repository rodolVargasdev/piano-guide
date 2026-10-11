# Tasks: Learn mode (a step-by-step piano teacher for people who cannot play)

Change: `learn-mode`. Tracker branch: `feat/learn-mode`. Artifacts read: proposal.md, design.md (amended), specs/* (12 capability specs), openspec/config.yaml.

Conventions used by every task below:

- Test command: `node --test <path>` from the repo root (`C:\Users\JOSE-\localapps_job\piano-guide`). Full gate before closing a PR: `node --test` (all tests) and, for PRs that touch Docker, `docker build -t piano-guide .`.
- Browser check: `$env:PORT=8790; node tools/serve.mjs` (PowerShell). NEVER port 8765. Confirm 8790 is free first. Screenshots are taken on the three reference viewports (1440x900, 844x390 landscape, 390x844 portrait) and READ (opened and inspected), not only captured.
- `strict_tdd: false` (openspec/config.yaml): ordinary functional checks per slice. Where the design lists a threat-matrix or guard case, the failing counter-proof test is written in the same task as the guard (no production code ships without its counter-proof).
- PR branch naming: `feat/learn-mode-prN<letter>-<slug>`, N = PR number inside the milestone, letter = milestone (a, b, c). Each PR branch is based on the previous PR branch; pr1a is based on `feat/learn-mode`.
- All learner-facing text in code, tests and docs follows the project typography rule (no long dashes, curly quotes, ellipsis character, middle dot, arrows) and the no-voseo Spanish rule; `src/i18n/guards.js` enforces it once it exists.
- A path marked `(read-only)` is only read; every other backticked path is an edit target.
- One commit per work unit, with tests and docs alongside, Conventional Commits, no AI attribution.
- Authored-line estimates exclude binary assets (samples, SVG artwork counts as authored) and include tests and PR description.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | about 9,800 authored (Milestone A about 4,700; B about 2,300 plus binary samples excluded; C about 2,800). Range 8,500 to 11,500 |
| 400-line budget risk | High as a whole change; Low to Medium per PR (each PR sized 250 to 450) |
| Chained PRs recommended | Yes |
| Suggested split | A: PR 1a to 12a, then B: PR 1b to 6b, then C: PR 1c to 9c (27 PRs, strictly chained) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Notes on the forecast:

- Chain bases: pr1a base = `feat/learn-mode`; pr2a base = pr1a branch; ... each later PR targets the previous PR branch so each diff shows only its own slice. Only the tracker `feat/learn-mode` merges to `master`, after the user judges each milestone.
- Highest-risk PRs for the 400-line budget: pr6a (matcher + reducer + progress + region), pr11a (Learn view wiring), pr5b (test migration off `songs/cancer.json`, 94 matches in 7 files, must be re-measured), pr6c (practice view). If a slice exceeds about 450 lines during apply, split it at the boundary named in its "Split point" line instead of enlarging it.
- Two STOP gates can block the chain: pr3b (Salamander approval) and pr4b (qualifying public-domain Ode to Joy source). They are independent of each other. If one is pending, sdd-apply may run the unaffected later PRs first only by explicitly re-basing the chain order and recording it in the tracker notes; by default apply stops at the gate.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A1 | Visibility, LocalizedText, learn block, silent rule in timeline and engine, privacy guards | pr1a-silent-rule | `node --test tests/core/schema.test.js tests/core/visibility.test.js tests/audio/engine-silent.test.js tests/privacy.test.js` | N/A: pure and engine-rig tests; existing player still plays public songs (`node --test` full) | schema/timeline/engine/practice edits and new guard tests; existing songs unaffected |
| A2 | Pitch spelling helpers, Hooktheory converter and CLI | pr2a-converter | `node --test tests/core/pitch.test.js tests/import/hooktheory.test.js tests/import/cli.test.js` | `node tools/convert-hooktheory.mjs` on the real private capture, writes `songs-private/cancer-private.json` (local, gitignored) | `src/import/`, `tools/convert-hooktheory.mjs`, pitch additions |
| A3 | Bilingual string catalog, guards, language selector | pr3a-i18n | `node --test tests/i18n` | Browser: language selector toggles and persists across reload | `src/i18n/`, `src/ui/language-select.js` |
| A4 | Transposition and fingering | pr4a-transpose-fingering | `node --test tests/theory/transpose.test.js tests/theory/fingering.test.js` | N/A: pure modules, no user-visible surface yet | `src/theory/transpose.js`, `fingering.js`, `keys.js`, `random.js` |
| A5 | Phrases, steps, instruction templates | pr5a-phrases-steps | `node --test tests/learn/phrases.test.js tests/learn/steps.test.js tests/learn/instructions.test.js` | N/A: pure; a node script prints the first Cancer phrase instructions from the local private file (manual) | `src/learn/phrases.js`, `steps.js`, `instructions.js` |
| A6 | Matcher, lesson reducer, progress store, keyboard region | pr6a-lesson-core | `node --test tests/learn` | N/A: pure reducer driven by action tables | `src/learn/matcher.js`, `lesson.js`, `progress.js`, `region.js` |
| A7 | Engine and synth: held notes, range playback, single notes, ear-drill playback | pr7a-audio-held-range | `node --test tests/audio` | N/A: recording rig; audible check happens in pr11a | `src/audio/engine.js`, `synth.js` additions |
| A8 | Input bus, computer keys, Web MIDI, learner sound | pr8a-note-input | `node --test tests/input` | N/A: fake navigator and event targets; real Casio check in pr11a | `src/input/` |
| A9 | 2D SVG learn keyboard and its styles | pr9a-learn-keyboard | `node --test tests/ui/learn-keyboard.test.js` | Browser: a temporary static harness page is NOT committed; verified inside pr11a. In pr9a use `node --test` only and a DOM-less render snapshot | `src/ui/learn-keyboard.js`, keyboard CSS |
| A10 | Private index merge, catalog actions, router, Play (no sound) | pr10a-catalog-private | `node --test tests/ui/catalog.test.js tests/ui/router.test.js tests/ui/player.test.js` | Browser 8790: catalog with and without `NO_PRIVATE=1` | `src/ui/catalog.js`, `router.js`, `player.js`, `transport.js` edits |
| A11 | Learn view, input panel, wiring, first end-to-end guided phrase | pr11a-learn-view | `node --test tests/ui/learn-view.test.js tests/ui/input-panel.test.js` | Browser 8790: private Cancer first verse phrase in E and C, three viewports, taps and keyboard; Casio check by the user | `src/ui/learn-view.js`, `input-panel.js`, `main.js` lazy view, learn CSS |
| A12 | README, usability protocol, Docker, nginx, serve hardening, docs guards | pr12a-docs-docker | `node --test tests/docs-guard.test.js tests/privacy.test.js tests/csp.test.js` | `docker build -t piano-guide .` and `docker run` with and without the read-only mount | `README.md`, `docs/USABILITY_CHECK.md`, `Dockerfile`, `.dockerignore`, `nginx.conf`, `tools/serve.mjs` |
| B1 | Lesson zero | pr1b-lesson-zero | `node --test tests/learn/lesson-zero.test.js tests/ui/lesson-zero-view.test.js` | Browser 8790: find and press C, Do, five fingers, input page | `src/learn/lesson-zero.js`, view, posture SVG |
| B2 | Stages, tempo, metronome in Learn, resumable stage progress | pr2b-stages | `node --test tests/learn/stages.test.js tests/learn/lesson.test.js tests/learn/progress.test.js` | Browser: stage sequence on Ode-like fixture, reload resumes | `src/learn/stages.js` and reducer/progress edits |
| B3 | Sampled piano (gated) | pr3b-sampled-piano | `node --test tests/audio/sampler.test.js tests/audio/voice.test.js tests/assets-guard.test.js tests/stack-doc.test.js` | Browser: first press loads samples, synth fallback with samples blocked; user judges piano sound | `src/audio/sampler.js`, `voice.js`, `assets/audio/piano/`, MIME rules, stack doc entry |
| B4 | Ode to Joy public-domain transcription (gated) | pr4b-ode-to-joy | `node --test tests/songs.test.js tests/fixtures-ode.test.js` | Browser: Listen then My turn on Ode to Joy | `songs/ode-to-joy.json`, fixture, license file |
| B5 | Synthetic fixture and test migration off `songs/cancer.json` | pr5b-test-migration | `node --test` (full) | N/A: tests only | `tests/fixtures/chords-only-song.json` and migrated tests |
| B6 | Public catalog swap | pr6b-catalog-swap | `node --test tests/songs.test.js tests/ui/catalog.test.js tests/privacy.test.js` | Browser: public catalog shows Chopin and Ode to Joy only; deep link `#/learn/cancer` shows "Song not found" | delete `songs/cancer.json`, `songs/index.json`, README examples |
| C1 | Random, keys, scales, five-finger | pr1c-scales | `node --test tests/theory/random.test.js tests/theory/keys.test.js tests/theory/scales.test.js` | N/A: pure | `src/theory/scales.js`, `keys.js` extensions |
| C2 | Triads, arpeggios, progressions | pr2c-triads-progressions | `node --test tests/theory/triads.test.js tests/theory/progressions.test.js` | N/A: pure | `src/theory/triads.js`, `progressions.js` |
| C3 | Intervals and ear-drill questions | pr3c-intervals-drills | `node --test tests/theory/intervals.test.js tests/theory/drills.test.js` | N/A: pure | `src/theory/intervals.js`, `drills.js` |
| C4 | Runner, metronome timeline, practice progress | pr4c-runner-progress | `node --test tests/practice/runner.test.js tests/practice/progress.test.js tests/core/timeline.test.js` | N/A: pure | `src/practice/runner.js`, `progress.js`, `makeTimeline` |
| C5 | Exercise catalog and bilingual doc cards | pr5c-exercise-catalog | `node --test tests/practice/catalog.test.js tests/i18n` | N/A: data and strings | `src/practice/catalog.js`, `ex.*` strings |
| C6 | Practice view (list, card, run, tempo ramp, key rotation) | pr6c-practice-view | `node --test tests/ui/practice-view.test.js tests/ui/router.test.js` | Browser 8790: C major scale run with fingering shown, tempo ramp, key rotation | `src/ui/practice-view.js`, router and CSS edits |
| C7 | Ear drills | pr7c-ear-drills | `node --test tests/practice/ear.test.js` | Browser: answer an interval drill by button and by play-back | `src/practice/ear.js` and view section |
| C8 | 10-minute routine and daily streak | pr8c-routine | `node --test tests/practice/routine.test.js tests/practice/progress.test.js` | Browser: run routine end to end, reload, progress visible | `src/practice/routine.js`, routine view section |
| C9 | Practice docs, usability T5, user-only verification list | pr9c-practice-docs | `node --test tests/docs-guard.test.js` | N/A: docs | README and `docs/USABILITY_CHECK.md` |

---

# MILESTONE A: teacher core plus private Cancer (silent)

## Phase 1: Silent rule, schema additions and privacy guards (pr1a-silent-rule, base `feat/learn-mode`, about 400 lines)

Specs: song-data-model (visibility, LocalizedText, learn block), playback-engine (private refusal), private-song-library (guards).

- [x] 1.1 Create `src/core/visibility.js` with `visibilityOf(song)` and `isSilent(song)` and `src/core/text.js` with `isLocalizedText(v)` and `textOf(value, lang)` (English fallback). Test: `tests/core/visibility.test.js` (public default, private silent, textOf for string, LocalizedText, missing language falls back to `en`).
- [x] 1.2 Extend `src/core/schema.js`: `visibility` values, LocalizedText accepted for lesson, level and analysis texts, `learn` block validation (phrases sorted, unique ids, inside the song, single-sentence `hint`, `transposeTo` valid and different from the tonic), private `user-submitted` source cannot be `transcribed`, `validateIndex` accepts optional `visibility`, and `visibilityMismatch(entry, song)`. Test: `tests/core/schema.test.js` additions, each new rule with its `disabledRules` counter-proof fixture that fails when the rule is off.
- [x] 1.3 Modify `src/core/timeline.js`: `resolveLevel` stamps `timeline.silent = isSilent(song)` and passes `learn`. Test: `tests/core/timeline.test.js` (public song `silent === false`, private `true`, hand-built timeline without field stays undefined).
- [x] 1.4 Modify `src/core/practice.js`: add `schedulableNotes(timeline, handModes)` that returns `[]` unless `timeline.silent === false` (fail closed). Test: `tests/core/practice.test.js` additions (missing `silent` schedules nothing, counter-proof: `silent: false` schedules the notes).
- [x] 1.5 Modify `src/audio/engine.js` to use `schedulableNotes` in `setTimeline`, `setHandModes`, `sustain`; `play()` returns `{ silent }`; add `isSilent()`. Test: new `tests/audio/engine-silent.test.js` using `tests/audio/engine-rig.js`: private fixture play, loop, seek-and-play and every level record zero `playNote` calls while `position()` still advances; public fixture unchanged. Run the full `node --test` to prove the existing 741 tests still pass.
- [x] 1.6 Create privacy guards `tests/privacy.test.js`: `.gitignore` contains `songs-private/`; no `songs/*.json` declares private; public index `file` values never contain `songs-private/`; tracked paths from `git ls-files -z` (spawned with `spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot })`, `repoRoot` from `import.meta.url`, no shell) never start with `songs-private/`, skipped with a reason when `.git` is absent. Counter-proofs (threat matrix): a fixture path list containing `songs-private/cancer.json` makes the guard fail; the skip path is asserted when `.git` is absent. `.dockerignore` and Dockerfile checks are added in pr12a.
- [x] 1.7 Add `tests/songs.test.js` check: every `songs/index.json` entry declaring `visibility` matches its file via `visibilityMismatch`, with a failing counter-proof fixture pair (entry private, file without visibility).
- [x] 1.8 Verification: `node --test` (full) green. Commit per work unit (schema, silent rule, guards). PR description lists spec scenarios covered.

Split point if over budget: move 1.6 and 1.7 into their own PR.

## Phase 2: Pitch helpers and Hooktheory converter (pr2a-converter, about 450 lines)

Specs: song-import. Real input shape documented in design (Converter rules).

- [x] 2.1 Modify `src/core/pitch.js`: add `MAJOR_STEPS`, `pitchFromParts(letter, alter, octave)`, `transposeInterval(pitch, steps, semitones)`, `spellDegree(key, degree, alter, octaveOffset)`; existing exports unchanged. Test: `tests/core/pitch.test.js` additions: D5 moved by (-2 steps, -4 semitones) = `Bb4`, F# major gives `E#`, `spellDegree` E major degree 3 offset 0 = `G#4`, 5 = `B4`, b7 = `D5`, offset -1 degree 1 = `E3`, Eb major 3 = `G4`, 4 = `Ab4`; null for results beyond a double accidental or outside octaves -1 to 9.
- [x] 2.2 Create `tests/fixtures/hooktheory-synthetic.json`: synthetic converter input in the real shape (1-based beats, pickup section, rests, `b`/`#` prefixes, chord fields `root`, `type`, `inversion`, `applied`, `borrowed`, `adds`, `suspensions`). It must not contain private data or lyrics.
- [x] 2.3 Create `src/import/hooktheory.js` (`convertHooktheory(source, opts)`): degree to spelled pitch (A3 octave formula, offset 0 = tonic in octave 4), 1-based beat arithmetic (beat 2.5 -> tick 720), rests skipped, overlap clipped with warning, sections concatenated in a fixed order (each `endBeat - 1` beats, pickup bar kept as a full bar, `pickupTicks: 0`), chord quality derivation, left-hand roots in octave 2 with `role: "bass"`, whitelisted output fields only (no lyric, no hash), fixed key order, `schemaVersion 1`, id `cancer-private`, `visibility: "private"`, `learn.transposeTo: ["C"]` when the key has 3 or more accidentals, one `user-submitted` source, `confidence` medium. Errors returned as `{ ok: false, errors: [{ path, message }] }` for key, meter or tempo change and malformed input. Test: `tests/import/hooktheory.test.js` covering every scenario listed in the design Testing Strategy (Import row), deterministic bytes, output passes `validateSong`, private id never collides with public `cancer`.
- [ ] 2.4 Create `tools/convert-hooktheory.mjs` (thin CLI): reads `songs-private/sources/hooktheory-cancer.json` (read-only), validates the whole result in memory before any write, resolves the output and requires it to start with `resolve(repoRoot, "songs-private") + sep`, otherwise exit code 2 and write nothing, writes `songs-private/cancer-private.json` and upserts the entry in `songs-private/index.json`. Test: `tests/import/cli.test.js` spawns `process.execPath` with fixed argv into a temp dir; adversarial paths (`songs/x.json`, `songs-private/../songs/x.json`, absolute path elsewhere, symlinked folder) each exit non-zero and leave the temp tree unchanged; missing input and missing URL fail; whole file `test.skip` with a reason when `tools/convert-hooktheory.mjs` is absent (Docker stage).
- [ ] 2.5 Create `tests/private-local.test.js` (skipped with a reason when `songs-private/` is absent): asserts real counts verse 52/14, chorus 34/11, bridge 39/13 and that no lyric text appears in the generated file or its Learn strings; prints counts only. Run the converter once on the real capture (runtime harness) and record the counts in the PR notes.
- [ ] 2.6 Verification: `node --test` green; `git status` shows no file under `songs-private/` tracked. Commit.

Split point: 2.1 (pitch) as its own PR if the converter exceeds budget.

## Phase 3: Bilingual strings, guards and language selector (pr3a-i18n, about 380 lines)

Specs: learner-language.

- [ ] 3.1 Create `src/i18n/i18n.js`: `pickLanguage(saved, navigatorLanguage)` (saved wins, `es*` -> es, else en), `format(template, params)`, `createI18n({ storage, navigatorLanguage, documentElement, table })` with `t`, `lang`, `setLang` (saves `piano-guide:lang`, swallows storage errors, sets `document.documentElement.lang`), `onChange`; plural keys `_one`/`_other`; English fallback never a raw key. Test: `tests/i18n/i18n.test.js` (`es-SV` -> es, saved wins, blocked storage, fallback, plural forms, synchronous onChange).
- [ ] 3.2 Create `src/i18n/guards.js` with `missingTranslations`, `placeholderMismatches`, `forbiddenTypography`, `voseoForms`, `instructionLimits(render)`. Test: `tests/i18n/guards.test.js`, each guard with a fixture table containing one defect that it must flag (counter-proof) and a clean fixture that passes.
- [ ] 3.3 Create `src/i18n/strings.js` with the Milestone A keys only: `common.*`, `hand.*`, `finger.*`, `step.*` templates (`step.one`, `step.together_one/_other`, `step.move`, `step.thenPlay`, `step.both`), `input.*` (chips, `input.midi.noDevice`, `input.midi.noDeviceHint` using the aligned texts from the design), `catalog.*` learn actions, `learn.*` card texts, solfege note names. Test: `tests/i18n/strings.test.js` runs all guards on the real table.
- [ ] 3.4 Create `src/ui/language-select.js` (English / Espanol selector, accessible label, calls `i18n.setLang`) and styles in `styles/app.css`. Test: `tests/ui/language-select.test.js` with `tests/score/fake-dom.js` (renders both options, current selected, change calls `setLang`).
- [ ] 3.5 Modify `src/ui/lesson-card.js` to use `textOf(value, lang)` for LocalizedText; existing lesson-card tests still pass. Test: `tests/ui/lesson-card.test.js` additions.
- [ ] 3.6 Verification: `node --test tests/i18n tests/ui/lesson-card.test.js` and full `node --test`. Browser 8790: the selector is not wired into a view yet, so the check is deferred to pr10a/pr11a (state this in the PR notes).

## Phase 4: Transposition, fingering, keys (pr4a-transpose-fingering, about 420 lines)

Specs: music-theory-generators (transposition, fingering), learn-mode (transposition toggle).

- [ ] 4.1 Create `src/theory/random.js` (`mulberry32`, `shuffle`) and `src/theory/keys.js` (`TONICS`, `circleOfFifths`, `introOrder`, `scaleOf`; `keyOrder` is completed in pr1c). Test: `tests/theory/random.test.js` (same seed same sequence), `tests/theory/keys.test.js` (circle of fifths 12 entries).
- [ ] 4.2 Create `src/theory/transpose.js`: `smallestMove` (|semitones| <= 6, tritone goes down), `transposeChordSymbol` ("C#m" with E->C = "Am"), `transposeSong(song, levelId, targetTonic)` with letter-preserving spelling, per-hand octave rule (range A0 to C8 first, then closest to C4 right / C3 left, ties to 0 then lower), authored fingers dropped, `RangeError` naming the hand when no candidate survives, `visibility` and other top-level fields copied. Test: `tests/theory/transpose.test.js`: E->C scenario, D5 -> Bb4, intervals preserved over seeded random melodies, range-first fixture (closest-to-C4 candidate out of range must pick the in-range one), low-bass protection, identity move, a transposed private song is still silent (`isSilent`).
- [ ] 4.3 Create `src/theory/fingering.js` `assignFingering(groups, { hand, key })`: greedy longest-run five-step positions, tie rules (no black-key thumb, thumb on played note, anchor closest to previous, lowest), left-hand mirror, authored fingers pin the anchor, stretch rule for groups wider than five steps within 12 semitones, `unplayable` for wider. Test: `tests/theory/fingering.test.js`: five-finger melody, leap shift, LH mirror, triad inversions (RH 1-2-5, 1-3-5; LH 5-3-1, 5-2-1), octave bass, unplayable split, authored wins, no black-key thumb.
- [ ] 4.4 Verification: `node --test tests/theory tests/core/pitch.test.js` and full run. No UI in this PR.

## Phase 5: Phrases, steps, instructions (pr5a-phrases-steps, about 400 lines)

Specs: learn-mode (steps, instructions), learner-language (templates).

- [ ] 5.1 Create `src/learn/phrases.js` `derivePhrases(timeline)`: authored `learn.phrases` win; otherwise about 2 bars cut at rests; never empty. Test: `tests/learn/phrases.test.js` with synthetic fixtures `tests/fixtures/learn-*.json` (authored, 2-bar auto, cut at rest, one-bar song).
- [ ] 5.2 Create `src/learn/steps.js` `deriveSteps(timeline, phrase, hand, { key })` using `assignFingering`: one step per onset group, ties one step, rests and grace skipped, LH only, hand with no notes yields no steps, `unplayable` split lowest first, position and shift flags. Test: `tests/learn/steps.test.js` (melody 8 steps, chord one step, shift, tie, split).
- [ ] 5.3 Create `src/learn/instructions.js` `instructionFor(step, prevStep)` -> `{ key, params }` and `renderInstruction(t, instr, lang)`: note renders "E (Mi)" in English and "Mi (E)" in Spanish, move wording, `step.both`. Test: `tests/learn/instructions.test.js`: the EN and ES examples from the spec ("Right hand: thumb on E (Mi). Press these 3 keys together." and its Spanish form), and `instructionLimits` over every hand x finger x count 1 to 5 x move/no move x language (<= 2 sentences, <= 25 words).
- [ ] 5.4 Add the missing `step.*` keys to `src/i18n/strings.js` if not already present, rerun `tests/i18n`.
- [ ] 5.5 Verification (runtime harness): a throwaway script in the scratchpad (not committed) loads the local `songs-private/cancer-private.json`, derives the first verse phrase in E and prints instructions and fingers; inspect that every finger is 1 to 5 and every instruction reads naturally in both languages. Record findings in PR notes (flag awkward fingering for the by-hand review, per risk table).

## Phase 6: Matcher, lesson reducer, progress, region (pr6a-lesson-core, about 450 lines)

Specs: learn-mode (waiting, feedback, flow, progress), learn-keyboard (region).

- [ ] 6.1 Create `src/learn/matcher.js` (`startStep`, `matchEvent`): exact and `pitchClass` modes, order-free accumulation with no time limit, held-at-start keys excluded until released, wrong key clears the accumulation, `octave` outcome for same pitch class, `ignored` for off events. Test: `tests/learn/matcher.test.js`: single key, chord keys 80 ms and 200 ms apart (no timing used), one by one, held from previous step, auto-repeat, wrong key, octave feedback, pitch-class mode (any C).
- [ ] 6.2 Create `src/learn/progress.js` (`readProgress`, `writeProgress`, `clearSong`, storage injected, key `piano-guide:learn:v1`, shape per design): corrupt JSON and blocked storage read as empty, writes swallowed. Test: `tests/learn/progress.test.js` including the privacy test (serialize progress after a synthetic lesson and assert no spelled-pitch pattern, only ids, indexes, tonics, dates).
- [ ] 6.3 Create `src/learn/region.js` `learnRegion(...)`: phrase mode, position fallback, minimum 9 white keys, `maxWhite` by width, edges land on white keys. Test: `tests/learn/region.test.js`.
- [ ] 6.4 Create `src/learn/lesson.js` (`initLesson`, `reduce`): phases `start`, `phraseIntro`, `listening`, `yourTurn`, `phraseComplete`, `songComplete` (lessonZero and stageComplete phases added in pr1b/pr2b), actions `START`, `CONTINUE`, `LISTEN`, `LISTEN_DONE`, `MY_TURN`, `NOTE_ON`, `NOTE_OFF`, `LISTEN_AGAIN`, `NEXT_PHRASE`, `REPEAT`, `SET_LANG`, `SET_KEY`, `SET_HAND`, `LEAVE`; effects `listen`, `stopListen`, `save`, `announce`, `releaseAll`; a silent state never emits `listen`. Test: `tests/learn/lesson.test.js` as a transition table (one row per design table row): language switch mid-chord keeps accumulation, transposition keeps phrase index, Listen interrupted by a key counts that key as held at start, private never emits `listen`.
- [ ] 6.5 Verification: `node --test tests/learn` and full run.

Split point: 6.4 (reducer) as its own PR.

## Phase 7: Engine and synth additions (pr7a-audio-held-range, about 400 lines)

Specs: playback-engine (range playback, single notes, held learner voices).

- [ ] 7.1 Modify `src/audio/synth.js`: `startHeld({ midi, vel, when })` and `releaseHeld(voiceId, now)`; learner voices excluded from `cancelPending`, counted in the shared voice cap. Test: `tests/audio/synth.test.js` additions (held note survives `cancelPending`, cap includes learner voices, release ramps).
- [ ] 7.2 Modify `src/audio/engine.js`: `startNote`, `releaseNote`, `releaseAllNotes`, `playRange({ startTick, endTick, hand, bpm })` resolving `{ status }` (`completed`, `cancelled`, `silent`, `empty`; omitted `bpm` means slow, explicit `bpm` allowed), `stopRange`, `playNotes`, `stopNotes`. Test: new `tests/audio/engine-range.test.js` with the recording rig: range plays only notes inside it and stops itself, empty range immediate, private timeline resolves `silent` with zero `playNote` calls, `releaseAllNotes` leaves nothing held, `playNotes` generated notes play even when the loaded song is private.
- [ ] 7.3 Add guard test in `tests/audio/engine-silent.test.js` (or `tests/learn-guard.test.js`): modules under `src/learn/` never import `playNotes` (static text scan with a counter-proof fixture string that does).
- [ ] 7.4 Verification: `node --test tests/audio` and full run.

## Phase 8: Input bus, computer keys, Web MIDI, learner sound (pr8a-note-input, about 420 lines)

Specs: note-input.

- [ ] 8.1 Create `src/input/bus.js` `createNoteBus()` (`noteOn`, `noteOff`, `releaseAll(source?)`, `held()`, `on`, `dispose`; same (source, midi) held twice ignored). Test: `tests/input/bus.test.js` (dedupe, releaseAll per source, dispose emits noteOff, synchronous dispatch order).
- [ ] 8.2 Create `src/input/computer-keys.js`: pure `keyMapFor(region, anchorMidi)` (11 home-row white keys, black keys on the upper row) and `attachComputerKeys({ target, bus, getMap })` that ignores Ctrl/Alt/Meta, events targeting input/select/textarea/contenteditable, `event.repeat` and unmapped codes, calls `preventDefault` for mapped keys, remembers `code -> midi` at press time, releases on `blur` and hidden `visibilitychange`; layout legend helper using `navigator.keyboard.getLayoutMap()` with a US fallback table. Test: `tests/input/computer-keys.test.js` with a fake event target (map from C and from E, modifiers, focused input, repeat, unmapped, blur release, map moved between down and up).
- [ ] 8.3 Create `src/input/midi.js`: pure `parseMidiMessage(bytes)` and `createMidiInput({ navigator, isSecureContext, bus, onState })` with states `unsupported | insecure | idle | requesting | denied | no-device | connected | unavailable`, permission only from `connect()`, every input listened, `statechange` hot-plug, disconnect calls `bus.releaseAll("midi")`, device name with manufacturer prefix. Test: `tests/input/midi.test.js` with a fake navigator: on, off, velocity-0 off, pedal and clock ignored, short messages, each state, hot-plug in and out releasing held notes.
- [ ] 8.4 Create `src/input/learner-sound.js` `createLearnerSound({ bus, engine, settings })`: screen and computer always sound, MIDI only when `piano-guide:input:midi-sound` is on (default off). Test: `tests/input/learner-sound.test.js` (each source, setting on and off, wrong keys still sound, counter-proof: MIDI with setting off calls nothing on the engine).
- [ ] 8.5 Verification: `node --test tests/input` and full run. Real Casio and browser check happen in pr11a.

## Phase 9: 2D SVG learn keyboard (pr9a-learn-keyboard, about 420 lines)

Specs: learn-keyboard.

- [ ] 9.1 Create `src/ui/learn-keyboard.js` `createLearnKeyboard({ mount, i18n, bus })` with `setRegion`, `setKeyContext`, `setStepKeys`, `setPositionKeys`, `setLetters`, `flashWrong`, `flashCorrect`, `setSounding`: geometry from `layoutRange`, names on every white key (language-ordered, solfege and letters), black-key names in the strip above spelled by key context (E# and Cb correct), finger badges (circle right hand, rounded square left hand, hand letter when hands together), quiet position digits, states pressed / wrong (hatch plus x, 1.2 s) / correct (check, 0.7 s) / sounding, none relying on color alone, `role="group"` with aria-label and a polite live region, pointer events by `pointerId` emitting `noteOn`/`noteOff` with source `screen`, `touch-action: none`, no states animated under `prefers-reduced-motion`. Test: `tests/ui/learn-keyboard.test.js` with `tests/score/fake-dom.js`: key count and names for a region, spelling in F# and Gb contexts, badge shapes, pointer down/up/leave/cancel produce bus events, two pointers two notes, label text sizes via computed attributes, black keys drawn after white.
- [ ] 9.2 Add keyboard styles to `styles/app.css` for the three viewport layouts from the design (white key width formulas, 36 px minimum at 360 px width, labels >= 12 px, badge sizes). Test: a CSS text guard in `tests/ui/learn-keyboard.test.js` asserting the minimum sizes and the `max-height: 480px` landscape rule exist.
- [ ] 9.3 Verification: `node --test tests/ui/learn-keyboard.test.js` and full run. Learner-level acceptance is verified in pr11a where the keyboard is on screen.

## Phase 10: Private index merge, catalog actions, router (pr10a-catalog-private, about 400 lines)

Specs: private-song-library, song-catalog, playback-engine (Play (no sound)).

- [ ] 10.1 Modify `src/ui/catalog.js`: `fetchJsonOrAbsent(url)` three-state (absent for network failure, non-2xx or non-JSON content type; invalid; ok), merge private entries after public ones with a "Private" chip, require file `visibility: "private"`, id collision with a public id marks the private entry unavailable, `visibilityMismatch` marks entries unavailable, invalid private index shows one notice "The private library could not be read." (bilingual key), absent shows nothing, export `canLearn(song)`, card actions "Learn" (omitted when no pitched note) and "Play along", link to Practice (target `#/practice`, route lands in pr6c; until then the link is hidden behind a feature check so no dead link ships), language selector in the header. Test: `tests/ui/catalog.test.js` additions with injected fetch for every row of the design Catalog test row (404, network error, HTML 200, invalid, valid, collision both ways, missing visibility, mismatch with counter-proof, `canLearn` empty-notes fixture, cards).
- [ ] 10.2 Modify `src/ui/router.js`: `parseHash` handles `#/learn/<id>`, `#/practice` and `#/practice/<id>` (raw id returned). Test: `tests/ui/router.test.js` and `tests/ui/router-dispatch.test.js` additions (unknown id yields the plain "Song not found" view, ids shown through text nodes only).
- [ ] 10.3 Modify `src/ui/player.js` and `src/ui/transport.js`: label the play button "Play (no sound)" (bilingual key) when `engine.play()` reports `silent`. Test: `tests/ui/player.test.js` and `tests/ui/transport.test.js` additions.
- [ ] 10.4 Modify `tools/serve.mjs`: `NO_PRIVATE=1` answers 404 under `/songs-private/`, and `/songs-private/sources/` is always 404. Test: `tests/serve.test.js` (new, spawns the server module on an ephemeral port or tests the pure path-guard function exported from `tools/serve.mjs`; skipped with a reason when `tools/` is absent).
- [ ] 10.5 Browser check on 8790: (a) with `songs-private/` present and the converter output from pr2a, the catalog shows Cancer with a "Private" chip after the public songs; (b) with `$env:NO_PRIVATE=1`, only public songs and no private wording anywhere, console shows only the expected 404; (c) opening a private song's Play along: play button reads "Play (no sound)", cursor moves, no sound; (d) `#/learn/cancer-private` still shows a not-ready message until pr11a (record in notes). Read screenshots of 1440x900 and 390x844.
  Learner-level acceptance: a person opening the catalog sees plain "Learn" and "Play along" buttons on each song and understands Cancer is a private, local-only song; nothing says the app will play it.
- [ ] 10.6 Verification: `node --test` full.

## Phase 11: Learn view, input panel, end-to-end first phrase (pr11a-learn-view, about 450 lines)

Specs: learn-mode, learn-keyboard, note-input, private-song-library (silent in Learn). This is the PR where the learner sees the teacher.

- [ ] 11.1 Create `src/ui/input-panel.js`: chips for computer keys and MIDI state, "Connect piano" button (click-only permission), device name chip, one-line "No MIDI device found..." hint after a Connect attempt finds nothing, "Sound from the app for MIDI" toggle persisted at `piano-guide:input:midi-sound`. Test: `tests/ui/input-panel.test.js` (each MIDI state renders the single aligned line EN and ES, toggle persists, Connect calls `connect()` only on click).
- [ ] 11.2 Create `src/ui/learn-view.js`: wires `learn/lesson.reduce`, bus, learner sound, engine (`playRange` for Listen, `startNote` through learner sound), `learn-keyboard`, input panel, language select, transposition toggle (only when `learn.transposeTo`, remembered via progress), hand selector, level selector (only when more than one level has notes), progress read and save, effects executor (`listen`, `stopListen`, `save`, `announce`, `releaseAll`), instruction card of 1 to 2 sentences rendered through `i18n.t`, feedback chip Correct / Try again, a polite live region, "Start" / "Continue" / "Start over", "Repeat phrase", "Next phrase", "Reset progress", private songs hide Listen and "Listen again", computer-key map moving with the position, key-up on route change (`releaseAll`). Test: `tests/ui/learn-view.test.js` with fake DOM and injected engine/storage/bus: private song shows no Listen action and never calls `playRange`, public synthetic song Listen then My turn, wrong key shows Try again and keeps shading, chord by single clicks completes, language switch mid-chord keeps the step, transposition refreshes names and fingers and keeps phrase index.
- [ ] 11.3 Modify `src/main.js` to lazy-load the `learn` view with a shared i18n instance and modify `styles/app.css` with the Learn layout for the three viewports (instruction 28/18/20 px, button heights 48/36/48, input panel one row or two). Test: `tests/smoke.test.js` and `tests/csp.test.js` still pass (no import map change).
- [ ] 11.4 Browser check on 8790 with the real private Cancer (E major, then "Transpose to C major"): complete the first verse phrase using (a) on-screen taps, (b) the computer keyboard, (c) wrong key then right key, (d) language switch mid-step, (e) reload resumes the same phrase and key and language, (f) typing in a BPM box plays nothing, Ctrl+R reloads, window blur releases notes, (g) reduced-motion emulation. Capture and READ screenshots at 1440x900, 844x390 and 390x844 during My turn; measure with DevTools that white keys are >= 36 px at 360 px width and labels >= 12 px; confirm instruction and every shaded key with finger number are visible without scrolling.
  Learner-level acceptance: a non-player opens Cancer, presses Start, reads one sentence ("Right hand: thumb on E (Mi).") and sees the shaded E key with a "1" on it; pressing it says "Correct" and the next sentence appears; pressing a wrong key says "Try again" and the shaded key stays; no sound plays from the app except the learner's own presses; there is no Listen button.
- [ ] 11.5 Verification: `node --test` full. Record Casio MIDI as NOT verified here (user-only, see final task).

Split point: 11.1 (input panel) as its own PR, or 11.3 CSS.

## Phase 12: README, usability protocol, Docker, nginx (pr12a-docs-docker, about 380 lines)

Specs: private-song-library (Docker), lesson-guide, success criteria (usability protocol).

- [ ] 12.1 Create `docs/USABILITY_CHECK.md`: participant profile (has never played), setup (device, input, language), tasks T1 find C with lesson zero (2 min), T2 first Cancer phrase right hand in E and in C (10 min per key), T3 Ode to Joy first phrase (5 min), T4 resume after reload, T5 one 10-minute routine, rules (the observer does not help), what to record (time per task, hesitations over 10 seconds or questions, wrong-key count), pass thresholds, "revised on" line (A4). Tasks T1, T3, T5 are marked "available after Milestone B/C".
- [ ] 12.2 Modify `README.md`: Learn mode, the three inputs and Casio setup (USB TO HOST cable, Chrome or Edge, "Connect piano", what to do when only USB audio is exposed), the documented computer-key map, private songs (gitignored folder, converter command, `docker run -v <path>/songs-private:/usr/share/nginx/html/songs-private:ro`), language selector, link to `docs/USABILITY_CHECK.md`; Docker presented as the main path.
- [ ] 12.3 Modify `.dockerignore` (add `songs-private`, `!docs/USABILITY_CHECK.md`), `Dockerfile` (test stage also copies `.gitignore`, `.dockerignore`, `README.md`, `docs/USABILITY_CHECK.md`; replace `COPY assets/vendor/ ./assets/vendor/` with `COPY assets/ ./assets/`; no `COPY`/`ADD` of `songs-private`; `tools/` stays out), `nginx.conf` (`location ^~ /songs-private/sources/ { return 404; }` and `location ^~ /songs-private/ { expires -1; types { application/json json; } }`). Verify `tests/csp.test.js` still passes (no change to `index.html`).
- [ ] 12.4 Create `tests/docs-guard.test.js`: `docs/USABILITY_CHECK.md` has T1 to T5 with thresholds, the README links it; extend `tests/privacy.test.js`: `.dockerignore` contains `songs-private`, Dockerfile has no `COPY`/`ADD` naming it (counter-proof fixture Dockerfile text that does fails).
- [ ] 12.5 Verification: `docker build -t piano-guide .` (tests run in the build stage and CLI tests skip with their reason), `docker run --rm -p 8790:8080 piano-guide` (no private songs, catalog public only), `docker run --rm -p 8790:8080 -v <abs path>\songs-private:/usr/share/nginx/html/songs-private:ro piano-guide` (private Cancer appears; `/songs-private/sources/` returns 404), and `docker run --rm piano-guide find /usr/share/nginx/html -path '*songs-private*'` prints nothing. Stop containers afterwards.
- [ ] 12.6 Milestone A close-out in the tracker: list in the PR notes which success criteria are now met by automated tests and which await the user (by-ear confirmation of Cancer, Casio MIDI), so the user can judge Milestone A before B starts.

---

# MILESTONE B: whole song, real piano, public catalog swap

## Phase 13: Lesson zero (pr1b-lesson-zero, base pr12a, about 400 lines)

Specs: learn-mode (lesson zero), learner-language.

- [ ] 13.1 Create `src/learn/lesson-zero.js`: four parts as data (find C with groups of 2 and 3 black keys using the matcher in `pitchClass` mode over a C3 to B4 region; sitting and hand posture; fingers 1 to 5 on C4 D4 E4 F4 G4; input how-to including Casio line). Completion or skip saved globally in `lessonZero` of `piano-guide:learn:v1`. Test: `tests/learn/lesson-zero.test.js` (any C counts, other keys do not advance, five single-key steps with fingers 1 to 5, skip saves "skipped", completion saves "done").
- [ ] 13.2 Add `lz.*` keys (EN and ES) to `src/i18n/strings.js`; rerun `tests/i18n` guards.
- [ ] 13.3 Create `assets/img/posture.svg` (original artwork, simple, text-free) and `src/ui/lesson-zero-view.js`; modify `src/ui/learn-view.js` (the `lessonZero` phase, "Lesson zero" button on the first screen when never done, skip always available) and `src/learn/lesson.js` (new phase and actions). Test: `tests/ui/lesson-zero-view.test.js`, `tests/learn/lesson.test.js` rows.
- [ ] 13.4 Browser check on 8790, three viewports (screenshots read): complete lesson zero by pressing any C, then fingers 1 to 5; skip it; reload and confirm it does not reappear; Spanish and English.
  Learner-level acceptance: a person who has never seen a piano reads "Find a C: it is the white key just left of the two black keys", sees the groups of two black keys outlined, presses a C and gets "Correct"; pressing another key says "Try again" and keeps the hint.
- [ ] 13.5 Verification: `node --test` full. Update `docs/USABILITY_CHECK.md` T1 availability note.

## Phase 14: Stages, tempo, metronome in Learn, resumable progress (pr2b-stages, about 400 lines)

Specs: learn-mode (stages, progress).

- [ ] 14.1 Create `src/learn/stages.js`: per phrase `[R slow, L slow, T slow, T full]` filtered by hands with onsets (no-note hand drops its stage; single hand drops "together"), then a section stage and a song stage; slow = `effectiveBpm({ userBpm: song bpm, slowMode: true })`, full = explicit song bpm. Test: `tests/learn/stages.test.js` (one-hand song, two-hand song, hand with no notes in a phrase, last stage leads to `songComplete`).
- [ ] 14.2 Modify `src/learn/lesson.js` and `src/learn/progress.js`: `stageComplete` phase, `NEXT_STAGE`, `stage` and `hand` saved per song, level and tonic, "Continue" resumes phrase, stage, hand, key, language; `clearSong` for "Reset progress". Test: `tests/learn/lesson.test.js`, `tests/learn/progress.test.js` rows including hands-together expected union and resume.
- [ ] 14.3 Modify `src/ui/learn-view.js`: metronome during My turn through `engine.setMetronome` at the stage tempo (A1: tempo affects Listen and the metronome only), full-tempo Listen passes explicit `bpm`, "Next stage" action, stage label in the progress line. Test: `tests/ui/learn-view.test.js` additions (stage labels, metronome tempo per stage, private song never starts song audio but may click if the user turned the metronome on).
- [ ] 14.4 Browser check on 8790 using the synthetic public fixture (temporary local index entry, not committed) and private Cancer: walk the stages of one phrase, reload and use "Continue", "Reset progress" clears. Read screenshots at the three viewports.
  Learner-level acceptance: after finishing the right hand slow, the screen says plainly "Now the left hand, slowly" with a "Next stage" button; reloading offers "Continue" at that exact stage.
- [ ] 14.5 Verification: `node --test` full.

## Phase 15: Sampled piano, GATED (pr3b-sampled-piano, about 380 authored lines plus binary samples excluded)

Specs: playback-engine (sampled voice with synth fallback), project rules (dependency announcement, STACK_TECNOLOGICO.md in the same commit, vulnerability check).

- [ ] 15.1 STOP GATE, measurement only (no repo change except a note in `openspec/changes/learn-mode/apply-notes.md`): measure the Salamander Grand Piano set: exact source URL and version or commit, any web-encoded redistribution and its own license, file list (one velocity layer, sample points every 3 semitones, restricted subset covering the app range, maximum distance <= 3 semitones), format decodable in Chrome, Edge, Firefox and Safari (MP3 or M4A, not FLAC or Ogg), per-file and total size in KB, license text and attribution line, vulnerability status (assets, no code: record "N/A: static audio"). Ask the runtime before any download if network access needs approval. **STOP and return to the orchestrator** with: what, why, exact version, size, rejected alternatives (Tone.js Sampler: npm runtime library, project has none; GM soundfonts as JS: larger, unclear provenance; better oscillator: still not a piano). No file is added before the user approves. If rejected, mark 15.2 to 15.8 as skipped and continue with Phase 16.
- [ ] 15.2 (after approval) Create `assets/audio/piano/` sample files, `assets/audio/piano/manifest.json` (file, midi, sha256) and `assets/audio/piano/LICENSE.txt` with the attribution.
- [ ] 15.3 (after approval) Create `src/audio/sampler.js` `createSampler(ctx, { manifest, baseUrl, fetch })`: lazy load after the first gesture, `decodeAudioData`, pure `nearestSample(midi, points)`, `playbackRate = 2 ** ((midi - sample) / 12)`, same interface as the synth including `startHeld`/`releaseHeld`, gain-ramp release, shared voice cap. Test: `tests/audio/sampler.test.js` with fake audio (`tests/audio/fake-audio.js`): nearest sample, rate formula, lazy load, failure marks the point failed.
- [ ] 15.4 (after approval) Create `src/audio/voice.js` `createVoice(ctx)`: per note uses the sampler when that sample is decoded, else the synth; fetch or decode failure falls back silently. Modify `src/audio/engine.js` and `src/main.js` to use the voice. Test: `tests/audio/voice.test.js` (fallback per note, fetch failure, same interface), `tests/audio` existing rigs still pass.
- [ ] 15.5 (after approval) Modify `nginx.conf` (`location ^~ /assets/audio/ { types { audio/mpeg mp3; audio/mp4 m4a; application/json json; } expires 1y; }`) and `tools/serve.mjs` (audio MIME types and `Cache-Control: public, max-age=31536000, immutable` for `/assets/audio/`). Test: extend `tests/serve.test.js`.
- [ ] 15.6 (after approval) Modify `docs/STACK_TECNOLOGICO.md` with the sample set entry (name, exact version, license, source, size, date, "N/A: static audio" vulnerability note) IN THE SAME COMMIT as the assets. Create `tests/assets-guard.test.js`: every audio file under `assets/` has a stack entry, with a counter-proof fixture list containing an unlisted file; update `tests/stack-doc.test.js` if it enumerates entries. Add the CC BY credit line in the Learn footer (`src/ui/learn-view.js`).
- [ ] 15.7 (after approval) Browser check on 8790: first press loads samples, Listen on a public song and the learner's own key presses use the piano voice, blocking the sample requests in DevTools falls back to the synth with no error shown, Docker build serves `.mp3`/`.m4a` with the right type. The user judges "this sounds like a piano" (recorded as a user confirmation, not claimed by apply).
- [ ] 15.8 Verification: `node --test` full and `docker build -t piano-guide .`.

Before approval (the default state of the chain): the assets guard test (15.6) is the only part that may land earlier, and only if it passes with no audio files; otherwise it ships with the rest.

## Phase 16: Ode to Joy transcription, GATED (pr4b-ode-to-joy, about 350 lines)

Specs: song-data-model (transcribed provenance), song-catalog.

- [ ] 16.1 STOP GATE, source search (no repo change): search Mutopia Project first (LilyPond text), then IMSLP, for Beethoven's Symphony No. 9 finale theme or a public-domain piano reduction of the "Freude" theme; accept only Mutopia "Public Domain", "CC BY" or "CC BY-SA", or IMSLP files tagged Public Domain (US) with the license line visible. Record piece page URL, file URL, source ID, license, SHA-256 of the exact downloaded file, access date. Download only after the runtime permits it. **If no qualifying source exists, STOP and return to the orchestrator; write nothing from memory.**
- [ ] 16.2 Create `tests/fixtures/<source>-ode-to-joy-onsets.json` extracted from the downloaded file only (onset tick, spelled pitch, duration, source SHA-256), following the pattern of `tests/fixtures/mutopia-chopin-op9n2-onsets.json` (read-only).
- [ ] 16.3 Create `songs/ode-to-joy.json` (C major beginner level, right-hand melody transposed from the source key with `transposeInterval`, `transcribed: true`, `what` stating bars taken, reduction to the theme and the transposition, four `learn.phrases` of 4 bars, easy left hand with `role: "bass"` from the source bass or an original arrangement recorded as a second `original-arrangement` source, bilingual lesson text) and `songs/LICENSE-ode-to-joy.md` when the source license requires attribution. Do NOT edit `songs/index.json` yet (pr6b).
- [ ] 16.4 Create `tests/songs-ode.test.js`: file validates, provenance fields complete (URL, license, SHA-256, access date), right-hand melody equals the fixture transposed by the recorded interval (counter-proof: a one-note change in a copy makes it fail), every learn phrase inside the song, no lyric text.
- [ ] 16.5 Browser check on 8790 with a temporary local index entry (not committed): Listen then My turn on the first phrase, wrong key, right-hand then left-hand stages; screenshots read.
  Learner-level acceptance: the learner presses Listen and hears and sees the phrase lit slowly with the piano or synth voice, then presses My turn and is told one key at a time which finger to use; completing it says "Correct" and offers the next phrase.
- [ ] 16.6 Verification: `node --test` full.

## Phase 17: Synthetic fixture and test migration (pr5b-test-migration, about 420 lines)

Specs: song-data-model, song-catalog (tests must stop depending on the public Cancer).

- [ ] 17.1 Re-measure the dependency on `songs/cancer.json`: run `rg -i -c "cancer" tests` and `rg -n "songs/cancer|\"cancer\"" tests`; the design measured 94 matches in 7 files on 2026-10-11 (`songs.test.js` 55, `level-select.test.js` 12, `router-dispatch.test.js` 9, `router.test.js` 8, `player.test.js` 5, `score/render.test.js` 4, `score/engraving-polish.test.js` 1). Record the new counts, which matches are file references versus prose or ids, and the resulting PR size in `openspec/changes/learn-mode/apply-notes.md`; if the migration exceeds about 450 lines, split it into two PRs (`pr5b-test-migration` for `songs.test.js` and `pr5b2-...` for the UI and score tests) and note it in the tracker.
- [ ] 17.2 Create `tests/fixtures/chords-only-song.json`: synthetic chords-only public song covering what the Cancer tests assert (confidence per section, chords-only copyright guard shape, levels, tempo, key), no real melody.
- [ ] 17.3 Migrate `tests/songs.test.js` so no assertion needs `songs/cancer.json` (use the fixture for the chords-only guard, keep the Chopin assertions), keeping every guard that still applies; each migrated guard keeps its counter-proof. Test: `node --test tests/songs.test.js`.
- [ ] 17.4 Migrate `tests/ui/level-select.test.js`, `tests/ui/router-dispatch.test.js`, `tests/ui/router.test.js`, `tests/ui/player.test.js`, `tests/score/render.test.js`, `tests/score/engraving-polish.test.js` to the fixture or to Chopin. Test: `node --test tests/ui tests/score`.
- [ ] 17.5 Verification: `node --test` full green with `songs/cancer.json` still present (pr6b removes it), and a temporary local check that renaming `songs/cancer.json` makes no test fail (do not commit the rename; restore it).

## Phase 18: Public catalog swap (pr6b-catalog-swap, about 200 lines)

Specs: song-catalog (public set), song-data-model (Cancer no longer named as shipped), lesson-guide (Cancer policy moves off the public song).

- [ ] 18.1 Delete `songs/cancer.json`; modify `songs/index.json` so it lists exactly `chopin-nocturne-op9-no2` and `ode-to-joy`, each entry with `visibility` not private. Test: `tests/songs.test.js` update: index is exactly the two public songs, `songs/cancer.json` absent, Ode provenance and melody checks still pass, `visibilityMismatch` over the index.
- [ ] 18.2 Modify `README.md` so examples and descriptions no longer name the public chords-only Cancer; modify `src/ui/lesson-card.js` or lesson texts only if a Cancer-specific branch exists (check with `rg -n -i "cancer" src styles README.md docs`), leaving the private song id `cancer-private` untouched so saved progress keys do not change. Test: add `tests/privacy.test.js` assertion that no file in the repository (tracked paths, `songs/`) contains the Cancer melody or lyrics markers used by the private-local test (marker list in the test is title-level only, no lyrics).
- [ ] 18.3 Browser check on 8790: catalog shows Chopin and Ode to Joy plus (with `songs-private/`) Cancer with the "Private" chip; with `$env:NO_PRIVATE=1` only the two public songs; deep link `#/learn/cancer` shows "Song not found"; `#/learn/cancer-private` works locally. Docker: `docker build -t piano-guide .` then `docker run --rm piano-guide find /usr/share/nginx/html -path '*songs-private*'` prints nothing and the image contains no `songs/cancer.json`.
- [ ] 18.4 Milestone B close-out: list in the PR notes which success criteria are met (Ode to Joy listen-then-play, resume, public catalog guards) and which await the user (piano sound judgment if samples were approved).

---

# MILESTONE C: Practice exercises

## Phase 19: Scales, keys, five-finger patterns (pr1c-scales, base pr6b, about 400 lines)

Specs: music-theory-generators (scales, five-finger, key orders).

- [ ] 19.1 Modify `src/theory/keys.js`: `keyOrder({ kind, direction, start, list, seed, count })` (fixed list, random with no early repeat and no self-follow, circle of fifths wrapping to C at 13, circle of fourths C F Bb Eb Ab Db F# B E A D G), `introOrder` C G D F A E B Bb Eb Ab Db F#. Test: `tests/theory/keys.test.js` additions (including a fixed list C F G for 5 steps).
- [ ] 19.2 Create `src/theory/scales.js`: `majorScale(tonic, { octaves, hand })`, `fiveFinger(tonic, hand)`, `SCALE_FINGERING` table exactly as in the design (all 12 keys, start / cycle / top for both hands), descending reverses, spelling via `spellDegree` (F# major has E#). Test: `tests/theory/scales.test.js`: table checks for the sequences listed in the design (C RH 1 2 3 1 2 3 4 5; C LH 5 4 3 2 1 3 2 1; F RH 1 2 3 4 1 2 3 4; C RH two octaves 15 notes; C LH two octaves; B LH 4 3 2 1 4 3 2 1; Bb RH 2 1 2 3 1 2 3 4; F# LH 4 3 2 1 3 2 1 4), all 12 keys x valid fingers x stepwise, intro order equals the table order, five-finger G and D LH.
- [ ] 19.3 Verification: `node --test tests/theory` and full run. Record the two flagged fingering uncertainties (Bb RH start, F# LH start) in the PR notes so the user can confirm them with a teacher.

## Phase 20: Triads, arpeggios, progressions (pr2c-triads-progressions, about 420 lines)

Specs: music-theory-generators.

- [ ] 20.1 Create `src/theory/triads.js`: `triad(tonic, quality, inversion, hand)` with the amended left-hand fingering (5-3-1 root and first inversion, 5-2-1 second inversion), `arpeggio` from the arpeggio table (standard table, not the five-finger assigner; Db, Eb, Ab, Bb left hand uses the assigner fallback and is marked "suggested fingering"), reverse for descending. Test: `tests/theory/triads.test.js`: RH and LH inversions, arpeggio notes and fingerings (C RH 1 2 3 5, LH 5 4 2 1, two-octave patterns), reverse, flagged rows carry the `suggested` flag.
- [ ] 20.2 Create `src/theory/progressions.js` `progression(tonic, numerals)` with Viterbi voice leading (first chord root position, minimal total movement, ties to lower voicing). Test: `tests/theory/progressions.test.js`: C I-IV-V-I, common tone held, total movement <= all-root sequence for all 12 tonics x 3 progressions (I-IV-V-I, I-vi-IV-V, I-V-vi-IV), G vi = Em, Bb spelling.
- [ ] 20.3 Verification: `node --test tests/theory` and full run.

## Phase 21: Intervals and ear-drill questions (pr3c-intervals-drills, about 300 lines)

Specs: music-theory-generators (intervals), practice-exercises (ear drills data).

- [ ] 21.1 Create `src/theory/intervals.js` (`INTERVALS` table m2 to P8, `intervalNotes(low, interval)`) and `src/theory/drills.js` (`intervalQuestion(seed, options)`, `chordQuestion(seed, options)` with seeded `mulberry32`, answer appears exactly once among options, notes in C3 to C6). Test: `tests/theory/intervals.test.js`, `tests/theory/drills.test.js`: same seed same question, answer once among options over 500 seeds, M3 notes, range C3 to C6.
- [ ] 21.2 Verification: `node --test tests/theory`.

## Phase 22: Runner, metronome timeline, practice progress (pr4c-runner-progress, about 400 lines)

Specs: practice-exercises (runner, tempo ramp, progress).

- [ ] 22.1 Modify `src/core/timeline.js`: add `makeTimeline({ meter, bpm, bars })` returning the note-less `silent: false` timeline from the design. Test: `tests/core/timeline.test.js` (no notes, whole bars, `silent: false`, clock runs with the engine rig and schedules no note).
- [ ] 22.2 Create `src/practice/runner.js`: converts a generated sequence into matcher steps, tracks `clean` (false after any wrong key), stages R, L then T for scales and arpeggios, `nextTempo(steps, current, clean) -> { bpm, top }` pure (A1: tempo is pacing only, "clean at tempo T" means no wrong key while the metronome was at T). Test: `tests/practice/runner.test.js` (clean tracking, stage order, ramp, top, unclean stays at the same tempo, tempo within 20 to 240).
- [ ] 22.3 Create `src/practice/progress.js` (`readPracticeProgress`, `recordRun`, `recordRoutine` as a no-op when no block is done, `clearPracticeProgress`; key `piano-guide:practice:v1`; `cleanStreak` per exercise and key, `bestTempo`, `cleanRuns`, `lastPracticed`; `dayStreak` stays separate per A5). Test: `tests/practice/progress.test.js`: streak and best-tempo scenarios, unclean run resets `cleanStreak`, corrupt JSON reads empty, blocked storage swallowed, reset empties the summary.
- [ ] 22.4 Verification: `node --test tests/practice tests/core/timeline.test.js` and full run.

## Phase 23: Exercise catalog and bilingual doc cards (pr5c-exercise-catalog, about 400 lines)

Specs: practice-exercises (catalog, doc cards), learner-language.

- [ ] 23.1 Create `src/practice/catalog.js`: ids `five-finger`, `scale-major`, `triads`, `arpeggios`, `cadence-i-iv-v-i`, `progression-i-vi-iv-v`, `progression-i-v-vi-iv`, `ear-intervals`, `ear-chords`, `routine`, each with `group`, `generate(options)` calling the theory generators, `tempoSteps` (for example scales `[50, 60, 72, 88]`), doc-card string keys. Test: `tests/practice/catalog.test.js`: every id has all card keys, a failing fixture entry missing a card key is flagged (counter-proof), tempo steps within 20 to 240.
- [ ] 23.2 Add `ex.<id>.{title,goal,why,how,good}`, `interval.*`, `quality.*`, `practice.*` (including `practice.notFound` "Exercise not found" / "Ejercicio no encontrado") keys to `src/i18n/strings.js`, with the card line "standard fingering; some books differ" for scales and "suggested fingering" for flagged arpeggios. Test: `tests/i18n` guards (completeness, placeholders, typography, voseo) over the real table.
- [ ] 23.3 Verification: `node --test tests/practice tests/i18n`.

## Phase 24: Practice view (pr6c-practice-view, about 450 lines)

Specs: practice-exercises (view, repeat, metronome, ramp, key rotation, checking), learn-keyboard reuse.

- [ ] 24.1 Create `src/ui/practice-view.js` for `#/practice` (grouped exercise list, each with a one-line goal) and `#/practice/<id>` (doc card with goal, why, how, what good looks like, tempo steps; "Start"; run with the learn keyboard showing the keys and fingers, metronome through `engine.setMetronome` on a `makeTimeline` timeline, tempo ramp with `nextTempo`, "Next key" using `keyOrder` (fixed, random, circle) announcing the key in one line, simple Correct / Try again feedback, progress summary with `cleanStreak` and best tempo, "Reset progress" with an inline "Reset? Yes / No" pair (no dialog)); unknown id renders `practice.notFound` plus a link to `#/practice` using text nodes only. Test: `tests/ui/practice-view.test.js` with fake DOM and injected engine/storage/bus: list, card, run to clean completion records the run, wrong key makes it unclean, next key reframes, unknown id message, reset empties the summary.
- [ ] 24.2 Modify `src/ui/router.js` and `src/main.js` to lazy-load the `practice` view and `src/ui/catalog.js` to show the Practice link; modify `styles/app.css` with Practice styles for the three viewports. Test: `tests/ui/router.test.js`, `tests/ui/catalog.test.js` (Practice link present).
- [ ] 24.3 Browser check on 8790: open Practice exercises, choose "Major scales", run C major right hand with the fingering shown on the keys using taps and the computer keyboard, watch the tempo step up after a clean run, change key with "Next key" (circle of fifths), reload and see streak and best tempo, open `#/practice/nope`. Read screenshots at the three viewports.
  Learner-level acceptance: a non-player opens "Major scales", reads in plain words why and how, sees the C scale keys shaded with finger numbers one at a time, and plays the scale ending on "Correct"; the next day the page still shows their streak and best tempo.
- [ ] 24.4 Verification: `node --test` full.

Split point: move key rotation and progress summary into pr7c if over budget.

## Phase 25: Ear drills (pr7c-ear-drills, about 400 lines)

Specs: practice-exercises (ear drills).

- [ ] 25.1 Create `src/practice/ear.js`: session reducer over seeded questions (`drills.js`), options start at {M3, P5, P8} or {major, minor} and grow after 8 of 10 correct (order P4, m3, M6, M2, m6, m7, M7, TT, m2; then dim, aug), second wrong pick reveals the answer, "Listen again" free, count "7/10", play-back answers matched by pitch class for chords and by distance from the first pressed note for intervals (any octave counts). Test: `tests/practice/ear.test.js`: reveal on second wrong, count, option growth, play-back by pitch class and by interval, reproducible with a seed.
- [ ] 25.2 Modify `src/ui/practice-view.js`: ear drill screen with Play / Listen again, answer buttons, play-back input through the bus, count, summary; playback through `engine.playNotes` only (generated notes). Test: `tests/ui/practice-view.test.js` additions; `tests/learn-guard.test.js` (from 7.3) still proves Learn modules do not import `playNotes`.
- [ ] 25.3 Browser check on 8790: answer an interval question by button and by playing it back on the computer keyboard; second wrong shows the answer; options grow after 8 of 10. Screenshots read.
  Learner-level acceptance: the learner presses Play, hears two notes, sees three big buttons ("Major third", "Perfect fifth", "Octave") with a plain description, picks one and is told right or wrong; nothing requires knowing theory words beforehand.
- [ ] 25.4 Verification: `node --test` full.

## Phase 26: 10-minute routine and daily streak (pr8c-routine, about 400 lines)

Specs: practice-exercises (routine, progress).

- [ ] 26.1 Create `src/practice/routine.js`: `buildRoutine(progress, isoDate)` (warm-up five-finger in the key after `lastWarmupKey` on the circle of fifths, C first, 2 min; scale in the least recently practiced key following intro order, 3 min; chord drill alternating triads/inversions and I-IV-V-I by day parity, 3 min; ear drill alternating intervals and chords by day parity, 2 min; total 9 to 11; deterministic for the same progress and date) and `routineReducer(session, action)` with `DONE_BLOCK`, `SKIP_BLOCK`, `END` (skipping the last open block ends the routine). Day recording: at least one block done records the day (`dayStreak` +1 when `lastDate` was yesterday, unchanged when today, else 1); all skipped records nothing. Test: `tests/practice/routine.test.js`: first day, next day (G and a different warm-up), same day identical, 9 to 11 minutes, skip last block after three done records the day, everything skipped records nothing and streak unchanged, summary "N days in a row" with plural forms (`routine.daysInRow_one` "1 day in a row" / "1 día seguido"), `lastWarmupKey` and `scaleLastPracticed` updated only for done blocks.
- [ ] 26.2 Modify `src/ui/practice-view.js` and `src/i18n/strings.js` (`routine.*`): "10-minute routine" entry, block-by-block run reusing the exercise runner and ear drill screens, "Skip block", end summary listing every block as done or skipped plus days in a row. Test: `tests/ui/practice-view.test.js` additions.
- [ ] 26.3 Browser check on 8790: run the routine end to end (use skip for a block to prove it), reload and see the streak; change the system date forward one day (or inject the date in the dev console through the exposed `?today=` test hook if present, otherwise unit tests only and record that) and see a new key combination. Screenshots read.
  Learner-level acceptance: pressing "10-minute routine" gives a short, named list of four things to do today; the learner can finish them in order or skip one, and ends on a summary saying "1 day in a row".
- [ ] 26.4 Verification: `node --test` full.

## Phase 27: Practice docs and usability T5 (pr9c-practice-docs, about 200 lines)

Specs: practice-exercises, project docs rules.

- [ ] 27.1 Modify `README.md`: Practice exercises section (the exercise list, doc cards, key rotation, routine, ear drills, local progress and Reset, flagged fingerings noted); modify `docs/USABILITY_CHECK.md` (T5 routine details, Practice-specific recording fields, thresholds). Test: extend `tests/docs-guard.test.js` (README mentions Practice exercises, T5 present, usability doc links remain valid).
- [ ] 27.2 Verification: `node --test` full and `docker build -t piano-guide .`.

## Phase 28: Final close-out, what only the user can verify (in pr9c-practice-docs or a final docs-only PR `pr10c-user-verification`)

- [ ] 28.1 Add a section "Only the user can verify" to `docs/USABILITY_CHECK.md` (and mirror it in the tracker PR description), each item with how to check and where to record the result (date, device, input): (1) by-ear check of the converted private Cancer melody on the Casio, phrase by phrase, then raising `confidence` in the private file by hand; (2) Casio MIDI connection in Chrome or Edge: device name chip, hot-plug, default no app sound, the MIDI-sound toggle, and the "No MIDI device found" line if the Casio exposes only USB audio; (3) recognizing Cancer by playing it (success criterion, user confirmation recorded); (4) judging the app sound as a piano (only if samples were approved); (5) confirming the flagged fingerings (Bb RH start, F# LH start, flat-key arpeggio LH) with a teacher or book; (6) running the manual usability protocol T1 to T5 with a person who has never played, recording times, hesitations over 10 seconds and wrong-key counts, and revising thresholds with a reason; (7) the Docker run with the read-only mount on the user's machine; (8) confirming on the deployed GitHub Pages site (after the tracker merges) that only public songs appear and there is no error. Test: `tests/docs-guard.test.js` asserts the section exists and lists items 1 to 8 (counter-proof: a fixture doc without it fails).
- [ ] 28.2 Verification: `node --test` full. Final branch hygiene per project rules: `git branch -a` and `git worktree list` show only `master`, the tracker and the PR branch in progress; report anything else with `git log master..branch`.
