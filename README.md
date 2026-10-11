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
| `#/song/<id>` | Song player: transport controls, position readout and BPM; the keyboard and score views arrive later. Add `?debug=1` to the page URL (or the hash) for the drift and frame-time overlay |
| `#/song/<id>?level=<id>&names=<solfege or letters>&view=<both, scene or score>` | Same song with the level, note names and view preselected |
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
