// Pure timeline queries over a resolved level. No DOM, no Web Audio.
import { parsePitch } from "./pitch.js";
import { isSilent } from "./visibility.js";
import { ticksPerBar } from "./timing.js";

/**
 * Resolved timeline of one level: every note gets its `midi`, notes are sorted
 * (tick, then midi, then hand), and the song-wide fields views need are copied
 * so no consumer has to carry the whole song.
 * `silent` is true for a private song: the engine schedules no note of a timeline unless
 * `silent === false` (core/practice `schedulableNotes`). `learn` is the level's learn block or null.
 * `range` is the lowest and highest MIDI of pitched notes, or null without notes.
 * `shifts` is the set of note indexes flagged by shiftHints for either hand.
 * Throws RangeError for a level the song does not have.
 */
export function resolveLevel(song, levelId) {
  const level = song.levels?.[levelId];
  if (!level) throw new RangeError(`Unknown level: ${levelId}`);
  const notes = level.notes
    .map((n) => (n.rest ? { ...n, midi: null } : { ...n, midi: parsePitch(n.pitch)?.midi ?? null }))
    .sort((a, b) => a.tick - b.tick || (a.midi ?? -1) - (b.midi ?? -1) || a.hand.localeCompare(b.hand));
  let low = Infinity;
  let high = -Infinity;
  for (const n of notes) {
    if (n.midi === null) continue;
    if (n.midi < low) low = n.midi;
    if (n.midi > high) high = n.midi;
  }
  const shifts = new Set([...shiftHints(notes, "L"), ...shiftHints(notes, "R")]);
  return {
    levelId,
    label: level.label,
    notation: level.notation,
    strictBars: level.strictBars === true,
    meter: song.meter,
    pickupTicks: song.pickupTicks,
    tempo: song.tempo,
    lengthTicks: song.lengthTicks,
    notes,
    chords: level.chords ?? song.chords ?? [],
    sections: song.sections ?? [],
    pedal: level.pedal ?? [],
    analysis: level.analysis ?? [],
    key: song.key,
    range: notes.some((n) => n.midi !== null) ? { low, high } : null,
    shifts,
    silent: isSilent(song),
    learn: level.learn ?? null,
  };
}

/**
 * A timeline with no notes, for the metronome of Practice exercises: `bars` whole bars of `meter` at `bpm` (quarter
 * notes). It is `silent: false` so the engine runs its clock and clicks on it, and it has nothing to schedule, so no
 * note can ever sound from it. Throws RangeError for a meter or a bar count that is not a positive whole number.
 */
export function makeTimeline({ meter = { num: 4, den: 4 }, bpm = 60, bars = 64 } = {}) {
  if (!Number.isInteger(meter?.num) || !Number.isInteger(meter?.den) || meter.num < 1 || meter.den < 1) throw new RangeError("meter must be { num, den } whole numbers");
  if (!Number.isInteger(bars) || bars < 1) throw new RangeError("bars must be a positive whole number");
  return {
    levelId: null,
    label: null,
    notation: "none",
    strictBars: false,
    meter: { num: meter.num, den: meter.den },
    pickupTicks: 0,
    tempo: { bpm, beatUnit: "quarter" },
    lengthTicks: bars * ticksPerBar(meter),
    notes: [],
    chords: [],
    sections: [],
    pedal: [],
    analysis: [],
    key: null,
    range: null,
    shifts: new Set(),
    silent: false,
    learn: null,
  };
}

/**
 * Notes sounding at `tick`: start inclusive, end exclusive. Rests are never active.
 * Pass `out` (an array) to reuse it between frames; it is cleared and returned.
 */
export function activeAt(timeline, tick, out = []) {
  out.length = 0;
  for (const n of timeline.notes) {
    if (n.tick > tick) break;
    if (n.midi !== null && tick < n.tick + n.dur) out.push(n);
  }
  return out;
}

/**
 * Indexes (into `notes`) of events of `hand` that are a hand shift: the pitch lies more than
 * `thresholdSemitones` outside the span (lowest to highest MIDI) of the previous onset group
 * of the same hand. An onset group is the pitched, non-grace notes of that hand sharing a tick.
 * The first group is never a shift. `notes` MUST be sorted by tick.
 */
export function shiftHints(notes, hand, thresholdSemitones = 5) {
  const shifts = new Set();
  let prev = null; // { low, high } of the previous onset group
  let groupTick = null;
  let group = []; // { i, m } of the current group
  let lo = 0;
  let hi = 0;
  const close = () => {
    if (group.length === 0) return;
    if (prev) {
      for (const { i, m } of group) {
        if (m > prev.high + thresholdSemitones || m < prev.low - thresholdSemitones) shifts.add(i);
      }
    }
    prev = { low: lo, high: hi };
    group = [];
  };
  notes.forEach((n, i) => {
    if (n.hand !== hand || n.rest || n.grace) return;
    const m = n.midi ?? parsePitch(n.pitch)?.midi;
    if (m === undefined) return;
    if (n.tick !== groupTick) {
      close();
      groupTick = n.tick;
      lo = m;
      hi = m;
    } else {
      lo = Math.min(lo, m);
      hi = Math.max(hi, m);
    }
    group.push({ i, m });
  });
  close();
  return shifts;
}
