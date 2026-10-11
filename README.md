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

Songs are data. A new song needs a `songs/<id>.json` file and an entry in `songs/index.json`. The data format arrives with the song catalog; this section is extended then.

## Open items

- nginx Content-Security-Policy: add the SHA-256 of the inline import map to `script-src` in `nginx.conf` once `index.html` carries it (tracked as a TODO comment in `nginx.conf`).
