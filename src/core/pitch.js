// Pure pitch helpers. Spelled pitch strings ("Eb4") are the data format; MIDI is derived.
// Scientific pitch notation: C4 = MIDI 60.
//
// Contract for malformed input: parsePitch, noteName and transpose return null
// (they never throw), so callers decide how to report the problem. The schema
// validator turns a null into an error with the JSON path.

export const MIDI_MIN = 21; // A0
export const MIDI_MAX = 108; // C8

const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const ACCIDENTAL_ALTER = { "": 0, "#": 1, b: -1, "##": 2, bb: -2 };
const ALTER_TEXT = { 0: "", 1: "#", "-1": "b", 2: "##", "-2": "bb" };
const SOLFEGE = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };

const PITCH_RE = /^([A-G])(##|bb|#|b)?(-?\d{1,2})$/;

/** "Eb4" -> { letter: "E", alter: -1, octave: 4, midi: 63 }, or null when unparsable. */
export function parsePitch(s) {
  if (typeof s !== "string") return null;
  const m = PITCH_RE.exec(s);
  if (!m) return null;
  const letter = m[1];
  const alter = ACCIDENTAL_ALTER[m[2] ?? ""];
  const octave = Number(m[3]);
  return { letter, alter, octave, midi: (octave + 1) * 12 + NATURAL_PC[letter] + alter };
}

/** True when the MIDI number is on an 88-key piano (A0 to C8). */
export function inPianoRange(midi) {
  return Number.isInteger(midi) && midi >= MIDI_MIN && midi <= MIDI_MAX;
}

function asParsed(pitch) {
  return typeof pitch === "string" ? parsePitch(pitch) : pitch;
}

/**
 * Display name from the WRITTEN spelling, never re-spelled:
 * mode "solfege": Eb4 -> "Mib"; mode "letters": Eb4 -> "Eb". Null when unparsable.
 */
export function noteName(pitch, mode) {
  const p = asParsed(pitch);
  if (!p || !(p.letter in NATURAL_PC)) return null;
  const accidental = ALTER_TEXT[p.alter];
  if (accidental === undefined) return null;
  if (mode === "solfege") return SOLFEGE[p.letter] + accidental;
  if (mode === "letters") return p.letter + accidental;
  return null;
}

// Major-scale position of each letter on the circle of fifths (C = 0, F = -1).
const FIFTHS_OF_MAJOR = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, F: -1 };

/** Number of sharps (positive) or flats (negative) of a key { tonic, mode }, or null. */
export function keyFifths(key) {
  const t = key && typeof key.tonic === "string" ? parsePitch(`${key.tonic}4`) : null;
  if (!t || (key.mode !== "major" && key.mode !== "minor")) return null;
  const major = FIFTHS_OF_MAJOR[t.letter] + 7 * t.alter;
  return key.mode === "major" ? major : major - 3;
}

/** Semitones above the tonic of the seven degrees of a major scale. */
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

// Spelled scale of the key as [{ letter, alter }] indexed by pitch class (0..11).
function scaleSpellings(key) {
  const t = parsePitch(`${key.tonic}4`);
  const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS;
  const startLetter = LETTERS.indexOf(t.letter);
  const byPc = new Map();
  steps.forEach((step, degree) => {
    const letter = LETTERS[(startLetter + degree) % 7];
    const pc = (((NATURAL_PC[t.letter] + t.alter + step) % 12) + 12) % 12;
    let alter = pc - NATURAL_PC[letter];
    if (alter > 6) alter -= 12;
    if (alter < -6) alter += 12;
    byPc.set(pc, { letter, alter });
  });
  return byPc;
}

const SHARP_SPELLING = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_SPELLING = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/**
 * Moves a pitch by `semitones`. The spelling follows the TARGET key: a note that
 * belongs to the key's scale takes the scale spelling (D# in E major, Eb in
 * Eb major); other notes use sharps for sharp keys and flats for flat keys.
 * Without a valid key, sharps are used. Returns a pitch string, or null when the
 * input pitch is unparsable.
 */
