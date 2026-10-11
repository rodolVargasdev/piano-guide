# Design: Learn mode (a step-by-step piano teacher for people who cannot play)

## Technical Approach

Learn mode is built as **pure data modules plus thin views**, following the project's existing pattern (pure `src/core/*` tested with `node --test`, DOM views in `src/ui/*` wired with injectable dependencies, one audio clock in `src/audio/engine.js`).

- **Teacher logic is pure**: phrases, steps, fingering, transposition, instructions, the key matcher, the lesson state machine, progress, theory generators, the exercise runner and the routine builder are functions over plain objects. They never touch the DOM, Web Audio or `localStorage` directly (storage is injected), so every rule in the specs is covered by `node --test`.
- **One lesson reducer drives the screen**: the Learn view holds one state object, feeds it actions (`NOTE_ON`, `LISTEN_DONE`, `NEXT_PHRASE`...) and executes the effects the reducer returns (`listen`, `stopListen`, `save`, `announce`). The view never decides what a press means.
- **One input bus**: on-screen keys, the computer-keyboard map and Web MIDI emit the same `noteOn` / `noteOff` events; the matcher, the key states and the learner-sound rule subscribe to the bus only.
- **Silence is enforced in the engine**: `resolveLevel` stamps every timeline with `silent: isSilent(song)`; the engine schedules nothing for a timeline that is not explicitly `silent: false` (fail closed), through every entry point.
- **2D SVG keyboard** reusing `core/keyboard-layout.js` geometry; the 3D scene stays in Play along.
- **Bilingual strings** live in one catalog (`src/i18n/strings.js`) with guard tests for completeness, placeholders, typography and register.
- **Private library is a runtime option**: the catalog tries `songs-private/index.json` after the public index; absence is silent. Nothing private is committed, copied into the image, or read by tests.
- **Sampled piano is gated**: until the user approves the measured Salamander subset, the oscillator synth is the only voice and no audio file exists in the repository.

The design maps one-to-one onto the twelve spec files under `openspec/changes/learn-mode/specs/`; field names (`visibility`, `learn`, `learn.phrases`, `learn.transposeTo`, `LocalizedText`) are taken from the song-data-model delta unchanged.

## Spec amendments made in this phase

| Spec | Change | Why |
|------|--------|-----|
| song-data-model | `nocturne-op9-no2` -> `chopin-nocturne-op9-no2` (requirement text and scenario) | The shipped file and index id is `chopin-nocturne-op9-no2` (`songs/index.json`); "existing id retained" was wrong as written. |
| song-import | Beats are 1-based per section; sections concatenated in a fixed order, each `endBeat - 1` beats; pickup bar kept as a full bar; formula stated | The real captured input (`hooktheory-cancer.json`) starts every section at `beat: 1` and marks pickup sections with `pickup: true` and chords from beat 5. |
| song-import | Scenario "Beat arithmetic": tick 1200 -> 720 | With 1-based beats, beat 2.5 is 1.5 quarters after the start: `1.5 * 480 = 720`. The old value assumed 0-based beats and would shift every note one beat late. |
| song-import | Chord quality derivation from `root`, `type`, `inversion`, `applied`, `borrowed`, `adds`, `suspensions` | The real input has no quality names; it encodes harmony by degree and function (observed values: `type` 5 and 7, `inversion` 0 to 3, `applied` 0 and 5, `borrowed` "", "minor", "phrygianDominant", `adds` [9]). |
| music-theory-generators | Left-hand triad fingering is 5-3-1 for root and first inversion, 5-2-1 for second inversion (new scenario added) | The previous wording paired them like the right hand; standard left-hand fingering puts the fourth (the 5-2 gap) at the bottom in second inversion, not in first. |
| music-theory-generators | Arpeggio fingering comes from a standard table, not the five-finger assigner | The assigner would finger C4 E4 G4 C5 as 1 3 5 1 (a shift); the standard is 1 2 3 5. |
| learn-mode | Lesson zero completion is stored once for the learner, not per song, level and key | Lesson zero is not tied to a song. |
| song-import | Converter id `cancer-private`, default output `songs-private/cancer-private.json`, index upsert; new scenario "Private id never collides with the public catalog"; CLI tests skip when `tools/convert-hooktheory.mjs` is absent | The public `cancer` ships until the Milestone B swap; an equal id would trip the kept collision rule and hide the private song. The Docker test stage has no `tools/`. |
| private-song-library | Scenario ids and fixture path follow `cancer-private` | Consistency with song-import. |
| music-theory-generators | Octave shift is range first, then closest to C4 (right) or C3 (left); new scenario "Circle of fourths" | Choosing by distance first could pick a candidate outside A0 to C8; fourths was named but untested. |
| note-input, practice-exercises | Aligned strings: chip "MIDI: no device" / "MIDI: sin dispositivo"; hint "No MIDI device found. Use the computer keys or tap the keys." / "No se encontró ningún dispositivo MIDI. Use el teclado de la computadora o toque las teclas." | The two specs quoted different texts for the same state. |
| playback-engine | Omitted `bpm` means slow; an explicit `bpm` (the full-tempo stage) is allowed | The full-tempo Learn stage plays Listen at song tempo, which the old wording forbade. |
| practice-exercises | Routine summary lists done/skipped blocks and "N days in a row"; the day is recorded when at least one block is done; all skipped records nothing; new scenario "Everything skipped" | The spec did not say what a partly or fully skipped routine records. |
| song-catalog | New scenario "Song without notes offers no Learn" | The requirement existed without a scenario. |

## Resolved assumptions

