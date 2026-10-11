# Song Import Specification

## Purpose

A local tool that converts a user-captured Hooktheory TheoryTab export (scale degrees, beats, octaves, durations, rests) into a valid private song file, so the owner can learn a song by ear and by hand. The pure conversion module has no dependency and is tested with a synthetic fixture only, never with the private data. The tool never emits lyrics.

## Requirements

### Requirement: Pure conversion module and thin command

The conversion MUST be a pure module (no filesystem, no DOM, no dependency) turning a parsed source object into a song object, and the command `tools/convert-hooktheory.mjs` MUST be a thin zero-dependency Node wrapper that reads an input path and writes an output path. Default paths are `songs-private/sources/hooktheory-cancer.json` to `songs-private/cancer-private.json`, and the song `id` MUST be `cancer-private` (the index rule requires `file` to equal the id plus `.json`). The id differs from the public `cancer` id on purpose: while the public chords-only Cancer still ships (until the Milestone B catalog swap), an equal id would trigger the catalog collision rule and mark the private song unavailable. The command also upserts the entry for that id in `songs-private/index.json`. The command MUST refuse any output path outside `songs-private/` and MUST write nothing when conversion fails.

#### Scenario: Owner converts

- GIVEN `songs-private/sources/hooktheory-cancer.json` exists
- WHEN the owner runs the command
- THEN `songs-private/cancer-private.json` is written with id `cancer-private`, `songs-private/index.json` lists it, and a summary line states counts of notes and chords per section

#### Scenario: Private id never collides with the public catalog

- GIVEN the public index still lists `cancer` (Milestone A)
- WHEN the converted private song is loaded by the catalog
- THEN its id is `cancer-private`, it is available with a "Private" chip, and the public `cancer` card is unchanged

#### Scenario: Output outside the private folder

- GIVEN an output path under `songs/`
- WHEN the command runs
- THEN it exits non-zero with a message that the output must be under `songs-private/`, and writes nothing

#### Scenario: Missing input

- GIVEN the input file does not exist
- WHEN the command runs
- THEN it exits non-zero naming the path and writes nothing

### Requirement: Scale degree to spelled pitch in the song key

Each source note carries a scale degree (with an optional chromatic alteration), an octave offset and a start beat and duration in beats. The module MUST convert a degree to a spelled pitch in the song key: the letter is determined by the degree number, the accidental by the semitone distance from the major scale tone of that degree, and the octave by one documented reference rule (offset 0 places the tonic in octave 4). Output pitches MUST parse with the existing pitch module and lie within A0 to C8.

#### Scenario: Degrees in E major

- GIVEN key E major and octave offset 0
- WHEN degrees 1, 3, 5 and 7 are converted
- THEN the pitches are E4, G#4, B4 and D#5

#### Scenario: Lowered seventh

- GIVEN key E major and a lowered 7th degree at offset 0
- WHEN it is converted
- THEN the pitch is D5 natural, spelled D5 and not C##5

#### Scenario: Negative octave offset

- GIVEN degree 1 at octave offset -1 in E major
- WHEN it is converted
- THEN the pitch is E3

#### Scenario: Flat key

- GIVEN key Eb major and degree 3
- WHEN it is converted
- THEN the pitch is G4 and degree 4 is Ab4

#### Scenario: Out-of-range result

- GIVEN a note that would be above C8
- WHEN conversion runs
- THEN it fails naming the note index and writes nothing

### Requirement: Beats to ticks and rests

Source beats are 1-based inside each section (beat 1 is the first beat of the section). Sections are laid end to end in the fixed order intro, verse, pre-chorus, chorus, bridge, outro (absent ones skipped), each occupying `endBeat - 1` beats; a section with `pickup: true` keeps its pickup bar as one full bar. The module MUST convert beats to integer ticks at 480 per quarter note using the source meter and beat unit (`tick = sectionStartTick + (beat - 1) * 480` for a quarter-note beat unit), MUST round to the nearest tick, and MUST give every note a duration of at least 1 tick. Rests MUST be honored as gaps or explicit `rest` events. Notes of the right-hand melody MUST NOT overlap within the hand and voice: when a source note runs into the next, its end MUST be clipped to the next onset and a warning MUST be reported. The song length MUST be a whole number of bars covering the last note.

#### Scenario: Beat arithmetic in 4/4

- GIVEN a note at beat 2.5 (1-based) with duration 0.5 in 4/4, in the first section
- WHEN it is converted
- THEN its tick is 720 and its duration 240 ticks

#### Scenario: Rest honored

- GIVEN two notes separated by a one-beat gap
- WHEN converted
- THEN the second note starts one beat later than the end of the first and no note covers the gap

#### Scenario: Overlap clipped with a warning

