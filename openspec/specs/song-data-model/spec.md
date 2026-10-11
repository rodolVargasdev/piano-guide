# Song Data Model Specification

## Purpose

One JSON file per song holds everything the app needs: metadata, tempo, meter, key, sections, chord track, levels with note events (hand, fingering, labels, ornaments, analysis), lesson content, sources and confidence. A pure validator (no DOM, no dependencies, tested with `node --test`) rejects malformed files. Both levels share this single model. Musical time is expressed in integer ticks at a fixed resolution of 480 ticks per quarter note (`PPQ`, a code constant, not a file field).

## Requirements

### Requirement: One file per song, listed in an index

Each public song MUST live in `songs/<id>.json` and MUST be listed in `songs/index.json` as `{ "songs": [ ... ] }`. A private song MUST live in `songs-private/<id>.json` and MAY be listed in `songs-private/index.json` of the same shape. Each index entry MUST carry `id`, `file`, `title`, `composer` (composer or artist credit), `key` (`{ tonic, mode }`), `defaultBpm` (equal to the song file's `tempo.bpm`) and `levels` (level ids offered); it MAY carry `visibility`. A pure `validateIndex(index)` MUST check required fields and duplicate ids; a test MUST check that every entry of `songs/index.json` resolves to an existing song file whose `id`, `key` and `tempo.bpm` match the entry. The public index MUST NOT reference `songs-private/`. A test over the private index MUST run only when `songs-private/index.json` exists and MUST be skipped, not failed, when it does not.
(Previously: only `songs/` and `songs/index.json` were described; no private folder or visibility field.)

#### Scenario: Valid index

- GIVEN `songs/index.json` with entries for each song file
- WHEN the index validator and the index test run
- THEN they pass and every entry resolves to an existing song file

#### Scenario: Duplicate ids

- GIVEN two index entries with the same id
- WHEN `validateIndex` runs
- THEN validation fails naming the duplicate id

#### Scenario: Public index never points into the private folder

- GIVEN `songs/index.json`
- WHEN the privacy guard test scans every `file` value
- THEN none starts with or contains `songs-private/`

#### Scenario: Private index absent in a clean clone

- GIVEN a clone without `songs-private/`
- WHEN `node --test` runs
- THEN the private-index tests are skipped and the suite passes

### Requirement: Required top-level fields

A song file MUST contain: `schemaVersion` (1), `id`, `title`, `composer`, `key` (`{ tonic, mode }`), `meter` (`{ num, den }`), `pickupTicks`, `tempo` (`{ bpm, beatUnit, marking? }` with `beatUnit` one of `quarter`, `eighth`, `dotted-quarter`, `half`), `lengthTicks`, `sections[]`, `chords[]`, `levels{}`, `defaultLevel`, `lesson`, `sources[]` and `confidence[]`. Optional: `arranger`, `contentPolicy` (`open` by default, or `chords-only`), `visibility` (`public` by default, or `private`). The validator MUST reject a file missing any required field and MUST report the missing field path.
(Previously: `visibility` did not exist.)

#### Scenario: Complete file passes

- GIVEN a song file with all required fields and consistent values
- WHEN it is validated
- THEN validation succeeds with no errors

#### Scenario: Missing field is rejected

- GIVEN a song file without `meter`
- WHEN it is validated
- THEN validation fails with an error identifying `meter`

#### Scenario: Malformed types

- GIVEN `tempo.bpm` is a string, is not positive, or is outside 20 to 300
- WHEN it is validated
- THEN validation fails identifying `tempo.bpm`

#### Scenario: Default level must exist

- GIVEN `defaultLevel` names a level not present in `levels`
- WHEN it is validated
- THEN validation fails identifying `defaultLevel`

### Requirement: Provenance is mandatory

Every song file MUST include a non-empty `sources[]`. Each source MUST record `url`, `what` (what was taken from it), `accessed` (ISO date) and `kind`, one of `public-domain-score`, `user-submitted`, `original-arrangement`, `reference`; `license` and `sha256` are optional. The file MUST include a non-empty `confidence[]` array of `{ scope, level, note }` entries, one per musical area it covers (for example `chords:verse`, `chords:chorus`, `notes`, `fingering`), with `level` one of `high`, `medium`, `low`. The validator MUST reject empty `sources[]`, a source without `url`, a source with an unknown `kind`, empty `confidence[]`, or a confidence level outside the domain.
(Previously: the confidence scenario named the public Cancer file; it now speaks of any single-source user-submitted song.)

#### Scenario: Song without sources is rejected

- GIVEN a song file whose `sources` is empty
- WHEN it is validated
- THEN validation fails with an error about missing sources

#### Scenario: Source without URL is rejected

- GIVEN a source entry that lacks `url`
- WHEN it is validated
- THEN validation fails identifying that source entry

#### Scenario: Confidence is recorded per area

- GIVEN a song whose only source is `user-submitted` and whose chorus is less certain than its verse
- WHEN it is validated
- THEN its `confidence` entries distinguish the verse from the chorus
- AND both are non-empty and none is `high`

#### Scenario: Confidence value out of domain

- GIVEN a confidence level of "maybe"
- WHEN it is validated
- THEN validation fails

### Requirement: Public-domain provenance for transcribed notes

A level whose note events are transcribed from a published score MUST set `transcribed: true`. Any file with a transcribed level MUST record a source of kind `public-domain-score` whose URL host is `mutopiaproject.org` or `imslp.org` (or a subdomain of either). The Chopin Nocturne file and the Ode to Joy file MUST satisfy this. A private song built from a `user-submitted` source MUST NOT set `transcribed: true`.
(Previously: only the Chopin Nocturne was named, and private user-submitted songs were not addressed.)

#### Scenario: Chopin names its source

- GIVEN the Nocturne Op. 9 No. 2 file
- WHEN it is validated
- THEN `sources[]` contains at least one entry of kind `public-domain-score` whose URL host is a Mutopia Project or IMSLP address
- AND its `what` field states which bars were taken

#### Scenario: Transcribed notes without a public-domain source

- GIVEN a file with a level marked `transcribed: true` and no `public-domain-score` source on an accepted host
- WHEN it is validated
- THEN validation fails

#### Scenario: User-submitted private song claims transcription

- GIVEN a private song with only a `user-submitted` source and a level with `transcribed: true`
- WHEN it is validated
- THEN validation fails

### Requirement: Levels share one data model

A song MUST define levels in a `levels` map keyed by level id; recognized ids are `beginner` and `original`, and at least one level is required. Every level MUST use the same object shape: `{ label, description, notation: "labelled" | "engraved", transcribed?, strictBars?, chords?, notes[], pedal?, analysis?, learn? }`. A note event is `{ tick, dur, pitch, hand, finger?, voice?, vel?, role?, label?, ornament?, tie?, grace?, tuplet?, fingeringSource?, rest? }` where `pitch` is a spelled pitch string (`"Eb4"`, C4 is MIDI 60), `hand` is `L` or `R`, `voice` is 1 or 2, `role` is one of `melody`, `accompaniment`, `bass`, `ornament`, `label` overrides the displayed note name, `ornament` is one of `turn`, `trill`, `mordent`, `inverted-mordent`, `fioritura` (a sign drawn on that note; the ornament's sounding notes are written as their own events), `grace: true` marks a small note that still has a written `tick` and `dur`, and `rest: true` marks an explicit rest (no `pitch`). Shared data (metadata, tempo, meter, key, sections, song-level chords, lesson, sources) MUST live once at song level. Level-specific differences (voicing, labels, analysis, chord overrides, learn phrases) MUST be data, not code branches.
(Previously: the level shape had no `learn` block.)

#### Scenario: Both levels validate with one schema

- GIVEN the Nocturne file with `beginner` and `original` levels
- WHEN it is validated
- THEN both levels are checked against the same event schema with no level-specific validator

#### Scenario: Adding a level is data only

- GIVEN a song with only a `beginner` level
- WHEN an `original` level object is added to `levels` with valid events
- THEN the file still validates and the level becomes selectable with no code change

#### Scenario: Unknown level id

- GIVEN `levels` contains a key that is not a recognized level id
- WHEN it is validated
- THEN validation fails naming the key

#### Scenario: At least one level

- GIVEN `levels` is empty
- WHEN it is validated
- THEN validation fails

### Requirement: Event bounds and fingering

The validator MUST reject: `finger` not an integer in 1 to 5; `pitch` unparsable or outside A0 to C8 (MIDI 21 to 108); `tick` negative; `dur` not a positive integer; `tick + dur` greater than `lengthTicks`; a non-rest event without `pitch`; overlapping non-grace events within the same hand and voice, except events sharing the same `tick` and `dur` (a chord). When a level sets `strictBars: true`, the validator MUST also reject, per hand and voice: a bar (the pickup counts as a partial bar of `pickupTicks`) whose non-grace coverage (chord onsets counted once, plus `rest` events) is not exactly the bar length, and a non-grace event that crosses a barline without being split into tied events. Without `strictBars`, gaps are allowed and the score fills them with computed rests.

#### Scenario: Finger out of range

- GIVEN an event with `finger: 6`
- WHEN it is validated
- THEN validation fails identifying the event

#### Scenario: Event outside the song length

- GIVEN an event whose end tick exceeds `lengthTicks`
- WHEN it is validated
- THEN validation fails identifying the event

#### Scenario: 12/8 bar sums

- GIVEN a 12/8 song and a level with `strictBars: true`
- WHEN a bar of the melody voice covers a duration other than 12 eighth notes (2880 ticks)
- THEN validation fails identifying the bar, hand and voice

#### Scenario: Pitch out of range

- GIVEN an event with `pitch: "C9"`
- WHEN it is validated
- THEN validation fails

### Requirement: Copyright guard for chords-only songs

The validator MUST support `contentPolicy: "chords-only"`. Under it, any event with `role: "melody"` and any non-empty `lyrics` field anywhere in the file MUST be rejected. No song shipped under `songs/` is required to use it; a chords-only file, if any exists, MUST consist only of chord-based accompaniment events. A private song MUST NOT set `chords-only` when it carries a melody.
(Previously: the Cancer file was required to set `chords-only`; the public Cancer no longer ships.)

#### Scenario: Melody event rejected under chords-only

- GIVEN a chords-only file containing an event with `role: "melody"`
- WHEN it is validated
- THEN validation fails

#### Scenario: Lyrics rejected under chords-only

- GIVEN a chords-only file with a non-empty `lyrics` string
- WHEN it is validated
- THEN validation fails

#### Scenario: Copyright guard still tested without a shipped chords-only song

- GIVEN the test suite and a synthetic chords-only fixture
- WHEN `node --test` runs
- THEN the two rejections above are asserted against the fixture and pass
### Requirement: Chord track, sections and analysis

`chords[]` (song level, optionally overridden by a level's `chords`) MUST be a sorted list of `{ tick, dur, symbol, roman?, function? }` entries; `sections[]` a sorted list of `{ id, name, startTick, endTick }` entries. Both MUST lie within `lengthTicks`, and sections MUST NOT overlap. A level MAY attach `analysis[]` entries `{ tick, endTick?, kind, title, text, roman?, function? }` with `kind` one of `harmony`, `voice-leading`, `ornament`, `rubato`, `dynamics`, `form`.

#### Scenario: Overlapping sections

- GIVEN two sections whose tick ranges overlap
- WHEN it is validated
- THEN validation fails

#### Scenario: Chord outside song length

- GIVEN a chord entry whose `tick + dur` exceeds `lengthTicks`
- WHEN it is validated
- THEN validation fails

### Requirement: Validator is pure and independently testable

The validator MUST be a pure module with no DOM and no dependency, runnable under `node --test`. Tests MUST include at least one positive case per shipped song and a negative case for each rejection rule above.

#### Scenario: Negative test suite

- GIVEN the test suite
- WHEN `node --test` runs
- THEN a deliberately malformed song fixture is rejected for each rule and the tests asserting those rejections pass

#### Scenario: Shipped songs validate in tests

- GIVEN `songs/index.json`
- WHEN `node --test` runs
- THEN every indexed song file is validated and passes
### Requirement: Song visibility and the silent rule

A song file MAY declare `visibility` as `"public"` or `"private"`; an absent value MUST be read as `"public"`; any other value MUST be rejected. A song with `visibility: "private"` is silent by that fact alone: there MUST be no separate stored "silent" field, and a pure `isSilent(song)` MUST return true if and only if `visibility` is `"private"`. A file under `songs/` (the public folder) MUST NOT declare `visibility: "private"`, and a file loaded from `songs-private/` MUST declare it. An index entry MAY repeat `visibility`; when it does it MUST equal the song file's value.

#### Scenario: Public by default

- GIVEN a song file with no `visibility` field
- WHEN it is validated and `isSilent` is called
- THEN validation succeeds and `isSilent` returns false

#### Scenario: Private song is silent

- GIVEN a song file with `visibility: "private"`
- WHEN `isSilent` is called
- THEN it returns true

#### Scenario: Unknown visibility value

- GIVEN `visibility: "secret"`
- WHEN the file is validated
- THEN validation fails identifying `visibility`

#### Scenario: Private flag in the public folder

- GIVEN a file under `songs/` declaring `visibility: "private"`
- WHEN the privacy guard test runs
- THEN the test fails naming the file

#### Scenario: Index and file disagree

- GIVEN an index entry with `visibility: "private"` whose song file has no visibility (public)
- WHEN the index test runs
- THEN the test fails naming the entry

### Requirement: Localized text values

Learner-facing text fields (`lesson` texts, level `label` and `description`, `analysis` `title` and `text`, `learn` `title` and `hint`) MAY be either a plain string (read as English) or a `LocalizedText` object. A `LocalizedText` MUST have non-empty `en` and `es` strings; the validator MUST reject an object missing either, or with an empty value. When the learner's language has no text, the English text MUST be used.

#### Scenario: Both languages present

- GIVEN a `learn.phrases[].hint` with non-empty `en` and `es`
- WHEN it is validated
- THEN validation succeeds

#### Scenario: Spanish missing

- GIVEN a `hint` object with `en` only
- WHEN it is validated
- THEN validation fails identifying the field and the missing language

#### Scenario: Plain string stays valid

- GIVEN an existing song whose lesson texts are plain English strings
- WHEN it is validated and shown to a learner who chose Spanish
- THEN validation succeeds and the English text is shown for those fields

### Requirement: Learn block per level

A level MAY carry `learn: { phrases?, transposeTo? }`. `phrases[]` entries are `{ id, startTick, endTick, title?, hint? }` with unique `id`, `0 <= startTick < endTick <= lengthTicks`, sorted by `startTick` and non-overlapping; `title` and `hint` are text values per the localized text rule, and a `hint` MUST be a single sentence. `transposeTo[]` lists tonic names the Learn view offers as a toggle; each MUST be a valid tonic name and different from the song's tonic. When `learn.phrases` is absent the Learn step model derives phrases automatically (see learn-mode). Authored `finger` values on note events MUST take precedence over computed fingering.

#### Scenario: Authored phrases validate

- GIVEN a level with three sorted, non-overlapping `learn.phrases`
- WHEN it is validated
- THEN validation succeeds

#### Scenario: Overlapping phrases

- GIVEN two phrases whose tick ranges overlap
- WHEN it is validated
- THEN validation fails identifying both phrase ids

#### Scenario: Phrase outside the song

- GIVEN a phrase with `endTick` greater than `lengthTicks`
- WHEN it is validated
- THEN validation fails identifying the phrase

#### Scenario: Duplicate phrase id

- GIVEN two phrases with id `p1`
- WHEN it is validated
- THEN validation fails naming `p1`

#### Scenario: Transpose target equals the song key

- GIVEN a song in E major with `learn.transposeTo: ["E"]`
- WHEN it is validated
- THEN validation fails identifying `learn.transposeTo`

#### Scenario: No learn block

- GIVEN a level without `learn`
- WHEN it is validated
- THEN validation succeeds and the Learn view derives phrases automatically

### Requirement: Public shipped songs and Ode to Joy provenance

The public catalog MUST ship exactly two songs: `chopin-nocturne-op9-no2` (existing id retained) and `ode-to-joy`. `ode-to-joy` MUST be Beethoven's theme in C major with a `beginner` level holding a right-hand melody and an optional easy left hand (left-hand events with `role: "accompaniment"` or `"bass"`), authored `learn.phrases`, `transcribed: true`, and a source of kind `public-domain-score` on `mutopiaproject.org` or `imslp.org` recording `url`, `license`, `sha256`, `accessed` and a `what` that states the reduction to the theme. The notes MUST come from that score and not from memory.

#### Scenario: Ode to Joy names its source

- GIVEN the Ode to Joy file
- WHEN it is validated
- THEN `sources[]` has a `public-domain-score` entry on an accepted host with `license`, `sha256` and `accessed`

#### Scenario: Ode to Joy has an optional left hand

- GIVEN the Ode to Joy `beginner` level
- WHEN its events are inspected
- THEN right-hand melody events exist and left-hand events exist as a separable set

#### Scenario: Public set is exactly two

- GIVEN `songs/index.json`
- WHEN the index test runs
- THEN it lists `chopin-nocturne-op9-no2` and `ode-to-joy` and no `cancer` entry, and `songs/cancer.json` does not exist

