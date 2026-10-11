# Song Catalog Specification

## Purpose

A short landing page that lists the available songs from `songs/index.json` and routes the user to the per-song player using hash routing, so the site works on GitHub Pages and plain nginx without rewrites.

## Requirements

### Requirement: Catalog is driven by the index file

The system MUST render the catalog from `songs/index.json` (and, when present, `songs-private/index.json` per the private index requirement). Adding a song MUST require only adding a song file and an index entry, with no code change.
(Previously: only the public index was named, and the first scenario listed Cancer and the Nocturne.)

#### Scenario: Both public songs are listed

- GIVEN `songs/index.json` contains entries for "Ode to Joy" and "Nocturne Op. 9 No. 2"
- WHEN the user opens the site root on a build without a private library
- THEN the catalog shows exactly two song cards
- AND each card shows title, artist or composer, key, and default BPM

#### Scenario: New song appears without code change

- GIVEN a valid new song file and a matching new entry in `songs/index.json`
- WHEN the catalog is loaded
- THEN a third card is rendered for the new song

#### Scenario: Index file cannot be loaded

- GIVEN `songs/index.json` is missing or is not valid JSON
- WHEN the catalog loads
- THEN the page shows a visible error message instead of an empty list
- AND no uncaught exception halts the rest of the page

#### Scenario: Index entry points to a missing or invalid song file

- GIVEN an index entry whose file is missing or fails schema validation
- WHEN the user opens that song or the catalog loads
- THEN the catalog still lists the remaining valid songs
- AND the broken entry is marked unavailable with the validation reason

### Requirement: Hash routing

The system MUST use hash-based routes: the catalog at `#/`, a Play along player at `#/song/<id>`, the guided lesson at `#/learn/<id>`, and the exercises section at `#/practice` (with `#/practice/<exercise-id>` for one exercise). All asset and data URLs MUST be relative so the site works under a subpath.
(Previously: only `#/` and `#/song/<id>` existed.)

#### Scenario: Open a song from the catalog

- GIVEN the catalog is displayed
- WHEN the user activates a song card's Play along action
- THEN the location hash becomes `#/song/<id>` and the player view for that song is shown
- AND the page does not reload

#### Scenario: Open a lesson from the catalog

- GIVEN the catalog is displayed
- WHEN the user activates a song card's Learn action
- THEN the location hash becomes `#/learn/<id>` and the Learn view for that song is shown

#### Scenario: Deep link to a song

- GIVEN the user opens `index.html#/song/<id>` or `index.html#/learn/<id>` directly
- WHEN the app starts
- THEN that view is shown without visiting the catalog first

#### Scenario: Unknown song id

- GIVEN the hash is `#/song/does-not-exist` or `#/learn/does-not-exist`
- WHEN the router resolves it
- THEN a "song not found" message with a link back to the catalog is shown

#### Scenario: Private id on a public build

- GIVEN the site is served without the private library and the hash is `#/learn/<private-id>`
- WHEN the router resolves it
- THEN the same plain "song not found" message is shown, with no hint that a private song exists

#### Scenario: Browser back button

- GIVEN the user navigated from the catalog to a player, a lesson or the exercises section
- WHEN the user presses browser back
- THEN the catalog is shown, any playback in progress is stopped, any held learner note is released and any open MIDI listener of that view is detached

### Requirement: Static hosting compatibility

The system MUST work when served as static files from a subpath (GitHub Pages) and from the nginx container root, with no server-side rewrite rules.

#### Scenario: Served from a subpath

- GIVEN the site is served at `/piano-guide/`
- WHEN the catalog, a Learn view and a song player are opened
- THEN all scripts, styles, vendor files and song JSON files load successfully

### Requirement: Landing page is short and self-explanatory

The catalog MUST fit a short single page, label actions by what they do, and MUST NOT require reading a paragraph to understand a control. Learner-facing catalog labels (Learn, Play along, Practice exercises, Private, level chips) MUST follow the language selector.
(Previously: the example primary action was "Open" and the labels were English only.)

#### Scenario: Song card actions are clear

- GIVEN the catalog is displayed
- WHEN the user inspects a song card
- THEN the primary action label names the action ("Learn") and the level availability is shown as short chips

#### Scenario: Catalog follows the chosen language

- GIVEN the learner selected Spanish
- WHEN the catalog is displayed
- THEN the action labels and chips are in Spanish and the song titles are unchanged
### Requirement: Optional private index is merged and marked

At startup the catalog MUST try to load `songs-private/index.json` after the public index. When it loads and validates, its songs MUST join the catalog after the public songs, each card carrying a "Private" chip. When it is absent (HTTP 404, a network failure, or a response that is HTML instead of JSON, as happens on GitHub Pages) the catalog MUST be exactly the public catalog and MUST show no error, no warning and no empty placeholder. When it is present but not valid, the catalog MUST still show every public song and MUST show one short notice that the private library could not be read. A private id equal to a public id MUST NOT replace the public song; the private entry is marked unavailable.

#### Scenario: Learner on the public site sees no trace of private songs

- GIVEN the site is served from GitHub Pages where `songs-private/index.json` does not exist
- WHEN a person opens the catalog
- THEN they see the public songs only
- AND no error, warning or "private" wording appears anywhere on the page

#### Scenario: Owner running locally with the mount

- GIVEN the app runs on the owner's machine with `songs-private/` available and its index lists one song
- WHEN the catalog opens
- THEN the public songs appear first and the private song appears with a "Private" chip

#### Scenario: Private index is not valid JSON

- GIVEN `songs-private/index.json` exists but is malformed
- WHEN the catalog opens
- THEN every public song is listed
- AND one short notice says the private library could not be read

#### Scenario: Server answers a missing private index with an HTML page

- GIVEN a static server returns its HTML page with status 200 for `songs-private/index.json`
- WHEN the catalog opens
- THEN the private library is treated as absent and no notice is shown

#### Scenario: Private id collides with a public id

- GIVEN a private entry with the same id as a public song
- WHEN the catalog opens
- THEN the public card is unchanged and the private entry is marked unavailable with the reason

### Requirement: Cards offer Learn and Play along

Every available song card MUST offer two clearly labelled actions: "Learn" (primary, opens `#/learn/<id>`) and "Play along" (opens `#/song/<id>`). For a private song the second action MUST be labelled so that it states there is no sound, for example "Play along (no sound)". The catalog MUST also show one link labelled "Practice exercises" to `#/practice`. A song with no level containing note events MUST NOT offer "Learn".

#### Scenario: A person who has never played picks a song

- GIVEN the catalog is open
- WHEN the person looks at the Ode to Joy card
- THEN they see "Learn" as the main button and "Play along" as the second
- AND no sentence needs to be read to understand either

#### Scenario: Private card states there is no sound

- GIVEN the owner sees the private song card
- WHEN they read its actions
- THEN the Play along action says that it has no sound

#### Scenario: Song without notes offers no Learn

- GIVEN a valid song whose every level has an empty `notes` array
- WHEN its card renders
- THEN "Play along" is offered and "Learn" is not

#### Scenario: Practice exercises link

- GIVEN the catalog is open
- WHEN the person activates "Practice exercises"
- THEN the hash becomes `#/practice` and the exercises section opens

