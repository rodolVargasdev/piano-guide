# Piano guide

A single-page app to learn songs on the piano, step by step.

## Run with Docker (primary)

```sh
docker build -t piano-guide .
docker run --rm -p 8790:8080 piano-guide
```

Then open `http://localhost:8790/`. The build runs the test suite inside the image (`node --test`), so the image only exists if the tests pass. Port 8790 is a suggestion: pick any free port.

To see the private songs in the container, mount the folder read-only (see "Private songs").

The images used (exact tags and digests) and their vulnerability audit are listed in `docs/STACK_TECNOLOGICO.md`.

## Run without Docker (dev server)

Requires Node 22 or newer (the Docker image uses Node 24 for its test stage). No `npm install` is needed: the project has no dependencies.

```sh
PORT=8790 node tools/serve.mjs
```

On PowerShell: `$env:PORT=8790; node tools/serve.mjs`. The default port is 8790. Check that the port is free first.

## Learn mode

Open a song and press **Learn**. The screen says one thing at a time: which finger goes on which key ("Right hand: thumb on C (Do)."), with the key shaded on a close keyboard and the finger number on it. Press the key and the screen says "Correct" and gives the next step; press another key and it says "Try again" and keeps the shaded key. A phrase is a few steps; finish it and the next one opens. Progress (phrase, hand, key, language) is saved in the browser and "Continue" brings you back to it.

- **Language**: the selector (English / Español) switches every text at once, also in the middle of a step.
- **Key**: when a song offers it, a second key (for example "C major" for a song in E major) recomputes the note names and the fingers.
- **Hand**: right or left hand, when the song has both.
- **Private songs** have no Listen button: the app only tells you what to play. Your own key presses always sound.

### Inputs

All three work at the same time.

| Input | How |
|-------|-----|
| On-screen keys | Click or tap the keys. Several fingers at once play several keys. Sliding off a key ends the note |
| Computer keys | The home row plays white keys: `A S D F G H J K L ; '`. The row above plays the black keys between them: `W E R T Y U I O P [`. The map starts one white key below the current hand position and moves with it; the letters are drawn on the keys. Ctrl, Alt and Meta combinations, text fields and auto-repeat never play a note. The letters follow the physical keys (a Spanish keyboard shows its own letter on the `;` position in Chrome and Edge) |
| MIDI piano | Chrome or Edge, a secure page (`localhost` counts). Press **Connect piano** and allow the permission; the chip shows the device name. The app does not add sound to MIDI notes by default (the piano already sounds); the setting "Sound from the app for MIDI" turns it on |

Casio digital pianos: connect the USB TO HOST port to the computer with a USB cable, then press **Connect piano**. If the chip says "MIDI: no device", the piano may be exposing only USB audio; use the computer keys or tap the keys.

### Private songs

A song you must not publish goes in `songs-private/` (a folder next to `index.html`, ignored by git and by Docker). It joins the catalog on your machine with a "Private" chip and is silent in the app: the cursor and the falling bars move, nothing from the song sounds, and the play button says "Play (no sound)". Nothing in the repository, the image or GitHub Pages contains it.

- Convert a Hooktheory capture: put it at `songs-private/sources/hooktheory-cancer.json` and run `node tools/convert-hooktheory.mjs` (writes `songs-private/cancer-private.json` and its index entry).
- With Docker, mount the folder read-only: `docker run --rm -p 8790:8080 -v <path>/songs-private:/usr/share/nginx/html/songs-private:ro piano-guide`. Without the mount only the public songs appear and nothing is reported. The `sources/` folder is never served.
- With the dev server, `NO_PRIVATE=1 node tools/serve.mjs` hides the whole folder, to see what GitHub Pages would show.

### Usability check

`docs/USABILITY_CHECK.md` is the protocol to test Learn mode with a person who has never played.

## Practice exercises

Open **Practice exercises** (the link in the header, or the button on the catalog). Nothing here is a song: every exercise is generated from music theory, so there is nothing to copy and no copyright. The page opens with a **Today** card (the 10-minute routine of the day, the key of the day on a circle of fifths and your days in a row) and then the exercises in four groups.

| Group | Exercises |
|-------|-----------|
| Technique | Five-finger patterns, major scales (one or two octaves, right hand, left hand, then both together), arpeggios |
| Harmony | Chords and inversions, the cadence I, IV, V, I, the progressions I, vi, IV, V and I, V, vi, IV (a left hand root and a right hand chord, with the smallest movement between chords) |
| Ear training | Hear the interval (starts with major third, perfect fifth and octave), hear the chord (major or minor) |
| Routine | The 10-minute routine |

