# Proposal: Piano Guide MVP

## Intent

The user wants to learn songs on the piano with a tool that reads the music for him in several ways at once, in the style of a Jaime Altozano class: song title and BPM, chord names above the staff, finger numbers above notes, note names written inside the noteheads, and a keyboard below that lights up the keys. Pressing play must guide him step by step at a tempo he controls so he can play along.

He is a beginner who knows the basics, so the tool must make the music readable without notation skills (falling notes toward a 3D keyboard, colored hands, finger numbers, a lesson card that explains chords, hand positions and posture). He also asked for a site that surprises and still serves advanced, demanding players. Both audiences are served from ONE data model through a per-song level selector, not two products.

Songs are arranged by the agent on request and stored in the repository as data files. The first two are "Cancer" (My Chemical Romance) and Chopin's Nocturne Op. 9 No. 2.

Success looks like: the user opens the catalog, picks a song, picks a level, presses play, and can follow the guidance at a slow tempo, loop a passage and raise the tempo until he plays it; an advanced player switching to the Original level sees real notation, harmonic analysis and interpretation notes instead of training wheels.

## Scope

### In Scope

- Static SPA with hash routing: a short catalog landing page and a per-song player view.
- Song data model: one JSON file per song under `songs/`, listed in `songs/index.json`; adding a song means adding a file and an index entry. Each file holds metadata, tempo, meter, key, sections, chord track, and one or more **levels** (each level carries its own note events per hand, fingering and labels), plus lesson content, analysis annotations, sources and confidence notes.
- Level selector per song:
  - **Beginner**: roots or simple triads in the left hand, simplified melody or block chords in the right hand, note names inside noteheads (solfege by default, toggle to letter names), finger numbers, ghost-finger markers on the keys, falling notes.
  - **Original / Advanced**: full voicing where licensing allows (Chopin full texture for the transcribed bars; Cancer stays chord-based for copyright reasons), engraved-style notation without note-name labels, harmonic analysis layer (roman numerals, chord function, voice-leading notes, for example the diminished color over the Eb pedal in bar 1 of the nocturne), ornament explanations (Chopin's fioriture and turns), rubato and dynamics guidance.
- Playback engine: transport (play, pause, seek), adjustable BPM, slow mode, metronome with accented downbeat, loop A-B over a selected range, tempo ramp (start slow, raise by a step per successful loop pass), hands-separate practice (mute or hide either hand).
- Sound: Web Audio API synthesized piano-like tone (oscillators plus envelope), no samples, no new dependency.
- 3D keyboard scene with three.js: player-perspective camera, keys that press down and light up, falling notes whose length shows duration, left hand blue and right hand orange, ghost-finger markers with numbers 1 to 5 showing position and upcoming shifts.
- Visual ambition with a performance budget: polished lighting, subtle reflections on the key surface, smooth camera moves between song sections; respects `prefers-reduced-motion` (no camera moves, no non-essential animation) and degrades on low-end devices.
- Score view: SVG grand staff with chord names above, finger numbers, note names inside noteheads (Beginner) or clean engraved style (Original), and a cursor synced to playback.
- Lesson card per song and level: chords used, hand positions and shifts, how to sit and place the hands, practice plan; on Original level, the analysis and interpretation notes.
- First two songs:
  - Cancer: E major, 4/4, default 72 BPM (adjustable); chords, structure and a generic beginner accompaniment (LH roots, RH triads) only. No lyrics, no vocal melody transcription. Sources and confidence recorded in the file (verse progression from a single user-submitted source; chorus progression lower confidence).
  - Nocturne Op. 9 No. 2: Eb major, 12/8; MVP covers the opening A section (pickup plus first four bars) in both levels, transcribed from a public-domain machine-readable source (Mutopia Project LilyPond source or IMSLP score) with the source URL recorded in the file. Never from memory.
- Pure data and timing modules (schema validation, tick/beat/seconds conversion, loop and tempo-ramp math, scheduling windows, note-name mapping) tested with `node --test`, zero dependencies.
- three.js 0.186.1 vendored under `vendor/` (copied from the portfolio site, already OSV-clean there; re-checked before commit).
- nginx Dockerfile serving the static site (Docker-first rule); container is the primary way to run it locally.
- `docs/STACK_TECNOLOGICO.md` listing every dependency with exact version and the vulnerability check used, updated in the same commit that adds three.js and the nginx base image.
- GitHub Pages compatible paths (relative URLs, no server rewrites needed thanks to hash routing).
- Desktop first; usable on a phone in landscape.

### Out of Scope

- MIDI input, and therefore any "wait for me" mode that listens to the player.
- Accounts, progress tracking, backend, server-side anything.
- Audio samples or soundfonts (synthesized tone only).
- The full Chopin nocturne beyond the opening A section (later changes add sections).
- Lyrics or vocal melody of Cancer, or any copyrighted transcription beyond chords and structure.
- Realistic 3D hand models (finger markers are used instead).
- Score import (MusicXML, MIDI files) or an in-browser song editor.
- CI workflows (disabled before v1 by user rule).
- Internationalization beyond the solfege/letter note-name toggle.

## Capabilities

No existing specs in `openspec/specs/` (greenfield).

### New Capabilities

- `song-catalog`: landing page listing songs from `songs/index.json`, navigation to the player, hash routing.
- `song-data-model`: JSON song schema (metadata, tempo, meter, key, sections, chords, levels with per-hand note events and fingering, lesson, analysis, sources, confidence) and its validator.
- `playback-engine`: musical timing (ticks, beats, seconds), scheduling, transport, BPM, slow mode, metronome, Web Audio synthesis.
- `practice-tools`: loop A-B, tempo ramp, hands-separate, level selector behavior.
- `keyboard-scene`: three.js keyboard, key press and highlight, falling notes, hand colors, finger markers, lighting and camera moves, reduced-motion and low-end fallbacks.
- `score-view`: SVG notation with chord names, fingering, note-name labels (solfege or letters), playback cursor, Beginner vs Original rendering.
- `lesson-guide`: lesson card content per level, harmonic analysis layer, ornament and interpretation notes.

### Modified Capabilities

None.

## Approach

- **No build step**: `index.html` loads `src/main.js` as an ES module with an import map pointing `three` to `vendor/three.module.min.js`. Pure modules (`src/core/*`) have no DOM or three.js imports so `node --test` runs them directly.
- **One timeline, many views**: songs are converted at load time into a single sorted event timeline in ticks. The playback engine owns time (Web Audio clock with a look-ahead scheduler) and publishes the current position; the 3D scene, score cursor and audio are subscribers. This keeps all views in sync and makes timing testable without a browser.
- **Levels inside the song file**: one file per song with shared metadata, chords, sections and lesson, and a `levels` map. Adding a level or a song is data work, not code work. The validator rejects files missing sources, fingering ranges outside 1 to 5, or events outside the declared meter.
- **Notation without a dependency**: a custom SVG renderer covers what the MVP songs need (grand staff, key signature, quarter/eighth/dotted values, 12/8 beaming, accidentals, chord symbols, fingering, labelled noteheads). Rejected alternative: VexFlow, which renders more notation but adds a dependency and its own layout model; reconsider if Original-level fidelity proves insufficient (that would require informing the user per the dependency rule).
- **Sound**: Web Audio API with a few detuned oscillators and an ADSR envelope gives a recognizable piano-like tone. Rejected: sampled piano (asset weight, licensing, possible new dependency).
- **3D scene**: three.js with instanced falling-note meshes, a key mesh set with per-key animation, one key light plus environment lighting and a cheap reflective floor/key surface; camera moves are tweened per section and disabled under `prefers-reduced-motion`. A frame-time watchdog lowers quality (no reflections, fewer lights) if frames run long.
- **Content provenance**: every song file carries `sources[]` (URL, what was taken, date) and `confidence` notes; Chopin bars are transcribed from Mutopia/IMSLP, Cancer is limited to chords and structure.
- **Delivery (auto-chain, 400 changed-line budget per PR)**, suggested slices for `sdd-tasks` to refine:
  1. Skeleton: `index.html`, routing, catalog page, song schema and validator, timing core with `node --test`, Dockerfile, `docs/STACK_TECNOLOGICO.md`, README run instructions.
  2. Playback engine: scheduler, transport, BPM, slow mode, metronome, Web Audio synth; transport UI.
  3. Keyboard scene base: vendored three.js, keyboard, key press/highlight, falling notes, hand colors.
  4. Score view: SVG grand staff, labels toggle, chords, fingering, cursor; level selector wiring.
  5. Practice tools plus Cancer: loop A-B, tempo ramp, hands-separate; Cancer song file and lesson card.
  6. Chopin: transcribed A section in Beginner and Original levels, analysis layer, ornament and rubato notes.
  7. Visual polish: finger markers with shift hints, lighting and reflections, section camera moves, reduced-motion and quality fallback.
  Song JSON data can be long; if a song file alone pushes a slice over budget, it is split by level (Beginner first) rather than squeezed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `index.html`, `styles/` | New | App shell, import map, layout for catalog and player |
| `src/main.js`, `src/ui/router.js` | New | Entry point and hash routing |
| `src/core/` | New | Pure modules: schema validation, timing, scheduling math, loop/ramp, note names |
| `src/audio/` | New | Web Audio synth and metronome |
| `src/scene/` | New | three.js keyboard, falling notes, markers, lighting, camera |
| `src/score/` | New | SVG notation renderer and cursor |
| `src/ui/` | New | Catalog, transport, practice controls, level selector, lesson card |
| `songs/index.json`, `songs/*.json` | New | Catalog index and the two song files |
| `assets/vendor/three.module.min.js`, `assets/vendor/three.core.js` | New | three.js 0.186.1 vendored |
| `tests/` | New | `node --test` suites for `src/core/` |
| `Dockerfile`, `.dockerignore`, `nginx.conf` | New | Static nginx image |
| `docs/STACK_TECNOLOGICO.md` | New | Dependencies with exact versions and audit method |
| `README.md` | Modified | Run with Docker (primary), run tests, add a song |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Chopin bars transcribed wrong (naive Eb/Bb7 reading is already known to be wrong in bar 1) | Med | Transcribe only from Mutopia/IMSLP, record source URL, add a validator test that bar sums match 12/8 and spot-check bar 1 harmony |
| Cancer chord data inaccurate (single user-submitted source; chorus lower confidence) | Med | Record confidence in the file and show it on the lesson card; easy to correct as data |
| Copyright exposure on Cancer | Low | Chords, structure and generic accompaniment only; no lyrics or vocal melody |
| Custom SVG notation insufficient for Original level fidelity | Med | Scope renderer to MVP needs; VexFlow as a documented fallback requiring user notice |
| 3D scene too heavy on phones | Med | Frame-time watchdog and quality tiers; reduced-motion path; desktop first |
| Audio/visual drift | Med | Single Web Audio clock as time source; views read engine position each frame |
| Synthesized tone sounds poor | Low | Accepted for MVP; samples are a later change |
| Song files push slices over 400 lines | Med | Split song files by level across slices |
| Ambition creep (two audiences, polish) delays a usable tool | Med | Beginner path complete by slice 5; polish isolated in slice 7 |

## Rollback Plan

Greenfield repository: each slice is its own PR on top of the previous one. Rolling back means reverting the slice's merge commit (or closing the unmerged PR); earlier slices remain a working site. The Docker image is rebuilt from the reverted tree. No data migration or external state exists. Song files are independent: a bad song is reverted by removing its file and its `songs/index.json` entry.

## Dependencies

- three.js 0.186.1, vendored from `C:\Users\JOSE-\localapps_job\personal-info\proyecto-work\portafolio-site\assets\vendor\` (`three.module.min.js`, `three.core.js`); OSV re-check before commit.
- nginx official image (exact tag pinned and audited in the Dockerfile slice).
- Node.js built-in test runner (`node --test`) for local tests; no npm packages.
- Public-domain source for the nocturne (Mutopia Project or IMSLP), accessed during the Chopin slice.

## Assumptions and open product decisions (for the orchestrator)

- UI copy in English (matches the user's other sites). Assumption, not confirmed.
- Note names default to solfege (Do Re Mi, as in the screenshot) with a toggle to letters. Creative choice.
- Chopin MVP extent: pickup plus first four bars in both levels; rest deferred.
- Finger markers instead of 3D hand models. Creative choice.

## Success Criteria

- [ ] `docker build` and `docker run` serve the site; the catalog lists both songs.
- [ ] Opening a song and pressing play moves the falling notes, key highlights, score cursor and audio in sync at the chosen BPM.
- [ ] BPM change, slow mode, metronome, loop A-B, tempo ramp and hands-separate work on both songs.
- [ ] Level selector switches between Beginner (labels, simplified voicing) and Original (engraved style, analysis, ornaments) without reloading.
- [ ] Each song file validates, lists its sources and confidence, and has a lesson card per level.
- [ ] `node --test` passes for all `src/core/` modules, including a negative test that a malformed song is rejected.
- [ ] With `prefers-reduced-motion` set, no camera moves or decorative animation occur.
- [ ] Desktop playback holds a smooth frame rate; a phone in landscape stays usable.
- [ ] `docs/STACK_TECNOLOGICO.md` lists three.js and the nginx image with exact versions and their audit result.
- [ ] Every PR slice stays within the 400 changed-line budget or records why.
