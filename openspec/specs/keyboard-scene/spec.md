# Keyboard Scene Specification

## Purpose

A three.js 3D keyboard seen from the player's perspective. Keys press down and light up in time with playback, notes fall toward the keyboard with length showing duration, hands have distinct colors, and ghost-finger markers show finger numbers and upcoming position shifts. The scene is visually ambitious but has a performance budget, honors `prefers-reduced-motion` and degrades on low-end devices.

## Requirements

### Requirement: Keyboard rendering and key state

The scene MUST render a piano keyboard covering the range of the loaded level (at least the notes used) with white and black keys in correct layout. A key MUST visibly depress and light up while its note is sounding, and return to rest on note end.

#### Scenario: Key lights on note

- GIVEN playback reaches a note with midi 60
- WHEN the note is active
- THEN the key for midi 60 is depressed and lit, and returns to rest when the note ends

#### Scenario: Range fits the song

- GIVEN a level whose lowest note is outside a default range
- WHEN the scene loads the level
- THEN the keyboard range is extended so every note has a key

#### Scenario: Paused state

- GIVEN playback is paused
- WHEN the scene renders
- THEN no keys are lit by playback and falling notes are frozen at the paused position

### Requirement: Falling notes

Notes MUST fall toward the keyboard, arriving at the key at the moment the note starts, with bar length proportional to duration. Position MUST be derived from the engine position, not an independent timer. A bounded look-ahead of notes MUST be shown and notes outside it MUST NOT be drawn.

#### Scenario: Arrival aligned with sound

- GIVEN a note at tick T
- WHEN the engine position equals T
- THEN the falling note's lower edge touches the key top and the audio onset is scheduled at the same time

#### Scenario: Duration shown

- GIVEN two notes, one twice as long as the other
- WHEN both are visible
- THEN the longer note's bar is twice the length

#### Scenario: Seek

- GIVEN the user seeks to a new tick
- WHEN the scene updates
- THEN falling notes are recomputed for the new position in the same frame

#### Scenario: Many notes

- GIVEN a level with dense notes in view
- WHEN the scene renders
- THEN instanced meshes are used and the number of draw calls does not grow with the number of notes

### Requirement: Hand colors

Left-hand notes and keys MUST be blue and right-hand notes and keys MUST be orange. Hidden hands (see practice-tools) MUST NOT be drawn. Color MUST NOT be the only differentiator: finger markers or labels MUST also distinguish hands for color-blind users.

#### Scenario: Colors per hand

- GIVEN LH and RH notes are active together
- WHEN rendered
- THEN LH ones are blue and RH ones are orange

#### Scenario: Non-color cue

- GIVEN a color-blind viewer
- WHEN viewing the scene
- THEN hand identity is still available through a shape or label cue on markers

### Requirement: Ghost-finger markers

Finger markers numbered 1 to 5 MUST appear on the keys the hand should play, showing current position and upcoming shifts: the marker for the next position MUST appear before the hand needs to move, and a shift MUST be visually distinguishable from a hold. Markers MUST be driven by the `finger` field; events without a finger show no number.

#### Scenario: Marker with number

- GIVEN an event with `finger: 3` on midi 64
- WHEN the event is current or upcoming
- THEN a marker labelled 3 appears on the key for midi 64

#### Scenario: Upcoming shift hint

- GIVEN the next event's pitch lies more than five semitones outside the span (lowest to highest MIDI) of the previous onset group of the same hand
- WHEN the shift approaches
- THEN a shift hint appears on the destination key before the note starts

#### Scenario: Missing fingering

- GIVEN an event without `finger`
- WHEN rendered
- THEN the key lights without a number and nothing errors

### Requirement: Lighting, reflections and camera

The scene MUST use a player-perspective camera, a key light plus environment lighting and a subtle reflective key surface. The camera MAY move smoothly between song sections. Visual effects MUST NOT obscure notes or finger numbers.

#### Scenario: Section camera move

- GIVEN reduced motion is not requested
- WHEN playback crosses into a new section
- THEN the camera tweens smoothly to that section's framing

#### Scenario: Readability over effect

- GIVEN reflections are enabled
- WHEN a note is lit
- THEN the note and finger number remain clearly readable

### Requirement: prefers-reduced-motion

When the user agent reports `prefers-reduced-motion: reduce`, the scene MUST NOT perform camera moves, MUST disable non-essential animation (idle sway, glow pulses, smoothing flourishes), and MUST keep only the essential motion needed to convey timing (falling notes and key press). The behavior MUST update if the preference changes while the app is open.

#### Scenario: Reduced motion set at load

- GIVEN `prefers-reduced-motion: reduce` is active
- WHEN a song plays across a section boundary
- THEN the camera stays fixed and no decorative animation runs

#### Scenario: Preference changes live

- GIVEN the app is open with motion enabled
- WHEN the user turns on reduced motion in the system
- THEN camera moves and decorative animation stop without reload

#### Scenario: Essential motion retained

- GIVEN reduced motion is active
- WHEN playback runs
- THEN falling notes still advance and keys still depress

#### Scenario: Reduced motion cleared

- GIVEN reduced motion was active
- WHEN the preference is cleared
- THEN camera moves resume at the next section boundary

### Requirement: Performance budget and quality fallback

A frame-time watchdog MUST lower quality tiers (disable reflections, reduce lights, lower pixel ratio) when frame times exceed a threshold over a sustained window, and MUST NOT raise them back within the same session without sustained headroom. The scene MUST remain functional with all effects off. The scene MUST stay usable on a phone in landscape.

#### Scenario: Watchdog degrades

- GIVEN the average frame time exceeds the threshold for the sustained window
- WHEN the watchdog evaluates
- THEN reflections are disabled first, then lights are reduced, and notes and keys still render

#### Scenario: Minimum quality is usable

- GIVEN all effects are off
- WHEN a song plays
- THEN falling notes, key highlights and finger markers all still work

#### Scenario: Phone landscape

- GIVEN a viewport of 844 by 390 pixels
- WHEN the player opens
- THEN the keyboard, falling notes and transport controls are all visible without horizontal scrolling

### Requirement: WebGL unavailable

If WebGL cannot be initialized, the system MUST show a clear message and MUST keep the score view, transport and audio usable.

#### Scenario: No WebGL

- GIVEN WebGL context creation fails
- WHEN the player opens
- THEN a short message explains the 3D view is unavailable and playback with the score still works

### Requirement: Resource cleanup

Leaving the player view MUST dispose of geometries, materials, render loop and listeners so that repeated catalog to player navigation does not leak.

#### Scenario: Navigate away

- GIVEN the player is open
- WHEN the user returns to the catalog
- THEN the render loop stops and scene resources are disposed
