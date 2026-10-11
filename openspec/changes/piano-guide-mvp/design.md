# Design: Piano Guide MVP

## Technical Approach

A static, build-free single-page app. `index.html` declares an import map and loads `src/main.js` as an ES module. The code is split into five layers with a strict dependency direction:

```
src/ui  ----->  src/audio  --->  src/core   (pure: no DOM, no Web Audio, no three.js)
   |              ^                 ^
   +----------> src/scene ----------+
   |                                |
   +----------> src/score ----------+   (src/score/layout.js is pure; render.js touches the DOM)
```

- `src/core` holds every rule that can be wrong in a way a test can catch: song and index validation, pitch spelling and naming, chord-symbol parsing, tick/second conversion for 4/4 and 12/8, transport anchor math, scheduling windows with loop wrap, active-note and shift-hint queries, loop normalization, BPM clamping, tempo ramp, keyboard range and key geometry, the quality-tier decision. It imports nothing outside `src/core`, so `node --test` runs it directly.
- `src/audio` owns the only clock: `AudioContext.currentTime`. Every view asks the engine "what tick is it now" once per animation frame. Nothing else keeps time.
- `src/scene` (three.js) and `src/score` (SVG) are pure subscribers: `render(tick)`. They never schedule, never advance time.
- `src/ui` composes everything: hash router, catalog, player shell, controls, lesson card, a tiny state store, and the single `requestAnimationFrame` loop.

This maps one to one onto the proposal's "one timeline, many views" approach and onto the specs in `openspec/changes/piano-guide-mvp/specs/` (`song-catalog`, `song-data-model`, `playback-engine`, `practice-tools`, `keyboard-scene`, `score-view`, `lesson-guide`). The song schema is defined normatively in `specs/song-data-model/spec.md`; this design restates it and adds the implementation shape.

## Architecture Decisions

### Decision: Ticks as the canonical musical unit, PPQ = 480 as a code constant

**Choice**: All song data and all internal positions are integer ticks, 480 per quarter note, exported as `PPQ` from `src/core/timing.js`. It is not a song-file field. A bar of 4/4 is 1920 ticks; a bar of 12/8 is 12 x 240 = 2880 ticks.
**Alternatives considered**: A per-file `ppq` field (every consumer must rescale, no benefit for hand-authored data); seconds in the data (breaks on every BPM change); float beats (rounding errors); PPQ 96 (cannot express 32nd-note tuplets inside Chopin fioriture exactly).
**Rationale**: 480 divides by 2, 3, 4, 5, 6, 8, 10, 12, 16 and 32, so dotted values, compound meter, 32nds and common tuplets stay integral. Integer ticks make bar-sum validation exact.

### Decision: Tempo per beat unit, single tempo per song, runtime clamp

**Choice**: Song files declare `tempo: { bpm, beatUnit, marking? }` with `beatUnit` in `quarter`, `eighth`, `dotted-quarter`, `half`; the validator accepts `bpm` 20 to 300. At runtime the user tempo goes through the pure `clampBpm(n)` (20 to 240) and the control shows the clamped value; the song default is clamped the same way. `ticksPerSecond = bpm * ticksPerBeatUnit(beatUnit) / 60`. Slow mode multiplies the user BPM by 0.5. Rubato is guidance text, not timing data.
**Alternatives considered**: A flat `defaultBpm` field without a beat unit (wrong mental model for 12/8, where players count dotted quarters or eighths); a tempo map with changes (not needed by the MVP songs).
**Rationale**: Covers 4/4 at 72 quarter-BPM and 12/8 counted in dotted quarters. Conversion functions take a tempo object, so a later tempo map is additive.

### Decision: Spelled pitch strings in the data, MIDI at runtime