- **Doc card**: every exercise has a short card (goal, why it matters, how to do it, what good looks like, tempo steps) in English and Spanish, one tap away on the exercise page ("How this exercise works").
- **A run**: press **Start**; the keys to press are shaded with the finger number, one step at a time. Right keys say "Correct", a wrong key says "Try again", keeps the step and makes the run "not clean". Taps, the computer keys and MIDI work like in Learn mode (same input panel). **Listen** plays the exercise first (generated notes only; it never plays a song).
- **After a run**: **Again** (same key and tempo), **Faster** (the next tempo of the card after a clean run; it stops at the top and says so), **Next hand** (right, left, then both together) and **Next key**. The order of the keys is the circle of fifths, the circle of fourths, random (every key once before a repeat) or the same key; the key is also chosen on the circle of fifths. A scale opens on the first key without a clean run in the order C, G, D, F, A, E, B, Bb, Eb, Ab, Db, F#; it is a suggestion, every key can be chosen.
- **Metronome**: a click at the page tempo while a run is going. Tempo is a pacing aid: nothing is timed, and a "clean run at 72" means no wrong key while the click was at 72.
- **Ear drills**: **Play** the question (as often as you like), then pick a name or play it back on the keyboard (any octave counts). A second wrong answer shows the right one. A round is ten questions; 8 of 10 right unlock the next choice (perfect fourth, minor third, major sixth, major second, minor sixth, minor seventh, major seventh, tritone, minor second; chords add diminished and augmented).
- **10-minute routine**: a warm-up (a five-finger pattern in the key after the last warm-up on the circle of fifths), a scale (the key practiced longest ago or never), chords (triads, the cadence or the I, V, vi, IV progression) and an ear drill, 2 + 3 + 3 + 2 minutes. **Skip block** at any moment; the summary says "N days in a row". A day counts when at least one block was done; skipping everything records nothing.
- **Progress** (best clean tempo, clean streak, clean runs, last practiced, the days in a row, the unlocked ear choices) is saved in the browser under one key and shows on the list and on each exercise; **Reset progress** on the list asks "Reset all practice progress? Yes No" and clears it. It holds only ids, key names, counts, tempos and dates.
- **Suggested fingering**: a fingering is marked "Suggested fingering" when method books disagree: the right hand of B-flat major and the left hand of F-sharp major scales, the left hand arpeggios of D-flat, E-flat, A-flat and B-flat, the left hand crossing finger of two-octave arpeggios, and the minor arpeggios of B, F-sharp and the flat keys. The scale and arpeggio cards also say "Standard fingering; some books differ."

## Tests

```sh
node --test
```

The runner is the built-in one; there is nothing to install.

## Adding a song

Songs are data. A new song needs a `songs/<id>.json` file and an entry in `songs/index.json`. The format is defined and enforced by `src/core/schema.js` (`validateSong`, `validateIndex`); an invalid song shows as "Unavailable" in the catalog with the reason.

Levels and analysis, by example from `songs/chopin-nocturne-op9-no2.json` (and `tests/fixtures/chords-only-song.json`, a synthetic chords-only song used by the tests):

- `levels` has up to two keys, `beginner` and `original`; `defaultLevel` names one of them and `songs/index.json` lists the same level ids. A song with one level shows a static chip instead of the selector.
- `notation: "labelled"` draws note names inside enlarged noteheads (Beginner); `notation: "engraved"` draws standard notation (Original). `strictBars: true` asks the validator to check that every bar of every hand is exactly covered, and the score then draws only the rests you wrote.
- `analysis` (optional, per level) is a list of `{ tick, endTick?, kind, title, text, roman?, function? }` with `kind` one of `harmony`, `voice-leading`, `ornament`, `rubato`, `dynamics`, `form`. It appears only when the Analysis toggle is on: roman numerals under the staff, a short callout per entry (keep `title` under about 18 characters) and the full text in the lesson card. A level with no `analysis` has no Analysis toggle.
- `lesson` has one entry per level id; a level without one shows "No lesson for this level yet" and a validator warning.
- `contentPolicy: "chords-only"` (the fixture above) forbids `role: "melody"` and any `lyrics` string anywhere in the file; the arrangement is then described as a generic chord-based accompaniment.
- A level with `transcribed: true` (the Chopin Nocturne and Ode to Joy) needs a `public-domain-score` source on mutopiaproject.org or imslp.org. Notes are read only from that source, never from memory, and the source entry records the piece page, the file URL, the ID, the license, the SHA-256 of the file and the access date. The Nocturne data is adapted from a Mutopia file licensed CC BY-SA 3.0 (typeset by Renato Biolcati Rinaldi from the 1881 G. Schirmer edition): keep that attribution and license with any copy or adaptation of `songs/chopin-nocturne-op9-no2.json`. The LilyPond file itself is not stored in the repository.
- A `tie: true` note and the note that continues it (same hand and pitch, starting where it ends) sound once for both lengths; the score draws both.

