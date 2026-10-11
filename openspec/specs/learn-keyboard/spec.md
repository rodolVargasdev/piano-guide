# Learn Keyboard Specification

## Purpose

A close, readable 2D keyboard (SVG) used by Learn mode, lesson zero and Practice exercises. It shows a small region of the piano, large enough for a beginner to read every label, and makes the next keys unmistakable. The 3D scene is not used here; it remains in Play along.

## Requirements

### Requirement: Framed to the hand region

The keyboard MUST show the region of keys needed now: at least about 1.5 octaves (9 white keys), centered on the current hand position and widened only when a step or an exercise needs keys outside it. Every key of the current step and of the current five-finger position MUST be visible without scrolling or zooming. When the hand moves to a new position the framing MUST change to the new region and MUST NOT animate when reduced motion is requested.

#### Scenario: Beginner sees only what matters

- GIVEN the right hand is in the C position
- WHEN the keyboard shows
- THEN roughly 9 white keys around the hand are shown and none of the 88 keys outside the region is drawn

#### Scenario: Hand shifts up

- GIVEN the next step requires a position outside the shown region
- WHEN the step begins
- THEN the region moves so the new keys are visible

#### Scenario: Wide chord

- GIVEN a step whose keys span more than the default region
- WHEN it begins
- THEN the region widens to include every key of the step

#### Scenario: Reduced motion

- GIVEN `prefers-reduced-motion: reduce` is set
- WHEN the region changes
- THEN it changes instantly with no animation

### Requirement: Readable at phone width

At a viewport width of 360 CSS pixels the region MUST keep white keys at least 36 CSS pixels wide, with labels at least 12 CSS pixels, and MUST remain operable by touch. When the width cannot fit the region at that size the region MUST show fewer keys (never fewer than the keys of the current step plus its position) instead of shrinking labels.

#### Scenario: Phone

- GIVEN a 360 px wide screen
- WHEN the keyboard shows 9 white keys
- THEN every white key is at least 36 px wide and its label at least 12 px

#### Scenario: Very narrow screen

- GIVEN a width that cannot fit 9 keys at the minimum size
- WHEN the keyboard shows
- THEN it shows fewer keys, still including all keys of the current step, and the labels stay legible

### Requirement: Names on every key

Every drawn key MUST show its note name as solfege and letter (for example "Mi E"), spelled for the song's current key (for example F# and not Gb in E major). Black keys MUST show their spelling, with the alternate spelling only when the key context is ambiguous (for example in lesson zero). The labels MUST follow the language selector for any words they contain; note names are the same in both languages.

#### Scenario: Names visible

- GIVEN any region
- WHEN the keyboard shows
- THEN each key shows both the solfege and the letter name

#### Scenario: Spelling follows the key

- GIVEN a song in E major
- WHEN a black key between F and G is shown
- THEN it is labelled F# and Fa# and not Gb

### Requirement: Finger numbers on the keys to press

Keys the learner must press now MUST show their finger number (1 thumb to 5 little finger) on the key, shaded and outlined, and MUST NOT rely on color alone to be distinguished. Keys already in the hand position but not required MAY show a quiet marker. For a hands-together step the left-hand and right-hand finger numbers MUST be visually distinct and each hand MUST be named in text.

#### Scenario: Next key unmistakable

- GIVEN the next step is the thumb on E
- WHEN it is shown
- THEN the E key is shaded, outlined and shows "1"

#### Scenario: Color-blind learner

- GIVEN the shading is viewed in grayscale
- WHEN the learner looks at the keyboard
- THEN the expected keys remain distinguishable by outline and the finger number

#### Scenario: Two hands

- GIVEN a hands-together step
- WHEN it is shown
- THEN each key shows its finger number and the hands are told apart by label and style

### Requirement: Computer-key letters on the keys

When the computer-keyboard input is active the keyboard MUST draw on each mapped key the computer key that plays it, over the current hand region (see note-input). The letters MUST update when the region moves.

#### Scenario: Learner finds the computer keys

- GIVEN the region is C4 to E5 and the computer keyboard input is on
- WHEN the keyboard shows
- THEN each key shows the letter that plays it

#### Scenario: Region moves

- GIVEN the region shifts
- WHEN the keyboard redraws
- THEN the letters follow the new keys

### Requirement: Key states: pressed, wrong, correct

A pressed key MUST show a pressed state for as long as it is held, from any input source. A wrong key MUST show a distinct wrong state for a short moment and a text cue; a satisfied step MUST show a correct state and a text cue ("Correct"). States MUST NOT be conveyed by color alone and MUST be announced to assistive technology through a polite live region. Reduced motion removes any animation but keeps the states.

#### Scenario: Hold and release

- GIVEN the learner holds a key
- WHEN they release it
- THEN the pressed state shows during the hold and clears on release

#### Scenario: Wrong key

- GIVEN the learner presses a key that is not expected
- WHEN the press arrives
- THEN that key shows the wrong state briefly and the live region says "Try again"

#### Scenario: Pressing from MIDI

- GIVEN a MIDI note arrives
- WHEN the key is in the shown region
- THEN it shows pressed, and when it is outside the region nothing breaks

### Requirement: Taps and clicks on the keys

The keys MUST be pressable by pointer and touch: pressing starts the note, releasing or leaving the key ends it, multiple touches at once MUST play multiple keys, and the key MUST have a target at least as large as its drawn area.

#### Scenario: Two fingers at once on a phone

- GIVEN a touch screen
- WHEN two fingers touch two keys together
- THEN both keys are pressed

#### Scenario: Slide off a key

- GIVEN a held pointer slides off the key
- WHEN it leaves
- THEN the note ends

### Requirement: Shared by Learn mode and Practice exercises

The same keyboard component MUST serve lesson zero, Learn steps and exercises with the same labels and states.

#### Scenario: Same look in exercises

- GIVEN a scale exercise
- WHEN it shows the next key
- THEN the shading, finger number and labels match the Learn view
