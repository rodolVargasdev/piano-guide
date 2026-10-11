# Delta for Lesson Guide

## ADDED Requirements

### Requirement: Private song lesson content stays local and lyric-free

The lesson text of a private song lives only inside its private song file. It MUST NOT contain lyrics, and it MUST state, in both languages, that the notes come from a single user-submitted source and should be checked by ear. The same applies to every text shown by Learn mode for that song: only instructions, note names and finger numbers, never lyrics.

#### Scenario: Owner reads the private card

- GIVEN the private song's lesson card
- WHEN it is viewed in English and in Spanish
- THEN it says the notes come from one user-submitted source and should be checked by ear

#### Scenario: Lyrics scan

- GIVEN the private song file and every Learn string generated for it
- WHEN scanned by the lyrics guard in a local-only test
- THEN no lyric line is found, and the test is skipped when the private file is absent

## MODIFIED Requirements

### Requirement: Provenance and confidence shown

The card MUST display the song's sources (as links) and its confidence notes. Content with lower confidence MUST be labelled as such.
(Previously: the first scenario used the public Cancer chorus; it now uses any song with lower-confidence content, such as the private converted song.)

#### Scenario: Lower-confidence section is labelled

- GIVEN a song whose chorus has lower confidence than its verse (for example the owner's private song)
- WHEN the chords or notes section is viewed
- THEN the chorus is labelled lower confidence and the source link is shown

#### Scenario: Chopin source link

- GIVEN the Nocturne lesson card
- WHEN the sources area is viewed
- THEN a link to the named public-domain score source (Mutopia Project or IMSLP) is shown

#### Scenario: Ode to Joy source link

- GIVEN the Ode to Joy lesson card
- WHEN the sources area is viewed
- THEN a link to its Mutopia Project or IMSLP source and its license are shown

### Requirement: Readable, self-explanatory UI copy

Card headings MUST be one line, action labels MUST state what they do, and learner-facing UI copy MUST be available in English and Spanish following the language selector (see learner-language). Parts of the player outside Learn mode, lesson zero, Practice exercises and the catalog actions MAY remain English only.
(Previously: all UI copy MUST be in English.)

#### Scenario: Headings

- GIVEN any lesson card
- WHEN viewed
- THEN each section heading fits on one line

#### Scenario: Card in Spanish

- GIVEN the learner selected Spanish and the song supplies Spanish text
- WHEN the lesson card opens
- THEN its headings and texts are in Spanish

#### Scenario: Card text without Spanish

- GIVEN the song supplies English text only for a field
- WHEN the learner who chose Spanish opens the card
- THEN that field shows its English text and nothing is blank

## REMOVED Requirements

### Requirement: Cancer content policy

(Reason: the public chords-only Cancer is removed from the catalog; the real Cancer melody exists only as a private local song, covered by "Private song lesson content stays local and lyric-free" and by the private-song-library capability.)
(Migration: the scenarios "No lyrics in card" and "Accompaniment statement" are replaced by the lyric-free and single-source statements above. The "Cancer low-confidence chorus" scenario of "Provenance and confidence shown" is replaced by "Lower-confidence section is labelled".)
