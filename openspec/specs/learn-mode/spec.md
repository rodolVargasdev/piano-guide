# Learn Mode Specification

## Purpose

A guided lesson that behaves like a patient teacher for a person who has never played the piano. It shows one small instruction at a time, waits until the learner plays the right keys, says "Correct" or "Try again", and moves on. Public-domain songs are played for the learner first (Listen, then My turn). Private songs are never played by the app. The existing player remains as "Play along". Field names (`visibility`, `learn`, `learn.phrases`, `learn.transposeTo`, `LocalizedText`) are defined in song-data-model.

Milestones: requirements marked (A) belong to Milestone A, (B) to Milestone B.

## Requirements

### Requirement: Learn route and starting screen (A)

The system MUST provide the route `#/learn/<id>` showing the lesson for the song's default level. The first screen MUST show the song title, one primary action ("Start", or "Continue" when saved progress exists for this song, level and key), the language selector, the input panel (see note-input) and, for a song with `learn.transposeTo`, the transposition toggle. A learner who has never opened lesson zero MUST be offered it as a clearly labelled optional action before the first phrase. A level selector MUST appear only when the song has more than one level with notes.

#### Scenario: First visit by a person who has never played

- GIVEN a person opens the Learn view for Ode to Joy for the first time
- WHEN the first screen appears
- THEN they see the title, a "Start" button, a way to choose English or Spanish, and an offer of "Lesson zero"
- AND nothing else competes for attention

#### Scenario: Returning learner

- GIVEN saved progress exists for this song, level and key
- WHEN the learner opens the Learn view
- THEN the primary action reads "Continue" and a secondary action offers "Start over"

#### Scenario: Song with a single level

- GIVEN a song with one level
- WHEN the first screen appears
- THEN no level selector is shown

### Requirement: Phrases and steps derived from song data (A)

The system MUST derive an ordered lesson from the chosen level using pure functions. A phrase is an authored `learn.phrases` entry when present; otherwise phrases MUST be cut automatically to about 2 bars and MUST be cut at rests when a rest lies within the second bar boundary window (a phrase never splits a sounding note group). A step is "the next onset group of one hand": all notes of that hand that start at the same tick. A step MUST carry: the keys to press, the finger for each key, the five-finger hand position the hand is in, whether the hand must move to reach it (a shift), and one instruction. Steps of the left hand and the right hand are separate lessons selected by a hand selector (right hand is the default). Rests produce no step. Tied notes produce one step at the first onset. Grace notes are not steps.

#### Scenario: A melody becomes steps

- GIVEN a right-hand melody of eight single notes in one phrase
- WHEN the lesson is derived
- THEN the phrase has eight steps, each with one key, one finger and one instruction

#### Scenario: A chord becomes one step

- GIVEN three right-hand notes starting at the same tick
- WHEN the lesson is derived
- THEN they form one step whose key set holds the three keys

#### Scenario: Phrase cut at a rest

- GIVEN a song without authored phrases and a rest near the end of the second bar
- WHEN phrases are derived
- THEN a phrase ends at that rest and the next begins after it

#### Scenario: Authored phrases win

- GIVEN a level with `learn.phrases`
- WHEN the lesson is derived
- THEN exactly those phrases are used in order

#### Scenario: Left hand lesson

- GIVEN the learner selects "Left hand"
- WHEN the lesson is derived
- THEN only left-hand events produce steps

#### Scenario: Hand with no notes

- GIVEN a level with no left-hand events
- WHEN the learner opens the hand selector
- THEN "Left hand" is shown as unavailable for this song

### Requirement: One instruction at a time, in plain words (A)

At every moment of a lesson the screen MUST state exactly one thing to do next, in at most two short sentences (the second only adds how many keys to press together), built from bilingual templates (see learner-language), naming the hand, the finger, the note in solfege and letter, and how many keys to press together when more than one. The keys to press and their finger numbers MUST be visible on the keyboard without scrolling. Instruction text MUST be at most 25 words and MUST NOT require reading a paragraph. A shift step MUST say the hand moves and where to.

#### Scenario: Single note step

- GIVEN the next step is the right-hand thumb on E
- WHEN the instruction is shown in English
- THEN it reads like "Right hand: thumb on E (Mi)." and the E key shows a "1"

#### Scenario: Chord step

- GIVEN the next step has three keys
- WHEN the instruction is shown in Spanish
- THEN it reads like "Mano derecha: pulgar en Mi (E). Presione estas 3 teclas a la vez."
- AND all three keys are shaded with their finger numbers

#### Scenario: Hand must move

- GIVEN the next step is outside the current five-finger position
- WHEN the instruction is shown
- THEN it states that the hand moves and names the new thumb key

