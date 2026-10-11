# Note Input Specification

## Purpose

One input bus delivers note-on and note-off events from three sources: on-screen keys (pointer and touch), a computer-keyboard map, and Web MIDI. The matcher and the sound path never know which source produced an event. A learner with no MIDI device is never blocked.

## Requirements

### Requirement: One bus, three sources

The system MUST provide one event bus emitting `noteOn` and `noteOff` with at least the MIDI note number and the source (`screen`, `computer`, `midi`); MIDI events MUST also carry velocity. Consumers (the step matcher, the keyboard states, the learner-sound rule) MUST subscribe to the bus only. Detaching a view MUST detach its subscriptions and release held notes.

#### Scenario: Same event from every source

- GIVEN the learner presses E by click, by computer key, and on the Casio
- WHEN each press arrives
- THEN the bus emits `noteOn` for the same note number each time, differing only in source

#### Scenario: Leaving the view

- GIVEN keys are held and the learner navigates away
- WHEN the view closes
- THEN `noteOff` is emitted for every held note and listeners are removed

### Requirement: Computer-keyboard map

The computer keyboard MUST map, by physical key position, a documented set of keys over the current hand region: a home row of at least 10 keys for white keys and the row above for black keys in the piano-like arrangement. The map MUST move with the region. Key presses with Ctrl, Alt or Meta, key presses while a text, number or select control has focus (for example the BPM box), and presses of keys outside the map MUST NOT produce notes and MUST NOT be prevented from their normal behavior. Held-key auto-repeat MUST NOT emit repeated `noteOn`. The map MUST be documented in the README.

#### Scenario: A person plays with the keyboard

- GIVEN the computer keyboard input is on and the keys show their letters
- WHEN the person presses the letter drawn on the E key
- THEN E sounds and lights

#### Scenario: Typing in the BPM box

- GIVEN focus is in the BPM box
- WHEN the person types digits and letters
- THEN no note sounds

#### Scenario: Browser shortcut

- GIVEN the person presses Ctrl+R
- WHEN the event arrives
- THEN no note sounds and the page reloads as usual

#### Scenario: Key held

- GIVEN a mapped key is held and auto-repeat fires
- WHEN repeats arrive
- THEN only one `noteOn` is emitted until the key is released

#### Scenario: Different keyboard layout

- GIVEN a person with a Spanish layout
- WHEN they press the physical key shown on the screen legend
- THEN the expected note plays

#### Scenario: Window loses focus

- GIVEN keys are held
- WHEN the window loses focus
- THEN `noteOff` is emitted for each

### Requirement: On-screen keys

The on-screen keys of learn-keyboard MUST emit `noteOn` on pointer or touch down and `noteOff` on release, leave or cancel, with multi-touch giving several notes.

#### Scenario: Tap

- GIVEN a person taps a key
- WHEN the tap ends
- THEN `noteOn` then `noteOff` are emitted for that key

#### Scenario: Touch cancelled by the browser

- GIVEN a touch is cancelled by a system gesture
- WHEN the cancel arrives
- THEN `noteOff` is emitted

### Requirement: Web MIDI detection and permission

The system MUST feature-detect Web MIDI. Permission MUST be requested only from a click on a "Connect piano" action, never at page load. When granted, every available MIDI input MUST be listened to, the connected device name MUST be shown, and devices connected or disconnected later MUST be followed without a reload. `noteOn` with velocity 0 MUST be treated as `noteOff`; messages other than note on and note off MUST be ignored without error.

#### Scenario: Owner connects the Casio

- GIVEN a Casio that exposes MIDI is connected over USB and the browser supports Web MIDI
- WHEN the owner presses "Connect piano" and allows the permission
- THEN the panel shows the device name as the browser reports it
- AND a key pressed on the Casio lights the on-screen key

#### Scenario: Plug in after connecting

- GIVEN permission was granted with no device
- WHEN the owner plugs the Casio in
- THEN its name appears with no reload

#### Scenario: Unplugged mid-lesson

- GIVEN a MIDI device is in use with keys held
- WHEN the cable is removed
- THEN the device name is replaced by the no-device line, held notes are released, and the lesson stays on the same step

#### Scenario: Note-on with zero velocity

- GIVEN a device sends note-on with velocity 0
- WHEN it arrives
- THEN it is handled as a release

#### Scenario: Pedal and other messages

- GIVEN the device sends sustain-pedal and clock messages
- WHEN they arrive
- THEN they are ignored and nothing breaks

### Requirement: Graceful states without MIDI

When the browser has no Web MIDI support, when the page is not in a secure context, when permission is denied or dismissed, or when no MIDI input device is found (for example a Casio that exposes only USB audio), the input panel MUST say so in one line with one short hint, MUST keep the two other inputs fully working, and MUST NOT show an error dialog or block the lesson.

#### Scenario: Casio exposes only audio

- GIVEN the Casio is connected but only as a USB audio device
- WHEN the owner presses "Connect piano" and allows the permission
- THEN the MIDI chip reads "MIDI: no device" ("MIDI: sin dispositivo") and one line says "No MIDI device found. Use the computer keys or tap the keys." ("No se encontró ningún dispositivo MIDI. Use el teclado de la computadora o toque las teclas.")
- AND the lesson continues with the other inputs

#### Scenario: Safari without Web MIDI

- GIVEN a browser without Web MIDI
- WHEN the panel shows
- THEN one line says MIDI is not available in this browser and the other inputs work

#### Scenario: Permission denied

- GIVEN the learner denies the permission
- WHEN the browser reports denial
- THEN one line says permission was denied and how to allow it, and nothing else changes

#### Scenario: Insecure page

- GIVEN the page is served over plain HTTP from a non-local host
- WHEN the panel shows
- THEN one line says MIDI needs a secure page

### Requirement: Learner sound rules

The learner's own presses MUST sound through the app for on-screen and computer-keyboard input, immediately and for as long as held. For MIDI input the app's sound MUST be controlled by a setting whose default is off (the digital piano already sounds) and which is remembered. The sound MUST be the same voice used for Listen. Presses sound whether they are right or wrong. The note events MUST NOT be delayed by the matcher.

#### Scenario: Computer keyboard sounds

- GIVEN a person presses a mapped computer key
- WHEN the press arrives
- THEN they hear the note at once

#### Scenario: Casio is not doubled

- GIVEN MIDI input and the default setting
- WHEN the owner plays a key on the Casio
- THEN only the Casio sounds and the app is silent

#### Scenario: Owner wants app sound from MIDI

- GIVEN the owner switches on "Sound from the app for MIDI"
- WHEN they play a key on the Casio
- THEN the app also sounds the note and the setting is still on after a reload

#### Scenario: Wrong key is heard too

- GIVEN a wrong key is pressed on the computer keyboard
- WHEN it arrives
- THEN it sounds like any key

#### Scenario: Private song

- GIVEN a private song lesson and an on-screen press
- WHEN it arrives
- THEN the learner's note sounds, and nothing from the song itself does

### Requirement: Input panel is compact and self-explanatory

The input panel MUST show for each source its state as a short chip (for example "Computer keys: on", "MIDI: Casio CDP-S100" or "MIDI: no device"), the single "Connect piano" action and the MIDI sound setting; it MUST NOT contain paragraphs.

#### Scenario: Panel at a glance

- GIVEN a learner who has never seen the app
- WHEN the panel shows
- THEN each input's state reads as one short chip and the only action is "Connect piano"
