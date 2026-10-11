// Major scales with standard fingering, and five-finger patterns, for any of the twelve tonics. Pure data:
// spelled pitches with a finger per note, nothing stored as content. Pitches are spelled for the key
// (F# major has E#) and parse with core/pitch.js. No DOM, no audio, no dependency.
import { parsePitch, spellDegree } from "../core/pitch.js";
import { minorTonic } from "./keys.js";

// Fingers of one hand in one key, as the design table gives them: `start` is the finger on the first note,
// `cycle` the finger on degrees 1 to 7 of an octave that continues (so cycle[0] is the finger on a tonic reached
// from below) and `top` the finger on the very last note. Written as digit strings: "1231234" is 1 2 3 1 2 3 4.
const row = (rs, rc, rt, ls, lc, lt) => ({
  R: { start: Number(rs), cycle: [...rc].map(Number), top: Number(rt) },
  L: { start: Number(ls), cycle: [...lc].map(Number), top: Number(lt) },
});

/**
 * SCALE_FINGERING[tonic][hand] = { start, cycle, top }. One octave ascending is start, cycle[1..6], top; two
 * octaves are start, cycle[1..6], cycle[0..6], top. Descending reverses notes and fingers. Right hand in octave 4,
 * left hand in octave 3 (the tonic).
 */
export const SCALE_FINGERING = Object.freeze({
  C: row(1, "1231234", 5, 5, "1432132", 1),
  G: row(1, "1231234", 5, 5, "1432132", 1),
  D: row(1, "1231234", 5, 5, "1432132", 1),
  A: row(1, "1231234", 5, 5, "1432132", 1),
  E: row(1, "1231234", 5, 5, "1432132", 1),
  B: row(1, "1231234", 5, 4, "1321432", 1),
  "F#": row(2, "2341231", 2, 4, "4321321", 4),
  Db: row(2, "2312341", 2, 3, "3214321", 3),
  Ab: row(3, "3412312", 3, 3, "3214321", 3),
  Eb: row(3, "3123412", 3, 3, "3214321", 3),
  Bb: row(2, "4123123", 4, 3, "3214321", 3),
  F: row(1, "1234123", 4, 5, "1432132", 1),
});

/**
 * Two fingerings are the least certain: the Bb major right hand start (method books differ between 2 and 4)
 * and the F# major left hand start (some books start on 3). They are shown as "Suggested fingering" until a
 * teacher or a book confirms them; every other row is the standard one ("some books differ" still applies).
 */
const SUGGESTED = Object.freeze({ Bb: ["R"], "F#": ["L"] });

const octaveOffset = (hand) => (hand === "L" ? -1 : 0);

function note(pitch, finger, hand) {
  return { pitch, midi: parsePitch(pitch).midi, finger, hand };
}

/**
 * Notes in the order of `direction`: "up" as given, "down" reversed, "updown" up and then back down without
 * repeating the top note. Works on any list (a scale, an arpeggio, a five-finger pattern).
 */
export function directed(notes, direction = "up") {
  if (direction === "down") return [...notes].reverse();
  if (direction === "updown") return [...notes, ...[...notes].reverse().slice(1)];
  return [...notes];
}

/**
 * majorScale(tonic, { octaves = 1, hand = "R", direction = "up" }) ->
 *   { tonic, hand, octaves, direction, suggested, notes: [{ pitch, midi, finger, hand }] }
 * or null for a tonic outside the twelve, a hand other than "R" or "L", or octaves other than 1 or 2.
 * One octave has 8 notes, two have 15. `suggested` is true for the two fingerings flagged for review.
 */
export function majorScale(tonic, { octaves = 1, hand = "R", direction = "up" } = {}) {
  const table = SCALE_FINGERING[tonic]?.[hand];
  if (!table || (octaves !== 1 && octaves !== 2)) return null;
  const key = { tonic, mode: "major" };
  const fingers = [table.start, ...table.cycle.slice(1)];
  for (let o = 1; o < octaves; o += 1) fingers.push(...table.cycle);
  fingers.push(table.top);
  const up = fingers.map((finger, i) => note(spellDegree(key, (i % 7) + 1, 0, Math.floor(i / 7) + octaveOffset(hand)), finger, hand));
  return { tonic, hand, octaves, direction, suggested: SUGGESTED[tonic]?.includes(hand) === true, notes: directed(up, direction) };
}

/**
 * fiveFinger(tonic, hand = "R", { minor = false, direction = "up" }) -> the five-finger pattern (degrees 1 to 5):
 * fingers 1 to 5 in the right hand and 5 to 1 in the left, from the tonic in octave 4 (right) or 3 (left). The minor
 * pattern lowers the third and is named with sharps for Db, Ab and Eb (C#, G#, D#): `name` is the tonic as shown.
 * Null for a tonic outside the twelve or a hand other than "R" or "L".
 */
export function fiveFinger(tonic, hand = "R", { minor = false, direction = "up" } = {}) {
  if (!SCALE_FINGERING[tonic] || (hand !== "R" && hand !== "L")) return null;
  const name = minor ? minorTonic(tonic) : tonic;
  const key = { tonic: name, mode: "major" };
  const up = [1, 2, 3, 4, 5].map((degree, i) => note(spellDegree(key, degree, degree === 3 && minor ? -1 : 0, octaveOffset(hand)), hand === "L" ? 5 - i : i + 1, hand));
  return { tonic, name, hand, minor, direction, suggested: false, notes: directed(up, direction) };
}