#### Scenario: Instruction length

- GIVEN any step of any shipped or synthetic song
- WHEN its instruction is generated in both languages
- THEN each instruction has at most two sentences and at most 25 words

### Requirement: The app waits for the right keys (A)

The lesson MUST NOT advance until the current step's expected key set has been satisfied. A step is satisfied when every expected key has received a note-on since the step began, in any order and with no time limit between keys, and no unexpected key received a note-on since the step began. Keys already held when the step begins MUST NOT count as pressed and MUST NOT count as wrong until pressed again. A repeated note-on of the same held key (auto-repeat) MUST be ignored. Any note-on of a key not in the expected set is a wrong key: the app MUST show "Try again", MUST keep the expected keys shaded, MUST clear the accumulated keys of this step, and MUST NOT advance. When the step is satisfied the app MUST show "Correct" and advance. The matcher MUST NOT know which input source produced the events.

#### Scenario: No input

- GIVEN a step is shown and the learner does nothing for a minute
- WHEN the minute passes
- THEN the step is unchanged and no failure is shown

#### Scenario: Wrong key pressed

- GIVEN the step expects E and the learner presses F
- WHEN the press arrives
- THEN "Try again" appears, E stays shaded with its finger number, the lesson does not advance and F shows as wrong for a moment

#### Scenario: Right key after a wrong key

- GIVEN the learner pressed F by mistake
- WHEN they press E
- THEN "Correct" appears and the lesson advances

#### Scenario: Chord keys pressed at slightly different times

- GIVEN a three-key step and the learner presses the keys 80 ms, then 200 ms apart
- WHEN the third key arrives
- THEN the step is satisfied without requiring simultaneity

#### Scenario: Chord keys tapped one by one with a single mouse pointer

- GIVEN a three-key step
- WHEN the learner clicks each key in turn, releasing each before the next
- THEN the step is satisfied after the third click

#### Scenario: Chord with one wrong key among the right ones

- GIVEN a three-key step and the learner presses two right keys and then a wrong one
- WHEN the wrong key arrives
- THEN "Try again" shows and the two earlier presses no longer count, so the learner presses all three again

#### Scenario: Key held from the previous step

- GIVEN the learner is still holding the key of the previous step when the next step starts
- WHEN the next step begins
- THEN the held key neither satisfies nor spoils the new step, and pressing it again counts as a new press

#### Scenario: Key held down

- GIVEN a computer key is held and the operating system auto-repeats it
- WHEN repeated note-on events arrive
- THEN only the first counts

#### Scenario: Same result from every input

- GIVEN the same step and the same keys
- WHEN the learner completes it by tapping, by computer keyboard, and by MIDI
- THEN the outcome is identical

### Requirement: Listen first, then My turn, for public songs (A)

For a public song each phrase MUST follow the flow: Listen (the phrase is played slowly by the engine with the keys lighting as they sound), My turn (the step-by-step waiting flow), then "Correct" on completion and an offer to go to the next phrase. Listen MUST be repeatable and skippable. The learner MUST be able to start My turn at any time, which stops Listen. When all phrases are done the app MUST show a short completion message and offer the next stage, Play along, or the catalog.

#### Scenario: Hear it, then play it

- GIVEN a learner on the first phrase of Ode to Joy
- WHEN the phrase screen opens
- THEN a "Listen" action is offered first, the phrase sounds slowly with the keys lighting, and then "My turn" begins

#### Scenario: Skip Listen

- GIVEN the learner presses "My turn" while Listen is playing
- WHEN they do
- THEN Listen stops with no stuck note and the first step is shown

#### Scenario: Listen again

- GIVEN My turn is in progress
- WHEN the learner presses "Listen again"
- THEN the phrase plays again and the learner returns to the same step

#### Scenario: Audio cannot start

- GIVEN the browser blocks audio and the learner has not yet interacted
- WHEN they press Listen
- THEN audio is resumed in that gesture and the phrase plays

#### Scenario: Last phrase done

- GIVEN the learner completes the final step of the final phrase
- WHEN "Correct" is shown
- THEN a completion message appears with the next actions

### Requirement: Private songs are guided silently (A)

For a song with `visibility: "private"` the Learn view MUST NOT offer a Listen action, MUST NOT play any note of the song, and MUST go straight to My turn per phrase. The app only says what to play and shades the keys; the learner's own presses sound according to the note-input rules. Play along for such a song is visual only.

#### Scenario: A learner opens private Cancer

- GIVEN the owner opens the Learn view of the private song
- WHEN the first phrase screen appears
- THEN there is no Listen button and no sound plays
- AND the first step is shown with shaded keys and finger numbers

