// The twelve major keys used by Learn and Practice, and their orders (fixed, random, circle of fifths or
// fourths). Pure data and functions; chance comes only from an explicit seed.
import { spellDegree } from "../core/pitch.js";
import { mulberry32, shuffle } from "./random.js";

/** The twelve major tonics, around the circle of fifths: C through the sharps, then through the flats. */
export const TONICS = Object.freeze(["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"]);

// Minor material on these three tonics is written with sharps (C# minor, not Db minor with an Fb), which is
// how a musician names it and keeps the spelling free of Fb, Cb and Gb.
const MINOR_NAMES = Object.freeze({ Db: "C#", Ab: "G#", Eb: "D#" });

/** The tonic as it is written for MINOR material on the same sound: "Db" -> "C#", "Ab" -> "G#", "Eb" -> "D#", others unchanged. */
export function minorTonic(tonic) {
  return MINOR_NAMES[tonic] ?? tonic;
}

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
 * keyOrder({ kind, direction, start, list, seed, count }) -> the next `count` (default 12) tonics for key rotation.
 *   "fixed":  `list` in the order given, repeated (C F G for 5 steps is C F G C F);
 *   "circle": around the circle of fifths from `start` (default C), or of fourths (its reverse, C F Bb Eb Ab Db F# B E A D G)
 *             when `direction` is "fourths"; it wraps, so the 13th key is the first again;
 *   "random": seeded; every key of `list` (default the twelve) once before any repeats, and no key follows itself.
 *             When `start` is given the order begins with it, so "next key" never repeats the key being played.
 * Unknown tonics in `start` are ignored (circle starts at C). A fresh array each call.
 */
export function keyOrder({ kind = "circle", direction = "fifths", start, list, seed = 1, count = 12 } = {}) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (kind === "fixed") {
    const pool = list?.length ? list : TONICS;
    return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
  }
  if (kind === "circle") {
    const ring = direction === "fourths" ? [...TONICS].reverse() : [...TONICS];
    const at = Math.max(0, ring.indexOf(start ?? "C"));
    return Array.from({ length: n }, (_, i) => ring[(at + i) % ring.length]);
  }
  const pool = [...new Set(list?.length ? list : TONICS)];
  const rng = mulberry32(seed);
  const out = [];
  while (out.length < n) {
    let block = shuffle(pool, rng);
    if (out.length === 0 && pool.includes(start)) block = [start, ...block.filter((k) => k !== start)];
    // A block never opens with the key the previous block closed with.
    else if (pool.length > 1 && block[0] === out.at(-1)) [block[0], block[1]] = [block[1], block[0]];
    out.push(...block);
  }
  return out.slice(0, n);
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
