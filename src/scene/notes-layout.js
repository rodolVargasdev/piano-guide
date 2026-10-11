// Pure placement rules for the falling notes. No three.js.
// Notes live in "tick space": a note's lower edge sits at y = tick * unitsPerTick, its height is
// its duration, and only the parent group moves (group.y = LANDING_Y - nowTick * unitsPerTick), so
// at nowTick = note.tick the lower edge touches the key-top line. Position is a pure function of
// the engine tick, so a seek needs no rebuild.
import { ticksPerBar } from "../core/timing.js";
import { LANDING_Y, WALL_HEIGHT } from "./dims.js";

export const HORIZON_BARS = 2; // default look-ahead: constant beats on screen, whatever the BPM
export const NOTE_DEPTH = 0.5;
export const NOTE_GAP = 0.05; // shortens a bar so repeated notes read as separate

/** World units per tick, so that `bars` bars (default 2) fill the wall of falling notes. */
export function unitsPerTick(meter, bars = HORIZON_BARS) {
  return WALL_HEIGHT / (ticksPerBar(meter) * bars);
}

/** y of the note group at `nowTick`. */
export function groupY(nowTick, upt) {
  return LANDING_Y - nowTick * upt;
}

/** Top of the visible look-ahead (world y) for `bars` bars. */
export function horizonY(bars) {
  return LANDING_Y + (WALL_HEIGHT * bars) / HORIZON_BARS;
}

/** Lower edge and height of a note's bar inside the group. The height is proportional to `dur`. */
export function noteBox(note, upt) {
  const height = note.dur * upt;
  return { y: note.tick * upt, height: height - Math.min(NOTE_GAP, height * 0.4) };
}

/**
 * Notes to draw: pitched, with a key in `range` (inclusive MIDI), and not played by a hidden hand.
 * Muted hands are still drawn (muted is audio only).
 */
export function fallingNotes(timeline, handModes, range) {
  return timeline.notes.filter(
    (n) => n.midi !== null && n.midi >= range.low && n.midi <= range.high && !handModes?.[n.hand]?.hidden,
  );
}