#### Scenario: Learner's own press is heard

- GIVEN the owner presses the expected key on the computer keyboard
- WHEN the press arrives
- THEN the learner hears their own note and sees "Correct", and nothing else sounds

#### Scenario: Private song on a build without the private library

- GIVEN a public Pages build
- WHEN anyone opens `#/learn/<private-id>`
- THEN a plain "song not found" message is shown

### Requirement: Transposition toggle remembered per song (A)

When the level has `learn.transposeTo`, the Learn view MUST show a toggle "Transpose to C major" (naming the first target) whose default is the original key. Turning it on MUST recompute notes, instructions, finger numbers, shifts and displayed chords for the new key (see music-theory-generators) and MUST keep the learner's place by phrase index. The choice MUST be saved per song in `localStorage` and restored on the next visit. Progress is stored per song and key.

#### Scenario: E major is hard on day one

- GIVEN a learner in E major finds four sharps hard
- WHEN they switch on "Transpose to C major"
- THEN the keyboard, note names, finger numbers and instructions refresh for C major and every key to press is a white key where the melody is diatonic

#### Scenario: Place is kept

- GIVEN the learner is on phrase 2 step 3 in E major
- WHEN they switch to C major
- THEN they are on phrase 2 at its first step and "Correct" counts reset only for that phrase

#### Scenario: Choice is remembered

- GIVEN the learner turned the toggle on
- WHEN they reload and reopen the song
- THEN the toggle is on and the lesson is in C major

#### Scenario: Song without transposition targets

- GIVEN a song without `learn.transposeTo`
- WHEN the Learn view opens
- THEN no transposition toggle is shown

#### Scenario: Fingering stays sensible after transposition

- GIVEN a phrase transposed from E major to C major
- WHEN the fingering is recomputed
- THEN fingers are valid, rise with pitch within each position for the right hand, and the thumb is on a black key only when no white-key position is possible

### Requirement: Language switch mid-lesson (A)

Changing the language MUST update the instruction, buttons, note-name captions and all Learn texts immediately, without reloading, without changing the current phrase, step, hand, key or stage, and without losing keys already accumulated in the current step.

#### Scenario: Switch in the middle of a chord step

- GIVEN a three-key step with two keys already pressed
- WHEN the learner switches from English to Spanish
- THEN the instruction becomes Spanish, the step stays the same and one more correct key completes it

### Requirement: Stages per phrase and per song (B)

For a song with notes in both hands, each phrase MUST be practiced in stages: right hand slow, left hand slow, hands together slow, full tempo; then the whole section, then the whole song. In a hands-together step the expected key set holds the keys of both hands. A song with notes in one hand skips the other hand's stages. The learner MUST be able to move to the next stage after "Correct" on the last step and to repeat a stage. The slow tempo MUST come from the slow-mode fraction and the full tempo from the song tempo, and a metronome toggle MUST be available.

#### Scenario: Both hands

- GIVEN an Ode to Joy phrase with a left hand
- WHEN the learner finishes the right-hand slow stage
- THEN the left-hand slow stage is offered, then hands together slow, then full tempo

#### Scenario: One-handed song

- GIVEN the private song with right-hand melody and left-hand roots but a section with only chords
- WHEN the learner reaches a section with a single hand
- THEN the other hand's stages are skipped without a message demanding action

#### Scenario: Repeat a stage

- GIVEN "Correct" on the last step
- WHEN the learner chooses "Repeat"
- THEN the same stage restarts at its first step

### Requirement: Lesson zero (B)

The system MUST provide a short, skippable, bilingual first lesson with these parts in order: (1) find C using the groups of 2 and 3 black keys, where the learner MUST press a C to continue; (2) sitting and hand posture, shown as a short text with a drawing and a single "Next" action; (3) finger numbers 1 to 5, where the learner presses fingers 1 to 5 on C D E F G in order; (4) how each input works, including how to connect the Casio piano. Completion MUST be saved; a skipped lesson MUST remain reachable.

#### Scenario: A person who has never played finds C

- GIVEN lesson zero part 1 shows a keyboard with the two-black-key groups highlighted and the text "C is the white key just left of the two black keys."
- WHEN the person presses a white key that is not C
- THEN "Try again" appears and the hint stays; when they press any C the lesson continues

#### Scenario: Any C counts

- GIVEN the keyboard shows several Cs
- WHEN the person presses a different C than the one highlighted
- THEN the step is satisfied

#### Scenario: Finger numbers

- GIVEN part 3
- WHEN the person presses C, D, E, F, G in order with the matching key labels shown
- THEN each press is acknowledged and the part completes after G

