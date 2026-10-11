# Practice Exercises Specification

## Purpose

A section (`#/practice`) of repeatable drills for harmony and technique, generated from music theory (see music-theory-generators), so there is nothing to copy and no copyright. Each exercise explains itself in a short bilingual doc card, can be repeated with a metronome, tempo ramp and key rotation, is checked through MIDI, computer keyboard or taps, and records simple local progress. A 10-minute routine builds a daily session from the learner's progress. This is Milestone C.

## Requirements

### Requirement: Exercise catalog

The section MUST list these exercises, grouped and labelled by what they do: five-finger patterns; major scales (one and two octaves; right hand, left hand, then together); triads and inversions; arpeggios; cadences (I-IV-V-I) and progressions (I-vi-IV-V, I-V-vi-IV); interval ear drill; chord ear drill; and the 10-minute routine. Each MUST be reachable at `#/practice/<exercise-id>`. Exercise content MUST be generated, not stored as files. Scales MUST be suggested in the order C, G, D, F, then the rest, without locking the others.

#### Scenario: A learner opens the section

- GIVEN the learner opens "Practice exercises"
- WHEN the page shows
- THEN the groups listed above appear with short action names and no paragraph

#### Scenario: Scale order suggested, not enforced

- GIVEN a learner who has not done any scale
- WHEN they open the scale exercise
- THEN C major is pre-selected and "G, D, F" are marked as next, and the other keys are selectable

#### Scenario: Unknown exercise id

- GIVEN the hash is `#/practice/does-not-exist`
- WHEN it resolves
- THEN a plain "exercise not found" message with a link back to the section is shown

### Requirement: Doc card for every exercise

Every exercise MUST have a bilingual doc card with: goal, why it matters, how to do it, what good looks like, and suggested tempo steps (each within the BPM bounds of the engine). The card MUST be one tap away from the exercise, each heading one line, the whole card short. A test MUST fail when an exercise lacks any of the five fields in either language.

#### Scenario: A person who has never played reads the C major scale card

- GIVEN the C major scale exercise
- WHEN the learner opens its card
- THEN they read the goal, why it matters, how to do it with fingers, what a good run sounds and feels like, and tempo steps such as 50, 60, 72, 88

#### Scenario: Card in Spanish

- GIVEN Spanish is selected
- WHEN the card opens
- THEN every field is in Spanish

#### Scenario: Missing field

- GIVEN a fixture exercise without "what good looks like"
- WHEN the completeness test runs on the fixture
- THEN it fails naming the exercise and field

### Requirement: Running an exercise

An exercise run MUST show the notes to play as steps on the learn-keyboard with finger numbers and the same waiting and feedback rules as learn-mode (right key advances, wrong key shows "Try again", keys of the step accumulate in any order). A run is clean when it finishes without any wrong key. After a run the learner MUST be offered "Again" and "Next key". Stages for scales and arpeggios: right hand, left hand, then hands together (a hands-together step expects the keys of both hands). Timing is not graded; the metronome and tempo are for pacing.

#### Scenario: Play a C major scale with the fingering shown

- GIVEN the learner opens the C major scale, right hand, one octave
- WHEN they press C, D, E in order with fingers 1, 2, 3 shown on the keys
- THEN each press shows "Correct" and the next key is shaded with its finger number, ending after the high C

#### Scenario: Wrong key makes the run unclean

- GIVEN a run in progress
- WHEN the learner presses a wrong key
- THEN "Try again" shows, the step stays, and the run will be recorded as not clean

#### Scenario: Hands together

- GIVEN the learner selects "Together"
- WHEN a step shows
- THEN both hands' keys are shaded and the step needs all of them

#### Scenario: No input device

- GIVEN no MIDI device
- WHEN the learner runs an exercise
- THEN taps and the computer keyboard work, the MIDI chip reads "MIDI: no device" and, after "Connect piano" found nothing, the hint line reads "No MIDI device found. Use the computer keys or tap the keys." (same strings as note-input)

#### Scenario: Run repeated

- GIVEN a run finished
- WHEN the learner presses "Again"
- THEN the same exercise restarts at step 1 with the same key and tempo

### Requirement: Metronome, tempo ramp and key rotation

An exercise MUST offer the metronome (reusing the engine and `core/practice`), a tempo ramp that suggests the next tempo of the card's steps after each clean run (never beyond the last step or the BPM maximum), and key rotation with three orders: a fixed list chosen by the learner, random, and around the circle of fifths. When a run ends the next key MUST be announced in one line and the keyboard MUST reframe to it. Tempo is a pacing aid: a "clean run at tempo T" means a run without a wrong key while the metronome was set to T, and timing is not verified.

#### Scenario: Ramp after a clean run

- GIVEN a clean run at 60 BPM with steps 50, 60, 72, 88
- WHEN the run ends
- THEN 72 BPM is suggested for the next run

#### Scenario: Ramp stops at the last step

- GIVEN a clean run at 88 BPM, the last step
- WHEN the run ends
- THEN the suggestion stays at 88 and says "top tempo of this card"

#### Scenario: Unclean run does not ramp

- GIVEN a run with a wrong key at 72 BPM
- WHEN the run ends
- THEN the suggested tempo stays 72

#### Scenario: Circle of fifths rotation

- GIVEN rotation "circle of fifths" starting at C on the major scale
- WHEN the learner finishes C and presses "Next key"
- THEN G is announced and the keyboard shows the G scale with its fingering

