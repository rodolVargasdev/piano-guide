// The twelve intervals from a minor second to the octave, and the two notes of an interval above any note.
// Pure data, no DOM, no audio. The ids are the keys of the `interval.*` strings (ex.: interval.M3).
import { parsePitch, transpose } from "../core/pitch.js";

/** Interval ids with their size in semitones, smallest first: m2 M2 m3 M3 P4 TT P5 m6 M6 m7 M7 P8. */
export const INTERVALS = Object.freeze(
  ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"].map((id, i) => Object.freeze({ id, semitones: i + 1 })),
);

/** The size in semitones of an interval id, or null for an id that is not one of the twelve. */
export function semitonesOf(id) {
  return INTERVALS.find((i) => i.id === id)?.semitones ?? null;
}

/** A MIDI number as a spelled pitch with sharps ("C#4"): ear drills name no key, so no spelling is more right. */
export function midiPitch(midi) {
  return transpose("C4", midi - 60, null);
}

/**
 * intervalNotes(low, id) -> [{ midi, pitch }, { midi, pitch }]: the lower note and the note `id` above it.
 * `low` is a MIDI number or a spelled pitch ("C4"). Null for an unknown interval, an unreadable pitch or a result
 * above MIDI 127.
 */
export function intervalNotes(low, id) {
  const semitones = semitonesOf(id);
  const base = typeof low === "string" ? parsePitch(low)?.midi : low;
  if (semitones === null || !Number.isInteger(base) || base + semitones > 127 || base < 0) return null;
  return [base, base + semitones].map((midi) => ({ midi, pitch: midiPitch(midi) }));
}