**Choice**: Note events carry `pitch: "Eb4"` (letter, accidental `#`, `b`, `##`, `bb`, octave in scientific pitch, C4 = MIDI 60). `src/core/pitch.js` parses to `{ letter, alter, octave, midi }`. Display names come from the written spelling (Eb4 is "Mib" or "Eb", never "Re#"); an event `label` overrides the display text.
**Alternatives considered**: MIDI numbers only (loses Eb versus D#, which the score and the solfege labels need).
**Rationale**: Spelling is musical information that cannot be reconstructed reliably; hand-authored data is also more legible and reviewable.

### Decision: Flat `notes[]` per level with a `hand` field

**Choice**: A level holds one sorted `notes[]` array; each event has `hand: "L" | "R"`, `voice` 1 or 2 (default 1), plus optional `finger`, `vel`, `role`, `label`, `ornament`, `tie`, `grace`, `tuplet`, `fingeringSource`, and `rest: true` for explicit rests (no pitch). The left hand engraves on the bass staff, the right hand on the treble staff.
**Alternatives considered**: Separate `rh`/`lh` arrays (two code paths for every query and merge sorting everywhere for playback).
**Rationale**: Playback, scene and score iterate one sorted timeline and filter by hand; sorting and validation live in one place.

### Decision: AudioContext clock as the single time source, look-ahead scheduler

**Choice**: A `setTimeout` loop every 25 ms schedules all events whose time falls inside the next 120 ms on the Web Audio clock. The transport keeps an anchor `{ ctxTime, tick, ticksPerSecond }`; `tickAt(t) = anchor.tick + (t - anchor.ctxTime) * tps`. BPM change, seek, pause, stop and loop wrap re-anchor. Views use `tickAt(ctx.currentTime - outputLatency)` so what is seen matches what is heard. The engine publishes `{ tick, bar, beat, seconds }` through `engine.position()`; all views read it once per frame from the same call.
**Alternatives considered**: `requestAnimationFrame` as the clock (throttled in background tabs, jitters audio); `performance.now()` plus Web Audio (two clocks drift).
**Rationale**: Sample-accurate audio; visuals derived from the same clock.

### Decision: Engine transport semantics

**Choice**:
- `play()` resumes the context inside the user gesture (autoplay policy), optionally runs a one-bar count-in, and schedules from the current tick.
- `pause()` keeps the position, releases sounding voices (short release, no clicks) and cancels voices scheduled in the future.
- `stop()` does what pause does and sets the position to 0 (or the loop start when a loop is active).
- `seek(tick)` cancels every pending scheduled voice (`osc.stop(now)` on voices whose start is in the future, release on sounding ones), re-anchors, and resumes scheduling from the new tick in the same call, so there are no stuck or doubled notes. The engine tracks scheduled voices in a ring list to make this possible.
- End of song without a loop: scheduling stops at `lengthTicks`; when the position passes it, the engine calls `stop()` (position 0, all notes released) and emits `ended`.
- Hidden tab: background timers are throttled to about 1 s, so on `visibilitychange` to hidden the look-ahead widens to 1.5 s, and returns to 120 ms when visible. Views read the engine position on the next frame; there is no accumulated state to drift.
**Rationale**: Every transport rule in `specs/playback-engine/spec.md` maps to one method with a pure core helper underneath.

### Decision: Loops scheduled on an unwrapped timeline

**Choice**: `windowEvents(notes, fromAbsTick, toAbsTick, loop)` in `src/core/schedule.js` returns occurrences with an "absolute play tick" that keeps increasing across loop passes (pass index times loop length is added). The engine never reschedules already-queued notes at a wrap; views map back with `songTickOf(absTick, loop)`. The pure `passesBetween(prevAbsTick, absTick, loop)` in `src/core/practice.js` returns how many passes completed; the engine emits `loop-pass` once per completed pass.
**Alternatives considered**: Seeking back at loop end (gap or doubled notes at the seam; timer jitter decides the seam).
**Rationale**: Seamless loops; seam logic is a pure function with edge-case tests (note straddling loop end is cut at loop end, note exactly at loop end belongs to the next pass, a window spanning two passes).

### Decision: Loop normalization and section loops are pure

**Choice**: `normalizeLoop({ startTick, endTick }, { snap: "bar" | "beat", meter, pickupTicks, lengthTicks, tempo })` swaps an inverted range, snaps A down and B up to the bar or beat grid (beat unit from `tempo.beatUnit`), clamps to `[0, lengthTicks]`, and returns `null` for a zero-length result, which the UI shows as "Loop not set". `loopFromSection(section)` returns the section range. The UI always displays the normalized range.

### Decision: Tempo ramp in BPM, requires an active loop

**Choice**: Ramp config `{ start, step, target }` in BPM; defaults start = `clampBpm(round(0.6 * songBpm))`, step 5, target = `clampBpm(songBpm)`; `normalizeRamp` swaps start and target when inverted. On enabling, the user BPM is set to `start`. On each `loop-pass`, unless Hold is on, `nextRampBpm({ current, start, step, target })` returns `max(start, min(target, current + step))`. `canRamp(loop)` is false without an active loop; the ramp control then shows "Needs a loop" and does nothing. Every completed pass counts because without MIDI input success cannot be observed; Hold is the user's way to repeat a tempo.
**Alternatives considered**: Percent-based steps (the spec scenarios are in BPM; percentages only feed the default start).

### Decision: Synthesized piano tone with core Web Audio nodes only

**Choice**: Per voice: one triangle oscillator plus two sine partials (fundamental detuned +3 cents, octave at -12 dB), into a lowpass `BiquadFilterNode` whose cutoff starts velocity-scaled (1.5 to 6 kHz) and decays, into a `GainNode` envelope (attack 4 ms, exponential decay shortening with pitch, sustain floor, release 180 ms, longer while the level's `pedal` range holds). Voice cap 48, oldest released first. Master: `DynamicsCompressorNode`. Metronome: 30 ms sine bursts, 1500 Hz accent on beat 1, 1000 Hz otherwise.
**Alternatives considered**: Samples or soundfonts (out of scope by proposal); `PeriodicWave` tables (more tuning effort for marginal gain).

### Decision: Metronome grid derived from `tempo.beatUnit`

**Choice**: `beatGrid(meter, pickupTicks, beatUnit, fromTick, toTick)` in core returns `[{ tick, accent }]`, one click per beat unit, `accent` true on the first beat of each bar. Nocturne (`dotted-quarter` in 12/8): 4 clicks per bar. A 12/8 file declaring `eighth` would click 12 per bar. Optional subdivision clicks at lower gain are a UI toggle. The metronome follows the effective BPM (slow mode and ramp included) and plays even when both hands are muted.

### Decision: AudioContext created lazily on the first user gesture

**Choice**: `src/audio/context.js` creates and resumes the context inside the Play click handler. Leaving the player suspends it rather than closing it, so returning is instant.

### Decision: three.js 0.186.1 vendored at `assets/vendor/`, core build only, no addons

**Choice**: Copy `three.module.min.js` and `three.core.js` from `C:\Users\JOSE-\localapps_job\personal-info\proyecto-work\portafolio-site\assets\vendor\` into `assets/vendor/`. Import map:

```html
<script type="importmap">
  { "imports": { "three": "./assets/vendor/three.module.min.js" } }
</script>
```

`three.module.min.js` imports `./three.core.js`, so both files travel together. Expected SHA-256 values (64 hex characters each):
- `three.module.min.js`: `3bc833fceb6577bd1a380388f832ae61cd6e2f78ad02b0bf0d5adf5a4a9334fe`
- `three.core.js`: `3b346151f65ffdfca3e4c002bd58966b78c423087fb48a873f83200de1bffc48`

The portfolio's `docs/STACK_TECNOLOGICO.md` prints the core hash with 65 characters (an extra leading `f`); do not copy it from there. The apply step MUST compute both hashes on the copied files (`Get-FileHash -Algorithm SHA256`) and record the computed values; the values above come from the orchestrator and were not recomputed during design. The OSV query (`POST https://api.osv.dev/v1/query`, package `three`, ecosystem `npm`, version `0.186.1`) is re-run before the commit. No `examples/jsm` addon is used.
**Alternatives considered**: `vendor/` at the repository root as the proposal wrote (superseded: one convention across the user's projects); CDN import (runtime third-party dependency); vendoring addons (more files to audit).

### Decision: Scene loaded lazily, with a no-WebGL fallback

**Choice**: `src/ui/player.js` does `await import("../scene/index.js")` inside `try`. If the import fails, or `createScene` throws because a WebGL context cannot be created (the `WebGLRenderer` constructor is wrapped), the scene slot shows "3D view unavailable on this device" and the player continues with a null scene object (no-op `render`, `setTimeline`, and so on), so score, transport and audio keep working. The catalog never downloads three.js.

### Decision: Falling notes as a static instanced field, clipped to the look-ahead window

**Choice**: For the active level and hand visibility, one `InstancedMesh` (rounded box geometry, `instanceColor` per hand) places each note once in tick space: `y = tick * unitsPerTick`, height = `dur`. Every frame only the parent group's `position.y = -nowTick * unitsPerTick` changes. Two world-space clipping planes (`renderer.localClippingEnabled = true`, `material.clippingPlanes`) cut everything below the key-top line and above the look-ahead horizon, so notes outside the bounded window are not drawn. Horizon: 2 bars by default (constant beats on screen), 1 bar on the Minimum tier. `frustumCulled = false` on the mesh. A seek needs no rebuild: the next frame's transform is the new position.
**Alternatives considered**: Rebuilding a windowed instance buffer every frame (CPU cost grows with density, allocations); fog only (notes would still be drawn, violating the spec); constant seconds on screen (notes stretch as BPM changes).
**Rationale**: One draw call, zero per-frame allocations, exact sync because position is a pure function of the tick, and the window bound is enforced on the GPU.

### Decision: Keyboard as two InstancedMeshes plus per-key state arrays

**Choice**: White keys and black keys are two `InstancedMesh`es. Geometry (x offset, width, black-key placement) comes from pure `src/core/keyboard-layout.js`. A sounding key depresses (rotation about its back edge, always on, including under reduced motion) and gets an emissive tint in its hand color through `instanceColor`; a pooled set of additive glow quads sits above pressed keys on the High and Medium tiers. `scene.highlightNotes(midis)` lights keys on demand (chord reference from the lesson card) with a neutral outline color, independent of playback; `highlightNotes([])` clears it.

### Decision: Keyboard range, fitted or full 88

**Choice**: Default "fitted": lowest and highest pitch of the resolved level, padded by 3 semitones, snapped outward to C and B white keys, minimum span 3 octaves, always containing every note. Toggle "Full 88" (A0 to C8). The camera frames the active range.

### Decision: Stage look with core-only lighting and reflections

**Choice**:
- Background near-black blue (`#0b0d12`) with linear `Fog` softening the horizon.
- Environment reflections: `PMREMGenerator.fromScene()` over a tiny procedural studio (two dim emissive softboxes and a ceiling strip); lacquered black keys and the floor reflect it.
- Lights: warm `SpotLight` key light (wide penumbra, 1024 shadow map on High), cool rim `DirectionalLight`, low `HemisphereLight` fill.
- Materials: white keys `MeshPhysicalMaterial` (roughness 0.35, clearcoat 0.3); black keys roughness 0.18, clearcoat 0.8; floor black `MeshStandardMaterial` roughness 0.22.
- Colors: left hand `#3b82f6` blue, right hand `#f59e0b` orange; falling notes slightly emissive with a brighter leading edge.
- `ACESFilmicToneMapping`, sRGB output. Effects never draw over the note field or the markers (markers render last with `depthTest: false`).
**Alternatives considered**: Bloom via `EffectComposer` and planar `Reflector` (addons, extra passes).
**Rationale**: A dark stage where the only saturated color is the music. Each effect maps to a tier switch.

### Decision: Quality tiers degrade reflections, then lights, then pixel ratio

**Choice**: Four tiers, each removing one family:

| Tier | Change from previous |
|------|---------------------|
| High | env reflections, shadows, all lights, glow quads, DPR `min(devicePixelRatio, 2)` |
| Medium | reflections off: env map removed, floor becomes matte |
| Low | lights reduced: shadows off, rim light off, glow quads off (key light and fill stay) |
| Minimum | pixel ratio 1, horizon 1 bar |

Pure `decideTier(frameTimesMs, currentTier, state)` in `src/core/quality.js` steps down one tier when the rolling 120-frame average exceeds 22 ms for 2 consecutive seconds. It steps up only after 20 consecutive seconds under 10 ms and at most once per session (sustained headroom, no oscillation). A manual selector overrides. Initial tier: High on desktop, Medium when `navigator.hardwareConcurrency <= 4` or the primary pointer is coarse. Every tier keeps falling notes, key states and finger markers.

### Decision: Reduced motion removes decoration only

**Choice**: Live `matchMedia("(prefers-reduced-motion: reduce)")` listener. When it matches: no section camera tweens (the camera cuts once to the framed range), no idle sway, no glow pulse, no smoothing flourishes; the score cursor steps per beat (see the score decision); lesson-card swaps have no transition (CSS `@media (prefers-reduced-motion: reduce)`). Essential motion stays: falling notes advance and keys still depress. When the preference clears, camera tweens resume at the next section boundary.

### Decision: Finger markers, shift hints and a non-color hand cue

**Choice**: One instanced billboard mesh over a `CanvasTexture` atlas (a single draw call for every marker and ring; separate `Sprite`s reached 27 draw calls per frame on the Nocturne and broke the budget). Shape encodes the hand independently of color: right-hand markers are circles, left-hand markers are rounded squares, each with a small "R" or "L" corner mark. The finger number is drawn only when the event has `finger`; an event without `finger` lights its key and shows no marker. Current notes: full opacity. Notes starting within the next beat: ghost markers at 40 percent opacity. Shift hint: pure `shiftHints(notes, hand, 5)` in `src/core/timeline.js` marks an event as a shift when its pitch lies more than 5 semitones outside the span (lowest to highest MIDI) of the previous onset group of the same hand; the scene draws a pulsing outline ring (static under reduced motion) on the destination key starting one beat before the shift.

### Decision: Custom SVG score, single continuous system, pure layout

**Choice**: One horizontal grand staff scrolling under a fixed playhead (the spec allows wrapping or horizontal scrolling with the cursor in view). `src/score/layout.js` is pure and computes: staff position per spelled pitch and clef, accidentals versus key signature and earlier accidentals in the bar, stem direction, beaming (12/8 in dotted-quarter groups of three; 4/4 per beat), rests (explicit `rest` events, or computed from gaps when the level is not `strictBars`), ties, tuplet brackets, grace notes (small, at their written tick), ornament sign positions, x positions from onset spacing, and the `tickToX` anchor table. `src/score/render.js` builds the SVG; `src/score/glyphs.js` holds hand-authored path data for G and F clefs, flat, sharp, natural, quarter and eighth rests, flags, and the ornament signs `turn`, `trill` ("tr" plus wavy line), `mordent`, `inverted-mordent`; `fioritura` is drawn as a bracket over the run.
Modes from the same layout:
- Beginner (`notation: "labelled"`): enlarged noteheads colored by hand with the name inside (solfege default, letters on toggle, `label` override), finger numbers above treble notes and below bass notes when `finger` is present, chord row above the treble staff showing the chord `symbol` only (the Beginner chord row ignores `roman` and `function`).
- Original (`notation: "engraved"`): standard proportions, no labels, chord row optional, ornament signs, and when Analysis is on, a roman-numeral row under the bass staff and analysis callouts anchored to their ticks.
Playhead: fixed line; content `transform: translateX(playheadX - tickToX(tick))`. Under reduced motion the tick passed to `tickToX` is quantized to the start of the current beat (from `beatGrid`), so the score steps per beat with no easing. `score.setHandModes(modes)` hides the bass or treble content of a hidden hand. Accessibility: the root `<svg role="img">` carries `<title>` ("<song title>, <level label> score") and `<desc>` (key, meter, tempo, bars shown), updated on song or level change. Beyond about 5000 nodes, only measures within plus or minus 8 of the playhead stay mounted.
**Alternatives considered**: VexFlow (new dependency; documented fallback requiring user notice); Bravura font; Unicode musical symbols.

### Decision: Chord symbols parsed in core

**Choice**: `src/core/chords.js` exports `parseChord(symbol)` returning `{ root, quality, bass?, pitches: ["E4", "G#4", "B4"] }` for major, minor, 7, maj7, m7, dim, dim7, m7b5, aug, sus2, sus4, add9 and slash bass, spelled from the root (E gives G#, not Ab). Unknown symbols return `null`; the lesson card shows the text without notes and no error. The card's chord chips call `scene.highlightNotes(midis)`.

### Decision: Hash router with query parameters and teardown

**Choice**: `#/` catalog; `#/song/<id>?level=<levelId>&names=solfege|letters&view=both|scene|score`. Level and names toggles update the hash with `history.replaceState`. Each route mount returns a `dispose()`; on any route change (including the browser back button) the router calls the previous view's `dispose()` first. Player `dispose()` calls `engine.stop()`, suspends the AudioContext, cancels the rAF loop, removes listeners, and disposes scene geometries, materials, textures and the renderer. Unknown ids show "Song not found" with a link back to the catalog.

### Decision: Catalog validates every indexed song

**Choice**: The catalog fetches `songs/index.json`, runs `validateIndex`, then fetches and validates each listed file in parallel. Valid entries render cards (title, composer, key, default BPM, level chips, "Open"). An entry whose file is missing or invalid renders an "Unavailable" card with the first validation reason (its `title` attribute holds the full list). If the index itself fails to load or parse, the page shows an error panel ("Song list could not be loaded") and no uncaught exception escapes. The player re-validates on open and shows the same reason for a deep link to a broken song.

### Decision: Level selection rules

**Choice**: Level resolution order: hash `level`, then `sessionStorage["piano-guide:level:<songId>"]`, then `defaultLevel`. The selector lists only the levels present in the file; with a single level it shows that one option as a static chip. Switching level keeps the musical position (`barBeatOf` in the old level, `tickOfBarBeat` in the new one, same meter and pickup, clamped to the new length) and keeps BPM, loop, metronome and hand state. While playing, the engine cancels pending voices and schedules the new level from the current tick in the same task (well under the 250 ms gap budget). An "Analysis" toggle sits next to the level selector, is shown only when the active level has `analysis[]`, and controls both the score marks and the card's analysis section.

### Decision: Hand modes are two independent flags per hand

**Choice**: `handModes = { L: { muted, hidden }, R: { muted, hidden } }`. The engine filters scheduling by `muted`; scene and score filter by `hidden`. Both hands may be muted; the transport shows "Both hands muted" and the metronome still plays. State survives seek, loop wrap and level change.

### Decision: One rAF loop, one small store

**Choice**: `src/ui/state.js` is a minimal observable store. `src/ui/player.js` runs the only `requestAnimationFrame` loop: `const pos = engine.position()`, then `scene.render(pos.tick)`, `score.render(pos.tick)`, readout update.

### Decision: Docker image is nginx alpine, non-root, with a test stage gate

**Choice**: Multi-stage `Dockerfile`:
1. `FROM node:<exact>-alpine AS test`: copy `package.json`, `src/`, `tests/`, `songs/`; run `node --test`; write `/app/.tests-passed`.
2. `FROM nginx:<exact>-alpine`: `COPY --from=test /app/.tests-passed /tmp/` (the final stage cannot build unless tests pass), copy `index.html`, `styles/`, `src/`, `songs/`, `assets/`, `nginx.conf`; run as `nginx` on port 8080 with pid and temp paths under `/tmp`.
`nginx.conf`: `application/javascript` for `.js`/`.mjs`, `application/json` for `.json`, `no-cache` for `index.html` and `songs/*.json`, long cache for `assets/vendor/`, `try_files $uri $uri/ =404`, `X-Content-Type-Options: nosniff`, a CSP allowing `'self'` scripts plus the import map by hash.
Tags are chosen in slice 1: newest patch of the current nginx stable line and of the current Node LTS line, each `x.y.z-alpine@sha256:<digest>`, scanned with `docker scout cves`, result and date in `docs/STACK_TECNOLOGICO.md`; unfixed CVEs are recorded with ID, impact and review date.
**Alternatives considered**: `nginxinc/nginx-unprivileged`; host-only tests (the shipped image would not be the tested build); Node in the runtime image.
**Rationale**: Docker-first rule. NOTE: the Node base image is a new dependency not in the proposal and must be announced to the user before slice 1 lands.

### Decision: Minimal `package.json` with no dependencies

**Choice**: `{ "name": "piano-guide", "private": true, "type": "module", "scripts": { "test": "node --test" } }`. No dependencies, no lockfile.

## Data Flow

```
songs/index.json --fetch--> core/schema.validateIndex --> catalog cards / error panel
songs/<id>.json  --fetch--> core/schema.validateSong ---> "Unavailable" card + reason
                                  | (valid)
user opens #/song/<id>?level=...  v
                     core/timeline.resolveLevel(song, levelId)
                     -> Timeline { notes[] (midi added), chords[], sections[], pedal[],
                                   analysis[], lengthTicks, range, shifts }
                                  |
          +-----------------------+-----------------------+
          v                       v                       v
   audio/engine              scene.setTimeline       score.setTimeline
   (core/schedule windows,   (instanced field,       (pure layout -> SVG)
    anchors, beatGrid)        clipping window)
          |
   AudioContext.currentTime (single clock)
          |
   engine.position() <---- ui/player rAF loop ----> scene.render(tick)
                                              +---> score.render(tick)
                                              +---> transport readout
   engine events: state, loop-pass (-> core/practice.nextRampBpm), ended
   lesson card chord chip -> core/chords.parseChord -> scene.highlightNotes(midis)
   route change / back button -> player.dispose() -> engine.stop(), scene.dispose()
```

## File Changes

All files are new except `README.md`.

| File | Action | Description |
|------|--------|-------------|
| `index.html` | Create | App shell, import map, mount, module entry |
| `styles/app.css` | Create | Catalog and player layout, dark theme, controls, lesson card, reduced-motion rules |
| `src/main.js` | Create | Boot: store, router |
| `src/core/pitch.js` | Create | Spelled pitch parse/format, MIDI, solfege/letter names, key-aware transpose |
| `src/core/chords.js` | Create | `parseChord` symbol to spelled pitches, `null` on unknown |
| `src/core/timing.js` | Create | `PPQ`, bar and beat-unit ticks, ticks/seconds, `barBeatOf`, `tickOfBarBeat`, `beatGrid` |
| `src/core/schema.js` | Create | `validateSong`, `validateIndex`, errors and warnings with JSON paths |
| `src/core/timeline.js` | Create | `resolveLevel`, `activeAt`, `shiftHints` |
| `src/core/schedule.js` | Create | Anchors, `tickAt`/`timeAt`, `windowEvents`, `songTickOf` |
| `src/core/practice.js` | Create | `clampBpm`, `effectiveBpm`, `normalizeLoop`, `loopFromSection`, `passesBetween`, ramp functions, hand filters |
| `src/core/keyboard-layout.js` | Create | Key geometry, fitted range |
| `src/core/quality.js` | Create | `decideTier` |
| `src/audio/context.js` | Create | Lazy AudioContext, resume, suspend, latency |
| `src/audio/synth.js` | Create | Voices, envelope, pedal-aware release, cancellation |
| `src/audio/metronome.js` | Create | Click scheduling from `beatGrid` |
| `src/audio/engine.js` | Create | Transport, scheduler, hidden-tab look-ahead, events |
| `src/scene/index.js` | Create | `createScene` facade and null-scene fallback |
| `src/scene/keyboard.js` | Create | Instanced keys, press state, glow quads, `highlightNotes` |
| `src/scene/falling-notes.js` | Create | Instanced field, clipping planes |
| `src/scene/marker-plan.js` | Create | Pure plan of which keys carry a marker or ring at a tick |
| `src/scene/markers.js` | Create | One instanced billboard mesh: finger markers with hand shapes, ghosts, shift rings |
| `src/scene/stage.js` | Create | Lights, PMREM studio env, floor, fog, tone mapping |
| `src/scene/camera.js` | Create | Range framing, section tweens, reduced-motion cut |
| `src/scene/quality.js` | Create | Frame sampling, applies tiers |
| `src/score/layout.js` | Create | Pure notation layout |
| `src/score/glyphs.js` | Create | SVG paths for clefs, accidentals, rests, flags, ornament signs |
| `src/score/render.js` | Create | SVG for labelled and engraved modes, playhead, title/desc, hand modes |
| `src/ui/router.js` | Create | Hash parsing, dispatch, dispose on change |
| `src/ui/state.js` | Create | Observable store |
| `src/ui/catalog.js` | Create | Cards, unavailable cards, index error panel |
| `src/ui/player.js` | Create | Composition, lazy scene import with fallback, rAF loop, dispose |
| `src/ui/transport.js` | Create | Play, pause, stop, seek bar with sections, BPM with clamp display, slow mode, metronome, count-in |
| `src/ui/practice-panel.js` | Create | Loop A-B and by section, ramp with Hold, hand flags, range, quality |
| `src/ui/level-select.js` | Create | Level selector, names toggle, Analysis toggle, session memory |
| `src/ui/lesson-card.js` | Create | Lesson, chord chips, analysis, ornaments with bar numbers, sources and confidence, missing-content notice |
| `songs/index.json` | Create | Catalog index |
| `songs/cancer.json` | Create | `contentPolicy: "chords-only"`, chords, structure, Beginner and Original accompaniment, lesson, sources, confidence |
| `songs/chopin-nocturne-op9-no2.json` | Create | Pickup plus bars 1 to 4, Beginner and Original (`transcribed`, `strictBars`), analysis |
| `assets/vendor/three.module.min.js` | Create | three.js 0.186.1 |
| `assets/vendor/three.core.js` | Create | three.js 0.186.1 core |
| `tests/core/*.test.js` | Create | One suite per core module |
| `tests/score/layout.test.js` | Create | Pure layout tests |
| `tests/songs.test.js` | Create | Index and every song validate; index fields match files; Cancer has no lyrics and no melody role anywhere; Chopin bar checkpoints |
| `tests/fixtures/*.json` | Create | Minimal valid song and one malformed fixture per rule |
| `tools/serve.mjs` | Create | Zero-dependency static dev server, port from `PORT` |
| `package.json` | Create | `type: module`, `test` script |
| `Dockerfile` | Create | Test stage plus nginx runtime |
| `.dockerignore` | Create | Exclude `.git`, `openspec`, `.atl`, `docs`, `tools` |
| `nginx.conf` | Create | MIME, caching, headers, non-root paths |
| `docs/STACK_TECNOLOGICO.md` | Create | three.js, nginx and Node images: versions, digests, hashes, audit method, date, result |
| `README.md` | Modify | Docker run (primary), dev server, tests, adding a song |

## Interfaces / Contracts

### Song JSON schema (version 1)

Normative source: `specs/song-data-model/spec.md`. Summary:

| Field | Type | Rules |
|------|------|-------|
| `schemaVersion` | `1` | exact |
| `id` | string | `^[a-z0-9-]+$`, equals the file stem |
| `title`, `composer` | string | non-empty; `composer` is the composer or artist credit; `arranger` optional |
| `key` | `{ tonic, mode }` | spelled tonic, `major` or `minor` |
| `meter` | `{ num, den }` | den in 2, 4, 8 |
| `pickupTicks` | integer | 0 to less than one bar |
| `tempo` | `{ bpm, beatUnit, marking? }` | bpm 20 to 300 in the file; runtime clamp 20 to 240 |
| `lengthTicks` | integer | pickup plus whole bars |
| `contentPolicy` | `open` or `chords-only` | optional, default `open` |
| `sections` | `[{ id, name, startTick, endTick }]` | sorted, non-overlapping, inside length |
| `chords` | `[{ tick, dur, symbol, roman?, function? }]` | sorted, `tick + dur` inside length |
| `levels` | map, keys `beginner` / `original` | at least one |
| `defaultLevel` | string | key of `levels` |
| `lesson` | map by level id | `{ summary, chordsUsed[], handPositions[{ tick, hand, anchor, text }], posture, practicePlan[], interpretation?: { rubato, dynamics }, ornaments?: [{ tick, name, text }], arrangementNote? }` (added in PR 20b: the card lists each ornament with its bar, as `specs/lesson-guide/spec.md` requires) |
| `sources` | `[{ url, what, accessed, kind, license?, sha256? }]` | at least one; kind in `public-domain-score`, `user-submitted`, `original-arrangement`, `reference` |
| `confidence` | `[{ scope, level, note }]` | at least one; level `high`, `medium`, `low` |

Level: `{ label, description, notation: "labelled" | "engraved", transcribed?, strictBars?, chords?, notes[], pedal?: [{ startTick, endTick }], analysis?: [{ tick, endTick?, kind, title, text, roman?, function? }] }`, analysis kind in `harmony`, `voice-leading`, `ornament`, `rubato`, `dynamics`, `form`.

Note event: `{ tick, dur, pitch, hand: "L" | "R", finger?: 1..5, voice?: 1 | 2, vel?: 0..1, role?: "melody" | "accompaniment" | "bass" | "ornament", label?, ornament?: "turn" | "trill" | "mordent" | "inverted-mordent" | "fioritura", tie?, grace?, tuplet?: { n, inSpaceOf }, fingeringSource?: "source" | "editorial", rest?: true }`. Grace notes carry their written `tick` and `dur`, are excluded from bar sums and overlap checks, and are played as written; the engine never computes grace timing.

Validator rules (errors), each with its own malformed fixture and test:
1. Missing required field (path reported); wrong type; `tempo.bpm` outside 20 to 300.
2. `defaultLevel` not in `levels`; `levels` empty; level key not `beginner` or `original`.
3. `sources` empty; source missing `url`, `what` or `accessed`; unknown `kind`.
4. `confidence` empty; level outside `high`/`medium`/`low`.
5. A level with `transcribed: true` and no `public-domain-score` source whose URL host is `mutopiaproject.org`, `imslp.org` or a subdomain of either.
6. `contentPolicy: "chords-only"` with any `role: "melody"` event, or any non-empty string field named `lyrics` anywhere in the file (recursive scan).
7. `finger` not an integer in 1 to 5; pitch unparsable or outside MIDI 21 to 108; non-rest event without pitch.
8. Negative `tick`; `dur` not a positive integer; `tick + dur > lengthTicks`.
9. Overlap of non-grace events in the same hand and voice, except identical `tick` and `dur` (chord).
10. `strictBars: true`: per hand and voice, every bar (pickup as a partial bar) exactly covered by non-grace onsets (chords counted once) plus `rest` events; no non-grace event crossing a barline without a tie split. Without `strictBars`, gaps are allowed and become computed rests in the score.
11. Sections overlapping or outside length; chord `tick + dur` outside length.

`validateIndex`: missing `id`, `file`, `title`, `composer`, `key`, `defaultBpm` or `levels`; duplicate `id`. File existence and field agreement with the song file are checked in `tests/songs.test.js`.
Warnings: duration outside the notation subset, key signature beyond 4 accidentals, level without lesson.

`songs/index.json`:

```json
{ "songs": [
  { "id": "cancer", "file": "cancer.json", "title": "Cancer", "composer": "My Chemical Romance",
    "key": { "tonic": "E", "mode": "major" }, "defaultBpm": 72, "levels": ["beginner", "original"] }
] }
```

Illustrative song (fictional data, not one of the MVP songs):

```json
{
  "schemaVersion": 1,
  "id": "example-song",
  "title": "Example Song",
  "composer": "Traditional",
  "key": { "tonic": "C", "mode": "major" },
  "meter": { "num": 4, "den": 4 },
  "pickupTicks": 0,
  "tempo": { "bpm": 72, "beatUnit": "quarter" },
  "lengthTicks": 3840,
  "sections": [ { "id": "a", "name": "Verse", "startTick": 0, "endTick": 3840 } ],
  "chords": [
    { "tick": 0, "dur": 1920, "symbol": "C", "roman": "I", "function": "tonic" },
    { "tick": 1920, "dur": 1920, "symbol": "G7", "roman": "V7", "function": "dominant" }
  ],
  "levels": {
    "beginner": {
      "label": "Beginner",
      "description": "Root in the left hand, triad in the right hand.",
      "notation": "labelled",
      "strictBars": true,
      "notes": [
        { "tick": 0, "dur": 1920, "pitch": "C3", "hand": "L", "finger": 5, "role": "bass" },
        { "tick": 0, "dur": 1920, "pitch": "C4", "hand": "R", "finger": 1, "role": "accompaniment" },
        { "tick": 0, "dur": 1920, "pitch": "E4", "hand": "R", "finger": 3, "role": "accompaniment" },
        { "tick": 0, "dur": 1920, "pitch": "G4", "hand": "R", "finger": 5, "role": "accompaniment" },
        { "tick": 1920, "dur": 1920, "pitch": "G2", "hand": "L", "finger": 5, "role": "bass" },
        { "tick": 1920, "dur": 1920, "pitch": "B3", "hand": "R", "finger": 1, "role": "accompaniment" },
        { "tick": 1920, "dur": 1920, "pitch": "F4", "hand": "R", "finger": 3, "role": "accompaniment" },
        { "tick": 1920, "dur": 1920, "pitch": "G4", "hand": "R", "finger": 5, "role": "accompaniment" }
      ]
    },
    "original": {
      "label": "Original",
      "description": "Melody over a held bass.",
      "notation": "engraved",
      "notes": [
        { "tick": 0, "dur": 960, "pitch": "E5", "hand": "R", "finger": 3, "role": "melody", "ornament": "turn" },
        { "tick": 960, "dur": 960, "pitch": "D5", "hand": "R", "finger": 2, "role": "melody" },
        { "tick": 0, "dur": 1920, "pitch": "C3", "hand": "L", "role": "bass" }
      ],
      "analysis": [
        { "tick": 0, "kind": "harmony", "title": "Tonic", "text": "Plain tonic triad.", "roman": "I", "function": "tonic" }
      ]
    }
  },
  "defaultLevel": "beginner",
  "lesson": {
    "beginner": {
      "summary": "Two chords, one hand position per hand.",
      "chordsUsed": ["C", "G7"],
      "handPositions": [ { "tick": 0, "hand": "R", "anchor": "C4", "text": "Thumb on Do (C4)." } ],
      "posture": "Sit centered on middle C, forearms level with the keys.",
      "practicePlan": ["Hands separately at 60 percent.", "Hands together, then raise the tempo."]
    }
  },
  "sources": [
    { "url": "https://example.org/source", "what": "Chord progression", "accessed": "2026-10-10", "kind": "reference" }
  ],
  "confidence": [ { "scope": "chords", "level": "high", "note": "Illustrative data." } ]
}
```

The example's `original` level has no lesson entry on purpose: it yields a warning and the card's "No lesson for this level yet" notice.

### Core module signatures

```js
// src/core/timing.js
export const PPQ = 480;
export function ticksPerBar(meter)                       // 4/4 -> 1920; 12/8 -> 2880
export function ticksPerBeatUnit(unit)                    // quarter 480, eighth 240, dotted-quarter 720, half 960
export function ticksPerSecond(tempo, bpm)                // bpm * ticksPerBeatUnit(tempo.beatUnit) / 60
export function ticksToSeconds(ticks, tempo, bpm), secondsToTicks(s, tempo, bpm)
export function barBeatOf(tick, meter, pickupTicks, beatUnit)   // { bar, beat, tickInBar }; pickup is bar 0
export function tickOfBarBeat({ bar, beat }, meter, pickupTicks, beatUnit)
export function beatGrid(meter, pickupTicks, beatUnit, fromTick, toTick) // [{ tick, accent }]

// src/core/pitch.js
export function parsePitch(s)                             // "Eb4" -> { letter:"E", alter:-1, octave:4, midi:63 }
export function noteName(pitch, mode)                     // "solfege" -> "Mib"; "letters" -> "Eb"
export function transpose(pitch, semitones, key)          // spelling follows the target key's side

// src/core/chords.js
export function parseChord(symbol)                        // { root, quality, bass?, pitches[] } | null

// src/core/schema.js
export function validateSong(json)                        // { ok, errors:[{ path, message }], warnings:[...] }
export function validateIndex(json)                       // same shape

// src/core/timeline.js
export function resolveLevel(song, levelId)               // Timeline
export function activeAt(timeline, tick)                  // sounding notes
export function shiftHints(notes, hand, thresholdSemitones = 5) // Set of event indexes that are shifts

// src/core/schedule.js
export function makeAnchor(ctxTime, tick, tps)
export function tickAt(anchor, ctxTime), timeAt(anchor, tick)
export function windowEvents(notes, fromAbsTick, toAbsTick, loop) // [{ note, absTick, absEnd }]
export function songTickOf(absTick, loop)

// src/core/practice.js
export const BPM_MIN = 20, BPM_MAX = 240;
export function clampBpm(n)
export function effectiveBpm({ userBpm, slowMode, slowFactor = 0.5 })
export function normalizeLoop(range, { snap, meter, pickupTicks, lengthTicks, tempo }) // range | null
export function loopFromSection(section)
export function passesBetween(prevAbsTick, absTick, loop)
export function canRamp(loop)
export function normalizeRamp({ start, step, target })
export function nextRampBpm({ current, start, step, target })
export function audibleNotes(notes, handModes), visibleNotes(notes, handModes)

// src/core/keyboard-layout.js
export function keyGeometry(midi)                         // { isBlack, x, width }
export function fittedRange(notes, { pad = 3, minSpan = 36 })

// src/core/quality.js
export const TIERS = ["high", "medium", "low", "minimum"];
export function decideTier(frameTimesMs, currentTier, state)  // { tier, state }

// DOM-side contracts
// engine: { play(), pause(), stop(), seek(tick), setBpm(n), setSlow(b), setLoop(range|null),
//           setHandModes(m), setMetronome(cfg), setTimeline(tl), position(), on(event, fn), dispose() }
// scene:  { setTimeline(tl), setHandModes(m), setRange(r), setReducedMotion(b), setQuality(t),
//           highlightNotes(midis), render(tick), resize(), dispose() }
// score:  { setTimeline(tl), setMode({ notation, names, analysis }), setHandModes(m),
//           setReducedMotion(b), render(tick), dispose() }
```

### Chopin transcription protocol (slice 6)

- Source of truth: the Mutopia Project LilyPond source of the Nocturne Op. 9 No. 2. Starting point: the Mutopia Chopin listing (`https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=ChopinFF`). The exact piece page URL, `.ly` URL, Mutopia ID, license, access date and SHA-256 of the downloaded `.ly` go into `sources[]` with `kind: "public-domain-score"` and `what` naming the bars taken. The exact piece URL was NOT looked up during design and must not be written from memory.
- License check first: Mutopia files are public domain or Creative Commons (some CC BY-SA). If CC BY-SA, the data carries attribution and the license, and the user is told before commit. The `.ly` is not committed.
- Cross-check: an IMSLP public-domain edition, recorded with `kind: "reference"`.
- Method: hand-transcribe the pickup plus bars 1 to 4 from the `.ly` (resolving `\relative` octaves bar by bar, noting the absolute first pitch of each bar as a checkpoint) into the Original level with `transcribed: true` and `strictBars: true`, explicit `rest` events, grace notes at their written ticks and ornament signs. Derive the Beginner level (melody kept, left hand reduced, simplifications explained in the lesson).
- Fingering: if the source has none, events get `fingeringSource: "editorial"` and a `confidence` entry with scope `fingering` says so.
- Verification before commit: `validateSong` passes (bar sums per voice); a test pins each bar's first pitch and the bass on each beat of bar 1 as read from the source; the Original render is compared bar by bar against the Mutopia PDF; the bar 1 analysis note (diminished color over the Eb pedal, required by `specs/lesson-guide/spec.md`) is written only after reading the harmony from the source, and if the source contradicts that description, the discrepancy is reported instead of forced; audible check at slow tempo.

### Cancer data protocol (slice 5)

`contentPolicy: "chords-only"`; E major, 4/4, 72 BPM. Every progression cites its URL (`kind: "user-submitted"` or `reference`); `confidence` has `chords:verse` medium and `chords:chorus` low unless a second source agrees. No lyrics, no melody role. Beginner: LH roots, RH triads. Original: same chord track with fuller voicings and analysis; the lesson's `arrangementNote` states it is a generic chord-based accompaniment, not a transcription.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `timing`: bar lengths 4/4 and 12/8, pickup, ticks/seconds round trip for BPM 20 to 300, `barBeatOf` and `tickOfBarBeat` inverse, `beatGrid` per beat unit with accents | `node --test`, table-driven |
| Unit | `pitch`: parsing, MIDI, solfege and letters for naturals, sharps, flats, A0/C8 bounds | `node --test` |
| Unit | `chords`: E gives E G# B, slash chords, unknown symbol returns null | `node --test` |
| Unit | `schema`: valid fixture passes; one malformed fixture per rule 1 to 11 and per `validateIndex` rule, each failing with the expected path (contra-proof per rule) | `node --test`, `tests/fixtures` |
| Unit | `schedule`: re-anchor on BPM change keeps the tick; `windowEvents` returns each event exactly once over consecutive windows; loop seam cases | `node --test` |
| Unit | `practice`: `clampBpm` (500 gives 240), `normalizeLoop` swap/snap/zero-length, `loopFromSection`, `passesBetween`, ramp sequence 50, 55, 60, 65, 70, gap case 68 to 70, never below start, `canRamp` without loop | `node --test` |
| Unit | `timeline.activeAt`, `shiftHints` (6 semitones is a shift, 5 is not), `keyboard-layout`, `quality` (downgrade order, no oscillation) | `node --test` |
| Unit | `score/layout`: E4 on the first treble line, Eb major signature three flats, 12/8 beaming in threes, accidental once per bar, `tickToX` monotonic | `node --test` |
| Data | Index and songs validate; index fields match files; Cancer recursive scan finds no `lyrics` and no `role: "melody"`; Chopin checkpoints | `tests/songs.test.js` |
| Container | Image builds only if tests pass | `docker build` |
| Browser | Sync, transport, practice, levels, fallbacks, reduced motion, quality | Manual checklist below, `?debug=1` overlay |

TDD mode: `strict_tdd: false` (`openspec/config.yaml`); tests land with each core module in the same commit. Runner: `node --test` from the repository root.

## Performance Budget

| Item | Budget |
|------|--------|
| Catalog route transfer (no three.js) | under 60 KB |
| App code (`src/`, unminified) | under 200 KB |
| Player first render after song fetch | under 1.5 s on desktop (cold three.js download excluded) |
| Draw calls | under 20 (keys 2, note field 1, glow 1, markers pooled, floor 1) |
| Frame time desktop, High tier | average under 12 ms, p95 under 16.7 ms |
| Frame time phone landscape (844 x 390) | p95 under 33 ms on Low or Minimum |
| Audio/visual drift | under 20 ms (`?debug=1` overlay) |
| Scheduler | 25 ms timer, 120 ms look-ahead visible, 1.5 s hidden; no gaps at loop seams |
| Level switch while playing | gap under 250 ms |
| Per-frame allocations in render paths | zero |
| SVG nodes mounted | under 5000; virtualize by measure beyond that |

## Verification Plan

1. `node --test` from the repository root: all suites green; break one validator rule locally to confirm its test fails, then restore.
2. Dev server on a free port other than 8765 (reserved by another app): `Get-NetTCPConnection -LocalPort 8790 -ErrorAction SilentlyContinue`; if empty, `$env:PORT=8790; node tools/serve.mjs`, otherwise try 8791 and up.
3. Docker (primary): `docker build -t piano-guide .`, then `docker run --rm -p 8790:8080 piano-guide` after the same port check; `curl -I http://localhost:8790/src/main.js` returns `application/javascript`.
4. Browser at `http://localhost:8790/`:
   - Catalog lists both songs with key and BPM; no three.js request on the catalog; a locally renamed song file shows an "Unavailable" card; a broken `index.json` shows the error panel.
   - Cancer Beginner at 72 then 50 BPM: falling notes, keys, cursor and audio agree; drift under 20 ms; typing 500 shows 240.
   - Pause/resume, stop, seek mid-note (no stuck notes), end of song returns to 0.
   - Slow mode, metronome accent, count-in, loop by section with a clean seam, inverted A-B gets swapped, ramp steps per pass and stops at target, ramp without loop says "Needs a loop", Hold freezes it.
   - Hands: mute left (silent, visible), hide right (gone from scene and score), both muted with metronome only.
   - Level switch paused and playing; session memory; Analysis toggle; chord chip highlights keys; an unknown chord shows text only.
   - Chopin Original: engraved, ornament signs, roman numerals, 12/8 beaming; Beginner labelled.
   - Reduced motion emulated: no camera tweens or glow pulse, keys still depress, cursor steps per beat, card swaps without transition; clearing it resumes tweens at the next section.
   - CPU throttle 6x: tiers drop High, Medium (reflections off), Low (lights reduced), Minimum (DPR 1); markers still work.
   - WebGL disabled (browser flag or DevTools): message shown, score and audio work.
   - Back button from the player stops audio; repeated navigation does not grow memory (Performance monitor).
   - Responsive 844 x 390: keyboard, notes and transport visible without horizontal page scroll.
   - Hidden tab for 10 s during playback, then return: views at the audio position.
5. Results recorded honestly; anything not checked is listed as not checked.

## Threat Matrix

N/A: no shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The hash router only selects a song id matched against `songs/index.json`; unknown ids show "Song not found". Song text is inserted with `textContent`, never `innerHTML`; source URLs are rendered as links only when their scheme is `https:`.

## Migration / Rollout

No migration required (greenfield). Delivery follows the proposal's seven auto-chain slices. Notes for `sdd-tasks`: slice 1 also creates `package.json`, `tools/serve.mjs` and the Node test stage (announce the Node image); `src/core/chords.js` and `scene.highlightNotes` belong with the lesson card in slice 5; the three.js copy, its STACK entry and the computed hashes land together in slice 3.

## Open Questions

- [ ] Node base image for the Docker test stage is a new dependency: needs the user notice in slice 1.
- [ ] Exact nginx and Node tags and digests: chosen and scanned in slice 1.
- [ ] Mutopia file license for the nocturne: checked in slice 6 before transcription.
- [ ] Cross-staff notes (a left-hand note written on the treble staff) are not supported in the MVP; if the Chopin source needs them in bars 1 to 4, an optional `staff` field on events is the planned extension.