- GIVEN a source note longer than the gap to the next note
- WHEN converted
- THEN its duration is clipped to the gap and a warning names its position

#### Scenario: Length is whole bars

- GIVEN the last note ends in the middle of bar 12
- WHEN converted
- THEN `lengthTicks` equals 12 full bars

### Requirement: Sections, chords and a simple left hand

The module MUST map source sections (intro, verse, chorus, bridge) to `sections[]` with ids and tick ranges, source chords to `chords[]` with symbols spelled in the song key (and `roman` when known). A source chord carries no quality name: the quality MUST be derived from its fields `root` (scale degree 1 to 7), `type` (5 triad, 7 seventh chord), `inversion` (0 to 3, written as a slash bass), `applied` (0 none, 5 secondary dominant of the root degree, 7 secondary leading-tone chord), `borrowed` (empty for the song mode, or a mode name such as `minor` or `phrygianDominant`), `adds` (9 gives `add9` on a major triad) and `suspensions` (2 or 4); an unsupported value MUST fail naming the chord path, and MUST generate a simple left hand: for each chord a root note in octave 2, the documented bass register (`role: "bass"`, hand `L`) lasting the chord's duration. An intro that has chords only MUST produce left-hand roots and no right-hand notes. The right-hand melody MUST be `hand: "R"`, `role: "melody"`. No `finger` values are written; fingering is computed by Learn mode.

#### Scenario: Chord to root

- GIVEN a chord of degree 6 minor lasting 4 beats in E major
- WHEN converted
- THEN the chord symbol is `C#m` and a left-hand `C#2` note lasts 4 beats

#### Scenario: Intro with chords only

- GIVEN an intro section containing chords and no melody notes
- WHEN converted
- THEN the intro has left-hand roots and no right-hand events

#### Scenario: Section ranges

- GIVEN verse, chorus and bridge in order
- WHEN converted
- THEN `sections[]` are sorted, within `lengthTicks` and do not overlap

#### Scenario: Counts reported, not melody

- GIVEN the owner's real source locally present
- WHEN the optional local check runs
- THEN it reports verse 52 notes and 14 chords, chorus 34 notes and 11 chords, bridge 39 notes and 13 chords, and it is skipped when the source is absent

### Requirement: Valid private song with honest provenance

The output MUST pass the song validator with: `visibility: "private"`, a `beginner` level with `notation: "labelled"`, not `transcribed`, a `learn.transposeTo` of `["C"]` for a song in E major, a minimal bilingual `lesson` stating that the notes come from a single user-submitted source and should be verified by ear, one source of kind `user-submitted` with `url` (from the input metadata or a `--source-url` option; the command fails when neither exists), `what`, `accessed`, and `confidence[]` entries per section whose level is `medium` or `low` and never `high`. Output MUST contain no `lyrics` field and no lyric text. Converting the same input twice MUST give byte-identical output.

#### Scenario: Output validates

- GIVEN a synthetic fixture
- WHEN it is converted and validated
- THEN validation succeeds

#### Scenario: Provenance recorded

- GIVEN the converted synthetic fixture
- WHEN its sources and confidence are inspected
- THEN there is exactly one `user-submitted` source and no confidence entry is `high`

#### Scenario: No source URL anywhere

- GIVEN input without a URL and no `--source-url`
- WHEN the command runs
- THEN it exits non-zero explaining the missing URL

#### Scenario: Lyrics in the input are dropped

- GIVEN a fixture note carrying a `lyric` text
- WHEN converted
- THEN the output contains no lyric text anywhere

#### Scenario: Deterministic

- GIVEN the same fixture converted twice
- WHEN the outputs are compared
- THEN they are byte-identical

### Requirement: Malformed input fails clearly

The module MUST report, with the path of the offending element, any note missing degree, octave, beat or duration, a degree outside 1 to 7, a non-positive duration, an unknown section name, or a missing key, tempo or meter, and MUST NOT produce partial output.

#### Scenario: Bad degree

- GIVEN a note with degree 9
- WHEN converted
- THEN conversion fails naming the note and the field

#### Scenario: Missing tempo

- GIVEN input without tempo
- WHEN converted
- THEN conversion fails naming `tempo`

### Requirement: Tests never use the private data

Unit tests MUST use a synthetic fixture that is not the owner's song, MUST pass in a clean clone, and MUST NOT read `songs-private/`. Tests of the command itself spawn `tools/convert-hooktheory.mjs` and MUST be skipped, not failed, when that file is absent (the Docker test stage does not contain `tools/`); the pure-module tests always run.

#### Scenario: Clean clone

- GIVEN a clone without private files
- WHEN `node --test` runs
- THEN all converter tests pass
