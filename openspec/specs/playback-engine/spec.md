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
### Requirement: Private songs are never scheduled

The engine MUST NOT schedule any note event of a song for which `isSilent(song)` is true (see song-data-model), through any entry point: transport play, loop, seek-and-play, phrase-range playback, or Learn "Listen". For such a song the transport and the position clock MAY run so that views can animate, but the set of scheduled notes MUST be empty and the engine MUST report to the caller that the song is silent. The refusal MUST be enforced inside the engine, not in the views, so that no view can play a private song by mistake. The metronome is not a song note and follows the user's metronome toggle.

#### Scenario: Cancer never sounds, even by mistake

- GIVEN a private song is loaded and a view calls the engine's play entry point
- WHEN the scheduler runs over the whole song with a recording audio sink
- THEN the sink records zero scheduled notes
- AND the engine reports the song as silent

#### Scenario: Listen refused for a private song

- GIVEN the Learn view asks the engine to play a phrase range of a private song
- WHEN the request is made
- THEN no note is scheduled and the caller receives the silent report

#### Scenario: Visual-only Play along keeps moving

- GIVEN a private song in Play along
- WHEN the person presses play
- THEN the cursor and falling bars advance with the clock and nothing is heard from the song

#### Scenario: Public song is unaffected

- GIVEN a public song
- WHEN the same entry points are used
- THEN its notes are scheduled exactly as before

#### Scenario: Visibility cannot be bypassed by level or range

- GIVEN a private song with several levels
- WHEN any level or any tick range is requested
- THEN no note of any level is scheduled

### Requirement: Bounded phrase-range playback

The engine MUST be able to play only the note events whose onsets lie in `[startTick, endTick)` of a public song, optionally limited to one hand, at a chosen BPM, and stop by itself at `endTick` while reporting completion to the caller. Used for Learn "Listen", the default BPM (when the caller passes none) MUST be no greater than the slow-mode fraction of the song tempo; a caller MAY pass an explicit BPM, which the Learn full-tempo stage does with the song tempo (an explicit, non-default choice). Notes still sounding at `endTick` MUST be released without a click. Position publishing MUST continue to use the single audio clock.

#### Scenario: Learner hears one phrase slowly

- GIVEN a learner on the first phrase of Ode to Joy presses Listen
- WHEN the phrase plays
- THEN only the notes of that phrase sound, at a slow tempo, with the keys lighting as they sound
- AND playback stops by itself at the end of the phrase and the view is told it finished

#### Scenario: Range containing no notes

- GIVEN a range with no onsets
- WHEN it is requested
- THEN completion is reported immediately and nothing sounds

#### Scenario: Listen interrupted

- GIVEN a phrase is playing
- WHEN the learner presses a key or leaves the view
- THEN scheduled notes are cancelled with no stuck or doubled note

#### Scenario: Single hand

- GIVEN a range played for the left hand only
- WHEN it plays
- THEN right-hand notes do not sound

### Requirement: Single-note playback for the learner

The engine MUST expose immediate note start and note release for one pitch independent of any song, used for the learner's own key presses and for ear drills. A started note MUST sound at the current audio time with no look-ahead delay, MUST continue until released, and MUST obey the same voice cap as scheduled notes. A release MUST apply the release envelope without a click. A "release all" MUST silence every learner note, and the view MUST call it on blur, on route change and on MIDI disconnect. Single-note playback MUST work when a private song is open, because the notes are the learner's own.

#### Scenario: First press wakes the audio

- GIVEN the audio context is suspended and a person taps their first on-screen key
- WHEN the tap happens
- THEN the context is resumed in that gesture and the note sounds

#### Scenario: Key held and released

- GIVEN a person holds a computer key for two seconds
- WHEN they release it
- THEN the note sounded for the whole time and then fades without a click

#### Scenario: Window loses focus with a key down

- GIVEN a key is held
- WHEN the window loses focus
- THEN every learner note is released

#### Scenario: Many fingers at once

- GIVEN more simultaneous learner notes than the voice cap
- WHEN they are started
- THEN the oldest are released first and nothing throws

#### Scenario: Learner plays while a private song is open

- GIVEN a private song lesson is open
- WHEN the learner presses a key
- THEN their note sounds even though the song itself is silent

### Requirement: Sampled piano sound with synthesized fallback

Once a sample set has been approved and recorded in `docs/STACK_TECNOLOGICO.md`, the voice layer MUST play a piano from static audio samples (sparse sample points, one velocity layer) pitched between sample points by changing playback rate, never by more than 3 semitones from the nearest sample, with no npm library. Samples MUST load lazily after the first user gesture or first use, MUST NOT block page start, and a note requested before its sample is ready, a missing file or a decode failure MUST be played by the oscillator synthesizer instead, with no error shown. The oscillator voice with its attack-decay-sustain-release envelope MUST remain as the automatic fallback and as the only voice before approval. Note release MUST apply without clicks and the number of simultaneous voices MUST be bounded for both voices. The sample set's license credit MUST be visible in the app, a license file MUST sit beside the samples, nginx and `tools/serve.mjs` MUST serve the audio files with a correct audio content type and long-cache headers for that folder, and no audio file MAY exist in the repository without a matching stack entry. Both Listen (public songs) and the learner's own presses MUST use this same voice.
(Previously: the requirement "Synthesized piano-like sound" demanded oscillators only, no samples and no new dependency.)

#### Scenario: Before approval nothing changes

- GIVEN no sample dependency has been approved
- WHEN the app plays any note
- THEN the oscillator synthesizer is used and the repository has no audio sample file

#### Scenario: Sample not yet loaded

- GIVEN samples are approved but still downloading
- WHEN a person presses a key
- THEN the note sounds immediately with the synthesizer and later notes use the piano

#### Scenario: Sample files missing or corrupt

- GIVEN a sample file returns 404 or fails to decode
- WHEN a note that needs it is played
- THEN the synthesizer plays it and no error is shown to the learner

#### Scenario: Pitching distance

- GIVEN any note in the supported range
- WHEN the voice picks a sample
- THEN the chosen sample is at most 3 semitones from the note

#### Scenario: Voice cap

- GIVEN more simultaneous notes than the voice cap
- WHEN they are scheduled
- THEN the oldest voices are released first and playback does not throw

#### Scenario: Attribution and stack record

- GIVEN approved samples are in the repository
- WHEN the app and the repository are inspected
- THEN a visible credit names the author and license, a license file is beside the samples, and `docs/STACK_TECNOLOGICO.md` has the entry added in the same commit

#### Scenario: Unrecorded audio asset

- GIVEN an audio file under `assets/` without a stack entry
- WHEN the guard test runs
- THEN it fails naming the file

