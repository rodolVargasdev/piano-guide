# Proposal: Learn mode (a step-by-step piano teacher for people who cannot play)

## Intent

The MVP is a player, not a teacher. It shows a distant 3D keyboard with falling bars and finger circles, a transport, a BPM box and "Set A / Set B" loop controls. A person who has never played the piano gets nothing actionable from it: nothing says what to do now, with which finger, and nothing waits for them. The 741 tests proved mechanics (timing, scheduling, rendering), not learning.

The flagship song makes it worse. Public "Cancer" (Beginner) is 11 bars of one whole-note block chord per bar plus a bass note, with no melody (a deliberate chords-only copyright choice), played by an oscillator synth. It does not sound like Cancer, so the learner cannot even recognize what they are practicing.

User feedback (2026-10-11, translated): "It isn't didactic, it's not clear what it does; I get nothing useful from looking at this. I really need it to be useful for someone who does not know how to play the piano."

This change adds a **Learn mode** that behaves like a patient teacher: one small instruction at a time in plain English or Spanish (learner's choice), a close and labelled keyboard, and the app waits until the learner actually plays the right keys (a Casio digital piano over USB MIDI, the computer keyboard, or tapping the on-screen keys). Public-domain songs are played for the learner first ("listen, then play"). The real Cancer melody is available for private local study only, and the app never plays it: it only says what to play and shades the keys, and the learner's own keys are what sounds. The public chords-only Cancer is replaced by a public-domain Ode to Joy, the sound becomes a real piano (after the dependency is approved), and a **Practice exercises** section adds repeatable, theory-generated drills for harmony and technique.

Success is measured as learning behavior observed in a person, not as unit tests (see Success Criteria).

## Decisions taken by the user (2026-10-11)

| # | Decision |
|---|----------|
| 1 | Input: all three, polished. Web MIDI (the user has a Casio digital piano; show the detected device name; some Casio models expose only USB audio, so "no MIDI device" must be handled gracefully), computer keyboard map, on-screen taps and clicks. |
| 2 | Learner text is bilingual English / Spanish with a selector remembered in `localStorage`. Every case is explained simply. The lesson-guide English-only rule changes. |
| 3 | Private Cancer has a "Transpose to C major" toggle; default is the original E major; the choice is remembered; instructions and fingering are recomputed for C. |
| 4 | Private Cancer is silent in the app: no Listen-first and no Play along audio for it. The app only tells what to play and shades the keys. The learner's own presses sound when the input is the computer keyboard or on-screen keys. With MIDI the Casio sounds by itself, so app sound for MIDI input is a setting, default off. Public-domain songs keep Listen-first. |
| 5 | Public catalog: remove chords-only Cancer; add Ode to Joy (Beethoven's theme), transcribed from a public-domain source such as Mutopia with URL and license recorded, never from memory: simple right-hand melody in C major plus an easy left-hand option. |
| 6 | New capability `practice-exercises` (Milestone C): documented, repeatable exercises generated algorithmically from music theory. |
| 7 | The Salamander sample dependency still requires an announcement before it enters; the apply phase measures it and stops for the orchestrator to announce. GitHub Pages publishes from the main branch git tree (legacy branch build), so the gitignored `songs-private/` cannot leak through Pages. |

## Scope

### In Scope

Delivered as a feature-branch chain of slices of about 400 authored lines each. Each milestone stands on its own and can be tried by the user before the next starts.

**Milestone A: teacher core plus private Cancer (a learner plays the first Cancer phrase, guided, silently)**

1. **Private song library (local only).** The app looks for `songs-private/index.json` at startup; when present (dev server or Docker on the user's machine) its songs join the catalog with a "Private" chip; when absent (GitHub Pages) the catalog is unchanged and no error is shown. A private song carries a "silent" flag: the engine never schedules its notes, and its Play along view is visual only. `songs-private/` stays gitignored, is added to `.dockerignore`, is never copied into the image, and is mounted read-only at run time (`docker run -v`). Guards: no file under `songs/` declares private visibility; the public index never references `songs-private/`.
2. **Hooktheory converter.** A zero-dependency Node tool (`tools/`) with a pure conversion module that turns `songs-private/sources/hooktheory-cancer.json` (scale degrees, beats, octaves, durations, rests; E major, 4/4, 75 BPM; intro chords only, verse 52 notes/14 chords, chorus 34/11, bridge 39/13) into a valid song file `songs-private/cancer-private.json` (id `cancer-private`, distinct from the public `cancer` so both coexist until the Milestone B swap) with a right-hand melody, a simple left hand, sections, chords and provenance (`kind: user-submitted`, single source, `confidence` medium or lower until the user confirms by ear). Unit tests use a synthetic fixture, never the private data.
3. **Learn step model, transposition and fingering (pure, `node --test`).** From a song level, derive an ordered lesson: phrases (authored when present, otherwise about 2 bars cut at rests), and per phrase a sequence of steps. A step is "the next onset group of one hand": the keys to press, their fingers, the five-finger hand position, and one plain-language instruction generated from bilingual templates (for example "Right hand: thumb on E (Mi). Press these 3 keys together." / "Mano derecha: pulgar en Mi (E). Presione estas 3 teclas a la vez."). A pure transposition (E major to C major for Cancer, pitches respelled in the new key and kept near middle C) and a pure fingering assigner (five-finger positions with marked shifts) recompute steps for the chosen key. The input matcher accepts the expected key set with order-free accumulation (so a 3-note chord can be tapped key by key) and returns "try again" on a wrong key.
4. **Note input and learner sound.** One input bus (`noteOn` / `noteOff`) fed by: on-screen keys (pointer and touch), a documented computer-keyboard map over the current hand region (letters drawn on the keys), and Web MIDI (feature-detected, permission requested on a click, the connected device name shown, hot-plug followed). With no MIDI support or no MIDI input device (for example a Casio that exposes only USB audio) the panel says so in one line and the other two inputs keep working. The learner's presses sound through the app for computer-keyboard and on-screen input; for MIDI input the app's sound is a setting, default off (the piano sounds by itself).
5. **Learn view.** A new route (`#/learn/<id>`) with a close, readable 2D (SVG) keyboard zoomed to the hand region (about 1.5 octaves), note names on every key (solfege and letters), finger numbers on the keys to press, the next keys shaded, one instruction card with a single sentence, a language selector (English / Español, remembered), and for Cancer the "Transpose to C major" toggle (remembered). Flow per phrase for public-domain songs: Listen (played slowly and lit) -> My turn (wait per step) -> "Correct" / "Try again" -> next phrase. For private songs there is no Listen action: My turn starts directly. The existing player stays as "Play along".

**Milestone B: from one phrase to the whole song, a real piano, and the public catalog swap**

6. **Lesson zero.** A short, skippable, bilingual first lesson: find C (Do) using the groups of 2 and 3 black keys (the learner must press a C to continue), sitting and hand posture, finger numbers 1 to 5 (press fingers 1 to 5 on C D E F G), and how each input works, including how to connect the Casio.
7. **Stages and progress.** Per phrase: right hand slow -> left hand slow -> hands together slow -> full tempo, then the whole section, then the song. Progress (lesson zero done, last phrase and stage per song and key) saved in `localStorage`, resumable with "Continue", clearable with "Reset progress".
8. **Sampled piano sound (new dependency, gated).** Replace the oscillator voice with a small set of piano samples served as static files and pitched between sample points with Web Audio (no npm library); the synth stays as the automatic fallback. Proposed source: Salamander Grand Piano (Alexander Holm, CC BY 3.0), one velocity layer, a subset covering the app's range. **The apply phase measures the exact source URL, version, file list, format, total size and license, then STOPS for the orchestrator to announce it to the user; nothing is added before approval.** On approval it is recorded in `docs/STACK_TECNOLOGICO.md` in the same commit. This voice is used for Listen on public songs and for the learner's own key presses.
9. **Public catalog swap.** Remove the public chords-only Cancer (`songs/cancer.json` and its index entry) and add Ode to Joy (Beethoven's theme): a beginner level with the right-hand melody in C major and an optional easy left hand, transcribed only from a public-domain score on Mutopia Project or IMSLP under the existing `transcribed: true` provenance rules (URL, license, SHA-256, access date), with Learn-mode phrases. Never written from memory.

**Milestone C: Practice exercises**

10. **Practice exercises section** (`#/practice`), all generated algorithmically from music theory, so no copyright applies:
    - Five-finger patterns in any key.
    - Major scales with standard fingering, introduced in the order C, G, D, F, then the rest; one and two octaves, hands separate then together.
    - Triads and their inversions; arpeggios.
    - Cadences I-IV-V-I and I-vi-IV-V, and the common progression I-V-vi-IV, in several keys with simple voice leading.
    - Intervals and chord identification ear drills: the app plays an interval or chord and the learner names it (buttons) or plays it back.
    - Key rotation: fixed list, random, or around the circle of fifths.
    - A "10-minute routine" generator that builds a daily session (warm-up pattern, a scale, a chord or cadence drill, an ear drill) from the learner's progress, rotating keys over the days.

    Each exercise has a bilingual doc card: goal, why it matters, how to do it, what good looks like, suggested tempo steps. Every exercise is repeatable with metronome, tempo ramp (reusing `core/practice`), key rotation, and checking through MIDI, computer keyboard or taps with simple feedback. Local progress per exercise and key (streak, best clean tempo) is saved in `localStorage`.

Across all slices: README sections for Learn mode, inputs (including Casio setup), private songs (running with the mount), language, Practice exercises and the manual usability check. The Docker image keeps passing `node --test` in its build stage.

### Out of Scope

- Pitch detection through the microphone (acoustic piano input). Deferred: needs research on latency and accuracy.
- Rhythm accuracy scoring (timing grades, stars). Feedback is right/wrong key; tempo stages and ramps give rhythm practice.
- Reading sheet music as a learning goal. The score view stays in Play along.
- Accounts, cloud sync of progress, or analytics.
- Any deployment of private songs, their melody or lyrics to GitHub Pages or a public image; any app playback of private songs.
- Rewriting the 3D scene. It stays as is inside Play along.
- Songs beyond Ode to Joy and the private Cancer.
- Translating the whole existing player UI. Bilingual text covers Learn mode, lesson zero, Practice exercises and the catalog actions that lead to them; the rest of the player stays English unless a slice touches it.
- Enabling CI (pre-v1 rule: workflows stay disabled).

## Capabilities

### New Capabilities

- `learn-mode`: the guided lesson flow: phrases and steps derived from song data, one plain-language instruction per step, Listen-first for public songs only, waiting for the correct keys, right/wrong feedback, stages (each hand slow, hands together, full tempo), lesson zero, the transposition toggle for private Cancer, and progress in `localStorage`.
- `learn-keyboard`: the close 2D keyboard used by Learn mode and Practice exercises: framing to the hand region, note names on keys, finger numbers, computer-key letters, shaded next keys, pressed and wrong states, readable at phone width.
- `note-input`: one input bus over on-screen keys, the computer-keyboard map and Web MIDI; device detection and name, hot-plug, graceful "no MIDI device" state, and the learner-sound rules (on for keyboard and taps, a setting default off for MIDI).
- `learner-language`: English / Spanish selector remembered in `localStorage`, bilingual text templates for instructions, lesson zero and exercise cards, with solfege and letter names.
- `private-song-library`: the local-only song library (`songs-private/`), its loading rules, the "Private" chip, the silent rule (no app playback of private songs), the Docker run-time mount, and the guards that keep it out of git and the image.
- `song-import`: the Hooktheory TheoryTab converter (scale degree to spelled pitch in the song key, beats to ticks, rests, sections, chords) and its provenance output.
- `music-theory-generators`: pure generators for transposition, fingering assignment, scales with standard fingering, triads and inversions, arpeggios, cadences and progressions with voice leading, intervals, and key orders (circle of fifths).
- `practice-exercises`: the exercise catalog, doc cards, repeat / metronome / ramp / key rotation, ear drills, checking and feedback, per-exercise progress (streak, best tempo) and the 10-minute routine generator.

### Modified Capabilities

- `song-data-model`: adds song visibility (public / private) with the silent rule for private songs, and an optional per-level `learn` block (phrases, optional hint text); the "Copyright guard for chords-only songs" requirement no longer names Cancer as a shipped public song; shipped-song scenarios change (Cancer removed from `songs/`, Ode to Joy added).
- `song-catalog`: merges the private index when present and marks those songs "Private"; cards offer "Learn" and "Play along"; a link to Practice exercises; the "Both MVP songs are listed" scenario changes to the new public set.
- `playback-engine`: the "Synthesized piano-like sound (no audio samples)" requirement is replaced by sampled piano with synth fallback (Milestone B, only after approval); adds bounded phrase-range playback for Listen, single-note playback for learner presses and ear drills, and a refusal to schedule notes of a private (silent) song.
- `lesson-guide`: the "Cancer content policy" requirement and the "Cancer low-confidence chorus" scenario move off the public song; the "UI copy MUST be in English" rule becomes bilingual English / Spanish for learner-facing text.

`keyboard-scene`, `score-view` and `practice-tools` keep their requirements; they become the Play along mode (visual only for private songs).

## Approach

- **Teacher logic is data plus pure modules.** Steps, instructions, transposition, fingering, theory generators and input matching are pure functions over the existing timeline (`src/core/timeline.js`, `pitch.js`, `keyboard-layout.js`, `practice.js`) in new `src/learn/` and `src/theory/` folders, tested with `node --test`. Instruction text comes from bilingual templates, so a new song needs no per-step authoring; an optional `learn.phrases[]` overrides automatic cuts.
- **2D keyboard, not a closer 3D camera.** A beginner needs legible labels and finger numbers on a small region; SVG gives crisp text at any size, works on phones, needs no WebGL and reuses the existing key layout math. The 3D scene remains for Play along.
- **One input bus.** Pointer, computer keys and MIDI emit the same events; the matcher never knows the source. Web MIDI is optional and detected (Chrome and Edge support it; Safari does not). Learner sound is decided per source, so a Casio is never doubled by default.
- **Silence is a data rule enforced in the engine.** A private song is silent by its visibility, and the engine refuses to schedule its notes, so no view can play it by mistake; a test proves it.
- **Listen and learner sound reuse the engine and its voice**, so there is still one clock and one sound path, and the sampled piano improves both at once.
- **Private library is runtime-optional, not a build variant.** The same code runs everywhere; the private index 404s on GitHub Pages and is skipped. Nothing private is committed, baked into the image, or needed by tests.
- **Converter is a tool, not app code.** It runs locally, writes into the gitignored folder, and its tests use a synthetic fixture. The user confirms the result by ear (on their own piano) before its confidence is raised.
- **Exercises are generated, not stored.** A theory module produces the notes and fingering for any key, so key rotation and the routine generator need no content files; standard scale fingerings are a small table of theory facts.
- **Sampled piano behind an explicit gate.** Samples are static files under `assets/`, loaded lazily, decoded with `decodeAudioData`; the voice picks the nearest sample and sets `playbackRate`. CSP already allows `connect-src 'self'`; `nginx.conf` and `tools/serve.mjs` need audio MIME types and long-cache rules for the sample folder.

### Forecast slices (about 400 authored lines each; sdd-tasks refines)

| Milestone | Slices |
|-----------|--------|
| A | private library and silent rule; converter; step model and matcher; transposition and fingering; input bus and MIDI; learner language templates; Learn view (two slices) |
| B | lesson zero; stages and progress; sampled piano (measure, stop for announcement, then add); Ode to Joy transcription; catalog swap |
| C | theory generators (two slices); exercise runner and checking; doc cards and catalog of exercises; ear drills; progress and 10-minute routine |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/learn/` | New | Step model, instruction templates, matcher, stages, progress store |
| `src/theory/` | New | Transposition, fingering, scales, triads, cadences, intervals, key orders |
| `src/input/` (or similar) | New | Pointer, computer-keyboard and Web MIDI sources, learner-sound rules |
| `src/i18n/` (or similar) | New | English / Spanish strings and the remembered selector |
| `src/ui/learn-view.js`, `src/ui/learn-keyboard.js`, `src/ui/practice-view.js` | New | Learn route, instruction card, 2D keyboard, exercises section |
| `src/ui/router.js` | Modified | `#/learn/<id>` and `#/practice` routes |
| `src/ui/catalog.js` | Modified | Optional private index, "Private" chip, Learn / Play along actions, Practice link |
| `src/core/schema.js` | Modified | `visibility`, optional `learn` block |
| `src/audio/engine.js`, `src/audio/synth.js` | Modified | Phrase-range and single-note playback, silent rule for private songs, sampled voice with synth fallback (Milestone B) |
| `tools/convert-hooktheory.mjs` + pure module | New | Hooktheory to song format converter |
| `tools/serve.mjs` | Modified | Audio MIME types |
| `songs/cancer.json`, `songs/index.json` | Removed / Modified | Public Cancer removed; Ode to Joy added |
| `songs/ode-to-joy.json` (proposed id) | New | Public-domain beginner piece with provenance and license file if the source requires attribution |
| `songs-private/` | Local only | `index.json`, `cancer-private.json`; never committed or baked into the image |
| `assets/audio/piano/` | New (gated) | Sample subset plus license file |
| `styles/app.css` | Modified | Learn and Practice styles |
| `index.html` | Possibly modified | If the import map changes, the CSP hash in `nginx.conf` must follow (`tests/csp.test.js`) |
| `Dockerfile`, `.dockerignore`, `nginx.conf` | Modified | Exclude `songs-private/`; audio MIME and caching; document the read-only mount |
| `docs/STACK_TECNOLOGICO.md` | Modified | Salamander samples entry when approved |
| `tests/` | Modified / New | Step model, matcher, transposition, fingering, theory generators, converter (synthetic fixture), schema, silent rule, privacy guards, input map |
| `README.md` | Modified | Learn mode, inputs and Casio setup, private songs, language, Practice exercises, usability check |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The Hooktheory transcription is wrong in places (single crowd-sourced source) | Med | Converter keeps `confidence` medium or low per section; the user verifies by ear on the Casio phrase by phrase; corrections are data edits in the private file |
| Private Cancer is silent, so a learner cannot hear the target phrase in the app | Med | Accepted by the user; the learner hears their own notes, and the instruction plus shaded keys carry the guidance; the user knows the song by ear |
| The user's Casio exposes only USB audio, not MIDI | Med | Detection shows "No MIDI device found" in one line with a hint; computer keyboard and taps stay first-class |
| Doubled or missing sound with MIDI | Low | App sound for MIDI input is a setting, default off; on for the other inputs |
| E major (four sharps) is hard for a first-day learner | Med | "Transpose to C major" toggle with recomputed fingering, remembered |
| Algorithmic fingering gives awkward fingers on some melody passages | Med | Five-finger positions with explicit shift steps; authored `finger` values in song data win over computed ones; flagged for by-ear and by-hand review |
| Private melody leaks into the public image or repository | Low | Gitignore plus `.dockerignore`, no `COPY` of the folder, synthetic-fixture tests, guard tests. GitHub Pages publishes from the main branch git tree (legacy build), so the gitignored folder cannot reach Pages |
| A suitable public-domain Ode to Joy score (simple theme) is not found on Mutopia or IMSLP | Med | Use a public-domain source of the theme or the symphony and reduce it to the theme with the reduction recorded in `what`; if none qualifies, stop and report instead of writing from memory |
| Sample assets are large or slow on mobile | Med | One velocity, sparse sample points, lazy load, size measured and announced before approval; synth fallback |
| Scope is large for one change (config asks for one reviewable slice) | High | Feature-branch chain of about 400-line slices; three milestones, each usable and judged by the user before the next |
| Usefulness is again not proven by unit tests | High | Success criteria are observed behaviors with a written manual usability protocol |
| Chord steps are hard to enter with one mouse pointer | Med | Order-free accumulation of chord keys; the computer keyboard and MIDI allow simultaneous keys |

## Rollback Plan

- Learn mode and Practice exercises are additive (new routes, new modules, new catalog actions). Reverting their slices restores the MVP player untouched; Play along never depends on them.
- The private library is optional at run time: not mounting `songs-private/` returns the catalog to the public set with no error.
- Sampled piano: the synth stays as fallback; reverting the sample slice (assets, voice, stack entry) restores the oscillator sound.
- Public catalog swap: reverting that slice restores `songs/cancer.json` and its index entry.
- Each slice is one PR in the chain with its own revert; Milestone A ships without B, and B without C.

## Dependencies

- **Proposed new dependency (asset, Milestone B, needs user approval before entering):** Salamander Grand Piano samples, CC BY 3.0, by Alexander Holm, a subset at one velocity in a web format. The apply phase measures the exact source URL, version, file list, format and total size, then stops for the announcement. Alternatives to present as rejected: Tone.js Sampler (an npm runtime library; the project has none), General MIDI soundfonts packaged as JavaScript (larger, lower quality, unclear provenance), and improving the oscillator synth (still not a piano, which is the complaint).
- **Public-domain source** for Ode to Joy: a Mutopia Project or IMSLP file, recorded with URL, license, SHA-256 and access date.
- **Captured input:** `songs-private/sources/hooktheory-cancer.json` (already present, gitignored).
- **Hardware for manual checks:** the user's Casio digital piano with a USB cable; whether it exposes MIDI is checked during Milestone A.
- No npm package and no build step.

## Success Criteria

Observable learning behaviors (checked with the manual usability protocol below, not only unit tests):

- [ ] A person who has never played can find and press C (Do) on their own using only lesson zero, in the language they choose.
- [ ] That person can follow the first verse phrase of private Cancer with the right hand, using only the on-screen instructions, in E major and in C major, reaching "Correct" on every step within 10 minutes.
- [ ] At every moment of a lesson the screen states one thing to do next in one sentence, and the keys to press with their finger numbers are visible on the keyboard without scrolling.
- [ ] The app waits: with no input or a wrong key it does not advance; a wrong key shows "Try again" and the expected keys stay shaded.
- [ ] The app never plays private Cancer: no Listen action, Play along is silent, and only the learner's own presses sound (on the Casio by itself, or through the app for keyboard and taps).
- [ ] The same phrase can be completed with on-screen taps, the computer keyboard, and the Casio over USB MIDI when it exposes MIDI; when it does not, the app says so in one line and keeps working.
- [ ] On Ode to Joy, the learner hears each phrase first, then plays it.
- [ ] Closing the browser and returning resumes at the same phrase, stage, key and language.
- [ ] The user, playing the private Cancer melody, recognizes the song (user confirmation recorded).
- [ ] With samples approved, the user judges the app sound as a piano rather than a synth (user confirmation recorded).
- [ ] In Practice exercises, the learner can run the 10-minute routine end to end, play a C major scale with the fingering shown, and answer an ear drill, with progress (streak, best tempo) visible the next day.

Mechanical guards (automated):

- [ ] `node --test` covers the step model, matcher, transposition, fingering, theory generators (scale notes and fingering per key, triad inversions, cadences, circle of fifths order), converter (synthetic fixture), schema additions, the silent rule (the engine schedules no note of a private song) and privacy guards, and passes inside the Docker build stage.
- [ ] Every learner-facing string exists in English and Spanish (a test fails on a missing key).
- [ ] The built image and the public repository contain no file from `songs-private/`, no Cancer melody and no lyrics.
- [ ] On GitHub Pages the catalog shows only public songs and no error when the private index is absent.

**Manual usability check plan:** a written protocol in the README (or `docs/`) with participant profile (has never played), setup (device, input, language), tasks (lesson zero; first Cancer phrase right hand in E and in C; Ode to Joy first phrase; resume after reload; one 10-minute routine), rules (the observer does not help), what to record (time per task, steps where the person hesitated more than 10 seconds or asked a question, wrong-key count), and pass thresholds matching the criteria above. Results are recorded with date, device and input in the slice PR notes.

## Remaining gates (not open product questions)

- Approval of the Salamander sample dependency after the apply phase measures it and the orchestrator announces it.
- The user's by-ear confirmation of the converted Cancer melody before its confidence is raised.
