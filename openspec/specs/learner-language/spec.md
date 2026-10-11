# Learner Language Specification

## Purpose

Learner-facing text is available in English and Spanish, chosen by the learner and remembered. Every case is explained in simple words. Scope: Learn mode, lesson zero, Practice exercises and the catalog actions that lead to them; the rest of the player stays English unless a slice touches it.

## Requirements

### Requirement: Language selector, remembered

The system MUST offer a visible selector with "English" and "Español" in the catalog, the Learn view and the exercises section. The first visit MUST default to Spanish when the browser language starts with `es` and to English otherwise. The choice MUST be saved in `localStorage`, applied on every later visit, and set the document language attribute. A change MUST apply immediately to all visible learner text without reloading and without losing position or state.

#### Scenario: First visit with a Spanish browser

- GIVEN a browser whose language is `es-SV` and no saved choice
- WHEN the catalog opens
- THEN the learner text is in Spanish and the selector shows "Español"

#### Scenario: Choice is remembered

- GIVEN the learner selects English on a Spanish browser
- WHEN they reload
- THEN the text is English

#### Scenario: Switch in the middle of a lesson

- GIVEN a learner on step 4 of a phrase
- WHEN they switch language
- THEN the instruction, buttons and captions change at once and the step, hand, key and accumulated presses are unchanged

#### Scenario: Storage blocked

- GIVEN `localStorage` is unavailable
- WHEN the learner selects Spanish
- THEN the page switches for the session and shows no error

### Requirement: Every string exists in both languages

Every learner-facing string key MUST have a non-empty English and Spanish value. A test MUST fail when a key lacks either value or when a template placeholder present in one language is missing in the other. At run time a missing value MUST fall back to English and never show a raw key.

#### Scenario: Complete catalog of strings

- GIVEN the string tables
- WHEN the completeness test runs
- THEN every key has both values and matching placeholders

#### Scenario: Deliberately missing Spanish value

- GIVEN a fixture table where one key lacks Spanish
- WHEN the completeness test runs on the fixture
- THEN it fails naming the key

#### Scenario: Missing value at run time

- GIVEN a key without Spanish text reaches the screen in Spanish mode
- WHEN it renders
- THEN the English text shows

### Requirement: Instruction templates with parameters

Step instructions, feedback and exercise texts MUST be built from templates with parameters: hand, finger name, note name, key count, direction and position. English finger names are thumb, index, middle, ring, little finger; Spanish are pulgar, índice, medio, anular, meñique. Plural and singular forms ("1 key", "3 keys"; "1 tecla", "3 teclas") MUST be correct. Spanish MUST be neutral and use the formal imperative ("Presione", "Toque", "Mueva") and MUST NOT use voseo.

#### Scenario: Single and plural

- GIVEN a one-key step and a three-key step
- WHEN the instructions render in English
- THEN the first never says "1 keys" and the second says "3 keys together"

#### Scenario: Spanish register

- GIVEN every Spanish template
- WHEN scanned by the register guard test for a listed set of voseo forms (second person singular with the "vos" stress, for example "podés", "mirá", "tocá")
- THEN none is found

#### Scenario: Note naming in both languages

- GIVEN the note E
- WHEN a template names it in either language
- THEN it appears as the solfege and the letter, "Mi (E)" and "E (Mi)" being the two orders the templates use

### Requirement: Names of music terms

Intervals, chord qualities, hand names, stage names, position words, "Correct", "Try again", "Listen", "My turn", "Continue", "Start over" and "Reset progress" MUST each have a defined pair of strings. Solfege MUST be fixed-do (Do Re Mi Fa Sol La Si) in both languages.

#### Scenario: Fixed-do

- GIVEN a G key in either language
- WHEN named
- THEN it shows "Sol (G)"

#### Scenario: Interval names

- GIVEN an ear drill answer set
- WHEN shown in Spanish
- THEN the options read in Spanish ("tercera mayor", "quinta justa", "octava")

### Requirement: Language of song data

Song titles and composer names MUST NOT be translated. Song text (lesson, hint, title) follows the localized text rule in song-data-model with fallback to English.

#### Scenario: Title unchanged

- GIVEN the learner chose Spanish
- WHEN the catalog shows "Ode to Joy"
- THEN the title is not translated

### Requirement: Spanish text typography

Spanish strings MUST be written with correct accents and the opening question and exclamation marks, and every string MUST use plain straight quotes and plain hyphens only (no typographic dashes, curly quotes or arrows).

#### Scenario: Typography guard

- GIVEN all strings
- WHEN the typography test scans them
- THEN no forbidden character is found and a fixture containing one fails the test
