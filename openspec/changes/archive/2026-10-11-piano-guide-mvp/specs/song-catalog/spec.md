# Song Catalog Specification

## Purpose

A short landing page that lists the available songs from `songs/index.json` and routes the user to the per-song player using hash routing, so the site works on GitHub Pages and plain nginx without rewrites.

## Requirements

### Requirement: Catalog is driven by the index file

The system MUST render the catalog from `songs/index.json`. Adding a song MUST require only adding a song file and an index entry, with no code change.

#### Scenario: Both MVP songs are listed

- GIVEN `songs/index.json` contains entries for "Cancer" and "Nocturne Op. 9 No. 2"
- WHEN the user opens the site root
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

The system MUST use hash-based routes: the catalog at `#/` and a song player at `#/song/<id>`. All asset and data URLs MUST be relative so the site works under a subpath.

#### Scenario: Open a song from the catalog

- GIVEN the catalog is displayed
- WHEN the user activates a song card
- THEN the location hash becomes `#/song/<id>` and the player view for that song is shown
- AND the page does not reload

#### Scenario: Deep link to a song

- GIVEN the user opens `index.html#/song/<id>` directly
- WHEN the app starts
- THEN the player view for that song is shown without visiting the catalog first

#### Scenario: Unknown song id

- GIVEN the hash is `#/song/does-not-exist`
- WHEN the router resolves it
- THEN a "song not found" message with a link back to the catalog is shown

#### Scenario: Browser back button

- GIVEN the user navigated catalog to player
- WHEN the user presses browser back
- THEN the catalog is shown and any playback in progress is stopped

### Requirement: Static hosting compatibility

The system MUST work when served as static files from a subpath (GitHub Pages) and from the nginx container root, with no server-side rewrite rules.

#### Scenario: Served from a subpath

- GIVEN the site is served at `/piano-guide/`
- WHEN the catalog and a song player are opened
- THEN all scripts, styles, vendor files and song JSON files load successfully

### Requirement: Landing page is short and self-explanatory

The catalog MUST fit a short single page, label actions by what they do, and MUST NOT require reading a paragraph to understand a control.

#### Scenario: Song card actions are clear

- GIVEN the catalog is displayed
- WHEN the user inspects a song card
- THEN the primary action label names the action (for example "Open") and the level availability is shown as short chips