export function transpose(pitch, semitones, key) {
  const p = asParsed(pitch);
  if (!p || !Number.isFinite(semitones)) return null;
  const midi = p.midi + Math.round(semitones);
  const pc = ((midi % 12) + 12) % 12;
  const fifths = keyFifths(key);

  let letter;
  let alter;
  const scaled = fifths === null ? undefined : scaleSpellings(key).get(pc);
  if (scaled) {
    ({ letter, alter } = scaled);
  } else {
    const text = fifths !== null && fifths < 0 ? FLAT_SPELLING[pc] : SHARP_SPELLING[pc];
    letter = text[0];
    alter = ACCIDENTAL_ALTER[text.slice(1)];
  }
  const octave = (midi - NATURAL_PC[letter] - alter) / 12 - 1;
  return `${letter}${ALTER_TEXT[alter]}${octave}`;
}

const OCTAVE_MIN = -1;
const OCTAVE_MAX = 9;

/**
 * "E", 1, 4 -> "E#4". Null when the letter is not A to G, the alteration is outside -2..2 (a double
 * accidental is the most the pitch format spells), or the octave is outside -1..9.
 */
export function pitchFromParts(letter, alter, octave) {
  if (!Object.hasOwn(NATURAL_PC, letter) || !Number.isInteger(alter) || !Object.hasOwn(ALTER_TEXT, alter) || !Number.isInteger(octave)) return null;
  if (octave < OCTAVE_MIN || octave > OCTAVE_MAX) return null;
  return `${letter}${ALTER_TEXT[alter]}${octave}`;
}

// Spells `midi` on `letter` in the octave numbered by that letter; null beyond a double accidental.
function onLetter(letter, letterOctave, midi) {
  return pitchFromParts(letter, midi - ((letterOctave + 1) * 12 + NATURAL_PC[letter]), letterOctave);
}

/**
 * Moves the letter by `steps` (letter names, so D to B is -2) and the sound by `semitones`, keeping
 * the letter arithmetic: transposeInterval("D5", -2, -4) is "Bb4". Unlike `transpose`, which spells
 * by key, this keeps a chromatic tone on the letter its degree asks for. Null when the pitch is
 * unparsable or the result needs more than a double accidental or leaves octaves -1..9.
 */
export function transposeInterval(pitch, steps, semitones) {
  const p = asParsed(pitch);
  if (!p || !Number.isInteger(steps) || !Number.isInteger(semitones)) return null;
  const index = LETTERS.indexOf(p.letter) + steps;
  return onLetter(LETTERS[((index % 7) + 7) % 7], p.octave + Math.floor(index / 7), p.midi + semitones);
}

/**
 * Scale degree to spelled pitch in a major key: the letter follows the degree number, the
 * accidental is the semitone distance from the major-scale tone (plus `alter`), and octave
 * offset 0 puts the tonic in octave 4. spellDegree({ tonic: "E", mode: "major" }, 7, -1, 0) is "D5".
 * Null for a degree outside 1..7, a key that is not a spelled major tonic, or an out-of-range result.
 */
export function spellDegree(key, degree, alter, octaveOffset) {
  const tonic = key && key.mode === "major" && typeof key.tonic === "string" ? parsePitch(`${key.tonic}4`) : null;
  if (!tonic || !Number.isInteger(degree) || degree < 1 || degree > 7 || !Number.isInteger(alter) || !Number.isInteger(octaveOffset)) return null;
  const index = LETTERS.indexOf(tonic.letter) + degree - 1;
  const midi = tonic.midi + 12 * octaveOffset + MAJOR_STEPS[degree - 1] + alter;
  return onLetter(LETTERS[index % 7], 4 + octaveOffset + Math.floor(index / 7), midi);
}