## Routes

The site uses hash routes, so it works on any static host and under a subpath with no rewrites.

| Hash | Shows |
|------|-------|
| `#/` | Song catalog: a hero and one card per song from `songs/index.json` (no three.js and no player code is downloaded for it) |
| `#/song/<id>` | Song player: 3D keyboard with falling notes, transport controls, position readout and BPM, and the grand-staff score under the keyboard. Add `?debug=1` to the page URL (or the hash) for the overlay (clock jitter, frame time, graphics tier and camera section) |
| `#/song/<id>?level=<id>&names=<solfege or letters>&view=<both, scene or score>` | Same song with the level, note names and view preselected; the selector under the title changes them and rewrites the hash without a reload |
| `#/learn/<id>?level=<id>` | Learn mode: the step-by-step teacher (see "Learn mode" above) |
| `#/practice` | Practice exercises: the Today card and the list of exercises (see "Practice exercises" above) |
| `#/practice/<id>` | One exercise: `five-finger`, `scale-major`, `triads`, `arpeggios`, `cadence-i-iv-v-i`, `progression-i-vi-iv-v`, `progression-i-v-vi-iv`, `ear-intervals`, `ear-chords` or `routine`; any other id shows "Exercise not found" with a link back |
| anything else | "Page not found" with a link to the catalog |

An id that is not in the index shows "Song not found". The browser back button always disposes the previous view first.

## Content security policy

`nginx.conf` allows the inline import map in `index.html` by its SHA-256 hash. If the import map text changes, update the hash in `nginx.conf`; `tests/csp.test.js` fails until both agree. Inline scripts and inline styles are not allowed.

## Engine contract

`src/audio/engine.js` owns musical time. `createEngine()` returns:

| Method | What it does |
|--------|--------------|
| `setTimeline(timeline, { tick? })` | Loads a resolved level (`core/timeline`); keeps the position unless `tick` is given; the BPM defaults to the song's. While playing (a level switch), the notes of the new level that should already be sounding start at once for their remaining length, so a held chord does not stay silent until its next onset |
| `play()` | Creates and resumes the audio context inside the call (call it from the Play click), optionally after a one-bar count-in |
| `pause()` / `stop()` | Pause keeps the position; stop goes to 0 (the loop start when a loop is set) |
| `seek(tick)` | Cancels pending voices and re-queues from the new tick in the same call |
| `setBpm(n)` / `getBpm()` | User BPM clamped to 20 to 240; returns the shown value |
| `setSlow(on)` | Plays half of the user BPM |
| `setLoop(range or null)` | Loop `{ startTick, endTick }`, already normalized by `core/practice` |
| `setHandModes({ L, R })` | Per hand `{ muted, hidden }`; muting silences it, hiding is for the views |
| `setMetronome({ enabled, countIn, subdivision })` | Clicks follow the song's beat unit and the effective BPM; they play even with both hands muted |
| `position()` | `{ tick, bar, beat, seconds }` at the heard audio position (`currentTime - outputLatency`); the same object each call |
| `on(name, fn)` | Events `state` (`{ state }`), `loop-pass` (once per completed pass) and `ended` (end of song, position back to 0); returns an unsubscribe function |
| `dispose()` | Stops, disposes the voices and clicks, suspends the context and drops listeners |

The scheduler runs every 25 ms with a 120 ms look-ahead (1.5 s while the tab is hidden). Everything is deterministic given the audio clock, so `node --test` covers it with a fake context (`tests/audio/`). Sound itself can only be judged by listening.

## Practice tools

