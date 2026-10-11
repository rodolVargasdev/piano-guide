# Score View Specification

## Purpose

A custom SVG grand-staff renderer (no notation dependency) showing chord names above the staff, finger numbers above notes, note names inside noteheads on Beginner or clean engraved style on Original, and a cursor synced to playback.

## Requirements

### Requirement: Grand staff rendering

The system MUST render a grand staff (treble and bass) as SVG with the song's key signature and meter, bar lines, and notes with correct pitch placement, accidentals and durations for the values the MVP songs use (quarter, eighth, dotted values, rests, ties as needed). For 12/8 the beaming MUST group eighths in dotted-quarter groups of three.

#### Scenario: Pitch placement

- GIVEN a right-hand event with pitch "E4" in a C-major context
- WHEN rendered
- THEN the notehead sits on the first line of the treble staff

#### Scenario: Key signature

- GIVEN a song in Eb major
- WHEN rendered
- THEN the key signature shows three flats on both staves

#### Scenario: 12/8 beaming

- GIVEN a 12/8 bar of twelve eighth notes
- WHEN rendered
- THEN the eighths are beamed in four groups of three

#### Scenario: Accidentals

- GIVEN an event that is not in the key signature
- WHEN rendered
- THEN the correct accidental is drawn once per bar per pitch where required

#### Scenario: Layout across widths

- GIVEN the viewport is narrow
- WHEN rendered
- THEN the score wraps into systems or scrolls horizontally with the cursor kept in view

### Requirement: Chord names above the staff

The score MUST show chord symbols from the chord track above the staff aligned with the tick they start.

#### Scenario: Chord symbol alignment

- GIVEN a chord "E" at tick 0 and "B" at tick 1920
- WHEN rendered
- THEN "E" appears above the first beat and "B" above the position of tick 1920

### Requirement: Finger numbers

Finger numbers 1 to 5 MUST be drawn above (right hand) or below (left hand) their notes when the event carries `finger`, and MUST NOT be drawn when absent.

#### Scenario: Finger shown

- GIVEN an RH event with `finger: 2`
- WHEN rendered
- THEN the numeral 2 appears next to its notehead

#### Scenario: No finger

- GIVEN an event without `finger`
- WHEN rendered
- THEN no number is drawn

### Requirement: Note names inside noteheads on Beginner

On the Beginner level the score MUST write note names inside noteheads, in solfege by default (Do Re Mi Fa Sol La Si) with a toggle to letter names (C D E F G A B). The toggle MUST apply immediately without reload and the mapping MUST be a pure, tested function that handles accidentals. On the Original level no note names MUST be drawn inside noteheads.

#### Scenario: Solfege default

- GIVEN the Beginner level with default settings
- WHEN a note with pitch "C4" is rendered
- THEN its notehead reads "Do"

#### Scenario: Toggle to letters

- GIVEN the Beginner level
- WHEN the user switches to letter names
- THEN the note with pitch "C4" reads "C" without reload

#### Scenario: Accidentals in names

- GIVEN a note with pitch "Eb4" in Eb major
- WHEN named in solfege
- THEN the label reads "Mib" (the spelling written in the data, never re-spelled as "Re#")
- AND an event with a `label` field shows that label instead

#### Scenario: Original has clean noteheads

- GIVEN the Original level
- WHEN the score renders
- THEN noteheads are empty and no note names are shown

#### Scenario: Name mapping tests

- GIVEN the note-name module
- WHEN `node --test` runs
- THEN tests cover natural, sharp and flat notes in both naming systems

### Requirement: Playback cursor

A cursor MUST mark the current playback position in the score, driven by the engine position, and MUST follow loop wraps and seeks. Clicking a bar MAY seek to it.

#### Scenario: Cursor follows

- GIVEN playback is running
- WHEN time advances
- THEN the cursor moves rightward in sync with the engine tick

#### Scenario: Cursor on seek

- GIVEN the user seeks to bar 3
- WHEN the position updates
- THEN the cursor jumps to bar 3 in the same frame

#### Scenario: Cursor with reduced motion

- GIVEN `prefers-reduced-motion: reduce`
- WHEN playback runs
- THEN the cursor steps per beat without smooth easing or decorative effects

### Requirement: Level-specific rendering

Beginner and Original MUST render from the same data model with different level data: Beginner shows simplified voicing, labels and finger numbers; Original shows full voicing in engraved style, ornament signs where present and optional analysis marks (see lesson-guide).

#### Scenario: Switch level re-renders

- GIVEN the Nocturne on Beginner
- WHEN the user selects Original
- THEN the score re-renders with the Original events and without note-name labels

### Requirement: Hidden hand and accessibility

A hidden hand (see practice-tools) MUST not be drawn in the score; the left hand is engraved on the bass staff and the right hand on the treble staff. The SVG MUST have a text alternative (title and description) summarizing the song and level.

#### Scenario: Hand hidden

- GIVEN the left hand is hidden
- WHEN the score renders
- THEN the bass staff content is not drawn

#### Scenario: Accessible name

- GIVEN the score is rendered
- WHEN inspected
- THEN the SVG has a title naming the song and level
