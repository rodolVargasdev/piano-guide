// Pure chord-symbol parser. "F#/A#" becomes the spelled notes of the chord, built from the root
// by letter steps so an E chord has G# (not Ab) and a Bb chord has D (not C##).
// Contract for malformed input: parseChord returns null and never throws; the lesson card then
// shows the symbol as plain text.

import { parsePitch } from "./pitch.js";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ALTER_TEXT = { "-2": "bb", "-1": "b", 0: "", 1: "#", 2: "##" };

// [letter steps above the root, semitones above the root]
const P1 = [0, 0];
const M2 = [1, 2];
const m3 = [2, 3];
const M3 = [2, 4];
const P4 = [3, 5];
const d5 = [4, 6];
const P5 = [4, 7];
const A5 = [4, 8];
const d7 = [6, 9];
const m7 = [6, 10];
const M7 = [6, 11];
const M9 = [8, 14];

// suffix -> { quality, intervals }
const QUALITIES = {
  "": { quality: "major", intervals: [P1, M3, P5] },
  m: { quality: "minor", intervals: [P1, m3, P5] },
  7: { quality: "dominant7", intervals: [P1, M3, P5, m7] },
  maj7: { quality: "major7", intervals: [P1, M3, P5, M7] },
  m7: { quality: "minor7", intervals: [P1, m3, P5, m7] },
  dim: { quality: "diminished", intervals: [P1, m3, d5] },
  dim7: { quality: "diminished7", intervals: [P1, m3, d5, d7] },
  m7b5: { quality: "half-diminished7", intervals: [P1, m3, d5, m7] },
  aug: { quality: "augmented", intervals: [P1, M3, A5] },
  sus2: { quality: "sus2", intervals: [P1, M2, P5] },
  sus4: { quality: "sus4", intervals: [P1, P4, P5] },
  add9: { quality: "add9", intervals: [P1, M3, P5, M9] },
};

const SYMBOL_RE = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/;
const mod12 = (n) => ((n % 12) + 12) % 12;

/** Spelled pitch string for `midi` written with `letter`, or null when it would need more than a double accidental. */
function spell(letter, midi) {
  const alter = mod12(midi - NATURAL_PC[letter] + 6) - 6;
  if (!(alter in ALTER_TEXT)) return null;
  return { name: `${letter}${ALTER_TEXT[alter]}`, octave: (midi - alter - NATURAL_PC[letter]) / 12 - 1, alter };
}

/**
 * parseChord("F#/A#") -> { symbol, root, quality, bass, names, pitches } or null.
 * `names` are the chord tones without octave ("F#", "A#", "C#"); `pitches` are spelled pitches
 * with the root in `octave` (default 4), the slash bass first and below the root.
 */
export function parseChord(symbol, octave = 4) {
  if (typeof symbol !== "string") return null;
  const m = SYMBOL_RE.exec(symbol.trim());
  if (!m) return null;
  const def = Object.hasOwn(QUALITIES, m[3]) ? QUALITIES[m[3]] : null;
  const root = parsePitch(`${m[1]}${m[2] ?? ""}${octave}`);
  if (!def || !root) return null;
  const tones = [];
  for (const [steps, semis] of def.intervals) {
    const letter = LETTERS[(LETTERS.indexOf(m[1]) + steps) % 7];
    const s = spell(letter, root.midi + semis);
    if (!s) return null;
    tones.push({ name: s.name, pitch: `${s.name}${s.octave}` });
  }
  const chord = { symbol: symbol.trim(), root: `${m[1]}${m[2] ?? ""}`, quality: def.quality, names: tones.map((t) => t.name), pitches: tones.map((t) => t.pitch) };
  if (m[4]) {
    const bass = parsePitch(`${m[4]}${m[5] ?? ""}${octave}`);
    // The bass sits within an octave below the root.
    const midi = root.midi - (mod12(root.midi - bass.midi) || 12);
    const s = spell(m[4], midi);
    if (!s) return null;
    chord.bass = s.name;
    chord.pitches.unshift(`${s.name}${s.octave}`);
  }
  return chord;
}

/** MIDI numbers of a chord symbol (slash bass included), or null when the symbol is not recognized. */
export function chordMidis(symbol, octave = 4) {
  const chord = parseChord(symbol, octave);
  return chord ? chord.pitches.map((p) => parsePitch(p).midi) : null;
}
