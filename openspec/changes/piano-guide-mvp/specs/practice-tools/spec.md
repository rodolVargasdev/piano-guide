# Practice Tools Specification

## Purpose

Controls that let a learner slow down, repeat and isolate passages: loop A-B, tempo ramp, hands-separate practice, and the per-song level selector (Beginner / Original). Loop and ramp math are pure functions tested with `node --test`.

## Requirements

### Requirement: Loop A-B

The user MUST be able to set a loop start (A) and end (B) on a tick-aligned range (bar or beat granularity) and enable or disable looping. When enabled, reaching B MUST jump back to A seamlessly with no doubled or missing notes. A MUST be before B. A pure `normalizeLoop(range, { snap, meter, pickupTicks, lengthTicks, tempo })` MUST swap an inverted range, snap A down and B up to the chosen grid, clamp to the song, and reject a zero-length result; a pure `loopFromSection(section)` MUST return the section's range; a pure wrap-detection function MUST report how many loop passes were completed between two engine positions.

#### Scenario: Loop wraps

- GIVEN a loop from bar 2 to bar 3 is enabled and playback reaches the end of bar 3
- WHEN the position passes B
- THEN playback continues from the start of bar 2 and the loop pass counter increments

#### Scenario: Invalid range

- GIVEN A is set after B
- WHEN the user applies the range
- THEN the range is rejected or swapped and the UI shows the resulting range, never an inverted loop

#### Scenario: Disable loop

- GIVEN a loop is active
- WHEN the user disables it
- THEN playback continues past B to the end of the song

#### Scenario: Loop selected by section

- GIVEN the song has named sections
- WHEN the user picks a section as the loop range
- THEN A and B are set to that section's start and end ticks

### Requirement: Tempo ramp

With tempo ramp enabled on an active loop, the system MUST start at a configured start BPM and raise BPM by a configured step after each completed loop pass until the target BPM is reached, then hold the target. Start, step and target are expressed in BPM and MUST be user-adjustable (defaults: start 60 percent of the song tempo rounded to an integer, step 5, target the song tempo; all clamped by `clampBpm`; if start exceeds target they are swapped). The pure function `nextRampBpm({ current, start, step, target })` MUST return `max(start, min(target, current + step))`, so the ramp never exceeds the target or goes below the start. A Hold control MAY freeze the ramp at the current BPM.

#### Scenario: Ramp steps up

- GIVEN a ramp from 50 to 70 BPM with step 5
- WHEN four loop passes complete
- THEN the BPM values used are 50, 55, 60, 65 and the next pass uses 70

#### Scenario: Ramp holds target

- GIVEN the target BPM has been reached
- WHEN further loop passes complete
- THEN BPM stays at the target

#### Scenario: Ramp without a loop

- GIVEN no loop is active
- WHEN the user enables tempo ramp
- THEN the control indicates a loop is required and the ramp does not run

#### Scenario: Step larger than remaining gap

- GIVEN BPM 68, target 70, step 5
- WHEN the next pass starts
- THEN BPM is 70, not 73

### Requirement: Hands-separate practice

The user MUST be able to mute, or hide, either hand independently. A muted hand MUST NOT sound; a hidden hand's falling notes and score voice MUST NOT be shown; the metronome and the other hand MUST be unaffected. Mute and hide are two independent flags per hand (`{ L: { muted, hidden }, R: { muted, hidden } }`). Both hands MAY be muted at the same time; the UI MUST show that state.

#### Scenario: Mute left hand

- GIVEN both hands are active
- WHEN the user mutes the left hand
- THEN left-hand notes produce no sound and right-hand notes still sound

#### Scenario: Hide right hand

- GIVEN both hands are active
- WHEN the user hides the right hand
- THEN right-hand falling notes, key highlights and score notes are not shown, and left-hand ones remain

#### Scenario: State persists across seek and loop

- GIVEN the right hand is muted
- WHEN the user seeks or the loop wraps
- THEN the right hand stays muted

#### Scenario: Both hands off

- GIVEN both hands are muted
- WHEN play is pressed
- THEN no note sound plays, the metronome still works if enabled, and the UI shows both hands off

### Requirement: Level selector

Each song MUST offer the levels present in its file (Beginner, Original) through a selector. Switching level MUST NOT reload the page, MUST preserve the playback position in musical time (bar and beat) where the target level has an equivalent position, and MUST preserve BPM, loop range, metronome and hands state.

#### Scenario: Switch while paused

- GIVEN the Nocturne is paused at bar 2 on Beginner
- WHEN the user selects Original
- THEN the scene, score and lesson update to Original data, the position stays at bar 2 and the page does not reload

#### Scenario: Switch while playing

- GIVEN playback is running
- WHEN the user switches level
- THEN playback continues without a gap longer than 250 ms and notes of the new level are scheduled from the current tick

#### Scenario: Song with a single level

- GIVEN a song file that defines only one level
- WHEN the player opens
- THEN the selector shows only that level and the other option is not offered

#### Scenario: Level preference

- GIVEN the user picked Original on a song
- WHEN the user returns to the song in the same session
- THEN Original is preselected (remembered in `sessionStorage` per song id; a `level` in the URL hash takes precedence)

### Requirement: Practice state is pure and testable

Loop wrap detection, tempo-ramp progression and BPM clamping MUST be implemented as pure functions with `node --test` coverage including the edge cases above.

#### Scenario: Unit tests cover ramp edges

- GIVEN the test suite
- WHEN `node --test` runs
- THEN tests for ramp start, step, target clamp and loop wrap pass
