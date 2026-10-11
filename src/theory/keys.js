// The twelve major keys used by Learn and Practice, and their orders. Pure data and functions.
// `keyOrder` (fixed, random, circle of fifths or fourths) is completed in the practice exercises slice.
import { spellDegree } from "../core/pitch.js";

/** The twelve major tonics, around the circle of fifths: C through the sharps, then through the flats. */
export const TONICS = Object.freeze(["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"]);

/** The circle of fifths from C (a fresh array each call). */
export function circleOfFifths() {
  return [...TONICS];
}

const INTRO = Object.freeze(["C", "G", "D", "F", "A", "E", "B", "Bb", "Eb", "Ab", "Db", "F#"]);

/** The order in which a learner meets the keys: easy white-key scales first (an order, not a lock). */
export function introOrder() {
  return [...INTRO];
}

/**
 * The seven spelled pitches of a major scale, from the tonic in octave 4 (so C is C4 to B4 and F#
 * is F#4 to E#5). Null for a tonic that is not a spelled note name.
 */
export function scaleOf(tonic) {
  const key = { tonic, mode: "major" };
  const pitches = [1, 2, 3, 4, 5, 6, 7].map((degree) => spellDegree(key, degree, 0, 0));
  return pitches.every(Boolean) ? pitches : null;
}
