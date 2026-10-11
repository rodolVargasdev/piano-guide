# Song Data Model Specification

## Purpose

One JSON file per song holds everything the app needs: metadata, tempo, meter, key, sections, chord track, levels with note events (hand, fingering, labels, ornaments, analysis), lesson content, sources and confidence. A pure validator (no DOM, no dependencies, tested with `node --test`) rejects malformed files. Both levels share this single model. Musical time is expressed in integer ticks at a fixed resolution of 480 ticks per quarter note (`PPQ`, a code constant, not a file field).

## Requirements

### Requirement: One file per song, listed in an index

Each song MUST live in `songs/<id>.json` and MUST be listed in `songs/index.json` as `{ "songs": [ ... ] }`. Each index entry MUST carry `id`, `file`, `title`, `composer` (composer or artist credit), `key` (`{ tonic, mode }`), `defaultBpm` (equal to the song file's `tempo.bpm`) and `levels` (level ids offered). A pure `validateIndex(index)` MUST check required fields and duplicate ids; a test MUST check that every entry resolves to an existing song file whose `id`, `key` and `tempo.bpm` match the entry.

#### Scenario: Valid index

- GIVEN `songs/index.json` with entries for each song file
- WHEN the index validator and the index test run
- THEN they pass and every entry resolves to an existing song file

#### Scenario: Duplicate ids

- GIVEN two index entries with the same id
- WHEN `validateIndex` runs
- THEN validation fails naming the duplicate id

### Requirement: Required top-level fields

A song file MUST contain: `schemaVersion` (1), `id`, `title`, `composer`, `key` (`{ tonic, mode }`), `meter` (`{ num, den }`), `pickupTicks`, `tempo` (`{ bpm, beatUnit, marking? }` with `beatUnit` one of `quarter`, `eighth`, `dotted-quarter`, `half`), `lengthTicks`, `sections[]`, `chords[]`, `levels{}`, `defaultLevel`, `lesson`, `sources[]` and `confidence[]`. Optional: `arranger`, `contentPolicy` (`open` by default, or `chords-only`). The validator MUST reject a file missing any required field and MUST report the missing field path.

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

#### Scenario: Song without sources is rejected

- GIVEN a song file whose `sources` is empty
- WHEN it is validated
- THEN validation fails with an error about missing sources

#### Scenario: Source without URL is rejected

- GIVEN a source entry that lacks `url`
- WHEN it is validated
- THEN validation fails identifying that source entry

#### Scenario: Confidence is recorded

- GIVEN the Cancer chorus progression has lower confidence than the verse
- WHEN the Cancer file is validated
- THEN its `confidence` entries distinguish the verse (single user-submitted source) from the chorus (lower confidence)
- AND both are non-empty

#### Scenario: Confidence value out of domain

- GIVEN a confidence level of "maybe"
- WHEN it is validated
- THEN validation fails

### Requirement: Public-domain provenance for transcribed notes

A level whose note events are transcribed from a published score MUST set `transcribed: true`. Any file with a transcribed level MUST record a source of kind `public-domain-score` whose URL host is `mutopiaproject.org` or `imslp.org` (or a subdomain of either). The Chopin Nocturne file MUST satisfy this.

#### Scenario: Chopin names its source

- GIVEN the Nocturne Op. 9 No. 2 file
- WHEN it is validated
- THEN `sources[]` contains at least one entry of kind `public-domain-score` whose URL host is a Mutopia Project or IMSLP address
- AND its `what` field states which bars were taken

#### Scenario: Transcribed notes without a public-domain source

- GIVEN a file with a level marked `transcribed: true` and no `public-domain-score` source on an accepted host
- WHEN it is validated
- THEN validation fails

### Requirement: Levels share one data model

A song MUST define levels in a `levels` map keyed by level id; recognized ids are `beginner` and `original`, and at least one level is required. Every level MUST use the same object shape: `{ label, description, notation: "labelled" | "engraved", transcribed?, strictBars?, chords?, notes[], pedal?, analysis? }`. A note event is `{ tick, dur, pitch, hand, finger?, voice?, vel?, role?, label?, ornament?, tie?, grace?, tuplet?, fingeringSource?, rest? }` where `pitch` is a spelled pitch string (`"Eb4"`, C4 is MIDI 60), `hand` is `L` or `R`, `voice` is 1 or 2, `role` is one of `melody`, `accompaniment`, `bass`, `ornament`, `label` overrides the displayed note name, `ornament` is one of `turn`, `trill`, `mordent`, `inverted-mordent`, `fioritura` (a sign drawn on that note; the ornament's sounding notes are written as their own events), `grace: true` marks a small note that still has a written `tick` and `dur`, and `rest: true` marks an explicit rest (no `pitch`). Shared data (metadata, tempo, meter, key, sections, song-level chords, lesson, sources) MUST live once at song level. Level-specific differences (voicing, labels, analysis, chord overrides) MUST be data, not code branches.

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

The validator MUST support `contentPolicy: "chords-only"`. Under it, any event with `role: "melody"` and any non-empty `lyrics` field anywhere in the file MUST be rejected. The Cancer file MUST set it and MUST consist only of chord-based accompaniment events (left-hand roots and right-hand triads or block chords).

#### Scenario: Cancer has no lyrics field content

- GIVEN the Cancer song file
- WHEN it is validated
- THEN there is no `lyrics` text anywhere in the file
- AND validation succeeds under `contentPolicy: "chords-only"`

#### Scenario: Melody event rejected under chords-only

- GIVEN a chords-only file containing an event with `role: "melody"`
- WHEN it is validated
- THEN validation fails

#### Scenario: Lyrics rejected under chords-only

- GIVEN a chords-only file with a non-empty `lyrics` string
- WHEN it is validated
- THEN validation fails

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