The panel under the transport drives `src/ui/practice-controller.js` (state, no DOM) and `src/ui/practice-panel.js` (the controls).

| Control | What it does |
|---------|--------------|
| Set A here, Set B here | Take the playhead as the start or the end of the loop. The range is swapped when inverted and snapped to the bar or beat (A down, B up); the panel always shows the normalized range, or "Loop not set" when nothing loopable results. A valid range turns the loop on |
| Loop a section | Loops the named section as it is |
| Loop | Turns the loop on or off; turning it off also stops the ramp |
| Ramp from, by, to, Ramp, Hold | With a loop on, sets the BPM to the start value and raises it one step after each completed pass up to the target; Hold freezes it. Without a loop it says "Needs a loop" and does nothing |
| Mute, Hide (left, right) | Mute silences a hand and keeps it visible; Hide removes it from the keyboard and the score and keeps it audible. Both hands muted still leaves the metronome. The flags survive seeks, loop wraps and level changes |
| Full 88 | Frames the whole keyboard instead of the range of the level |
| Quality | Graphics tier of the keyboard view: Auto (default), High, Medium, Low or Minimum. A tier overrides Auto; choosing Auto again restarts it (see Scene) |

## Lesson card

Under the practice panel, `src/ui/lesson-card.js` shows the `lesson` entry of the active level from the song file: overview, the chords used (each chip outlines its keys on the keyboard and lists its notes; an unknown symbol shows as text), hand positions with their bar, how to sit, the practice plan, the arrangement note and interpretation when present, an Ornaments list with the bar of each ornament (`ornaments[{ tick, name, text }]`), the analysis entries when the Analysis toggle is on, the sources and the confidence notes (lower confidence is labelled). Sources are links only when their address starts with `https:`. A level without a lesson shows "No lesson for this level yet". The lesson shape is `{ summary, chordsUsed[], handPositions[{ tick, hand, anchor, text }], posture, practicePlan[], arrangementNote?, interpretation?: { rubato, dynamics }, ornaments?: [{ tick, name, text }] }`.

## Scene

`src/scene/` draws the 3D keyboard with three.js 0.186.1 (vendored under `assets/vendor/`, see `docs/STACK_TECNOLOGICO.md`). The player loads it lazily, so the catalog never downloads three.js; `render(tick, playing)` is called once per frame from the single animation loop and reads no clock of its own.

- Colors: right hand orange (`#f59e0b`), left hand blue (`#3b82f6`). Hand identity does not rely on color alone: left-hand bars carry long dark stripes, right-hand bars are plain, and finger markers are circles for the right hand and rounded squares for the left, each with a corner R or L.
- Keys depress about their back edge and light up in the hand color with a soft glow while their note sounds. A paused scene lights no key.
- Falling notes sit in tick space: a bar's lower edge reaches the key-top line at the moment its note starts, and its height is proportional to its duration. Only the parent group moves each frame. Two clipping planes bound the look-ahead (2 bars).
- Range: the keyboard fits the song (3 semitones of padding, snapped outward to C and B, at least 3 octaves); the camera frames it. The practice panel has a "Full 88" toggle that shows all 88 keys and reframes.
- `highlightNotes(midis)` outlines keys in a neutral teal that no hand uses, whatever the playback does (the lesson card calls it for its chord chips); an empty array clears it, keys outside the drawn range are ignored and the outline survives a range or level rebuild.
- Finger markers (`marker-plan.js`, `markers.js`): a numbered marker on the key of every note that has a `finger` (full strength while it sounds, a ghost at 40 percent during the beat before), nothing for a note without one (its key still lights), and a pulsing ring one beat before a hand shift (a destination more than 5 semitones outside the previous onset group of that hand, from `shiftHints`; static under reduced motion). One instanced mesh, one draw call, drawn last so no effect covers a number.
- Stage (`stage.js`, `keyboard.js`): a dark room with a faint backdrop, a warm key light with soft shadows, lacquered black keys, ivory white keys, a glossy floor and a pool of light, reflecting a small procedural studio through `PMREMGenerator`. No bloom, no post-processing, no addons.
- Quality tiers: Auto starts at High (Medium with 4 cores or fewer or a touch pointer) and a frame-time watchdog (`scene/quality.js` over the pure `core/quality.js`) steps down one tier at a time when the average over 120 frames stays above 22 ms for 2 s (Medium: reflections off; Low: shadows, rim light and glow off; Minimum: pixel ratio 1 and a one-bar horizon) and up at most once after 20 s under 10 ms. Notes, key states and finger markers stay on in every tier. The Quality control overrides it.
- Camera: one framing per song section with a 1.4 s tween across a boundary (also on a seek while paused); songs with one section never move it. `prefers-reduced-motion: reduce`, followed live, makes the camera cut instead, keeps the rings static and the score stepping per beat; keys still depress and notes still fall.
- No WebGL, or a failed three.js import: the scene slot shows "3D view unavailable on this device" and the transport and audio keep working.
- One `WebGLRenderer` is shared by the whole page; leaving the player disposes the scene's own geometry, materials and textures.