| # | Assumption from spec/proposal | Decision | Rationale |
|---|------|----------|-----------|
| A1 | Exercise tempo is pacing only | **Accepted.** No timing is measured anywhere. A "clean run at tempo T" means no wrong key while the metronome was set to T. The full-tempo Learn stage means: Listen at song tempo and the metronome (if on) at song tempo during My turn. Listen at song tempo is an **explicit, non-default** call (`playRange({ ..., bpm: songBpm })`); when no `bpm` is passed, `playRange` uses the slow fraction, as the amended playback-engine spec states. | Proposal excludes rhythm scoring; honest labels avoid claiming a skill the app does not check. |
| A2 | Metronome may click in private Play along | **Accepted.** The metronome is not song data; `isSilent` blocks song notes only. Clicks follow the user's metronome toggle (default off as today). | A click track carries no melody; it helps practice along with the silent bars. |
| A3 | Converter octave rule | **Accepted as specified: offset 0 puts the tonic in octave 4** (`midi = tonicMidi(octave 4 + offset) + majorStep(degree) + alteration`). Checked against the real input: every note lies between degree 1 at offset -1 and degree 4 at offset 0, so in E major the melody spans E3 to A4, centered near middle C, which suits the right hand. Left-hand roots go to octave 2. | Real-data range check; the spec scenarios (E4, G#4, B4, D#5) follow from the same formula. |
| A4 | Usability thresholds (T1 2 min, T2 10 min per key, T3 5 min, T4 resume, T5 routine) | **Accepted as initial thresholds**, recorded in `docs/USABILITY_CHECK.md` with a "revised on" line. Changing them after the first observed session is a doc edit with a reason. | They are proposed numbers, not measured; the protocol makes revision explicit instead of silent. |
| A5 | Streak definition | **Two streaks, named differently**: `cleanStreak` per exercise and key (consecutive clean runs, reset by an unclean run); `dayStreak` for the routine (consecutive local calendar days with a finished routine; "1 day in a row"). | Spec scenarios use both meanings; one word for both would mislead. |
| A6 | `pitch.js` spelled-pitch extension | **Parser needs no change**: `PITCH_RE` already accepts `E#4`, `Cb5`, `B#3`, `Fb4` and double accidentals, and octave numbering follows the letter (`Cb5` is MIDI 71, `B#3` is MIDI 60). **What is missing is letter-preserving transposition**: the existing `transpose()` spells chromatic notes by key sharpness, so D5 in E major moved to C gives `A#4`, not the required `Bb4`. Add `transposeInterval`, `spellDegree` and `pitchFromParts` (see Interfaces). | Verified by reading `src/core/pitch.js` (`transpose` uses `SHARP_SPELLING` for fifths >= 0). |
| A7 | Scale fingering table for all 12 major keys | **Provided below**, with two flagged uncertainties. | Theory facts stated explicitly instead of generated. |
| A8 | Two-sentence instruction limit | **Accepted.** Sentence 1 always names hand, finger and note (or the move); sentence 2 only adds the key count or, for a move, the first finger to play. A guard test counts sentences and words (<= 25) for every template combination in both languages. | Matches the spec; the combinatorial test makes it a mechanical guarantee. |
| A9 | Wrong key clears the step | **Accepted.** A wrong key clears the accumulated presses of the step but never moves the lesson; the expected keys stay shaded. For a single-key step this is a no-op. | For chords it teaches pressing the whole shape cleanly; the step itself never regresses, so the learner loses nothing visible. |
| A10 | MIDI sound default off | **Accepted**, setting remembered in `localStorage` (`piano-guide:input:midi-sound`). | The Casio already sounds; doubling with latency is worse than silence. |

## Architecture Decisions

### Decision: Lesson flow as a pure reducer with returned effects

**Choice**: `src/learn/lesson.js` exports `initLesson(ctx)` and `reduce(state, action) -> { state, effects }`. The view executes effects (engine calls, storage writes, live-region text).
**Alternatives considered**: an imperative controller object with callbacks (like `ui/practice-controller.js`); a class with internal timers.
**Rationale**: every spec scenario of learn-mode (held keys, wrong key, language switch mid-chord, transposition keeps the phrase, Listen interrupted by a key) becomes a sequence of actions asserted under `node --test` without a DOM or audio. The existing controller pattern works for toggles but would hide the step logic inside event handlers.

### Decision: Matcher as its own pure reducer, exact MIDI by default, pitch class for lesson zero

**Choice**: `src/learn/matcher.js` with `startStep(expected, heldNow, { match: "exact" | "pitchClass" })` and `matchEvent(m, event) -> { m, outcome }`. Outcomes: `progress`, `satisfied`, `wrong`, `ignored`. No time window: accumulation lasts from the step start until satisfied or a wrong key.
**Alternatives considered**: a simultaneity window (for example 300 ms) for chords; counting held keys.
**Rationale**: the spec requires order-free accumulation with no time limit so a single mouse pointer can enter a chord; held-at-start keys are excluded so legato from the previous step cannot satisfy or spoil the next. Pitch-class matching serves "any C counts" in lesson zero. A same-pitch-class wrong press gets a kinder feedback variant ("Right note, other octave") but still counts as wrong, as the spec defines.

### Decision: Silent rule fails closed inside the engine

**Choice**: `resolveLevel` sets `timeline.silent = isSilent(song)` (boolean). The engine computes its schedulable notes with the pure `schedulableNotes(timeline, handModes)`, which returns `[]` unless `timeline.silent === false`. `play()` returns `{ silent }`; `playRange()` resolves `{ status: "silent" }` immediately for a silent timeline.
**Alternatives considered**: checking visibility in the Learn and Play along views; a stored `silent` field.
**Rationale**: the spec requires enforcement inside the engine so no view can play a private song by mistake. Fail-closed means a timeline built by hand (or a transposed copy that lost a field) is silent rather than audible. Existing test timelines built without `resolveLevel` (`compoundTimeline` in `engine-rig.js`) have no notes, so nothing changes for them.

### Decision: 2D SVG keyboard framed per phrase, falling back to per position

**Choice**: `src/learn/region.js` computes the visible range: all keys of the current phrase (for the hand or hands of the stage) plus one white key of margin on each side, at least 9 white keys, at most `maxWhite = floor(availableWidth / minWhitePx)`. If the phrase does not fit, the region frames the current five-finger position plus the current step (plus margin) and moves only on a shift. Region edges always land on white keys.
**Alternatives considered**: per-step framing (recentering on every note); a fixed 2-octave window; a closer 3D camera.
**Rationale**: a region that stays still for a whole phrase lets a beginner learn where things are; per-step recentering makes keys jump. SVG gives crisp labels at any size, works without WebGL, and reuses `layoutRange` geometry.

### Decision: Computer-keyboard map by physical `KeyboardEvent.code`, legend from the layout map

**Choice**: home row `KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote` (11 white keys); the upper row key physically between two home keys plays the black key between them (`KeyW` between A and S, `KeyE` between S and D, `KeyR` between D and F, and so on through `KeyO`, `KeyP`, `BracketLeft`). The map starts at the white key one below the current position's lowest key, clamped to the region, and moves only on a position shift. Printed letters come from `navigator.keyboard.getLayoutMap()` when available (Chrome, Edge), else US labels.
**Alternatives considered**: `KeyboardEvent.key` (layout-dependent letters); a fixed map at C4.
**Rationale**: `code` is the physical key, so a Spanish or AZERTY layout plays the key shown on screen; `getLayoutMap` prints what is on the learner's keycap (for example "Ñ" on `Semicolon` in a Spanish layout).

### Decision: Web MIDI only on a click, all inputs listened, hot-plug via `onstatechange`

**Choice**: `src/input/midi.js` feature-detects `navigator.requestMIDIAccess`, checks `isSecureContext`, calls `requestMIDIAccess({ sysex: false })` only from the "Connect piano" click, listens to every input, re-scans on `statechange`, and on a disconnect calls `bus.releaseAll("midi")`. A pure `parseMidiMessage(bytes)` maps `0x9n` with velocity > 0 to `on`, `0x8n` and `0x9n` velocity 0 to `off`, everything else to `null`.
**Alternatives considered**: requesting permission at load (spec forbids); listening to the first input only.
**Rationale**: matches the spec and Chrome's permission model; the Casio may appear as one or two ports, and listening to all avoids guessing.

### Decision: Learner sound through the engine's voice with held notes, separate from transport voices

**Choice**: add `startHeld` / `releaseHeld` to `synth.js` (and later the sampled voice). Held voices are flagged `learner: true`, count toward the shared voice cap, and are excluded from `cancelPending` so stopping Listen or Play along never cuts the learner's held key. The engine exposes `startNote(midi, opts)`, `releaseNote(midi)`, `releaseAllNotes()`.
**Alternatives considered**: a second synth instance for the learner; short fixed-length notes per press.
**Rationale**: one voice and one cap (spec); sounding for as long as held (spec); no stuck notes because `releaseAllNotes` runs on blur, route change and MIDI disconnect.

### Decision: Bilingual strings in one JS catalog with template keys, no library

**Choice**: `src/i18n/strings.js` exports `STRINGS = { key: { en, es } }` with `{name}` placeholders and plural pairs `key_one` / `key_other`. `src/i18n/i18n.js` exposes `createI18n({ storage, navigatorLanguage, documentElement })` with `t(key, params)`, `lang()`, `setLang()`, `onChange()`. Guard functions in `src/i18n/guards.js` are pure and also run against failing fixtures (counter-proof).
**Alternatives considered**: JSON files per language fetched at run time; `Intl.MessageFormat` style libraries.
**Rationale**: no dependency (project rule), synchronous lookup (language switch is instant, spec), one file makes the completeness test trivial.

### Decision: Instructions stored as `{ key, params }`, rendered at display time

**Choice**: steps carry `instruction: { key, params }` with language-neutral params (hand id, finger number, spelled pitch, count). Rendering happens in the view through `i18n.t`.
**Alternatives considered**: storing rendered strings per language on the step.
**Rationale**: a language switch mid-step re-renders text without touching the lesson state (spec: accumulated presses survive the switch).

### Decision: Fingering by greedy longest-run five-step positions

**Choice**: `src/theory/fingering.js` maps each note to a diatonic step index (`octave * 7 + letterIndex`, so chromatic notes take their letter's step). A position covers five consecutive step indexes. From the first unfingered group, choose the anchor that lets the longest run of following groups fit; ties prefer (1) no thumb on a black key among notes the thumb plays, (2) the thumb on a played note, (3) the anchor closest to the previous one, (4) the lowest anchor. Right hand: finger = step - anchor + 1; left hand: finger = (anchor + 4) - step + 1. Authored `finger` values pin the anchor; a conflict starts a new position. Groups wider than five steps but within 12 semitones use the stretch rule (outer notes 1 and 5; a middle note gets 2 or 3 by the smaller adjacent gap, mirrored for the left hand). Wider groups are `unplayable` and become consecutive steps, lowest first.
**Alternatives considered**: dynamic programming with a cost model (Parncutt-style); copying fingerings from sources.
**Rationale**: greedy longest-run is optimal for the number of positions (interval covering), predictable for a beginner ("the hand stays still, then moves"), and small. The stretch rule reproduces standard triad inversion fingering (1-2-5, 1-3-5; left hand 5-3-1, 5-2-1).

### Decision: Transposition by interval with letter preservation and a per-hand octave rule

**Choice**: `src/theory/transpose.js` `transposeSong(song, levelId, targetTonic)` picks the smallest move (|semitones| <= 6, a tritone goes down), moves every pitch by `{ steps, semitones }` (letters move by `steps`, so D5 in E major becomes Bb4 in C), respells chord symbol roots and slash basses the same way (romans are key-relative and stay), then per hand picks an octave shift in two ordered steps: (1) **range first**: every candidate in {0, +12, -12} that puts any note of that hand outside A0 to C8 is rejected; (2) among the survivors, the one whose mean pitch is closest to C4 (right hand) or C3 (left hand) wins, ties to 0, then to the lower shift. If no candidate survives (a hand spanning more than A0 to C8 minus an octave, impossible for real material) the function throws a `RangeError` naming the hand. Authored fingers are dropped (the schema has no value meaning "key-independent", so the spec's exception never applies today). `visibility` and every other top-level field are copied unchanged; a test asserts a transposed private song is still silent.
**Alternatives considered**: reusing `core/pitch.transpose` (wrong chromatic spelling, see A6); MIDI-only transposition with re-spelling by key (loses the degree).
**Rationale**: exact interval preservation plus correct spelling are both spec requirements; letter arithmetic gives both.

### Decision: Voice leading by dynamic programming, not greedy

**Choice**: `src/theory/progressions.js` enumerates close-position voicings of each chord inside the right-hand region (all inversions, all octaves that fit) and picks the sequence with minimal total movement (sum of absolute semitone moves between sorted voices) by Viterbi over the chords, the first chord fixed in root position, ties broken toward the lower voicing.
**Alternatives considered**: greedy next-chord choice.
**Rationale**: the spec scenario "total movement <= the all-root-position sequence" is guaranteed by a global optimum because the all-root sequence is one of the candidates; greedy can lose it. Sizes are tiny (4 chords x about 6 voicings).

### Decision: Hooktheory converter pure module in `src/import/`, thin CLI in `tools/`

**Choice**: `src/import/hooktheory.js` (pure, imports `core/pitch.js`, `core/timing.js`, `core/schema.js`); `tools/convert-hooktheory.mjs` reads, converts, validates and writes. The pure module ships in `src/` so the Docker test stage (which copies `src/` and `tests/` but not `tools/`, excluded by `.dockerignore`) runs its tests. The CLI tests (`tests/import/cli.test.js`) check `existsSync(tools/convert-hooktheory.mjs)` and are skipped with a reason when it is absent, so they run locally and skip in the image.
**Ids and paths**: the converter writes id **`cancer-private`** to **`songs-private/cancer-private.json`** (the index rule requires `file` = id + `.json`) and upserts that entry in `songs-private/index.json`. The id differs from the public `cancer` on purpose: during Milestone A the public chords-only `cancer` still ships, and the kept collision rule (private id equal to a public id -> private entry unavailable) would otherwise hide the private song. After the Milestone B swap removes the public `cancer`, the private id stays `cancer-private` so saved progress keys do not change.
**Alternatives considered**: `tools/lib/hooktheory.mjs` with Dockerfile and `.dockerignore` changes.
**Rationale**: no image build changes for one module; the module holds no data, only conversion code. It is never imported by the app.

### Decision: Private index read with a three-state fetch

**Choice**: `fetchJsonOrAbsent(url)` returns `{ status: "absent" }` for a network failure, a non-2xx status, or a content type that is not JSON (GitHub Pages returns an HTML 404 page; some servers return HTML with 200); `{ status: "invalid", reason }` when the body is JSON-typed but does not parse or validate; `{ status: "ok", json }` otherwise.
**Alternatives considered**: reusing `defaultFetchJson` (throws on any failure, cannot tell absent from broken).
**Rationale**: the spec separates "absent: no message" from "present but invalid: one notice".

### Decision: Sampled piano behind an explicit STOP gate, code and assets in the same slice

**Choice**: Milestone B has a measurement task that records the exact source URL, version or commit, file list, format, per-file and total size, license text and vulnerability status, then **stops** for the orchestrator to announce it. Only after approval does one slice add `src/audio/sampler.js`, `src/audio/voice.js`, `assets/audio/piano/*`, the license file, the credit line, the MIME and cache rules, and the `docs/STACK_TECNOLOGICO.md` entry, in the same commit.
**Alternatives considered**: landing the sampler code first behind a flag.
**Rationale**: unused code waiting for an asset is dead weight and invites a half-done state; the spec says nothing changes before approval.

## Learner experience

### Learn screen layout

The Learn view has one column and a fixed vertical order. Nothing scrolls during My turn on the three reference viewports: the instruction and the keys to press are always on screen together.

```
+--------------------------------------------------------------+
| <- Catalog   Ode to Joy        [Right hand v] [EN|ES]  (gear)|  top bar
+--------------------------------------------------------------+
| Phrase 2 of 6  .  o o o * o o o o   Step 4 of 8              |  progress line
|                                                              |
|   Right hand: thumb on E (Mi).                               |  instruction card
|   Press these 3 keys together.                               |  (1 or 2 sentences)
|                                [Correct] / [Try again] chip  |  feedback chip
|                                                              |
|  [ Listen again ]   [ Repeat phrase ]                        |  actions
+--------------------------------------------------------------+
|  Fa#   Sol#  La#        Do#  Re#                             |  black-key name strip
| +--+-##-+-##-+-##-+--+--+-##-+-##-+--+                       |
| |  |    |    |    |  |  |    |    |  |                       |  SVG keyboard
| | (1)   |   (3)   | (5)  |    |    |  |                       |  finger badges on keys to press
| |Mi|Fa  |Sol |La  |Si|Do|Re  |Mi  |Fa|                       |  note names on every white key
| |E |F   |G   |A   |B |C |D   |E   |F |                       |
| +--+----+----+----+--+--+----+----+--+                       |
|  a  s    d    f    g  h  j    k    l   <- computer key letters|
+--------------------------------------------------------------+
| Computer keys: on | MIDI: Casio CDP-S100 | [Connect piano]   |  input panel (chips)
| [ ] Sound from the app for MIDI                              |
+--------------------------------------------------------------+
```

(The diagram is schematic: in the real keyboard the computer-key letter sits inside each key above the note names; black-key names sit in the strip above the keys because a 21 px black key cannot hold "Sol#" at 12 px.)

What is on screen at each moment:

| Moment | Instruction card | Actions | Keyboard |
|--------|------------------|---------|----------|
| First screen | Song title, key ("E major"), one line "Learn it phrase by phrase." | Primary "Start" or "Continue"; secondary "Start over" (only with progress); "Lesson zero" (when never done); hand selector; transposition toggle (when `learn.transposeTo`); level selector (only when >1 level has notes) | Region of the first phrase, names only, no shading |
| Phrase intro (public) | "Phrase 2 of 6." plus the phrase `hint` when authored | Primary "Listen"; secondary "My turn" | Region of the phrase, no shading |
| Listening | "Listen." | Primary "My turn" (stops Listen) | Keys light as they sound (sounding state, no finger badges) |
| My turn | The step instruction (one or two sentences) | "Listen again" (public only), "Repeat phrase" | Step keys shaded, outlined, finger badges; position keys with quiet finger markers |
| Wrong key | Instruction unchanged; chip "Try again" plus one kind line ("Use the shaded key.") | Same | Wrong key hatched with an "x" for 1.2 s; expected keys stay shaded |
| Correct (transient) | Chip "Correct" for 0.7 s while the next step is already active | Same | Satisfied keys show a check for 0.7 s |
| Phrase complete | "Correct. Phrase 2 of 6 done." | Primary "Next phrase"; "Repeat"; (B) "Next stage" | Region of the next phrase |
| Song complete | "You played the whole song." | "Next stage" (B), "Play along", "Catalog" | Hidden |

Sizes by viewport (CSS pixels; measured against the layout in `styles/app.css`, which already has a `max-height: 480px` landscape rule and a `max-width: 40rem` rule):

| Element | 1440 x 900 | 844 x 390 landscape | 390 x 844 portrait |
|---------|-----------|---------------------|--------------------|
| Site header | visible (about 56) | hidden in Learn (back arrow in the top bar) | visible (about 48) |
| Top bar | 56, all controls inline | 40, hand and language inline, transposition and level inside the gear disclosure | 48 title + language; second row 40 with hand and transposition |
| Instruction text | 28 px, max 2 lines, card about 120 tall | 18 px, max 2 lines, about 52 tall, actions on the same row to the right | 20 px, max 3 visual lines (2 sentences), about 100 tall |
| Action buttons | 48 tall | 36 tall | 48 tall, full-width pair |
| Keyboard white keys | width `min(88, 1168 / n)`; 11 keys -> 88 wide, 300 tall | width `min(80, 820 / n)`; 11 keys -> 74 wide, about 230 tall (fills remaining height) | width `floor(374 / n)` with n <= 10; 9 keys -> 41 wide, 180 tall |
| Max white keys (`maxWhite`) | 15 at 72 px min | 15 at 54 px min | 10 at 36 px min |
| Note names on white keys | 18 px primary, 14 px secondary | 14 / 12 | 13 / 12 |
| Finger badge | 30 px diameter, 20 px digit | 24 / 16 | 22 / 15 |
| Black-key name strip | 24 tall, 14 px | 20 tall, 12 px | 20 tall, 12 px |
| Input panel | one row of chips, 44 tall | one row, 32 tall, MIDI sound toggle inside the gear | two rows, about 72 |
| Total at rest | about 640 of 900 | about 380 of 390 | about 560 of 844 |

Minimums from the learn-keyboard spec hold everywhere: white keys >= 36 px at 360 px width, labels >= 12 px. When the phrase does not fit `maxWhite`, the region switches to per-position framing (see Decision above), never to smaller labels.

### The 2D SVG keyboard (`src/ui/learn-keyboard.js`)

- **Geometry**: `layoutRange(region)` from `core/keyboard-layout.js`; the SVG `viewBox` is in white-key units (`width` = region white count, height 4.2 for white keys, black keys `BLACK_LENGTH_RATIO` of that). CSS sets the rendered width; the height follows the aspect ratio capped per viewport (table above).
- **Names on every key**: white keys show two lines at the bottom: primary name in the selected language order (Spanish: "Mi" over "E"; English: "E" over "Mi"). Black keys show their name in the strip above, spelled for the current key: the scale spelling when the pitch class belongs to the key, else the spelling of the step's data pitch when it is expected, else sharps for keys with fifths >= 0 and flats for fifths < 0. With no key context (lesson zero) black keys show both spellings ("Do# / Reb"). Spelling uses `core/pitch.noteName` on spelled pitches, so E# and Cb appear correctly in F# and Gb contexts.
- **Keys to press now**: fill tint of the hand color, 3 px outline (solid for the right hand, double line for the left), and a finger badge: right hand a **circle**, left hand a **rounded square**, digit in high contrast. Hands together: each badge also carries a small hand letter (R/L in English, D/I in Spanish) so grayscale or color-blind viewing still separates hands. Colors reuse the app's hand palette: right hand amber `#f59e0b`, left hand blue `#3b82f6`.
- **Hand-position keys not required now**: a quiet small digit at the bottom edge in the muted text color (MAY in the spec; shown because it tells the learner where each finger rests).
- **No preview of the following step** during My turn: one thing at a time; Listen already shows the motion. (A dashed preview was considered and rejected as competing for attention.)
- **Computer-key letters**: when the computer input is on, each mapped key shows its keycap letter in a small rounded box near the top of the key (white keys) or at the bottom of the black key; letters update when the map moves.
- **States**:
  - pressed: darker fill and a 2 px downward offset while held, from any source;
  - wrong: diagonal hatch pattern plus an "x" mark for 1.2 s, and the live region says "Try again";
  - correct: check mark for 0.7 s, live region says "Correct";
  - sounding (Listen): the hand color fill without outline or badge.
  None relies on color alone (offset, hatch, mark, outline). Under `prefers-reduced-motion: reduce` there are no transitions; states still show for the same durations.
- **Pointer and touch**: each key `<rect>` has `data-midi`; `pointerdown` emits `noteOn` (source `screen`), `pointerup`, `pointercancel` and `pointerleave` emit `noteOff`; pointers are tracked by `pointerId` so several touches play several keys; no pointer capture (so sliding off ends the note); the SVG has `touch-action: none`. Black keys are drawn after white keys so their larger hit area wins.
- **Accessibility**: the SVG is `role="group"` with an `aria-label` naming the region ("Keyboard, E3 to A4"); a polite live region (`aria-live="polite"`) carries Correct / Try again and the instruction text after each step change.
- **Shared**: the same component (`createLearnKeyboard({ mount, i18n, bus })` with `setRegion`, `setKeyContext`, `setStepKeys`, `setPositionKeys`, `setLetters`, `flashWrong`, `flashCorrect`, `setSounding`) serves Learn, lesson zero and Practice exercises.

### Step flow state machine (`src/learn/lesson.js`)

```
             START / CONTINUE
  [start] ------------------------+
     |  LESSON_ZERO (B)           |
     v                            v
 [lessonZero] --DONE/SKIP--> [phraseIntro] --LISTEN--> [listening]
                               |   ^  (public only)      |   |
                MY_TURN        |   |            LISTEN_DONE | MY_TURN or NOTE_ON
     (private: entered directly)   |                     v   v
                               +-->[yourTurn] <----LISTEN_AGAIN returns here
                                      |   NOTE_ON/NOTE_OFF -> matcher
                                      |   satisfied on last step
                                      v
                               [phraseComplete] --NEXT_PHRASE--> [phraseIntro]
                                      |  REPEAT -> [yourTurn] (step 1)
                                      |  last phrase of the stage
                                      v
                               [stageComplete] (B) --NEXT_STAGE--> [phraseIntro]
                                      |  last stage of the song
                                      v
                               [songComplete]
```

State shape (data only, no DOM):

```js
{
  phase: "start" | "lessonZero" | "phraseIntro" | "listening" | "yourTurn" | "phraseComplete" | "stageComplete" | "songComplete",
  songId, levelId, keyTonic,          // keyTonic: original or transposed tonic
  silent,                              // from the timeline: no Listen when true
  hand: "R" | "L" | "T",               // T = hands together (B)
  stage: { scope: "phrase" | "section" | "song", tempo: "slow" | "full", index },  // (B)
  phrases, phraseIndex,
  steps, stepIndex,
  matcher,                             // see matcher.js
  feedback: null | { kind: "correct" | "wrong" | "octave", midi, at },
  dirty                                // progress needs saving
}
```

Transitions and effects (excerpt; the reducer test table covers each row):

| From | Action | To | Effects |
|------|--------|----|---------|
| start | START | phraseIntro (public) or yourTurn (silent) | `save` |
| start | CONTINUE | phraseIntro / yourTurn at the saved phrase, stage, hand | none |
| phraseIntro | LISTEN | listening | `listen { startTick, endTick, hand, bpm }` |
| listening | LISTEN_DONE | yourTurn (step 1) | none |
| listening | MY_TURN or NOTE_ON | yourTurn (step 1, the pressed key counts as held at start) | `stopListen` |
| yourTurn | NOTE_ON expected | yourTurn (progress) or next step (satisfied) | `announce correct` on satisfied |
| yourTurn | NOTE_ON unexpected | yourTurn, accumulation cleared | `announce wrong` |
| yourTurn | NOTE_ON while satisfied on last step | phraseComplete | `save`, `announce phraseDone` |
| yourTurn | LISTEN_AGAIN | listening (returns to the same step on LISTEN_DONE) | `listen` |
| any | SET_LANG | same state | none (the view re-renders text) |
| any with steps | SET_KEY (transposition) | phraseIntro / yourTurn of the same phrase index, step 1 | `save` (transpose choice) |
| any | SET_HAND | phraseIntro of the same phrase for the new hand (skipped when the hand has no notes in it) | `save` |
| any | LEAVE | unchanged | `stopListen`, `releaseAll` |

"Correct" is a transient feedback flag: the state moves to the next step in the same reducer call, so a fast learner never loses a press. Listen on a silent timeline never happens because the reducer never emits `listen` when `silent` is true, and the engine would refuse it anyway (two independent guards).

Stages (Milestone B, `src/learn/stages.js`): for each phrase the stage list is `[R slow, L slow, T slow, T full]` filtered by which hands have onsets in that phrase (a hand with no notes drops its stage; with one hand, "together" equals that hand and is dropped). After all phrases of a section: one section stage (`T full`, or the only hand); after all sections: one song stage. Slow tempo = `effectiveBpm({ userBpm: song bpm, slowMode: true })` (the existing 0.5 fraction); full tempo = song bpm, passed explicitly to `playRange` (the non-default case; omitted `bpm` means slow). Tempo affects Listen and the metronome only (A1).

Lesson zero (Milestone B, `src/learn/lesson-zero.js` + `src/ui/lesson-zero-view.js`): four parts as data. Part 1 uses the matcher in `pitchClass` mode with expected pitch class 0 on a C3 to B4 region with the 2-black-key groups outlined; part 2 is a text plus a static SVG drawing (`assets/img/posture.svg`, original artwork) and "Next"; part 3 is five single-key steps C4 D4 E4 F4 G4 with fingers 1 to 5; part 4 shows the input panel live, a one-line Casio hint ("Connect the piano's USB TO HOST port to the computer, then press Connect piano.") and the no-MIDI line when applicable. Completion or skip is saved globally.

### Input bus (`src/input/`)

```js
// bus.js
createNoteBus() -> {
  noteOn(midi, { source, velocity = 0.7 }),   // ignored when (source, midi) is already held: auto-repeat guard
  noteOff(midi, { source }),                  // ignored when not held
  releaseAll(source?),                        // noteOff for every held note (of that source)
  held() -> Set<midi>,                        // union over sources
  on("noteOn" | "noteOff", fn) -> unsubscribe,
  dispose()                                   // releaseAll + drop listeners
}
// event: { type, midi, source: "screen" | "computer" | "midi", velocity, time }
```

Subscribers in order: learner sound (first, so sound is never delayed), keyboard states, lesson reducer. Dispatch is synchronous.

Computer keyboard (`computer-keys.js`):
- `keyMapFor(region, anchorMidi) -> Map<code, midi>` pure (tested): 11 white keys from the anchor white key on the home row, black keys on the upper row as described in the Decision.
- Listener ignores events with `ctrlKey`, `altKey` or `metaKey`; events whose target is `input`, `select`, `textarea` or `[contenteditable]`; codes outside the map; and `event.repeat`. For a mapped key it calls `preventDefault()` (so `'` does not open Firefox quick find and Space-like keys do not scroll) and remembers `code -> midi` at press time, so keyup releases the right note even if the map moved.
- `window` `blur` and `visibilitychange` (hidden) call `bus.releaseAll("computer")`.
- The legend (letters on keys) comes from `navigator.keyboard.getLayoutMap()` when present, else a US table. The README documents the map.

Web MIDI (`midi.js`): state machine `unsupported | insecure | idle | requesting | denied | no-device | connected | unavailable`, each rendered as one chip line: "MIDI: not available in this browser", "MIDI: needs a secure page", "MIDI: not connected" + [Connect piano], "MIDI: permission denied (allow it in the site settings)", "MIDI: no device" / "MIDI: sin dispositivo" with, after a Connect attempt found nothing, one hint line "No MIDI device found. Use the computer keys or tap the keys." / "No se encontró ningún dispositivo MIDI. Use el teclado de la computadora o toque las teclas." (string keys `input.midi.noDevice` and `input.midi.noDeviceHint`; the same strings serve Learn, lesson zero and Practice, as aligned in the note-input and practice-exercises specs), "MIDI: <device name>" (and "+1" when several), "MIDI: could not start". `isSecureContext` is true for `http://localhost` (dev server and Docker on the owner's machine). Device name: `input.name`, prefixed with `input.manufacturer` when the name does not already contain it.

Learner sound (`learner-sound.js`): `createLearnerSound({ bus, engine, settings })` subscribes to the bus; for `screen` and `computer` sources it always calls `engine.startNote` / `engine.releaseNote`; for `midi` only when the remembered setting is on. Wrong keys sound like any key (the rule never consults the matcher).

### Chord matcher window

There is **no time window**: from the moment a step starts, every new note-on of an expected key is added to the accumulated set; the step is satisfied when the set equals the expected set. A step is never failed by waiting. A wrong key clears the set. Keys held at step start are excluded until released and pressed again. For hands-together steps the expected set is the union of both hands. This satisfies "80 ms then 200 ms apart", "one by one with a mouse", and "held from the previous step".

Ear-drill play-back answers (Milestone C) use a different, explicit window: notes pressed since the question started (or since the last wrong answer), compared by pitch class for chords and by the semitone distance from the first pressed note for intervals; any octave counts.

### i18n (`src/i18n/`)

- `strings.js`: about 200 keys grouped by prefix: `common.*` (Correct, Try again, Listen, My turn, Continue, Start over, Reset progress, Play along, Practice exercises, Private), `hand.*`, `finger.*` (thumb/pulgar, index/índice, middle/medio, ring/anular, little finger/meñique), `step.*` instruction templates, `stage.*`, `lz.*` (lesson zero), `input.*` (chips), `catalog.*`, `interval.*` (minor second to octave; tercera mayor, quinta justa, octava...), `quality.*`, `ex.<id>.{title,goal,why,how,good}`, `routine.*`.
- Templates (examples; both languages per key):
  - `step.one`: "{hand}: {finger} on {note}." / "{hand}: {finger} en {note}."
  - `step.together_other`: "Press these {count} keys together." / "Presione estas {count} teclas a la vez." (`_one` is never used for chords, but exists for completeness)
  - `step.move`: "Move the {hand}: thumb on {thumb}." / "Mueva la {hand}: pulgar en {thumb}."
  - `step.thenPlay`: "Then {finger} on {note}." / "Luego, {finger} en {note}."
  - `step.both`: "Both hands: {right} right, {left} left." / "Ambas manos: {right} con la derecha, {left} con la izquierda."
  - `note` param renders as "E (Mi)" in English and "Mi (E)" in Spanish (fixed-do solfege, both languages).
- `i18n.js`: `pickLanguage(saved, navigatorLanguage)` pure (saved wins; else `es` when the browser language starts with `es`; else `en`); `format(template, params)` pure; `t(key, params)` with plural selection by `params.count` and fallback to English, never a raw key (the raw key is only logged with `console.warn` in development). `setLang` saves to `piano-guide:lang` (errors swallowed), sets `document.documentElement.lang`, and notifies subscribers synchronously.
- `guards.js` pure checkers, each with a failing fixture test:
  - `missingTranslations(table)` -> keys lacking a non-empty `en` or `es`;
  - `placeholderMismatches(table)` -> keys whose `{...}` sets differ between languages;
  - `forbiddenTypography(table)` -> U+2014, U+2013, U+00B7, U+2026, U+201C, U+201D, U+2018, U+2019, U+2192, U+2022, U+00A0;
  - `voseoForms(table)` -> a listed set: "vos", "podés", "tenés", "querés", "sabés", "mirá", "tocá", "presioná", "poné", "dejá", "escribí", "hacé", "fijate", "acá" (whole-word, case-insensitive);
  - `instructionLimits(render)` -> any generated instruction over 2 sentences or 25 words, enumerated over all hands x fingers x counts 1 to 5 x move/no move x both languages.
- Song text: `core/text.js` `textOf(value, lang)` returns the string for plain strings and `value[lang] ?? value.en` for `LocalizedText`. `lesson-card.js` uses it.

### Private library loading

```
catalog start
  -> fetch songs/index.json (unchanged behavior, errors shown)
  -> fetchJsonOrAbsent("songs-private/index.json")
       absent   -> catalog = public entries, no message
       invalid  -> public entries + one notice "The private library could not be read."
       ok       -> validateIndex; each entry: fetch songs-private/<file>,
                   validateSong, require visibility "private" (else unavailable),
                   id collision with a public id -> unavailable "id already used by a public song"
                   entries appended after public ones with private: true
  -> for every entry (public and private): when the entry declares visibility and it
     differs from the song file's visibility -> unavailable "index and file disagree on visibility"
  -> card actions: canLearn(song) = some level has at least one non-rest note;
     no Learn action otherwise (Play along stays)
```

Homes for the two catalog rules:
- **Learn gating**: pure `canLearn(song)` exported from `src/ui/catalog.js` (uses `core/timeline.resolveLevel` per level, true when any level has a pitched note); `card()` omits "Learn" when false; the Learn view shows "Song not found"-style "This song has no notes to learn" when opened by hash. Tests: `tests/ui/catalog.test.js` (fixture whose levels have empty `notes` renders no Learn link; a normal fixture renders both).
- **Index and file visibility agree**: pure `visibilityMismatch(entry, song)` in `src/core/schema.js` (returns null or a reason); used by `loadCatalog` at run time (entry unavailable) and by `tests/songs.test.js` over `songs/index.json` (the song-data-model scenario "Index and file disagree"), with a counter-proof fixture pair (entry says private, file has none) that must fail. The private-index test in `tests/private-local.test.js` applies the same check and is skipped when the folder is absent.

The same `loadCatalog` feeds the catalog, Play along and Learn, so a deep link `#/learn/<private-id>` on Pages resolves to the plain "Song not found" (the entry does not exist there). A public file declaring `visibility: "private"` is marked unavailable at run time too (defense in depth beside the guard test).

Serving: `tools/serve.mjs` already serves the working tree (so `songs-private/` works when present); it gains `NO_PRIVATE=1` (answer 404 under `/songs-private/`, to rehearse the Pages behavior locally without moving files) and always 404s `/songs-private/sources/` (the raw capture is never served). nginx gains `location ^~ /songs-private/sources/ { return 404; }` and `location ^~ /songs-private/ { expires -1; types { application/json json; } }`; nothing is copied into the image, and the README documents `docker run -v <path>/songs-private:/usr/share/nginx/html/songs-private:ro`.

### Engine refusal for private songs

`core/visibility.js` `isSilent(song)`; `core/timeline.js` copies it to `timeline.silent`; `core/practice.js` gains `schedulableNotes(timeline, handModes)`; the engine uses it in `setTimeline`, `setHandModes`, `sustain` and `playRange`. Tests with the recording synth from `tests/audio/engine-rig.js`: play, loop, seek-and-play, every level and any range of a private fixture record zero `playNote` calls; the clock and `position()` still advance; a public fixture is unchanged (the existing 741 tests keep passing); a hand-built timeline without `silent` schedules nothing (fail closed). The player (`ui/player.js` and `ui/transport.js`) labels the play button "Play (no sound)" when `play()` reports `silent`.

### Sampled piano loader and the STOP gate (Milestone B)

Before approval: `synth.js` only; a guard test (`tests/assets-guard.test.js`) asserts no file with an audio extension exists under `assets/` without a stack entry (so before approval there are none). In Docker the guard sees the whole `assets/` tree because the test stage copies `assets/` instead of only `assets/vendor/` (see File Changes, `Dockerfile`); locally it reads the working tree.

The STOP gate task (apply phase) measures and reports, then stops:
1. Source URL and exact version or commit of the Salamander Grand Piano set chosen (original by Alexander Holm, CC BY 3.0), and of any web-encoded redistribution used (its own license must be compatible).
2. File list: proposed one velocity layer, sample points every 3 semitones (the set's native C, D#, F#, A points), restricted to the app's range in practice (proposal: A0 to C8 is 30 points; a C2 to C7 subset is 21), so the maximum pitch distance is 1.5 semitones (<= 3 required).
3. Format decodable by `decodeAudioData` in Chrome, Edge, Firefox and Safari (MP3 or AAC in M4A; not FLAC or Ogg for Safari), per-file and total size in KB.
4. License text and attribution line; vulnerability check (assets carry no code; record "N/A: static audio").
5. The orchestrator announces: what, why, exact version, size, rejected alternatives (Tone.js Sampler: npm runtime library; GM soundfonts as JS: larger, unclear provenance; better oscillator: still not a piano).

After approval (one slice): `src/audio/sampler.js` (`createSampler(ctx, { manifest, baseUrl, fetch })`: lazy load after the first gesture, `decodeAudioData`, `nearestSample(midi, points)` pure, `playbackRate = 2 ** ((midi - sample) / 12)`, same interface as the synth including `startHeld`/`releaseHeld`, release by gain ramp, shared voice cap), `src/audio/voice.js` (`createVoice(ctx)`: per note, the sampler when that sample is decoded, else the synth; a fetch or decode failure marks the sample point failed and keeps using the synth, no error shown), `assets/audio/piano/manifest.json` (file, midi, sha256), `assets/audio/piano/LICENSE.txt`, credit line in the Learn and Practice footers, `nginx.conf` `location ^~ /assets/audio/ { types { audio/mpeg mp3; audio/mp4 m4a; application/json json; } expires 1y; }`, `tools/serve.mjs` audio MIME types and `Cache-Control: public, max-age=31536000, immutable` for `/assets/audio/`, and the `docs/STACK_TECNOLOGICO.md` entry, all in one commit. The CSP needs no change: `fetch` is `connect-src 'self'` and Web Audio decoding needs no `media-src`.

Downloading the samples is network access: the apply phase asks before fetching if the runtime requires it.

### Ode to Joy source protocol (Milestone B)

1. Search Mutopia Project first (LilyPond source is machine-readable text), then IMSLP, for Beethoven's Symphony No. 9 finale theme or a public-domain piano reduction or arrangement of the "Freude" theme. Accept only Mutopia "Public Domain", "CC BY" or "CC BY-SA" licenses, or IMSLP files tagged Public Domain (US) with the license line visible.
2. Download the source file; record piece page URL, file URL, Mutopia or IMSLP ID, license, SHA-256 of the exact file, access date.
3. Extract the theme's notes **from the file only** into a test fixture `tests/fixtures/<source>-ode-to-joy-onsets.json` (onset tick, spelled pitch, duration, with the source SHA-256), following the existing `tests/fixtures/mutopia-chopin-op9n2-onsets.json` pattern.
4. Build `songs/ode-to-joy.json`: right-hand melody transposed from the source key (D major in the symphony) to C major with `transposeInterval`, `transcribed: true`, `what` stating the bars taken, the reduction to the theme, and the transposition; `learn.phrases` for the four 4-bar phrases; an easy left hand (roots or simple fifths, `role: "bass"`) taken from the source's bass when the source has one, otherwise written as an original arrangement and recorded with a second source of kind `original-arrangement`.
5. A test asserts the song's right-hand melody equals the fixture transposed by the recorded interval, so the file cannot drift from the source.
6. If no qualifying source is found, the task stops and reports; nothing is written from memory. A `LICENSE-ode-to-joy.md` is added when the source license requires attribution (as for the Chopin file).

### Practice exercises (Milestone C)

Pure generators (`src/theory/`), runner and progress (`src/practice/`), one view (`src/ui/practice-view.js`) that reuses the learn keyboard, the input bus, the input panel and the matcher.

- **Exercise catalog** (`src/practice/catalog.js`), ids and groups: `five-finger`, `scale-major`, `triads`, `arpeggios`, `cadence-i-iv-v-i`, `progression-i-vi-iv-v`, `progression-i-v-vi-iv`, `ear-intervals`, `ear-chords`, `routine`. Each has `group`, `generate(options)`, `tempoSteps` (for example scales `[50, 60, 72, 88]`, all within 20 to 240), and doc-card string keys `ex.<id>.{goal,why,how,good}` (tempo steps render from data with a localized label).
- **Runner** (`src/practice/runner.js`): turns a generated sequence (`[{ keys: [{midi, pitch, finger, hand}] }]`) into steps for the same matcher; tracks `clean` (false after any wrong key); stages for scales and arpeggios R, L, then T (both hands' keys per step). `nextTempo(steps, current, clean) -> { bpm, top }` pure.
- **Metronome**: an empty generated timeline from the new `core/timeline.makeTimeline({ meter: { num: 4, den: 4 }, bpm, bars: 64 })`, which returns `{ meter, pickupTicks: 0, tempo: { bpm, beatUnit: "quarter" }, lengthTicks, notes: [], chords: [], sections: [], pedal: [], analysis: [], range: null, shifts: new Set(), silent: false }` (no notes, so `silent: false` schedules nothing but lets the clock and clicks run), on the engine with `setMetronome({ enabled })`; started with the run, stopped on run end or view dispose. Accent on beat 1 via the existing `beatGrid`.
- **Key rotation**: `keyOrder({ kind: "fixed" | "random" | "circle", direction: "fifths" | "fourths" = "fifths", start = "C", list, seed, count })` (fourths is the circle reversed: C F Bb Eb Ab Db F# B E A D G); "Next key" announces the key in one line and reframes the keyboard.
- **Ear drills** (`src/practice/ear.js`): session reducer over seeded questions from `src/theory/drills.js` (mulberry32 PRNG in `src/theory/random.js`); options start at {M3, P5, P8} or {major, minor} and grow after 8 of 10 correct (order P4, m3, M6, M2, m6, m7, M7, TT, m2; then dim, aug); second wrong pick reveals the answer; "Listen again" is free; count "7/10". Playback through `engine.playNotes` (generated notes only; a guard test asserts Learn modules never import it).
- **Progress** (`src/practice/progress.js`), key `piano-guide:practice:v1`: `{ exercises: { [id]: { [key]: { cleanStreak, bestTempo, cleanRuns, lastPracticed } } }, routine: { lastDate, dayStreak, lastWarmupKey, scaleLastPracticed: { [key]: date } } }`; corrupt or blocked storage reads as empty, writes are swallowed. `clearPracticeProgress(storage)` removes the key; the section's "Reset progress" button calls it after one `confirm` step (an inline "Reset? Yes / No" pair, no dialog), then re-renders an empty summary. Functions: `readPracticeProgress(storage)`, `recordRun(progress, { exerciseId, key, bpm, clean, date })`, `recordRoutine(progress, { date, blocks })`, `clearPracticeProgress(storage)`.
- **Unknown exercise**: `parseHash("#/practice/<id>")` returns the raw id; `practice-view.js` looks it up in the catalog and, when absent, renders the plain message "Exercise not found" / "Ejercicio no encontrado" (string key `practice.notFound`) with a link back to `#/practice`; the id is shown only through text nodes.
- **Routine session**: `src/practice/routine.js` also exports `routineReducer(session, action)` with actions `DONE_BLOCK`, `SKIP_BLOCK`, `END`; each block ends as `done` or `skipped`. Skipping the last open block ends the routine. The summary lists every block with its status and "{count} days in a row" / "{count} días seguidos" (plural keys `routine.daysInRow_one` "1 day in a row" / "1 día seguido"). **Decision**: the day is recorded (`recordRoutine`) when at least one block is `done`; a routine with every block skipped records nothing and leaves `dayStreak` unchanged. Rationale: the streak should count days the learner actually practiced, and a partly skipped routine is still practice (spec scenario "Skip a block" on the last block after three done blocks records the day).
- **Routine** (`src/practice/routine.js`) `buildRoutine(progress, isoDate) -> { blocks: [...] }`: warm-up five-finger in the key after `lastWarmupKey` on the circle of fifths (C first), 2 min; scale in the least recently practiced key (never practiced first, in introduction order C G D F A E B Bb Eb Ab Db F#), 3 min; chord drill alternating triads/inversions and the I-IV-V-I cadence by day parity, in the scale key, 3 min; ear drill alternating intervals and chords by day parity, 2 min. Total 10 (within 9 to 11). Same progress and date give the same routine; a recorded routine (at least one block done) updates `lastDate`, `dayStreak` (+1 when `lastDate` was yesterday, unchanged when `lastDate` is today, else 1), and only for done blocks `lastWarmupKey` and `scaleLastPracticed`.

### Scale fingering table (all 12 major keys)

Fingers for degrees 1 to 7 of a continuing octave (`cycle`), the finger on the very first note (`start`) and on the final top note (`top`). One octave ascending = `start`, `cycle[1..6]`, `top`; two octaves = `start`, `cycle[1..6]`, `cycle[0..6]`, `top`. Descending reverses notes and fingers. Right hand in octave 4, left hand in octave 3 (one octave lower for two-octave left-hand scales when needed to stay above C2).

| Key | RH start | RH cycle (1 2 3 4 5 6 7) | RH top | LH start | LH cycle (1 2 3 4 5 6 7) | LH top |
|-----|---|---|---|---|---|---|
| C | 1 | 1 2 3 1 2 3 4 | 5 | 5 | 1 4 3 2 1 3 2 | 1 |
| G | 1 | 1 2 3 1 2 3 4 | 5 | 5 | 1 4 3 2 1 3 2 | 1 |
| D | 1 | 1 2 3 1 2 3 4 | 5 | 5 | 1 4 3 2 1 3 2 | 1 |
| A | 1 | 1 2 3 1 2 3 4 | 5 | 5 | 1 4 3 2 1 3 2 | 1 |
| E | 1 | 1 2 3 1 2 3 4 | 5 | 5 | 1 4 3 2 1 3 2 | 1 |
| B | 1 | 1 2 3 1 2 3 4 | 5 | 4 | 1 3 2 1 4 3 2 | 1 |
| F# | 2 | 2 3 4 1 2 3 1 | 2 | 4 | 4 3 2 1 3 2 1 | 4 |
| Db | 2 | 2 3 1 2 3 4 1 | 2 | 3 | 3 2 1 4 3 2 1 | 3 |
| Ab | 3 | 3 4 1 2 3 1 2 | 3 | 3 | 3 2 1 4 3 2 1 | 3 |
| Eb | 3 | 3 1 2 3 4 1 2 | 3 | 3 | 3 2 1 4 3 2 1 | 3 |
| Bb | 2 | 4 1 2 3 1 2 3 | 4 | 3 | 3 2 1 4 3 2 1 | 3 |
| F | 1 | 1 2 3 4 1 2 3 | 4 | 5 | 1 4 3 2 1 3 2 | 1 |

`cycle[k]` is the finger on degree k + 1 inside a continuing octave (so for the C left hand the middle C takes the thumb and D the crossing 4th finger). Checks against the spec: C RH one octave = 1 2 3 1 2 3 4 5; C LH = 5 4 3 2 1 3 2 1; F RH = 1 2 3 4 1 2 3 4; C RH two octaves = 1 2 3 1 2 3 4 1 2 3 1 2 3 4 5 (15 notes); C LH two octaves = 5 4 3 2 1 3 2 1 4 3 2 1 3 2 1; B LH one octave = 4 3 2 1 4 3 2 1; Bb RH = 2 1 2 3 1 2 3 4; F# LH = 4 3 2 1 3 2 1 4. A table test asserts these sequences. Spelling uses `spellDegree`, so F# major has E#.

Flagged uncertainties (verify with a teacher; a doc-card line says "standard fingering; some books differ"):
- **Bb right hand start**: method books differ between starting on 2 and on 4 (the 4 always falls on Bb inside the scale). The table starts on 2.
- **F# left hand**: the common fingering 4 3 2 1 3 2 1 4 is used; some books start on 3.

Arpeggio table (one octave; two octaves repeat the inner pattern):

| Roots | RH one octave | RH two octaves | LH one octave | LH two octaves | Status |
|-------|---------------|----------------|---------------|----------------|--------|
| C, D, E, F, G, A (major and minor), B, F# (major) | 1 2 3 5 | 1 2 3 1 2 3 5 | 5 4 2 1 | 5 4 2 1 3 2 1 | standard; LH two-octave crossing finger (3 vs 4) varies by book: **flagged** |
| Db, Eb, Ab, Bb (major) | 2 1 2 4 | 2 1 2 4 1 2 4 | assigner fallback | assigner fallback | RH standard; **LH flagged for review**, card says "suggested fingering" |

## Data Flow

```
            songs/index.json            songs-private/index.json (optional)
                    \                          /
                     +--> ui/catalog.loadCatalog (validate, merge, mark Private)
                                   |
                       #/learn/<id> (ui/learn-view.js)
                                   |
      song --(transposeTo on?)--> theory/transpose.transposeSong --> song'
                                   |
                     core/timeline.resolveLevel(song', level)  (adds silent)
                                   |
            learn/phrases.derivePhrases --> learn/steps.deriveSteps
                                   |          (theory/fingering.assignFingering)
                                   v
   input sources            learn/lesson.reduce(state, action) --> effects
   screen  --\                 ^                                  |
   computer --+--> input/bus --+--> learner-sound --> engine.startNote/releaseNote
   midi    --/                 +--> learn-keyboard (pressed / wrong / correct)
                                                                   |
                         effects: listen -> engine.playRange (refused when silent)
                                  save   -> learn/progress (localStorage, ids only)
                                  announce -> live region + feedback chip
```

Practice exercises reuse the bottom half: `theory/*` generators -> `practice/runner` steps -> the same matcher, bus, keyboard and engine (metronome, `playNotes` for ear drills) -> `practice/progress`.

Converter (offline, local only):

```
songs-private/sources/hooktheory-cancer.json
   -> tools/convert-hooktheory.mjs (read, refuse output outside songs-private/)
   -> src/import/hooktheory.convert(source, { sourceUrl }) -> { song, warnings, summary }
   -> core/schema.validateSong(song) (must pass, else write nothing)
   -> songs-private/cancer-private.json (id cancer-private) + upsert entry in songs-private/index.json
```

Converter rules from the real input format:
- Top level: `source` (URL), `accessed`, `kind`, `sections` keyed by name. Each section: `keys[]` (`tonic`, `scale`), `meters[]` (`numBeats`, `beatUnit` 1 = quarter), `tempos[]` (`bpm`), `pickup`, `endBeat`, `chords[]`, `notes[]`. All sections must agree on key, meter and tempo (first entry each); a second differing entry fails as "key/meter/tempo change not supported" with its path.
- Notes: `sd` is a string, an optional `b`/`#` (or doubled) prefix plus a digit 1 to 7; `octave` is the offset; `beat` 1-based; `duration` in beats; `isRest: true` notes are skipped (gaps). Pitch via `spellDegree(key, degree, alter, offset)` (letter = tonic letter + degree - 1; octave from the A3 formula). Notes become `hand: "R"`, `role: "melody"`, `voice: 1`; overlaps clipped with a warning.
- Chords: degree `root` in the key (or in the `borrowed` mode's scale: `minor` = 1 2 b3 4 5 b6 b7, `phrygianDominant` = 1 b2 3 4 5 b6 b7, plus dorian, phrygian, lydian, mixolydian, locrian, harmonicMinor); triad or seventh stacked in thirds from that scale; `applied: 5` replaces it with the major triad (or dominant seventh for `type: 7`) a perfect fifth above the root degree; `applied: 7` with the diminished triad (half-diminished seventh for `type: 7`) a semitone below the root degree; `inversion` 1 to 3 adds the slash bass (third, fifth, seventh); `adds: [9]` on a major triad gives `add9`; `suspensions` 2 or 4 replace the third (`sus2`, `sus4`). Symbols use the `core/chords.js` suffixes, so `parseChord` reads them. `roman` is written for diatonic chords, `V/x` for applied, `bVI`-style for borrowed. Left hand: one root note in octave 2 per non-rest chord, `role: "bass"`, chord duration.
- Sections laid end to end (amended spec); `lengthTicks` = whole bars; `pickupTicks: 0`.
- Output: `schemaVersion 1`, `id "cancer-private"` (file `songs-private/cancer-private.json`; never `cancer`, see the converter Decision), title and composer from options or defaults, `visibility: "private"`, `key`, `meter`, `tempo { bpm, beatUnit: "quarter" }`, `sections`, `chords`, `levels.beginner { label, description, notation: "labelled", notes, learn: { transposeTo: ["C"] } }` (transposeTo added when the key has 3 or more accidentals), `defaultLevel`, bilingual `lesson.beginner` (single user-submitted source, verify by ear), `sources` (one `user-submitted` entry), `confidence` (`notes:<section>` and `chords:<section>` all `medium`). Fields are built from a whitelist, so nothing else from the input (no lyric, no hash) can reach the output. Keys are written in a fixed order and `JSON.stringify(song, null, 2) + "\n"`, so two runs are byte-identical.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/core/visibility.js` | Create | `visibilityOf(song)`, `isSilent(song)` |
| `src/core/text.js` | Create | `isLocalizedText(v)`, `textOf(value, lang)` |
| `src/core/pitch.js` | Modify | Add `pitchFromParts`, `transposeInterval`, `spellDegree`, `MAJOR_STEPS` export; existing functions unchanged |
| `src/core/schema.js` | Modify | `visibility` (R12), LocalizedText for lesson/level/analysis/learn texts (R13), `learn` block validation (R14: phrases sorted, unique, inside the song, single-sentence hint; `transposeTo` valid and different from the tonic), private `user-submitted` cannot be `transcribed` (R5 extension); `validateIndex` accepts optional `visibility` |
| `src/core/timeline.js` | Modify | `resolveLevel` adds `silent` and `learn`; new `makeTimeline({ meter, bpm, bars })` for note-less metronome timelines (Practice exercises) |
| `src/core/practice.js` | Modify | Add `schedulableNotes(timeline, handModes)` |
| `src/audio/engine.js` | Modify | Use `schedulableNotes`; `play()` returns `{ silent }`; `isSilent()`; `playRange`, `stopRange`; `startNote`, `releaseNote`, `releaseAllNotes`; `playNotes`, `stopNotes` |
| `src/audio/synth.js` | Modify | `startHeld`, `releaseHeld`; learner voices excluded from `cancelPending`, included in the cap |
| `src/audio/sampler.js` | Create (B, gated) | Sample loader and voice |
| `src/audio/voice.js` | Create (B, gated) | Sampler with per-note synth fallback |
| `src/theory/random.js` | Create | `mulberry32(seed)`, `shuffle(list, rng)` |
| `src/theory/keys.js` | Create | `TONICS`, `circleOfFifths`, `introOrder`, `keyOrder` (with `direction` fifths or fourths), `scaleOf` |
| `src/theory/transpose.js` | Create | `transposeSong`, `transposeChordSymbol`, `smallestMove` |
| `src/theory/fingering.js` | Create | `assignFingering(groups, { hand, key })` |
| `src/theory/scales.js` | Create (C) | `majorScale`, `fiveFinger`, `SCALE_FINGERING` |
| `src/theory/triads.js` | Create (C) | `triad`, `arpeggio`, `ARPEGGIO_FINGERING` |
| `src/theory/progressions.js` | Create (C) | `progression(tonic, numerals)` with DP voice leading |
| `src/theory/intervals.js` | Create (C) | `INTERVALS` table, `intervalNotes` |
| `src/theory/drills.js` | Create (C) | `intervalQuestion`, `chordQuestion` |
| `src/learn/phrases.js` | Create | `derivePhrases(timeline)` |
| `src/learn/steps.js` | Create | `deriveSteps(timeline, phrase, hand, options)` |
| `src/learn/instructions.js` | Create | `instructionFor(step, prevStep)` -> `{ key, params }`, `renderInstruction(t, instr, lang)` |
| `src/learn/matcher.js` | Create | `startStep`, `matchEvent` |
| `src/learn/lesson.js` | Create | `initLesson`, `reduce` |
| `src/learn/region.js` | Create | `learnRegion(...)` keyboard framing |
| `src/learn/progress.js` | Create | `readProgress`, `writeProgress`, `clearSong` (storage injected) |
| `src/learn/stages.js` | Create (B) | Stage lists per phrase, section, song |
| `src/learn/lesson-zero.js` | Create (B) | Lesson zero parts as data |
| `src/input/bus.js` | Create | Note bus |
| `src/input/computer-keys.js` | Create | `keyMapFor`, `attachComputerKeys` |
| `src/input/midi.js` | Create | `parseMidiMessage`, `createMidiInput` |
| `src/input/learner-sound.js` | Create | Sound rule per source, MIDI setting |
| `src/i18n/strings.js` | Create | String catalog en/es |
| `src/i18n/i18n.js` | Create | `createI18n`, `pickLanguage`, `format` |
| `src/i18n/guards.js` | Create | Pure guard checkers |
| `src/import/hooktheory.js` | Create | Pure converter |
| `src/practice/catalog.js` | Create (C) | Exercise definitions |
| `src/practice/runner.js` | Create (C) | Steps, clean tracking, `nextTempo` |
| `src/practice/progress.js` | Create (C) | Exercise and routine progress: `readPracticeProgress`, `recordRun`, `recordRoutine`, `clearPracticeProgress` |
| `src/practice/routine.js` | Create (C) | `buildRoutine`, `routineReducer` (done / skipped blocks, summary) |
| `src/practice/ear.js` | Create (C) | Ear-drill session reducer |
| `src/ui/learn-keyboard.js` | Create | SVG keyboard component |
| `src/ui/input-panel.js` | Create | Chips, Connect piano, MIDI sound toggle |
| `src/ui/language-select.js` | Create | English / Español selector |
| `src/ui/learn-view.js` | Create | `#/learn/<id>` view: wires reducer, bus, engine, keyboard, i18n |
| `src/ui/lesson-zero-view.js` | Create (B) | Lesson zero screens |
| `src/ui/practice-view.js` | Create (C) | `#/practice` and `#/practice/<id>` |
| `src/ui/router.js` | Modify | `parseHash` routes `learn` and `practice` |
| `src/ui/catalog.js` | Modify | Private index merge, Private chip, Learn / Play along actions, Practice link, language selector, bilingual labels |
| `src/ui/lesson-card.js` | Modify | `textOf` for LocalizedText |
| `src/ui/player.js`, `src/ui/transport.js` | Modify | "Play (no sound)" for silent songs |
| `src/main.js` | Modify | Lazy `learn` and `practice` views; shared i18n instance |
| `styles/app.css` | Modify | Learn, keyboard, input panel, practice styles; three viewport layouts |
| `index.html` | Unchanged | No import map change, so the CSP hash stays valid |
| `tools/convert-hooktheory.mjs` | Create | Thin CLI |
| `tools/serve.mjs` | Modify | `NO_PRIVATE=1`, 404 for `songs-private/sources/`, audio MIME and cache (B) |
| `nginx.conf` | Modify | `songs-private` locations; audio location (B) |
| `Dockerfile` | Modify | Test stage also copies `.gitignore`, `.dockerignore`, `README.md`, `docs/USABILITY_CHECK.md` for guards, and **replaces `COPY assets/vendor/ ./assets/vendor/` with `COPY assets/ ./assets/`** so the audio-asset guard sees every file the runtime stage ships (vendor, `img/`, later `audio/`); `tools/` stays out (CLI tests skip); no `songs-private` anywhere |
| `.dockerignore` | Modify | Add `songs-private`, `!docs/USABILITY_CHECK.md` |
| `.gitignore` | Unchanged | Already has `songs-private/` |
| `songs/cancer.json` | Delete (B) | Public chords-only Cancer removed |
| `songs/index.json` | Modify (B) | `chopin-nocturne-op9-no2` and `ode-to-joy` |
| `songs/ode-to-joy.json` | Create (B) | Public-domain theme, C major |
| `songs/LICENSE-ode-to-joy.md` | Create (B, if required) | Source attribution |
| `assets/audio/piano/*` | Create (B, gated) | Samples, manifest, license |
| `assets/img/posture.svg` | Create (B) | Original posture drawing |
| `docs/USABILITY_CHECK.md` | Create | Manual usability protocol |
| `docs/STACK_TECNOLOGICO.md` | Modify (B, gated) | Salamander entry |
| `README.md` | Modify | Learn mode, inputs and Casio setup, computer key map, private songs and mount, language, Practice exercises, usability check link; examples move off `cancer.json` |
| `tests/fixtures/chords-only-song.json` | Create (B) | Synthetic replacement for tests that use `songs/cancer.json`. Measured 2026-10-11 with a case-insensitive search for `cancer` under `tests/`: 94 matches in 7 files (`songs.test.js` 55, `level-select.test.js` 12, `router-dispatch.test.js` 9, `router.test.js` 8, `player.test.js` 5, `score/render.test.js` 4, `score/engraving-polish.test.js` 1). Not every match is a file reference; `sdd-tasks` should re-measure before sizing the slice |
| `tests/fixtures/hooktheory-synthetic.json` | Create | Synthetic converter input (never the private data) |
| `tests/fixtures/learn-*.json` | Create | Synthetic songs for steps, phrases, transposition, private silence |
| `tests/**` | Create / Modify | See Testing Strategy |

## Interfaces / Contracts

```js
// core/pitch.js (additions)
export const MAJOR_STEPS;                                  // [0, 2, 4, 5, 7, 9, 11]
/** "E", 1, 4 -> "E#4"; null when alter is outside -2..2 or the result is outside -1..9 octaves. */
export function pitchFromParts(letter, alter, octave);
/** Moves letters by `steps` and the pitch by `semitones`: transposeInterval("D5", -2, -4) -> "Bb4". Null when it would need more than a double accidental. */
export function transposeInterval(pitch, steps, semitones);
/** Scale degree to spelled pitch: spellDegree({ tonic: "E", mode: "major" }, 7, -1, 0) -> "D5". */
export function spellDegree(key, degree, alter, octaveOffset);

// core/visibility.js
export function visibilityOf(song);                        // "public" | "private"
export function isSilent(song);                            // visibility === "private"

// core/text.js
export function textOf(value, lang);                       // string | LocalizedText -> string

// core/practice.js (addition)
export function schedulableNotes(timeline, handModes);     // [] unless timeline.silent === false

// audio/engine.js (additions)
engine.play()            -> { silent: boolean }
engine.isSilent()        -> boolean
engine.playRange({ startTick, endTick, hand = null, bpm }) -> Promise<{ status: "completed" | "cancelled" | "silent" | "empty" }>
engine.stopRange()
engine.startNote(midi, { vel = 0.7 } = {})                 // resumes the context in the gesture
engine.releaseNote(midi)
engine.releaseAllNotes()
engine.playNotes([{ midi, at, dur, vel }])                 // generated notes only (ear drills)
engine.stopNotes()

// audio/synth.js (additions)
synth.startHeld({ midi, vel, when }) -> voiceId
synth.releaseHeld(voiceId, now)

// theory/transpose.js
export function smallestMove(fromTonic, toTonic);          // { steps, semitones }, |semitones| <= 6
export function transposeChordSymbol(symbol, move);        // "C#m" + E->C -> "Am"
export function transposeSong(song, levelId, targetTonic); // new song object; visibility kept; fingers dropped

// theory/fingering.js
/** groups: [{ tick, notes: [{ midi, pitch, finger? }] }] sorted by tick, one hand. */
export function assignFingering(groups, { hand, key }) ->
  [{ tick, fingers: number[], position: { anchorStep, thumbPitch, lowPitch, highPitch }, shift: boolean, unplayable: boolean }]

// learn/phrases.js and learn/steps.js
export function derivePhrases(timeline);                   // [{ id, startTick, endTick, title?, hint? }]
export function deriveSteps(timeline, phrase, hand, { key }) ->
  [{ id, tick, hand, keys: [{ midi, pitch, finger, hand }], position, shift, instruction: { key, params } }]

// learn/matcher.js
export function startStep(expectedMidis, heldMidis, { match = "exact" } = {});
export function matchEvent(m, { type: "on" | "off", midi }) -> { m, outcome: "progress" | "satisfied" | "wrong" | "octave" | "ignored" }
// "octave" is a wrong key with the same pitch class as an expected key (feedback variant only)

// learn/lesson.js
export function initLesson({ song, levelId, keyTonic, hand, progress, silent }) -> state
export function reduce(state, action) -> { state, effects: Array<{ type: "listen" | "stopListen" | "save" | "announce" | "releaseAll", ... }> }

// learn/region.js
export function learnRegion({ phraseMidis, positionMidis, stepMidis, maxWhite, minWhite = 9, marginWhite = 1 }) -> { low, high, mode: "phrase" | "position" }

// learn/progress.js   key "piano-guide:learn:v1"
// { v: 1, lessonZero: "done" | "skipped" | null,
//   songs: { [songId]: { [levelId]: { [tonic]: { phrase: int, stage?: int, hand?: "R"|"L"|"T", updated: "YYYY-MM-DD" } } } },
//   transpose: { [songId]: tonic | null } }
export function readProgress(storage); export function writeProgress(storage, progress); export function clearSong(storage, songId);

// input/bus.js, input/midi.js
export function createNoteBus();
export function parseMidiMessage(bytes) -> { type: "on" | "off", midi, velocity } | null
export function createMidiInput({ navigator, isSecureContext, bus, onState }) -> { connect(), state(), dispose() }

// input/computer-keys.js
export function keyMapFor(region, anchorMidi) -> Map<code, midi>
export function attachComputerKeys({ target, bus, getMap }) -> detach

// i18n/i18n.js
export function pickLanguage(saved, navigatorLanguage) -> "en" | "es"
export function format(template, params) -> string
export function createI18n({ storage, navigatorLanguage, documentElement, table }) -> { t, lang, setLang, onChange }

// import/hooktheory.js
export function convertHooktheory(source, { sourceUrl, id = "cancer-private", title = "Cancer", composer = "My Chemical Romance" } = {})
// CLI default output: songs-private/cancer-private.json; the index entry file is "<id>.json"
  -> { ok: true, song, warnings: string[], summary: { [section]: { notes, chords } } } | { ok: false, errors: [{ path, message }] }

// core/timeline.js (addition)
/** Note-less timeline for the metronome: whole bars, silent: false (nothing to schedule). */
export function makeTimeline({ meter, bpm, bars }) -> { meter, pickupTicks: 0, tempo: { bpm, beatUnit: "quarter" }, lengthTicks, notes: [], chords: [], sections: [], pedal: [], analysis: [], range: null, shifts: Set, silent: false }

// core/schema.js (addition)
export function visibilityMismatch(entry, song) -> null | string   // entry.visibility present and != visibilityOf(song)

// ui/catalog.js (addition)
export function canLearn(song) -> boolean                          // some level has a pitched, non-rest note

// theory/keys.js
export function keyOrder({ kind: "fixed" | "random" | "circle", direction = "fifths" /* or "fourths" */, start = "C", list, seed, count }) -> string[]

// practice
export function nextTempo(steps, current, clean) -> { bpm, top }
export function buildRoutine(progress, isoDate) -> { date, blocks: [{ id, exercise, key, minutes, options }] }
export function routineReducer(session, { type: "DONE_BLOCK" | "SKIP_BLOCK" | "END" }) -> session   // session.blocks[i].status: "pending" | "done" | "skipped"; session.ended
export function readPracticeProgress(storage); export function recordRun(progress, run); export function recordRoutine(progress, { date, blocks }); // no-op when no block is done
export function clearPracticeProgress(storage);
```

`localStorage` keys: `piano-guide:lang`, `piano-guide:learn:v1`, `piano-guide:input:midi-sound`, `piano-guide:practice:v1`. Values hold ids, indexes, tonic names, stage numbers, dates, booleans and numbers only; a test serializes progress after a synthetic lesson and asserts no spelled pitch pattern appears.

## Testing Strategy

All automated tests use `node --test` with no dependency and pass in a clean clone without `songs-private/`; they run in the Docker test stage.

| Layer | What to test | Approach |
|-------|-------------|----------|
| Unit (core) | `pitchFromParts`, `transposeInterval` (D5 E->C = Bb4; F# major E#), `spellDegree` (spec scenarios E4 G#4 B4 D#5, b7 = D5, offset -1 = E3, Eb major 3 = G4, 4 = Ab4) | `tests/core/pitch.test.js` additions |
| Unit (core) | Schema: visibility values, LocalizedText rules, learn block (sorted, overlap, outside, duplicate id, transposeTo equals tonic), private user-submitted not transcribed; each rule with its `disabledRules` counter-proof | `tests/core/schema.test.js` additions |
| Unit (core) | `isSilent`, `resolveLevel().silent`, `schedulableNotes` (fail closed without `silent`) | new `tests/core/visibility.test.js` |
| Unit (audio) | Private fixture: play, loop, seek-and-play, every level, `playRange` -> zero `playNote` calls, position advances, `{ silent: true }`; public unchanged; `playRange` stops itself and reports, empty range immediate; held notes survive `cancelPending`, voice cap includes them, `releaseAllNotes` | `tests/audio/engine-silent.test.js`, `engine-range.test.js`, `synth.test.js` additions with the recording rig |
| Unit (theory) | Transposition scenarios (E->C, chromatic respell, intervals preserved over random melodies, register rule, range-first: a fixture where the closest-to-C4 candidate leaves A0 to C8 must pick the in-range one, range protection for a low bass, identity, visibility kept); `makeTimeline` (no notes, `silent: false`, whole bars); fingering scenarios (five-finger, leap shift, LH mirror, triad, octave bass, unplayable, authored wins, no black thumb); scales (C, F, two octaves, F# spelling, all 12 x valid fingers x stepwise, table = intro order); five-finger G and D LH; triads RH and LH inversions; arpeggio notes and reverse; progressions (C I-IV-V-I, common tone, DP total <= all-root for all 12 tonics x 3 progressions, G vi = Em, Bb spelling); drills (same seed same question, answer once among options over 500 seeds, M3 notes, C3 to C6 range); key orders (circle of fifths 12 and wrap to C at 13, circle of fourths C F Bb Eb Ab Db F# B E A D G, random no early repeat and no self-follow, fixed list C F G for 5 steps) | `tests/theory/*.test.js` |
| Unit (learn) | Phrases (authored win, 2-bar auto, cut at rest, never empty); steps (melody 8 steps, chord one step, LH only, hand with no notes, ties one step, grace and rests skipped, unplayable split lowest first); instructions (EN/ES examples from the spec, shift wording, limits over all combinations); matcher (every learn-mode waiting scenario including held key and auto-repeat); lesson reducer (flow table rows, private never emits `listen`, language switch keeps accumulation, transposition keeps phrase index, Listen interrupted by a key); region (phrase fit, fallback, min 9, max by width, white edges); progress (corrupt JSON, blocked storage, reset, privacy of stored values) | `tests/learn/*.test.js` with synthetic fixtures |
| Unit (input) | `parseMidiMessage` (on, off, velocity 0, pedal, clock, short messages); `keyMapFor` (region from C and from E, 11 whites, black keys on the upper row); bus (dedupe, releaseAll per source, dispose emits noteOff); computer listener filters with a fake event target (modifiers, focused input, repeat, unmapped, blur release); MIDI state machine with a fake `navigator` (unsupported, insecure, denied, no device, hot-plug in and out releases notes) | `tests/input/*.test.js` |
| Unit (i18n) | Completeness, placeholders, typography, voseo, instruction limits on the real table; each guard fails on a fixture with one defect (counter-proof); `pickLanguage` (`es-SV` -> es, saved wins); fallback to English; plural forms | `tests/i18n/*.test.js` |
| Unit (import) | Synthetic fixture: spec scenarios (degrees, b7, offset, flat key, out of range, 1-based beat arithmetic = 720, rest gap, overlap clipped with warning, whole bars, chord degree 6 = C#m and C#2, applied V/V with inversion, borrowed minor bVI, intro chords only, sections sorted, provenance, no lyric text after a `lyric` field in input, deterministic bytes, malformed input paths, default id `cancer-private` and index entry file `cancer-private.json`); CLI tests skipped with a reason when `tools/convert-hooktheory.mjs` is absent (Docker test stage); CLI refusal of `songs/` output and `songs-private/../songs/x.json`, missing input, missing URL (spawned with `process.execPath` and a fixed argv into a temp dir) | `tests/import/hooktheory.test.js`, `tests/import/cli.test.js` |
| Local-only check | Real source counts (verse 52/14, chorus 34/11, bridge 39/13) and the lyrics scan of the generated private file and its Learn strings | `tests/private-local.test.js`, `test.skip` when `songs-private/` is absent; prints counts only |
| Guards (repo) | `.gitignore` and `.dockerignore` contain `songs-private/`; Dockerfile has no `COPY`/`ADD` naming it (and a fixture that does fails); no `songs/*.json` declares private; public index `file` values never contain `songs-private/`; tracked paths (from `git ls-files -z` when `.git` exists, else skipped) never start with `songs-private/` (and a fixture list that does fails); `docs/USABILITY_CHECK.md` has T1 to T5 with thresholds and the README links it; audio files under `assets/` have a stack entry; Learn modules do not import `playNotes` | `tests/privacy.test.js`, `tests/docs-guard.test.js`, `tests/assets-guard.test.js` |
| Unit (catalog) | Private index absent (404, network error, HTML 200), invalid (notice), valid (Private chip, after public), collision (private `cancer` vs public `cancer` -> private unavailable; private `cancer-private` beside public `cancer` -> both available), private file without visibility, index entry visibility differs from file (unavailable, with counter-proof); `canLearn` (song with only empty `notes` levels has no Learn action); cards Learn / Play along / "Play along (no sound)"; Practice link; router `learn`, `practice` and `practice/<id>` routes | `tests/ui/catalog.test.js`, `tests/ui/router.test.js` additions with injected fetch |
| Unit (practice) | Catalog ids and doc-card completeness (and a failing fixture); runner clean tracking and stages; `nextTempo` (ramp, top, unclean stays); progress streak and best tempo scenarios, `clearPracticeProgress` empties the summary, corrupt JSON reads empty; unknown exercise id renders "Exercise not found" with the back link; routine reducer (skip last block after three done -> day recorded, all skipped -> nothing recorded and streak unchanged, summary "N days in a row" with plural forms); routine first day, next day (G, different warm-up), same day identical, 9 to 11 minutes; ear session (reveal on second wrong, count, growth, play-back by pitch class) | `tests/practice/*.test.js` |
| Song data (A and B) | (A) every `songs/index.json` entry that declares `visibility` matches its file (`visibilityMismatch`), with a failing fixture pair. (B) `songs/index.json` is exactly the two public songs, `songs/cancer.json` absent; Ode to Joy provenance; melody equals the source fixture transposed | `tests/songs.test.js` update |

TDD is off in `openspec/config.yaml` (`strict_tdd: false`); ordinary functional checks apply per slice: `node --test` locally and inside `docker build`.

### Browser verification plan (manual, per slice that touches UI)

Dev server: `PORT=8790 node tools/serve.mjs` (PowerShell: `$env:PORT=8790; node tools/serve.mjs`). Never port 8765. Check that 8790 is free first.

1. **Catalog**: with `songs-private/` present, Cancer shows the "Private" chip after the public songs; with `$env:NO_PRIVATE=1`, only public songs and no "private" wording anywhere; DevTools console shows the expected 404 for the private index and no uncaught error.
2. **Viewports** (DevTools device toolbar): 1440 x 900, 844 x 390 landscape, 390 x 844 portrait. On each, during My turn: instruction and every shaded key with its finger number visible without scrolling; white keys >= 36 px at 360 px width; labels >= 12 px (computed style).
3. **Learn flow, Ode to Joy** (B) and synthetic public song (A): Listen plays slowly with keys lighting, My turn interrupts with no stuck note, wrong key shows "Try again" and keeps shading, chord by single clicks completes, language switch mid-chord keeps the step.
4. **Private Cancer**: no Listen button, no song sound in Learn or Play along (Play along cursor moves), own presses sound with computer keys and taps; transposition toggle refreshes names and fingers to C and survives a reload.
5. **Inputs**: computer keys with a Spanish layout setting in the OS (legend shows the printed keys in Chrome); typing in a BPM box plays nothing; Ctrl+R reloads; window blur releases notes. MIDI in Chrome or Edge with the Casio: Connect piano, device name shown, plug and unplug without reload; default no app sound; toggle on persists. Safari or a browser without Web MIDI: one line, other inputs work.
6. **Reduced motion** (DevTools rendering emulation): region changes instantly, states still visible.
7. **Docker**: `docker build -t piano-guide .` (tests run in the build), `docker run --rm -p 8790:8080 piano-guide` (no private songs) and with `-v <abs path>/songs-private:/usr/share/nginx/html/songs-private:ro` (private song appears; `/songs-private/sources/` returns 404); `docker run --rm piano-guide find /usr/share/nginx/html -path '*songs-private*'` prints nothing.
8. **Usability protocol** (`docs/USABILITY_CHECK.md`) is run by the user with participants per milestone; results recorded in the slice PR notes with date, device and input.

## Threat Matrix

The change adds no routing of shell commands, no PR or push automation and no executable-file classification. Two process or filesystem boundaries exist: a test reads `git ls-files`, and the converter CLI writes files.

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | `requirements.txt`, executable Markdown, `README.sh` | N/A: no file is executed or classified by type; Markdown is only read by guard tests as text | none | none |
| Git repository selection | `git -C`, relative paths, absolute paths | Applicable (test only): the privacy guard runs `git ls-files -z` | Spawned with `spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot })` where `repoRoot` comes from the test file's `import.meta.url`, never from input; no shell; when `.git` is absent or git is missing, the tracked-path check is skipped with a reason (Docker build stage) | Guard fails on a fixture path list containing `songs-private/cancer.json`; skip path asserted when `.git` is absent |
| Commit state | staged, `commit -a`, empty index | N/A: nothing commits | none | none |
| Push state | tracking branch, first push | N/A: nothing pushes | none | none |
| PR commands | `--head`, env prefix | N/A: no PR automation | none | none |
| Filesystem write boundary (added) | `songs/x.json`, `songs-private/../songs/x.json`, absolute path elsewhere, symlinked folder | Applicable: `tools/convert-hooktheory.mjs` writes files | Resolve the output path, require it to start with `resolve(repoRoot, "songs-private") + sep`; refuse otherwise with exit code 2 and write nothing; conversion and validation complete in memory before any write | CLI test: each adversarial path exits non-zero and leaves the temp tree unchanged |

## Migration / Rollout

- Delivery: feature-branch chain of about 400-line slices (auto-chain), three milestones, each usable on its own. Suggested order for `sdd-tasks`:
  - **A**: (1) visibility, LocalizedText, learn block in schema + silent rule in timeline and engine + privacy guards; (2) pitch additions + converter + CLI + synthetic fixture; (3) i18n catalog, guards, language selector; (4) transposition + fingering; (5) phrases, steps, instructions, matcher; (6) lesson reducer + progress + region; (7) input bus, computer keys, MIDI, learner sound, synth held notes, engine single-note and range playback; (8) learn keyboard SVG; (9) Learn view + catalog actions + router + private index merge + input panel; (10) README, `docs/USABILITY_CHECK.md` and its guard, Dockerfile and `.dockerignore`, nginx and serve changes.
  - **B**: lesson zero; stages and metronome in Learn; sample measurement and STOP; (after approval) sampler slice; Ode to Joy transcription; catalog swap (delete public Cancer, move tests to the synthetic fixture).
  - **C**: theory generators (two slices); runner and exercise view; doc cards and catalog; ear drills; progress and routine.
- No data migration: new `localStorage` keys are versioned (`:v1`); unknown or corrupt values read as empty.
- Rollback per slice: Learn and Practice are additive routes; the private library is optional at run time; the sample slice reverts to the synth; the catalog swap slice restores `songs/cancer.json`.
- CI stays disabled (pre-v1 rule). The local gate is `node --test` plus `docker build`.

## Open Questions

- [ ] Scale fingering: confirm Bb right-hand start (2 or 4) and F# left-hand start (4 or 3) with a teacher or method book; the table uses 2 and 4.
- [ ] Arpeggio fingering: left hand for Db, Eb, Ab, Bb roots and the two-octave left-hand crossing finger (3 or 4) are flagged; they ship as "suggested fingering" until confirmed.
- [ ] Salamander subset: exact source, format and size are measured in the apply phase and need the user's approval before entering (STOP gate).
- [ ] Ode to Joy: whether Mutopia or IMSLP has a qualifying public-domain file of the theme; if neither qualifies, the task stops and reports.
- [ ] Usability thresholds (A4) are initial numbers; revise after the first observed session.

None of these blocks Milestone A.
