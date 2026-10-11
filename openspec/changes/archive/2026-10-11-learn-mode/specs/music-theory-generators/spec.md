# Music Theory Generators Specification

## Purpose

Pure modules (no DOM, no audio, no dependency, tested with `node --test`) that produce everything Learn mode and Practice exercises need from music theory: transposition, fingering, scales with standard fingering, triads and inversions, arpeggios, cadences and progressions with voice leading, intervals, and key orders. Output is data (spelled pitches, fingers, hands); nothing is stored as content, so no copyright applies. Every generator that uses chance takes an explicit seed so tests are reproducible.

Tonics used for "every key": C, G, D, A, E, B, F#, Db, Ab, Eb, Bb, F (circle of fifths from C through the sharps and then through the flats). Pitches are spelled correctly for the key (F# major has E#, Db major has Cb only if it occurs) and parse with the existing pitch module.

## Requirements

### Requirement: Transposition preserves intervals and respells

A pure function MUST transpose a level's notes and chords to a target major tonic by the smallest interval (never more than a tritone up or down; E to C is a major third down), re-spelling every pitch in the new key (diatonic tones natural or sharp/flat per the key signature, chromatic tones with the correct accidental) and re-spelling chord symbols and roman numerals' roots (E to C, B to G, C#m to Am, A to F). Every interval between notes MUST be preserved exactly. The result MUST stay within A0 to C8; a deterministic octave shift (0 or plus or minus 12 semitones, applied to the whole hand's material at once) MUST be chosen per hand in two steps: first every candidate that puts any note of that hand outside A0 to C8 is rejected, then among the remaining candidates the one whose mean pitch is closest to C4 (right hand) or C3 (left hand) wins, ties going to 0 and then to the lower shift. For the right hand the winner MUST be no farther from C4 than the original whenever such an in-range candidate exists. Authored fingers MUST be dropped on transposition (they belong to the original key) unless the song's `fingeringSource` says they are key-independent.

#### Scenario: E major to C major

- GIVEN a right-hand phrase E4 G#4 B4 C#5 in E major
- WHEN it is transposed to C
- THEN the notes are C4 E4 G4 A4 and the chords E, B, C#m, A become C, G, Am, F

#### Scenario: Chromatic tone respelled

- GIVEN a lowered seventh D5 in E major
- WHEN transposed to C major
- THEN it becomes Bb4 (or Bb5 under the octave rule) and not A#

#### Scenario: Intervals preserved

- GIVEN any melody
- WHEN transposed to any target
- THEN the semitone distance between every pair of consecutive notes is unchanged

#### Scenario: Register stays near middle C

- GIVEN a right-hand melody whose mean pitch is above C4
- WHEN transposed down a major third
- THEN its mean distance from C4 is no greater than before

#### Scenario: Out of range protection

- GIVEN a bass note that would fall below A0
- WHEN transposed
- THEN the hand's material is shifted up an octave so every note is within range

#### Scenario: Identity

- GIVEN a target equal to the source key
- WHEN transposed
- THEN the notes are returned unchanged

### Requirement: Fingering assigner with positions and shifts

A pure assigner MUST take the notes of one hand and return, for each onset group, a finger per note, the five-finger position (anchor note and range) the hand is in, and a shift flag when the position changes. A position covers at most five consecutive scale steps; right-hand fingers rise with pitch (1 thumb on the lowest note of the position) and left-hand fingers fall with pitch (1 thumb on the highest). A note that leaves the position starts a new position and flags a shift; the new position is chosen so the note is reachable and fewer shifts occur. Repeated notes keep their finger. A chord of three notes within a fifth is fingered 1-3-5 (right) or 5-3-1 (left); two notes use the fingers that match their span (a fifth uses 1 and 5, a third uses 1 and 3). A group wider than 12 semitones MUST be reported as `unplayable` and the step model MUST present its notes one after another, lowest first. Authored `finger` values MUST win over computed ones. The thumb SHOULD NOT be put on a black key when a white-key position exists.

#### Scenario: Five-finger melody

- GIVEN a right-hand melody E F G F E within one position
- WHEN fingered
- THEN fingers are 1 2 3 2 1 with one position and no shift

#### Scenario: Leap forces a shift

- GIVEN a right-hand melody that moves from E4 up to C5
- WHEN fingered
- THEN a new position starts at the leap and the step is flagged as a shift

#### Scenario: Left hand mirrors

- GIVEN a left-hand melody C3 D3 E3 within one position
- WHEN fingered
- THEN fingers fall as pitch rises, so C3 gets 5 and E3 gets 3

#### Scenario: Triad

- GIVEN right-hand notes C4 E4 G4 together
- WHEN fingered
- THEN fingers are 1 3 5

#### Scenario: Octave bass

- GIVEN left-hand notes C2 and C3 together
- WHEN fingered
- THEN fingers are 5 and 1

#### Scenario: Unplayable stretch

- GIVEN a single hand asked to play C3 and G4 together
- WHEN fingered
- THEN the group is reported `unplayable`

#### Scenario: Authored fingers win

- GIVEN a note with an authored `finger: 4`
- WHEN fingered
- THEN it keeps 4 and the surrounding computed fingers adapt without breaking monotonicity

#### Scenario: Thumb off a black key when possible

- GIVEN a melody that can be placed in a white-key position
- WHEN fingered
- THEN no thumb lands on a black key

### Requirement: Major scales with standard fingering

A pure generator MUST produce the major scale of each of the 12 tonics for one or two octaves, ascending and descending, with the standard fingering table. The generator MUST return fingers for each hand and notes spelled correctly. The introduction order for learners MUST be C, G, D, F, then A, E, B, Bb, Eb, Ab, Db, F# (order of introduction, not a lock).

#### Scenario: C major one octave, right hand

- GIVEN tonic C, one octave, right hand, ascending
- WHEN generated
- THEN the notes are C4 D4 E4 F4 G4 A4 B4 C5 with fingers 1 2 3 1 2 3 4 5

#### Scenario: C major one octave, left hand

- GIVEN tonic C, one octave, left hand, ascending
- WHEN generated
- THEN the notes are C3 to C4 with fingers 5 4 3 2 1 3 2 1

#### Scenario: F major right hand

- GIVEN tonic F, one octave, right hand
- WHEN generated
- THEN the notes are F4 G4 A4 Bb4 C5 D5 E5 F5 with fingers 1 2 3 4 1 2 3 4

#### Scenario: Two octaves

- GIVEN tonic C, two octaves, right hand
- WHEN generated
- THEN there are 15 notes ascending and the same 15 descending with each ascending finger sequence from the table

#### Scenario: Spelling in F# major

- GIVEN tonic F#
- WHEN generated
- THEN the scale is spelled F# G# A# B C# D# E# F#

#### Scenario: All twelve tonics

- GIVEN each of the 12 tonics
- WHEN generated for one octave
- THEN every result has 8 notes, valid fingers 1 to 5 and each note one scale step above the previous

#### Scenario: Introduction order

- GIVEN the introduction order function
- WHEN called
- THEN it returns C, G, D, F, A, E, B, Bb, Eb, Ab, Db, F#

### Requirement: Five-finger patterns in any key

A pure generator MUST produce the major five-finger pattern (degrees 1 to 5) for each tonic with fingers 1 to 5 for the right hand and 5 to 1 for the left hand. A minor pattern (lowered third) MAY be offered.

#### Scenario: G five-finger pattern

- GIVEN tonic G, right hand
- WHEN generated
- THEN the notes are G4 A4 B4 C5 D5 with fingers 1 2 3 4 5

#### Scenario: Left hand pattern

- GIVEN tonic D, left hand
- WHEN generated
- THEN the notes are D3 E3 F#3 G3 A3 with fingers 5 4 3 2 1

### Requirement: Triads, inversions and arpeggios

A pure generator MUST produce major and minor triads and their root position, first and second inversions for each tonic, spelled correctly, within one octave of the hand's region, fingered 1-3-5 (root and second inversion) and 1-2-5 (first inversion) for the right hand, and 5-3-1 (root and first inversion) and 5-2-1 (second inversion) for the left hand. It MUST produce arpeggios (broken triads) ascending and descending over one or two octaves as note sequences with fingering from the standard arpeggio table in the design (white-key roots: right hand 1-2-3-5, left hand 5-4-2-1 per octave); table entries marked for review fall back to the assigner and are labelled as suggested fingering. Diminished and augmented triads MAY be offered.

#### Scenario: C major triad and inversions

- GIVEN tonic C major, right hand
- WHEN root, first and second inversions are generated
- THEN the notes are C4 E4 G4, E4 G4 C5 and G4 C5 E5 with fingers 1 3 5, 1 2 5 and 1 3 5

#### Scenario: C major triad and inversions, left hand

- GIVEN tonic C major, left hand
- WHEN root, first and second inversions are generated
- THEN the notes are C3 E3 G3, E3 G3 C4 and G3 C4 E4 with fingers 5 3 1, 5 3 1 and 5 2 1

#### Scenario: A minor triad

- GIVEN tonic A minor
- WHEN generated in root position
- THEN the notes are A3 C4 E4

#### Scenario: Arpeggio notes

- GIVEN a C major arpeggio, right hand, one octave ascending
- WHEN generated
- THEN the notes are C4 E4 G4 C5

#### Scenario: Two octaves down

- GIVEN a G major arpeggio, two octaves, descending
- WHEN generated
- THEN the sequence is the ascending sequence reversed

### Requirement: Cadences and progressions with voice leading

A pure generator MUST produce, for any major tonic, the progressions I-IV-V-I, I-vi-IV-V and I-V-vi-IV (a cadence is a final progression such as I-IV-V-I). For each chord it MUST give a left-hand root and a right-hand triad voicing chosen to minimize the total semitone movement from the previous voicing, with common tones kept and ties broken toward the lower voicing, staying within one octave of the hand's region. Chord symbols MUST be spelled in the key.

#### Scenario: C major I-IV-V-I

- GIVEN tonic C
- WHEN I-IV-V-I is generated
- THEN the chords are C, F, G, C with left-hand roots C3, F3, G3, C3 and each right-hand voicing contains the chord's three pitch classes

#### Scenario: Common tone kept

- GIVEN C to F
- WHEN the voicings are chosen
- THEN the note C is held in the right hand and the other two voices move by step or the smallest interval

#### Scenario: Minimal movement

- GIVEN any generated progression in any tonic
- WHEN total movement is compared with the root-position voicing of every chord
- THEN it is less than or equal

#### Scenario: Vi is minor

- GIVEN tonic G and the progression I-vi-IV-V
- WHEN generated
- THEN the chords are G, Em, C, D

#### Scenario: Flat key spelling

- GIVEN tonic Bb and I-V-vi-IV
- WHEN generated
- THEN the chords are Bb, F, Gm, Eb

### Requirement: Intervals and chord drills

Pure generators MUST produce ear-drill questions from a seeded random source: an interval question (root pitch, interval name among minor second to octave, direction ascending, descending or harmonic) and a chord question (root, quality among major and minor, optionally diminished and augmented, root position). A question MUST carry its correct answer id and the notes to play, and a chosen answer set (a subset of difficulty) MUST always include the correct answer and never repeat an option. The same seed MUST produce the same question.

#### Scenario: Reproducible

- GIVEN the same seed
- WHEN a question is generated twice
- THEN the two are identical

#### Scenario: Correct answer among options

- GIVEN an interval question with four options
- WHEN generated for many seeds
- THEN the correct answer is always among the options, once

#### Scenario: Major third

- GIVEN root C4 and the major third ascending
- WHEN notes are produced
- THEN they are C4 then E4

#### Scenario: Range safe

- GIVEN any seed and any interval
- WHEN the notes are produced
- THEN both are within C3 to C6

### Requirement: Key orders

A pure function MUST order keys for rotation: fixed (as given), random (seeded, no key immediately repeating, every key before any repeat), and circle of fifths (C G D A E B F# Db Ab Eb Bb F and then back to C), each in a forward direction, with the circle of fourths as its reverse.

#### Scenario: Circle of fifths

- GIVEN the circle order starting at C
- WHEN 12 keys are requested
- THEN they are C G D A E B F# Db Ab Eb Bb F

#### Scenario: Circle of fourths

- GIVEN the circle order starting at C with direction "fourths"
- WHEN 12 keys are requested
- THEN they are C F Bb Eb Ab Db F# B E A D G

#### Scenario: Wraps

- GIVEN 13 keys are requested from the circle order
- WHEN generated
- THEN the 13th is C again

#### Scenario: Random does not repeat early

- GIVEN a random order for 12 keys and any seed
- WHEN generated
- THEN each of the 12 tonics appears once before any appears twice and no key follows itself

#### Scenario: Fixed list

- GIVEN a fixed list C F G
- WHEN rotated for 5 steps
- THEN the order is C F G C F

### Requirement: Purity and determinism

Every generator MUST be a pure function of its inputs and seed, MUST NOT import DOM or audio code, and MUST be covered by `node --test`.

#### Scenario: Import in plain Node

- GIVEN the modules
- WHEN imported in a plain Node process
- THEN they load with no browser global and produce output