#### Scenario: Skip

- GIVEN lesson zero is open
- WHEN the person presses "Skip"
- THEN they go to the song, and "Lesson zero" stays available from the first screen

#### Scenario: No MIDI device in part 4

- GIVEN no MIDI input is available
- WHEN part 4 shows how each input works
- THEN it describes taps and the computer keyboard and says in one line that a Casio exposing only audio will not appear as MIDI

#### Scenario: Language chosen in lesson zero

- GIVEN a person chooses Spanish on part 1
- WHEN they continue
- THEN the remaining parts are in Spanish and the choice is remembered

### Requirement: Progress saved and resumable (A for position, B for stage)

The system MUST save in `localStorage` whether lesson zero is done (once for the learner, not per song) and, per song id, level and key: the last phrase and, from Milestone B, the stage and hand. "Continue" MUST resume at that phrase and stage with the saved language and key; "Reset progress" MUST clear the saved entries of this song after one confirmation. A missing, corrupt or unavailable `localStorage` MUST NOT break the lesson: it works for the session without saved progress and shows no error.

#### Scenario: Close and return

- GIVEN the learner stopped on phrase 3 in C major in Spanish
- WHEN they close the browser and reopen the song
- THEN "Continuar" resumes at phrase 3 in C major in Spanish

#### Scenario: Reset

- GIVEN saved progress
- WHEN the learner presses "Reset progress" and confirms
- THEN the saved entries for the song are removed and the first screen shows "Start"

#### Scenario: Corrupt saved data

- GIVEN the saved value is not valid JSON
- WHEN the Learn view opens
- THEN it starts as a first visit and no error appears

#### Scenario: Storage blocked

- GIVEN the browser blocks `localStorage`
- WHEN a lesson is used
- THEN everything works and nothing is saved

### Requirement: Play along stays available (A)

The existing player MUST remain reachable from the Learn view and the catalog as "Play along", unchanged in behavior except that a private song plays visually only.

#### Scenario: Switch to Play along

- GIVEN a learner on a Learn view
- WHEN they choose "Play along"
- THEN the player for the same song opens, any learner note is released and Learn state is kept

### Requirement: Manual usability check with an observable protocol (A, repeated per milestone)

A written protocol in `docs/USABILITY_CHECK.md`, linked from the README, MUST define how usefulness is judged by observing a person, not by unit tests. It MUST contain: participant profile (has never played; at least 2 participants; the owner may take part in the Casio check but does not count as a never-played participant); setup (device, input source, language, song key); tasks; rules (the observer does not help, does not point, does not read aloud); what to record; and pass thresholds. Tasks and thresholds: T1 lesson zero, the participant finds and presses C unaided in at most 2 minutes; T2 the first verse phrase of private Cancer, right hand, in E major and again in C major, reaching "Correct" on every step in at most 10 minutes each; T3 the first phrase of Ode to Joy, listens then plays it in at most 5 minutes; T4 close the browser and return, resuming at the same phrase, stage, key and language; T5 one 10-minute routine run end to end, and progress visible the next day. Recorded per task: time, each step where the participant hesitated more than 10 seconds, each question the participant asked, the wrong-key count, the input used and the date. A task passes only with zero observer help; each hesitation over 10 seconds is logged as a defect candidate. Results MUST be recorded with date, device and input in the slice pull request notes.

#### Scenario: Protocol is observable

- GIVEN the protocol document
- WHEN an observer who has never seen the app follows it
- THEN every task has a start condition, a stop condition, a time limit and a pass rule

#### Scenario: Observer helps

- GIVEN a participant stuck on a step
- WHEN the observer gives a hint
- THEN the task is recorded as failed and the step as a defect candidate

#### Scenario: Participant hesitates

- GIVEN a participant waits 12 seconds on one step before acting
- WHEN the observer records it
- THEN the step id and the wait are logged

#### Scenario: Casio check

- GIVEN the owner with a Casio connected over USB
- WHEN T2 is run with MIDI input
- THEN the record states whether the Casio exposed MIDI and which device name the app showed

#### Scenario: Protocol guard

- GIVEN the repository
- WHEN the documentation guard test runs
- THEN it fails if `docs/USABILITY_CHECK.md` is missing, if it lacks tasks T1 to T5 or their thresholds, or if the README does not link it

### Requirement: Learn mode never needs a network or private data to be tested (A)

All automated tests of steps, matcher, transposition, fingering and instructions MUST use public or synthetic songs and MUST pass in a clean clone without `songs-private/`.

#### Scenario: Clean clone

- GIVEN a clone without private files
- WHEN `node --test` runs
- THEN the learn-mode tests pass using synthetic fixtures
