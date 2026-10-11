# Lesson Guide Specification

## Purpose

A lesson card per song and level explaining chords, hand positions and shifts, posture and a practice plan. On the Original level it adds harmonic analysis, ornament explanations and interpretation (rubato, dynamics). Content is data inside the song file, and it surfaces sources and confidence honestly.

## Requirements

### Requirement: Lesson card per song and level

Each song MUST provide lesson content for each level it offers. The card MUST show: chords used (with the notes of each), hand positions and shifts, how to sit and place the hands, and a practice plan. Switching level MUST swap the card content without reload.

#### Scenario: Beginner card

- GIVEN a song on the Beginner level
- WHEN the lesson card opens
- THEN it lists the chords used with their notes, hand-position guidance, posture guidance and a practice plan

#### Scenario: Level switch updates card

- GIVEN the lesson card is open on Beginner
- WHEN the user selects Original
- THEN the card shows the Original content including analysis and interpretation sections

#### Scenario: Missing level content

- GIVEN a level without lesson content
- WHEN the card opens
- THEN a short notice is shown and the rest of the player continues to work

### Requirement: Chord reference

For every chord symbol in the chord track the card MUST be able to show its constituent notes and where they sit on the keyboard (highlight on demand).

#### Scenario: Chord notes

- GIVEN the chord "E"
- WHEN the user selects it in the card
- THEN the notes E, G#, B are listed and highlighted on the 3D keyboard

#### Scenario: Chord not recognized

- GIVEN a chord symbol the chord-name module cannot parse
- WHEN the card renders
- THEN the symbol is shown as text without notes and no error is thrown

### Requirement: Harmonic analysis layer on Original

The Original level MUST support an analysis layer with roman numerals, chord function, and voice-leading notes attached to ticks, shown in the score and card, and togglable. The Nocturne MUST include an analysis note on bar 1 describing the diminished color over the Eb pedal (not a plain Eb to Bb7 reading) when the public-domain source confirms that harmony; if the source contradicts it, the note MUST describe what the source shows and the discrepancy MUST be reported instead of forced.

#### Scenario: Analysis visible on Original

- GIVEN the Nocturne on Original with analysis on
- WHEN bar 1 is shown
- THEN a note states the diminished harmony over the Eb pedal and gives its function

#### Scenario: Analysis hidden on Beginner

- GIVEN the Beginner level
- WHEN the card and score render
- THEN no roman numerals or voice-leading notes are shown

#### Scenario: Toggle analysis

- GIVEN Original with analysis on
- WHEN the user toggles it off
- THEN roman numerals and voice-leading notes disappear from score and card

### Requirement: Ornament and interpretation notes

The Original card for the Nocturne MUST explain the ornaments present in the transcribed bars (fioriture and turns) and include rubato and dynamics guidance. Each ornament explanation MUST reference the bar where it occurs.

#### Scenario: Ornament explained

- GIVEN an ornament in a transcribed bar
- WHEN the Original card is open
- THEN the card has an entry naming the ornament, the bar and how to play it

#### Scenario: Rubato guidance

- GIVEN the Original card
- WHEN viewed
- THEN a rubato and dynamics section is present

### Requirement: Provenance and confidence shown

The card MUST display the song's sources (as links) and its confidence notes. Content with lower confidence MUST be labelled as such.

#### Scenario: Cancer low-confidence chorus

- GIVEN the Cancer lesson card
- WHEN the chords section is viewed
- THEN the chorus progression is labelled lower confidence and the source link is shown

#### Scenario: Chopin source link

- GIVEN the Nocturne lesson card
- WHEN the sources area is viewed
- THEN a link to the named public-domain score source (Mutopia Project or IMSLP) is shown

### Requirement: Cancer content policy

The Cancer lesson card and all its text MUST NOT include lyrics or a vocal melody transcription, and MUST state that the arrangement is a generic chord-based accompaniment. Its scope is chords, structure, and a beginner accompaniment (LH roots, RH triads).

#### Scenario: No lyrics in card

- GIVEN the Cancer lesson content
- WHEN scanned
- THEN it contains no lyric lines and no vocal melody notation

#### Scenario: Accompaniment statement

- GIVEN the Cancer card
- WHEN viewed
- THEN it states the arrangement is generic chord-based accompaniment, not a transcription

### Requirement: Reduced-motion friendly card

Card transitions MUST NOT animate when `prefers-reduced-motion: reduce` is set.

#### Scenario: No transition animation

- GIVEN reduced motion is active
- WHEN the card opens or content swaps
- THEN no animated transition plays

### Requirement: Readable, self-explanatory UI copy

Card headings MUST be one line, action labels MUST state what they do, and UI copy MUST be in English.

#### Scenario: Headings

- GIVEN any lesson card
- WHEN viewed
- THEN each section heading fits on one line
