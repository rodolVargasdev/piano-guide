# PR 12a: Docs, usability protocol and Docker

Branch: `feat/learn-mode-pr12a-docs-docker`. Base: `feat/learn-mode-pr11a5-learn-route`. Tasks: 12.1 to 12.6. Specs: private-song-library (Docker, mounted read-only), lesson-guide, the success criteria (usability protocol).

## Chain context

```
feat/learn-mode-pr11a5-learn-route
  ^
feat/learn-mode-pr12a-docs-docker       this PR (last of Milestone A)
  ^
feat/learn-mode-pr1b-lesson-zero (Milestone B, not started)
```

## What changes

- `docs/USABILITY_CHECK.md` (new): the protocol for a person who has never played: profile, setup, observer rules (the observer does not help), tasks T1 to T5 with time limits, what to record (time, hesitations over 10 seconds, questions, wrong keys), pass thresholds and a "Revised on" line. T1, T3 and T5 are marked "after Milestone B/C".
- `README.md`: Learn mode, the three inputs, the computer-key map, Casio setup (USB TO HOST, Chrome or Edge, Connect piano, what to do when only USB audio is exposed), private songs (converter command, `-v <path>/songs-private:/usr/share/nginx/html/songs-private:ro`, `NO_PRIVATE=1`), the `#/learn` route, a link to the protocol. Docker stays the primary path.
- `.dockerignore`: `songs-private` and `!docs/USABILITY_CHECK.md`. `Dockerfile`: the test stage copies `styles/`, `assets/` (not only `assets/vendor/`), `README.md`, `.gitignore`, `.dockerignore` and `docs/USABILITY_CHECK.md`; nothing copies `songs-private`; `tools/` stays out. `nginx.conf`: `location ^~ /songs-private/sources/ { return 404; }` and `location ^~ /songs-private/ { expires -1; types { application/json json; } }`.
- Tests: `tests/docs-guard.test.js` (4), `tests/privacy.test.js` (3 more) with `tests/privacy-guards.js` (3 pure guards).

## Finding: the Docker build was broken before this PR

`docker build` failed in the test stage: `tests/ui/language-select.test.js` (pr3a2) reads `styles/app.css`, which the test stage did not copy. It went unnoticed because earlier PRs of the chain were checked with `node --test` only. Fixed here by copying `styles/` (the same fix serves the keyboard and layout guards of pr9a3 and pr11a5).

## Counter-proofs

- A `.dockerignore` without the entry (or with a look-alike or a comment), and a Dockerfile with `COPY` or `ADD songs-private` (one of them commented out, which must not count), fail the guards.
- nginx config without the `sources` 404 fails the guard.
- A usability protocol without T3, without a threshold row, without the revision line or with T3 marked "now" fails; a README without the link, the `:ro` mount, the key map or the Docker-primary heading fails.

## Verification (task 12.5, Docker 29.8.2, observed 2026-10-11)

| Command | Result |
|---|---|
| `docker build -t piano-guide .` | exit 0; the test stage ran `node --test`: 1244 pass, 0 fail, 22 skipped with their reasons (CLI and dev-server tests need `tools/`, private-local needs the folder) |
| `docker run --rm piano-guide find /usr/share/nginx/html -path '*songs-private*'` | prints nothing |
| container without the mount | `/` 200, `/songs/index.json` 200, `/songs-private/index.json` 404, `/songs-private/cancer-private.json` 404, `/songs-private/sources/<capture>` 404; the catalog shows the public songs only |
| container with `-v <abs path>/songs-private:/usr/share/nginx/html/songs-private:ro` | `/songs-private/index.json` 200 (`no-cache`), the private song 200, `/songs-private/sources/<capture>` 404; the catalog shows Cancer with the "Private" chip after the public songs; Learn opens and shows the first step (screenshots `lm12-docker-catalog-mount-1440`, `lm12-docker-learn-1440`, read) |

Both containers were stopped afterwards (`docker ps` lists none of this project). The image still contains the public `songs/cancer.json` (chords only) until the Milestone B swap.

## Milestone A close-out (task 12.6)

Success criteria now met by automated tests or by the browser checks recorded in pr10a2 and pr11a5:

- The screen states one thing to do next in one sentence and the keys with finger numbers are visible without scrolling (screen model tests, DOM measures at 360, 390, 844 and 1440 widths).
- The app waits; a wrong key shows "Try again" and the shaded key stays.
- The app never plays private Cancer: no Listen, Play along silent (engine tests with zero `playNote` calls), only the learner's own presses sound.
- The same phrase can be completed with taps and clicks, the computer keyboard, and (fake navigator) MIDI; with no MIDI the panel says so in one line.
- Resume after reload (same phrase, hand, key, language).
- Mechanical guards: step model, matcher, transposition, fingering, schema, silent rule, privacy guards, English and Spanish strings, tests inside the Docker build stage; the image has no `songs-private`; on a host without the private index the catalog shows only public songs and no message.

Awaiting the user (NOT verified by apply):

- Playing the private Cancer melody on the Casio and confirming it is the song (by-ear confirmation, then raising `confidence` by hand).
- The Casio over USB MIDI (device name chip, hot-plug, "no device" if only USB audio) in Chrome or Edge.
- Hearing the learner's own key sound and, on a public song, Listen (no audio output was listened to here).
- The key legend on a non-US keyboard (only the US fallback was seen).
- The manual usability protocol with a person who has never played (T2 and T4 can run now).
- Not part of Milestone A: lesson zero, Ode to Joy, the sampled piano (not approved, no audio file exists), Practice exercises.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/docs-guard.test.js tests/privacy.test.js tests/csp.test.js`: all pass |
| Full suite | `node --test`: 1266 tests, 1266 pass, 0 fail |
| Runtime harness | the Docker runs in the table above |
| Rollback boundary | `README.md`, `docs/USABILITY_CHECK.md`, `Dockerfile`, `.dockerignore`, `nginx.conf`, the guards and their tests |

## Review budget

228 authored changed lines including tests, plus this description.
