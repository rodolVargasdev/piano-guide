# Private Song Library Specification

## Purpose

A local-only library for songs that must never be published: `songs-private/` next to the app. Its songs join the catalog on the owner's machine, are silent in the app (the app only says what to play), and can never reach git, the Docker image or GitHub Pages. Field names (`visibility`, silent rule) are defined in song-data-model.

## Requirements

### Requirement: Runtime-optional library

The app MUST look for `songs-private/index.json` at startup and use it only when present and valid, with identical code on every host (no build variant). Song files named by that index load from `songs-private/` and MUST declare `visibility: "private"`; a file that does not is marked unavailable with the reason. Catalog merging rules are in song-catalog.

#### Scenario: Owner with the library

- GIVEN `songs-private/index.json` lists `cancer-private` and the file declares `visibility: "private"`
- WHEN the app starts on the owner's machine
- THEN the catalog shows Cancer with a "Private" chip

#### Scenario: GitHub Pages

- GIVEN the app is served from GitHub Pages
- WHEN the app starts
- THEN the private index request fails silently and the catalog is the public set with no message

#### Scenario: Private file missing the visibility field

- GIVEN a file listed in the private index without `visibility: "private"`
- WHEN the catalog loads
- THEN that entry is marked unavailable and is not offered for Learn or Play along

### Requirement: Private songs are silent in the app

A private song MUST be silent (song-data-model silent rule; engine enforcement in playback-engine). The Learn view MUST NOT offer Listen for it; Play along MUST be visual only and its play action MUST say there is no sound; only the learner's own presses may sound.

#### Scenario: Owner tries Play along

- GIVEN the owner opens Play along for the private song
- WHEN they press play
- THEN the falling bars and cursor move and nothing from the song sounds

#### Scenario: Owner plays along on the Casio

- GIVEN the same view and the Casio over MIDI
- WHEN the owner plays the shaded keys
- THEN the Casio sounds by itself and the app adds no sound by default

### Requirement: The folder never reaches git, the image or Pages

`songs-private/` MUST be listed in `.gitignore` and in `.dockerignore`, the Dockerfile MUST NOT copy it, no file in the repository tree outside `songs-private/` MUST contain the private song's melody or lyrics, and no test, fixture, snapshot or documentation MAY contain them. GitHub Pages publishes from the main branch git tree, so a gitignored folder cannot be published. Guard tests MUST fail when: `.gitignore` or `.dockerignore` lacks the entry; the Dockerfile has a `COPY` or `ADD` naming `songs-private`; a file under `songs/` declares `visibility: "private"`; the public index references `songs-private/`; or a tracked file path starts with `songs-private/`.

#### Scenario: Ignore entries present

- GIVEN the repository
- WHEN the guard test reads `.gitignore` and `.dockerignore`
- THEN both contain `songs-private/`

#### Scenario: Someone adds a COPY

- GIVEN a Dockerfile fixture with `COPY songs-private/ /usr/share/nginx/html/songs-private/`
- WHEN the guard runs on the fixture
- THEN it fails

#### Scenario: A private file is staged

- GIVEN a fixture list of tracked paths including `songs-private/cancer-private.json`
- WHEN the guard runs on the list
- THEN it fails

#### Scenario: The built image

- GIVEN the Docker image is built from a clone that also has a `songs-private/` folder on disk
- WHEN the image file list is inspected
- THEN no path under `songs-private/` and no private song file exists in it

#### Scenario: Clean clone

- GIVEN a clone with no `songs-private/`
- WHEN `node --test` runs
- THEN every guard passes and tests that need the private library are skipped

### Requirement: Mounted read-only at run time

The README MUST document running the container with the private folder mounted read-only (for example `docker run -v <path>/songs-private:/usr/share/nginx/html/songs-private:ro`), and the container MUST serve it when mounted and return not found when not. The dev server `tools/serve.mjs` MUST serve `songs-private/` from the working tree when it exists.

#### Scenario: Container with the mount

- GIVEN the container started with the read-only mount
- WHEN the owner opens the catalog
- THEN the private song appears with a "Private" chip

#### Scenario: Container without the mount

- GIVEN the same image started without the mount
- WHEN the owner opens the catalog
- THEN only the public songs appear and no error is shown

#### Scenario: Read-only

- GIVEN the mount is read-only
- WHEN the app runs
- THEN it never writes to the folder

### Requirement: Private song progress is not private data

Saved progress, language and key choices for a private song MAY be stored in `localStorage` by song id; the stored values MUST contain no notes, no melody and no lyrics.

#### Scenario: Stored values

- GIVEN a learner completes phrases of the private song
- WHEN `localStorage` is inspected
- THEN it holds only ids, indexes, stage, key and language values
