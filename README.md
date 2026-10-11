# Piano guide

A single-page app to learn songs on the piano, step by step.

## Run with Docker (primary)

```sh
docker build -t piano-guide .
docker run --rm -p 8790:8080 piano-guide
```

Then open `http://localhost:8790/`. The build runs the test suite inside the image (`node --test`), so the image only exists if the tests pass. Port 8790 is a suggestion: pick any free port.

The images used (exact tags and digests) and their vulnerability audit are listed in `docs/STACK_TECNOLOGICO.md`.

## Run without Docker (dev server)

Requires Node 22 or newer. No `npm install` is needed: the project has no dependencies.

```sh
PORT=8790 node tools/serve.mjs
```

On PowerShell: `$env:PORT=8790; node tools/serve.mjs`. The default port is 8790. Check that the port is free first.

## Tests

```sh
node --test
```

The runner is the built-in one; there is nothing to install.

## Adding a song

Songs are data. A new song needs a `songs/<id>.json` file and an entry in `songs/index.json`. The format is defined and enforced by `src/core/schema.js` (`validateSong`, `validateIndex`); an invalid song shows as "Unavailable" in the catalog with the reason.

## Routes

The site uses hash routes, so it works on any static host and under a subpath with no rewrites.

| Hash | Shows |
|------|-------|
| `#/` | Song catalog (cards from `songs/index.json`) |
| `#/song/<id>` | Song player: 3D keyboard with falling notes, transport controls, position readout and BPM, and the grand-staff score under the keyboard. Add `?debug=1` to the page URL (or the hash) for the drift and frame-time overlay |
| `#/song/<id>?level=<id>&names=<solfege or letters>&view=<both, scene or score>` | Same song with the level, note names and view preselected; the selector under the title changes them and rewrites the hash without a reload |
| anything else | "Page not found" with a link to the catalog |

An id that is not in the index shows "Song not found". The browser back button always disposes the previous view first.

## Content security policy

`nginx.conf` allows the inline import map in `index.html` by its SHA-256 hash. If the import map text changes, update the hash in `nginx.conf`; `tests/csp.test.js` fails until both agree. Inline scripts and inline styles are not allowed.

## Engine contract

`src/audio/engine.js` owns musical time. `createEngine()` returns:

| Method | What it does |
|--------|--------------|
| `setTimeline(timeline, { tick? })` | Loads a resolved level (`core/timeline`); keeps the position unless `tick` is given; the BPM defaults to the song's |
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

## Scene

`src/scene/` draws the 3D keyboard with three.js 0.186.1 (vendored under `assets/vendor/`, see `docs/STACK_TECNOLOGICO.md`). The player loads it lazily, so the catalog never downloads three.js; `render(tick, playing)` is called once per frame from the single animation loop and reads no clock of its own.

- Colors: right hand orange (`#f59e0b`), left hand blue (`#3b82f6`). Hand identity does not rely on color alone: left-hand bars carry long dark stripes, right-hand bars are plain (finger markers with hand shapes arrive in a later PR).
- Keys depress about their back edge and light up in the hand color with a soft glow while their note sounds. A paused scene lights no key.
- Falling notes sit in tick space: a bar's lower edge reaches the key-top line at the moment its note starts, and its height is proportional to its duration. Only the parent group moves each frame. Two clipping planes bound the look-ahead (2 bars).
- Range: the keyboard fits the song (3 semitones of padding, snapped outward to C and B, at least 3 octaves); the camera frames it. With `?debug=1` a "Full 88" button shows all 88 keys and reframes; the regular control arrives with the practice panel.
- No WebGL, or a failed three.js import: the scene slot shows "3D view unavailable on this device" and the transport and audio keep working.
- One `WebGLRenderer` is shared by the whole page; leaving the player disposes the scene's own geometry, materials and textures.

## Score

`src/score/` draws the grand staff as SVG without a notation dependency: `layout.js` and `engraving.js` are pure (pitch placement, key signature, accidentals, stems, beams, rests, ties, tuplets, grace notes, ornament positions, the tick to x table), `draw.js` turns that into plain drawing descriptors, `glyphs.js` holds the hand-authored paths and `render.js` builds the SVG. The player calls `score.render(tick)` once per frame from the same loop as the scene.

- One continuous system: the staff lines, clefs, key signature and time signature stay fixed, the measures scroll under a fixed red playhead, so a seek or a loop wrap lands in the same place as playing there.
- Beginner (`notation: "labelled"`): larger noteheads colored by hand with the note name inside (solfege by default, letters with `names=letters`; a `label` field wins), a finger row above the treble staff and below the bass staff, and a chord row above the staff with the chord symbol only. Original (`notation: "engraved"`): empty noteheads, ornament signs, and optional roman numerals and analysis callouts.
- A hidden hand is not drawn. Under `prefers-reduced-motion: reduce` the score steps once per beat instead of moving smoothly.
- The SVG is `role="img"` with a title ("<song>, <level> score") and a description (key, meter, tempo, bars). Song text only ever reaches the page through `textContent`. Beyond 5000 nodes only the measures within 8 of the playhead stay mounted.
- Known limits: no cross-staff notes and no multi-measure rests. On a phone in landscape the two views share the stage, so the score is small: choose `Score` in the View control (or `view=score`) to give it the whole width.

### Levels and view

The level opens from the hash `level`, then the last level chosen for that song in this session (`sessionStorage`), then the song default. The selector lists only the levels a song has (a single level is a static chip), shows the note-name toggle on the labelled notation only and the Analysis toggle only when the level has `analysis[]`. Switching level keeps the bar and beat, the BPM, the loop, the metronome and the hand state; while playing the engine drops its pending voices and schedules the new notes from the same tick in one call. The View control (`Both`, `Keyboard`, `Score`) hides the other slot and skips its drawing.
