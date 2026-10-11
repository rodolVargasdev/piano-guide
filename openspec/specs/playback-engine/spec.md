# Playback Engine Specification

## Purpose

The engine owns musical time. It converts song ticks to beats and seconds, schedules notes against a single audio clock, exposes transport controls, tempo, slow mode and a metronome, and synthesizes piano-like sound with the Web Audio API. All other views (3D scene, score cursor) subscribe to its position.

## Requirements

### Requirement: Tick, beat and seconds conversion

The system MUST provide pure functions converting between ticks, beats and seconds for the fixed resolution `PPQ` = 480 and a tempo `{ bpm, beatUnit }`, and MUST account for the meter and `pickupTicks` when computing bar and beat positions. For a 12/8 song, a bar MUST be 12 eighth notes and the metronome beat unit MUST follow the song's declared `tempo.beatUnit` (dotted quarter in the Nocturne).

#### Scenario: Ticks to seconds at 72 BPM

- GIVEN `ppq` 480 and BPM 72 with a quarter-note beat
- WHEN 480 ticks are converted to seconds
- THEN the result is 60/72 seconds (0.8333 s)

#### Scenario: Round trip

- GIVEN any tick value t and any BPM in 20 to 300
- WHEN t is converted to seconds and back to ticks
- THEN the result equals t within one tick

#### Scenario: Compound meter bar length

- GIVEN a 12/8 song with `ppq` 480
- WHEN the bar length in ticks is computed
- THEN it is 2880 ticks and the bar contains 4 dotted-quarter beats

### Requirement: Single time source and subscribers

The engine MUST use the Web Audio clock as the only time source and MUST publish the current position (tick, bar, beat, seconds) so that the 3D scene and score cursor read the same value each frame. Views MUST NOT keep independent clocks.

#### Scenario: Views agree

- GIVEN playback is running
- WHEN the scene and the score cursor both read the position in the same animation frame
- THEN they receive the same tick value

#### Scenario: Tab hidden and restored

- GIVEN playback is running and the tab becomes hidden then visible
- WHEN it becomes visible again
- THEN views resume from the engine's current audio-clock position with no accumulated drift

### Requirement: Look-ahead scheduling

The scheduler MUST schedule note and metronome events inside a look-ahead window ahead of the audio clock, and MUST NOT schedule an event twice or skip one across window boundaries. The window computation MUST be a pure function.

#### Scenario: Window boundaries

- GIVEN events at ticks 0, 480, 960 and a window advancing in fixed steps
- WHEN the scheduler runs over consecutive windows
- THEN each event is returned exactly once, in order

#### Scenario: Seek during playback

- GIVEN playback is running
- WHEN the user seeks to a different tick
- THEN pending scheduled notes are cancelled and scheduling resumes from the new position with no stuck or doubled notes

### Requirement: Transport

The system MUST provide play, pause, stop and seek. Pause MUST keep the position and silence sounding notes; play MUST resume from the paused position. Reaching the end MUST stop playback and reset the position to the start (or the loop start if a loop is active).

#### Scenario: Pause and resume

- GIVEN playback is at tick 1200
- WHEN the user pauses and later plays
- THEN playback resumes from tick 1200

#### Scenario: End of song

- GIVEN playback reaches the last tick with no loop
- WHEN the end is reached
- THEN playback stops, all notes are released and the position returns to 0

#### Scenario: Browser blocks audio until a gesture

- GIVEN the audio context is suspended by autoplay policy
- WHEN the user presses play
- THEN the context is resumed as part of that gesture and playback starts

### Requirement: Adjustable BPM and slow mode

The user MUST be able to set BPM within a bounded runtime range (20 to 240, enforced by a pure `clampBpm`; the default comes from the song file's `tempo.bpm`, clamped into this range even though the file may declare up to 300) and toggle a slow mode that applies a fixed fraction (for example 50 percent) of the current BPM. Changing BPM during playback MUST keep the musical position (tick) continuous and MUST NOT restart the song.

#### Scenario: Change BPM mid-playback

- GIVEN playback at 72 BPM and tick 960
- WHEN the user sets 90 BPM
- THEN playback continues from tick 960 at 90 BPM with no restart

#### Scenario: Slow mode

- GIVEN BPM 100
- WHEN slow mode is enabled at 50 percent
- THEN the effective BPM is 50 and the displayed BPM indicates slow mode
- AND disabling slow mode restores 100

#### Scenario: Out-of-range BPM

- GIVEN the user enters 500
- WHEN the value is applied
- THEN it is clamped to the maximum (240) and the control shows the clamped value

### Requirement: Metronome with accented downbeat

The metronome MUST click on every beat of the song's beat unit, with a distinct accent on beat 1 of each bar, and MUST be toggleable independently of music playback. The metronome MUST follow the effective BPM, including slow mode and tempo ramp.

#### Scenario: Accent on downbeat

- GIVEN a 4/4 song with metronome on
- WHEN one bar plays
- THEN four clicks occur and the first has the accent timbre or level

#### Scenario: Metronome only

- GIVEN music audio is muted for both hands
- WHEN the metronome is on and play is pressed
- THEN only metronome clicks sound

### Requirement: Synthesized piano-like sound

The system MUST synthesize notes with the Web Audio API using oscillators and an attack-decay-sustain-release envelope, with no audio samples and no new dependency. Note-off MUST apply the release without clicks, and the number of simultaneous voices MUST be bounded.

#### Scenario: No sample assets

- GIVEN the repository file list
- WHEN it is inspected
- THEN no audio sample or soundfont files exist

#### Scenario: Voice cap

- GIVEN more simultaneous notes than the voice cap
- WHEN they are scheduled
- THEN the oldest voices are released first and playback does not throw

### Requirement: Ornament and rubato are data-driven notes

Ornament events (for example turns) and grace notes present in level data MUST be played as written note events at their written `tick` and `dur`; the engine MUST NOT invent ornament, grace-note or rubato timing.

#### Scenario: Ornament plays as written

- GIVEN an original-level event sequence expressing a turn as individual notes
- WHEN played
- THEN each note sounds at its written tick

#### Scenario: Grace note plays at its written tick

- GIVEN an event with `grace: true`, `tick` 2860 and `dur` 20 before a principal note at tick 2880
- WHEN played
- THEN the grace note sounds at tick 2860 for 20 ticks and the principal note is not shifted
