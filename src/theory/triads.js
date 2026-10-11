// Triads with their inversions and arpeggios (broken triads) for any of the twelve tonics. Pure data: spelled
// pitches with a finger per note. Nothing is stored as content, so nothing is copyrighted. No DOM, no audio.
import { parsePitch, spellDegree, transposeInterval } from "../core/pitch.js";
import { assignFingering } from "./fingering.js";
import { directed } from "./scales.js";
import { minorTonic } from "./keys.js";

// Alteration of degrees 1, 3 and 5 of the major scale for each kind of triad.
const QUALITIES = Object.freeze({ major: [0, 0, 0], minor: [0, -1, 0], dim: [0, -1, -1], aug: [0, 0, 1] });
const SUFFIX = Object.freeze({ major: "", minor: "m", dim: "dim", aug: "aug" });

/** The kinds of triad `triad` and `arpeggio` can build. Major and minor are the ones the exercises teach. */
export const TRIAD_QUALITIES = Object.freeze(Object.keys(QUALITIES));

// A root sits in a window of one octave so the chord is near the middle of the hand's region: the lowest root
// is A3 for the right hand and A2 for the left (C major is C4 E4 G4 and C3 E3 G3, A minor is A3 C4 E4).
const ROOT_FLOOR = Object.freeze({ R: 57, L: 45 });

// Fingers of a triad by inversion (0 root, 1 first, 2 second, 3 the root an octave higher), lowest note first.
const FINGERS = Object.freeze({
  R: [[1, 3, 5], [1, 2, 5], [1, 3, 5], [1, 3, 5]],
  L: [[5, 3, 1], [5, 3, 1], [5, 2, 1], [5, 3, 1]],
});

const up = (pitch, octaves = 1) => transposeInterval(pitch, 7 * octaves, 12 * octaves);
const toNote = (pitch, finger, hand) => ({ pitch, midi: parsePitch(pitch).midi, finger, hand });

// The three pitches of the root position triad, in the octave window of the hand. Null for a tonic outside the keys.
function rootPosition(tonic, quality, hand) {
  const name = quality === "minor" || quality === "dim" ? minorTonic(tonic) : tonic;
  const key = { tonic: name, mode: "major" };
  const root4 = spellDegree(key, 1, 0, 0);
  if (!root4) return null;
  const shift = Math.ceil((ROOT_FLOOR[hand] - parsePitch(root4).midi) / 12);
  const pitches = [1, 3, 5].map((degree, i) => spellDegree(key, degree, QUALITIES[quality][i], shift));
  return pitches.every(Boolean) ? { name, pitches } : null;
}

/**
 * triad(tonic, quality, inversion, hand) -> { tonic, name, quality, inversion, hand, symbol, notes } or null.
 * `quality` is "major", "minor", "dim" or "aug"; `inversion` 0 (root position), 1, 2 or 3 (the root an octave up);
 * `hand` "R" or "L". `notes` is [{ pitch, midi, finger, hand }] lowest first. Right hand fingers 1-3-5 (root and
 * second inversion) and 1-2-5 (first); left hand 5-3-1 (root and first) and 5-2-1 (second). Minor and dim triads
 * on Db, Ab and Eb are written with sharps (C#, G#, D#): `name` is the root as shown, `symbol` is "Am", "C#dim"...
 */
export function triad(tonic, quality = "major", inversion = 0, hand = "R") {
  if (!QUALITIES[quality] || !FINGERS[hand] || !Number.isInteger(inversion) || inversion < 0 || inversion > 3) return null;
  const base = rootPosition(tonic, quality, hand);
  if (!base) return null;
  const [r, t, f] = base.pitches;
  const stack = [[r, t, f], [t, f, up(r)], [f, up(r), up(t)], [up(r), up(t), up(f)]][inversion];
  if (!stack.every(Boolean)) return null;
  return { tonic, name: base.name, quality, inversion, hand, symbol: `${base.name}${SUFFIX[quality]}`, notes: stack.map((p, i) => toNote(p, FINGERS[hand][inversion][i], hand)) };
}

// Standard arpeggio fingering per octave (design table). The inner pattern repeats for two octaves.
const STANDARD = Object.freeze({
  R: { one: [1, 2, 3, 5], two: [1, 2, 3, 1, 2, 3, 5] },
  L: { one: [5, 4, 2, 1], two: [5, 4, 2, 1, 3, 2, 1] },
});
const FLAT_RIGHT = Object.freeze({ one: [2, 1, 2, 4], two: [2, 1, 2, 4, 1, 2, 4] });
const WHITE_ROOTS = new Set(["C", "D", "E", "F", "G", "A"]); // major and minor
const MAJOR_ROOTS = new Set(["B", "F#"]);
const FLAT_ROOTS = new Set(["Db", "Eb", "Ab", "Bb"]);

// Fingers of the table for this tonic, quality, hand and size, or null when the table has no row (the assigner decides).
function tableFingers(tonic, quality, hand, octaves) {
  const size = octaves === 1 ? "one" : "two";
  const regular = WHITE_ROOTS.has(tonic) ? ["major", "minor"].includes(quality) : MAJOR_ROOTS.has(tonic) && quality === "major";
  if (regular) return { fingers: STANDARD[hand][size], suggested: hand === "L" && octaves === 2 }; // the crossing finger of the left hand varies by book
  if (FLAT_ROOTS.has(tonic) && quality === "major" && hand === "R") return { fingers: FLAT_RIGHT[size], suggested: false };
  return null;
}

/**
 * arpeggio(tonic, quality, { octaves = 1, hand = "R", direction = "up" }) ->
 *   { tonic, name, quality, hand, octaves, direction, symbol, suggested, notes } or null.
 * Root, third, fifth and the root again for one octave (C major right hand: C4 E4 G4 C5, fingers 1 2 3 5); two
 * octaves repeat the pattern (7 notes). Descending is the ascending sequence reversed. Fingers come from the
 * standard table; a row the table does not have (a flat root in the left hand, minor on a black-key root, B and
 * F# minor) is fingered by the five-finger assigner, and every fingering that books disagree on is returned with
 * `suggested: true` so the screen says "Suggested fingering".
 */
export function arpeggio(tonic, quality = "major", { octaves = 1, hand = "R", direction = "up" } = {}) {
  if (octaves !== 1 && octaves !== 2) return null;
  const root = triad(tonic, quality, 0, hand);
  if (!root) return null;
  const [r, t, f] = root.notes.map((n) => n.pitch);
  const pitches = [];
  for (let o = 0; o < octaves; o += 1) pitches.push(up(r, o), up(t, o), up(f, o));
  pitches.push(up(r, octaves));
  const table = tableFingers(tonic, quality, hand, octaves);
  const fingers = table ? table.fingers : assignFingering(pitches.map((pitch, i) => ({ tick: i, notes: [{ midi: parsePitch(pitch).midi, pitch }] })), { hand, key: { tonic: root.name, mode: "major" } }).map((g) => g.fingers[0]);
  const notes = pitches.map((pitch, i) => toNote(pitch, fingers[i], hand));
  return { tonic, name: root.name, quality, hand, octaves, direction, symbol: root.symbol, suggested: table ? table.suggested : true, notes: directed(notes, direction) };
}
