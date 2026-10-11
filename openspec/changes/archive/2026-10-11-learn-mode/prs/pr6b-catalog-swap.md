# PR 6b: Public catalog swap and Milestone B close-out

Branch: `feat/learn-mode-pr6b-catalog-swap`. Base: `feat/learn-mode-pr5b2-ui-test-migration`. Tasks: 18.1 to 18.4. Specs: song-catalog (public set), song-data-model (the chords-only song is no longer shipped), lesson-guide (the Cancer policy moves off the public song). Last PR of Milestone B as built so far (the sampled piano, pr3b, is deferred to the end of the chain).

## Chain context

```
feat/learn-mode-pr5b2-ui-test-migration
  ^
feat/learn-mode-pr6b-catalog-swap            this PR
  ^
(pr3b-sampled-piano, appended here when approved; then Milestone C)
```

## What changes

- `songs/cancer.json` is deleted. `songs/index.json` lists exactly `ode-to-joy` (first, so the catalog hero says "Start with Ode to Joy") and `chopin-nocturne-op9-no2`, neither private.
- `README.md`: the examples no longer name the public chords-only song (they point at the Chopin data and the synthetic fixture), the transcribed-level text mentions Ode to Joy, and the license paragraph states Ode to Joy's source, its Public Domain status and that its left hand is original.
- `docs/STACK_TECNOLOGICO.md`: the "Content sources" row of the removed song is replaced by the Ode to Joy row (piece page, SHA-256, access date, license, credit location). No dependency was added.
- `tests/songs.test.js`: the public set is exactly the two songs (with a counter-proof that notices the removed song returning, a third song and a missing song), the removed file does not exist, no entry is private, the first entry is Ode to Joy.
- `tests/privacy-guards.js` and `tests/privacy.test.js`: a title-level guard over `songs/*.json` and the index: no id, title, composer or file name carries the private song's title or artist (names only, never a note, a chord or a lyric); counter-proof with a synthetic title, artist and file name, and with free text that mentions the name (not scanned). The private id `cancer-private` is untouched, so saved progress keys do not change.
- A search of `src`, `styles`, `README.md` and `docs` for the public song's name finds no Cancer-specific code branch; the remaining mentions are the private converter defaults and the usability protocol's private task.

## Browser check (task 18.3; headless Chrome, real GPU flags, port 8790)

At 1440 x 900, 844 x 390 and 390 x 844, English (and Spanish at 1440). Screenshots `lmB-sw-*` were opened and read:

- With the local private folder: three cards, Ode to Joy and the Nocturne (Learn and Play along) and the private song with its "Private" chip and "Play along (no sound)" after them; the hero button reads "Start with Ode to Joy" ("Empezar con Ode to Joy" in Spanish, the title is not translated).
- With `NO_PRIVATE=1`: only the two public songs and no private wording; the console shows only the expected 404 of `/songs-private/index.json`.
- `#/learn/cancer` and `#/song/cancer`: "Song not found" with a Catalog button. `#/learn/cancer-private` (local): the first Learn screen of the private song, title Cancer, "Press Start..." with Start and Lesson zero; with `NO_PRIVATE=1` it says "Song not found".
- Docker (Docker 29.8.2): `docker build -t piano-guide .` exits 0 (rerun with `--no-cache-filter test`: the test stage ran 1343 tests, 1321 pass, 0 fail, 22 skipped with their reasons: the CLI and dev-server tests need `tools/`, and the private-local test needs the folder). A container (port 8795, stopped afterwards): `/` 200, `/songs/index.json` lists `ode-to-joy,chopin-nocturne-op9-no2`, `/songs/ode-to-joy.json` 200, `/songs/cancer.json` 404, `/songs-private/index.json` 404, `/assets/img/posture.svg` 200 as `image/svg+xml`. `find /usr/share/nginx/html -path '*songs-private*'` prints nothing, the `songs/` folder holds only the two songs and their license files, and no `cancer*` file exists in the image.

## Counter-proofs

The exact-set check (removed song returning, third song, missing song), the privacy name guard (title, artist, file name; free text not scanned), and the temporary rename check of pr5b (now permanent: the file really is gone and the suite is green).

## Milestone B close-out (task 18.4)

Success criteria now met by automated tests or the browser checks recorded in pr1b2, pr2b3, pr4b and here:

- Lesson zero: a person who has never seen a piano is shown how to find C by the groups of black keys, presses any C, sees the posture, presses fingers 1 to 5 on C D E F G and reads how each input works; skip and reload behave (tests and walkthrough).
- Stages: right hand slowly, left hand slowly, both hands slowly, both hands at the song speed, then the whole song; "Now the left hand, slowly." with "Next stage"; Continue resumes at the exact stage after a reload; the metronome follows the stage tempo (tests, walkthrough).
- Ode to Joy, listen then play: Listen lights the keys, My turn tells one key at a time which finger to use, "Correct" and the next phrase (walkthrough, headless; sound not listened to).
- Public catalog guards: exact public set, no private entry, no file or index entry that names the private song, the Docker image has neither the private folder nor the removed file.
- Source discipline: the Ode to Joy melody equals the recorded source moved by the recorded interval, with the SHA-256 of the exact file and the license recorded.

Awaiting the user (NOT verified by apply):

- Hearing Listen, the learner's own key sound, the metronome click and the "does it sound like a piano" judgment (the sampled piano, pr3b, is not approved and no audio file exists; the synth is the only voice).
- The Casio over MIDI (device name, hot-plug, "no device"), a real touch screen, the key legend on a non-US keyboard.
- The usability protocol with a person who has never played: T1 (lesson zero) and T3 (first phrase of Ode to Joy) are now available, T2 and T4 as before; T5 waits for Milestone C.
- On a phone in portrait, a both-hands step whose hands are more than ten white keys apart shows small keys (Ode to Joy is fine, the Chopin Nocturne is not): decide between scrolling the keyboard and splitting such a step.
- In landscape the finger badge of a white key in a both-hands step is partly covered by the computer-key letter box of the same key.
- Eight two-bar phrases instead of four four-bar ones for Ode to Joy (a product choice for the beginner; tell apply if four-bar phrases are wanted).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `node --test tests/songs.test.js tests/privacy.test.js tests/ui/catalog.test.js`: all pass |
| Full suite | `node --test`: 1343 tests, 1343 pass, 0 fail |
| Runtime harness | the headless Chrome check and the Docker build and run above |
| Rollback boundary | `songs/index.json`, the deleted `songs/cancer.json`, the README and stack-document lines, the two test files |

## Review budget

About 85 authored changed lines excluding the deleted data file (38 added and 12 removed in the swap commit, 35 added and 1 removed in the guard commit), plus this description; the deletion of `songs/cancer.json` removes 347 lines.
