// Cadences and chord progressions with voice leading: for each chord a left hand root and a right hand triad,
// the voicings chosen so the total movement from one chord to the next is as small as it can be (common tones
// are kept, ties go to the lower voicing). Pure data, no DOM, no audio, no dependency.
import { parsePitch, spellDegree, transposeInterval } from "../core/pitch.js";

/** The progressions the exercises teach, as roman numerals (a cadence is a final progression such as I-IV-V-I). */
export const PROGRESSIONS = Object.freeze({
  "I-IV-V-I": Object.freeze(["I", "IV", "V", "I"]),
  "I-vi-IV-V": Object.freeze(["I", "vi", "IV", "V"]),
  "I-V-vi-IV": Object.freeze(["I", "V", "vi", "IV"]),
});

// Scale degree and quality of each numeral the module understands (uppercase is major, lowercase minor).
const NUMERALS = Object.freeze({ I: [1, "major"], ii: [2, "minor"], iii: [3, "minor"], IV: [4, "major"], V: [5, "major"], vi: [6, "minor"] });

// Where the right hand triads may sit (G3 to G5, about an octave around the middle of the hand's region) and the
// window of one octave the left hand root takes (A2 to G#3), the same windows as theory/triads.js.
const REGION = Object.freeze({ low: 55, high: 79 });
const BASS_FLOOR = 45;
const FINGERS = Object.freeze([[1, 3, 5], [1, 2, 5], [1, 3, 5]]); // by inversion: root, first, second

const shiftOctaves = (pitch, k) => transposeInterval(pitch, 7 * k, 12 * k);
const note = (pitch, finger, hand) => ({ pitch, midi: parsePitch(pitch).midi, finger, hand });

// The chord of a numeral: its root spelled in the key, its quality and the spelled pitches of the triad in the
// octave of the root's letter (the third is lowered for a minor chord).
function chordOf(tonic, numeral) {
  const [degree, quality] = NUMERALS[numeral] ?? [];
  const root = degree ? spellDegree({ tonic, mode: "major" }, degree, 0, 0) : null;
  if (!root) return null;
  const name = root.replace(/-?\d+$/, "");
  const key = { tonic: name, mode: "major" };
  const pitches = [spellDegree(key, 1, 0, 0), spellDegree(key, 3, quality === "minor" ? -1 : 0, 0), spellDegree(key, 5, 0, 0)];
  return pitches.every(Boolean) ? { numeral, name, quality, symbol: `${name}${quality === "minor" ? "m" : ""}`, root, pitches } : null;
}

// Every close position voicing of a chord inside the region: [{ pitches, midis, inversion }], lowest note first.
function voicings(chord) {
  const [r, t, f] = chord.pitches;
  const stacks = [[r, t, f], [t, f, shiftOctaves(r, 1)], [f, shiftOctaves(r, 1), shiftOctaves(t, 1)]];
  const out = [];
  stacks.forEach((stack, inversion) => {
    for (let k = -3; k <= 3; k += 1) {
      const pitches = stack.map((p) => shiftOctaves(p, k));
      if (!pitches.every(Boolean)) continue;
      const midis = pitches.map((p) => parsePitch(p).midi);
      if (midis[0] >= REGION.low && midis[2] <= REGION.high) out.push({ pitches, midis, inversion });
    }
  });
  return out;
}

const movement = (a, b) => a.reduce((sum, m, i) => sum + Math.abs(m - b[i]), 0);
const pitchSum = (v) => v.midis[0] + v.midis[1] + v.midis[2];

/**
 * progression(tonic, numerals) -> { tonic, numerals, movement, chords: [{ numeral, name, symbol, quality, bass, right }] } or null.
 * `numerals` is a list of I, ii, iii, IV, V, vi (or a key of PROGRESSIONS). `bass` is the left hand root as a note
 * (finger 5, octave window A2 to G#3); `right` is { inversion, notes } with the three right hand notes and their
 * fingers. The first chord is the root position triad of the right hand window (C major: C4 E4 G4); every next one
 * is chosen by dynamic programming over all voicings so the sum of semitone moves is minimal for the whole
 * progression (so it can never be worse than playing every chord in root position), ties going to the lower voicing.
 */
export function progression(tonic, numerals) {
  const list = typeof numerals === "string" ? PROGRESSIONS[numerals] : numerals;
  if (!Array.isArray(list) || list.length === 0) return null;
  const chords = list.map((n) => chordOf(tonic, n));
  if (chords.some((c) => c === null)) return null;
  const options = chords.map(voicings);
  // The first chord is fixed: root position, the lowest root of the right hand window (A3 to G#4).
  const first = options[0].filter((v) => v.inversion === 0 && v.midis[0] >= 57 && v.midis[0] <= 68);
  if (first.length === 0 || options.some((o) => o.length === 0)) return null;
  options[0] = first.slice(0, 1);
  // best[c][j] = the cheapest way to reach voicing j of chord c: [total movement, sum of pitches] and where it came from.
  const best = [options[0].map((v) => ({ cost: [0, pitchSum(v)], from: -1 }))];
  for (let c = 1; c < options.length; c += 1) {
    best.push(
      options[c].map((v) => {
        let pick = null;
        best[c - 1].forEach((prev, i) => {
          const cost = [prev.cost[0] + movement(options[c - 1][i].midis, v.midis), prev.cost[1] + pitchSum(v)];
          if (pick === null || cost[0] < pick.cost[0] || (cost[0] === pick.cost[0] && cost[1] < pick.cost[1])) pick = { cost, from: i };
        });
        return pick;
      }),
    );
  }
  let j = 0;
  best.at(-1).forEach((b, i) => {
    const now = best.at(-1)[j];
    if (b.cost[0] < now.cost[0] || (b.cost[0] === now.cost[0] && b.cost[1] < now.cost[1])) j = i;
  });
  const total = best.at(-1)[j].cost[0];
  const chosen = [];
  for (let c = options.length - 1; c >= 0; c -= 1) {
    chosen[c] = options[c][j];
    j = best[c][j].from;
  }
  return {
    tonic,
    numerals: [...list],
    movement: total,
    chords: chords.map((chord, c) => {
      const shift = Math.ceil((BASS_FLOOR - parsePitch(chord.root).midi) / 12);
      return {
        numeral: chord.numeral,
        name: chord.name,
        symbol: chord.symbol,
        quality: chord.quality,
        bass: note(shiftOctaves(chord.root, shift), 5, "L"),
        right: { inversion: chosen[c].inversion, notes: chosen[c].pitches.map((p, i) => note(p, FINGERS[chosen[c].inversion][i], "R")) },
      };
    }),
  };
}
