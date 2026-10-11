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
| `#/song/<id>` | Song player (a placeholder until the player lands) |
| `#/song/<id>?level=<id>&names=<solfege or letters>&view=<both, scene or score>` | Same song with the level, note names and view preselected |
| anything else | "Page not found" with a link to the catalog |

An id that is not in the index shows "Song not found". The browser back button always disposes the previous view first.

## Content security policy

`nginx.conf` allows the inline import map in `index.html` by its SHA-256 hash. If the import map text changes, update the hash in `nginx.conf`; `tests/csp.test.js` fails until both agree. Inline scripts and inline styles are not allowed.