## Score

`src/score/` draws the grand staff as SVG without a notation dependency: `layout.js` and `engraving.js` are pure (pitch placement, key signature, accidentals, stems, beams, rests, ties, tuplets, grace notes, ornament positions, the tick to x table), `draw.js` turns that into plain drawing descriptors, `glyphs.js` holds the hand-authored paths and `render.js` builds the SVG. The player calls `score.render(tick)` once per frame from the same loop as the scene.

- One continuous system: the staff lines, clefs, key signature and time signature stay fixed, the measures scroll under a fixed red playhead, so a seek or a loop wrap lands in the same place as playing there.
- Beginner (`notation: "labelled"`): larger noteheads colored by hand with the note name inside (solfege by default, letters with `names=letters`; a `label` field wins), a finger row above the treble staff and below the bass staff, and a chord row above the staff with the chord symbol only. Original (`notation: "engraved"`): empty noteheads, ornament signs, and optional roman numerals and analysis callouts.
- A hidden hand is not drawn. Under `prefers-reduced-motion: reduce` the score steps once per beat instead of moving smoothly.
- The SVG is `role="img"` with a title ("<song>, <level> score") and a description (key, meter, tempo, bars). Song text only ever reaches the page through `textContent`. Beyond 5000 nodes only the measures within 8 of the playhead stay mounted.
- Glyphs are hand-drawn SVG paths (clefs, accidentals, rests, flags, ornaments) and spacing reserves room for accidentals so none prints over a neighbouring chord. Known limits: no cross-staff notes, no multi-measure rests, and no slurs, hairpins, dynamics or pedal signs. On a phone in landscape the two views share the stage, so the score is small: choose `Score` in the View control (or `view=score`) to give it the whole width.

### Levels and view

The level opens from the hash `level`, then the last level chosen for that song in this session (`sessionStorage`), then the song default. The selector lists only the levels a song has (a single level is a static chip), shows the note-name toggle on the labelled notation only and the Analysis toggle only when the level has `analysis[]`. Switching level keeps the bar and beat, the BPM, the loop, the metronome and the hand state; while playing the engine drops its pending voices and schedules the new notes from the same tick in one call. The View control (`Both`, `Keyboard`, `Score`) hides the other slot and skips its drawing.

## Performance notes

Measured on 2026-10-10 (Chrome on an RTX 3050 laptop GPU through ANGLE and Direct3D 11, a local dev server and the built image). Details and what was not checked are in `openspec/changes/archive/2026-10-11-piano-guide-mvp/prs/`.

- Draw calls per frame: 18 on High and Medium, 11 on Low and Minimum (budget: under 20).
- Frame time on High at 1440 x 900 and 844 x 390: average 16.7 ms, p95 16.9 ms (the 60 Hz display period).
- Catalog route: 37 KB over 13 requests from the image with gzip, no three.js.
- `?debug=1` clock jitter, the gap between the audio clock and the frame clock per frame: 8.5 to 9 ms at most per 10-frame window. It is not the delay between what is heard and what is seen, which a page cannot measure.

## License

The code and documentation are MIT licensed (`LICENSE`). The Nocturne data, `songs/chopin-nocturne-op9-no2.json`, is adapted from a Mutopia Project file and is licensed CC BY-SA 3.0; its attribution is in `songs/LICENSE-chopin-nocturne-op9-no2.md`. The Ode to Joy data, `songs/ode-to-joy.json`, is adapted from Mutopia Project piece 528, which is Public Domain (no attribution is required; the source, the license and the SHA-256 of the file are in `songs/LICENSE-ode-to-joy.md`); its left hand is an original arrangement. A song you keep for yourself goes in the private folder described above and is never part of the public data.