#### Scenario: Random rotation does not repeat immediately

- GIVEN random rotation
- WHEN twelve keys are used
- THEN each key appears once before any repeats

#### Scenario: Metronome on

- GIVEN the metronome is on at 72 BPM
- WHEN the learner starts a run
- THEN clicks sound at 72 BPM with an accented first beat and stop when the run ends or the view closes

### Requirement: Ear drills

The interval and chord ear drills MUST play a question through the engine's single-note and chord playback (the same piano voice), show the answer options as buttons labelled in the learner's language, and also accept the answer by playing it back on the keyboard. The learner MUST be able to hear the question again any number of times. After an answer the drill MUST say "Correct" or "Try again", reveal the correct answer on the second wrong attempt, and move on to the next question on request. The session MUST show a count such as 7/10. Options start with a small set (major third, perfect fifth, octave; or major and minor triads) and MAY grow with accuracy.

#### Scenario: Identify an interval

- GIVEN the drill plays C4 then E4
- WHEN the learner presses "Major third"
- THEN "Correct" shows and the count increases

#### Scenario: Wrong answer twice

- GIVEN the learner picks wrong options twice
- WHEN the second wrong pick arrives
- THEN the correct option is highlighted with its name

#### Scenario: Play it back

- GIVEN the drill played a minor triad rooted on A
- WHEN the learner plays A, C and E on the keyboard
- THEN the answer is accepted as correct

#### Scenario: Hear again

- GIVEN a question
- WHEN the learner presses "Listen again" five times
- THEN it plays five times with no penalty

#### Scenario: Audio blocked

- GIVEN the browser has not yet allowed audio
- WHEN the learner presses "Listen"
- THEN audio resumes in that gesture and the question plays

#### Scenario: Reproducible in tests

- GIVEN a fixed seed
- WHEN the session generates questions
- THEN the question sequence is the same each time

### Requirement: Local progress per exercise and key

The system MUST save in `localStorage`, per exercise and key: the clean streak (consecutive clean runs, reset by an unclean run), the best clean tempo, the count of clean runs and the date of last practice. A summary MUST be visible in the section and on each exercise the next day. A missing, corrupt or blocked `localStorage` MUST NOT break exercises and MUST show no error. "Reset progress" MUST clear exercise progress after one confirmation.

#### Scenario: Streak and best tempo

- GIVEN two clean runs at 60 then one clean run at 72 on the G scale
- WHEN the learner opens the G scale tomorrow
- THEN the clean streak is 3 and the best clean tempo is 72

#### Scenario: Unclean run resets the streak

- GIVEN a streak of 3
- WHEN the next run has a wrong key
- THEN the streak becomes 0 and the best tempo is unchanged

#### Scenario: Corrupt data

- GIVEN the saved value is not valid JSON
- WHEN the section opens
- THEN it starts empty and shows no error

#### Scenario: Reset

- GIVEN saved progress
- WHEN the learner resets and confirms
- THEN the summary is empty

### Requirement: The 10-minute routine

The routine generator MUST build a session from, in order: a warm-up five-finger pattern, one major scale, one chord or cadence drill, and one ear drill, with suggested minutes per block adding up to between 9 and 11 minutes. It MUST choose the keys from the learner's progress: the scale key is the key practiced least recently or never, preferring the introduction order C, G, D, F then the rest; the warm-up key follows the circle of fifths from the last warm-up; the result MUST be deterministic for the same progress and date and MUST differ on consecutive days when the learner practiced. The learner MUST be able to skip a block, MUST see which block is current, and MUST see a summary at the end listing each block as done or skipped and "N days in a row" ("N días seguidos"). Reaching the end records the day when at least one block was done; a routine where every block was skipped records nothing and leaves the day streak unchanged.

#### Scenario: First day

- GIVEN a learner with no progress
- WHEN they start the routine
- THEN it builds a C five-finger warm-up, a C major scale, a chord or cadence drill and an ear drill, summing to about 10 minutes

#### Scenario: Next day rotates the keys

- GIVEN the learner finished the routine yesterday with a C scale and a C warm-up
- WHEN they start it today
- THEN the scale key is G and the warm-up key is different from yesterday's

#### Scenario: Same day, same routine

- GIVEN unchanged progress and date
- WHEN the routine is built twice
- THEN the two are identical

#### Scenario: Skip a block

- GIVEN the routine is on the ear drill
- WHEN the learner presses "Skip"
- THEN the summary shows that block as skipped and the routine ends
- AND because earlier blocks were done, the day is recorded

#### Scenario: Everything skipped

- GIVEN the learner skips all four blocks
- WHEN the routine ends
- THEN the summary shows four skipped blocks, the day is not recorded and the day streak is unchanged

#### Scenario: Finish end to end

- GIVEN a learner finishes all four blocks
- WHEN the last block ends
- THEN a summary shows what was practiced and "1 day in a row", and the day is recorded

#### Scenario: Progress visible the next day

- GIVEN the learner finished yesterday
- WHEN they open Practice exercises today
- THEN yesterday's streak and best tempos are visible

### Requirement: Language and state during an exercise

All exercise text MUST follow the language selector, and switching language mid-exercise MUST NOT change the exercise, step, key, tempo or accumulated presses.

#### Scenario: Switch in the middle of a scale

- GIVEN the learner is on step 5 of the G scale
- WHEN they switch to Spanish
- THEN the texts change and they stay on step 5 in G
