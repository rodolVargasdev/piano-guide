// Ear-drill questions from a seeded random source: an interval question or a chord question carries its correct
// answer id and the notes to play, and the answer options always hold the correct answer exactly once. The same
// seed always gives the same question. Pure data, no DOM, no audio.
import { INTERVALS, semitonesOf } from "./intervals.js";
import { mulberry32 } from "./random.js";

/** The options a drill starts with, and the order in which it adds more (design: ear drills). */
export const INTERVAL_START = Object.freeze(["M3", "P5", "P8"]);
export const INTERVAL_GROWTH = Object.freeze(["P4", "m3", "M6", "M2", "m6", "m7", "M7", "TT", "m2"]);
export const CHORD_START = Object.freeze(["major", "minor"]);
export const CHORD_GROWTH = Object.freeze(["dim", "aug"]);

const CHORD_SEMITONES = Object.freeze({ major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8] });
const ROOT_LOW = 48; // C3: every note of a question lies in C3 to C6 (48 to 84)
const ROOT_HIGH = 72; // C5: the highest root, so an octave above it is still C6

// Seconds: a melodic interval is two notes one after the other, a harmonic one and a chord sound together.
const STEP = 0.8;
const NOTE = 0.7;
const TOGETHER = 1.4;

const unique = (list, known) => [...new Set(list)].filter((id) => known(id));

/**
 * intervalQuestion(seed, { options = INTERVAL_START, directions = ["asc"] }) ->
 *   { kind: "interval", seed, answer, options, direction, root, notes: [{ midi, at, dur }] }.
 * `options` are interval ids (duplicates and unknown ids are dropped, the rest stay in size order); the answer is one
 * of them. `direction` is "asc", "desc" or "harm" (both notes together), drawn from `directions`. `root` is the lower
 * note; `notes` are in the order they sound, `at` and `dur` in seconds (the shape engine.playNotes takes).
 */
export function intervalQuestion(seed, { options = INTERVAL_START, directions = ["asc"] } = {}) {
  const ids = INTERVALS.map((i) => i.id).filter((id) => unique(options, (x) => semitonesOf(x) !== null).includes(id));
  if (ids.length === 0) return null;
  const rng = mulberry32(seed);
  const answer = ids[Math.floor(rng() * ids.length)];
  const root = ROOT_LOW + Math.floor(rng() * (ROOT_HIGH - ROOT_LOW + 1));
  const direction = directions[Math.floor(rng() * directions.length)] ?? "asc";
  const [low, high] = [root, root + semitonesOf(answer)];
  const notes =
    direction === "harm"
      ? [{ midi: low, at: 0, dur: TOGETHER }, { midi: high, at: 0, dur: TOGETHER }]
      : (direction === "desc" ? [high, low] : [low, high]).map((midi, i) => ({ midi, at: i * STEP, dur: NOTE }));
  return { kind: "interval", seed, answer, options: ids, direction, root, notes };
}

/**
 * chordQuestion(seed, { options = CHORD_START }) ->
 *   { kind: "chord", seed, answer, options, root, notes: [{ midi, at, dur }] }: a root position triad of the
 * answer's quality ("major", "minor", "dim" or "aug") that sounds as a block. The root is the lowest note.
 */
export function chordQuestion(seed, { options = CHORD_START } = {}) {
  const ids = Object.keys(CHORD_SEMITONES).filter((q) => unique(options, (x) => x in CHORD_SEMITONES).includes(q));
  if (ids.length === 0) return null;
  const rng = mulberry32(seed);
  const answer = ids[Math.floor(rng() * ids.length)];
  const root = ROOT_LOW + Math.floor(rng() * (ROOT_HIGH - ROOT_LOW + 1));
  return { kind: "chord", seed, answer, options: ids, root, notes: CHORD_SEMITONES[answer].map((s) => ({ midi: root + s, at: 0, dur: TOGETHER })) };
}

/** The semitones above the root of each chord quality, for matching a played chord by pitch class. */
export function chordSemitones(quality) {
  return CHORD_SEMITONES[quality] ? [...CHORD_SEMITONES[quality]] : null;
}
