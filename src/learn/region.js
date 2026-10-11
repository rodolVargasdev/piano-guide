// Visible key range of the learn keyboard. Computed in white-key indexes so both edges always land on
// white keys; the result is given as MIDI numbers of those two white keys. Pure, no DOM.
import { MIDI_MAX, MIDI_MIN } from "../core/pitch.js";

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
// White key at or below each pitch class (0..11), as an index into WHITE_PCS.
const WHITE_AT_OR_BELOW = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const IS_WHITE = new Set(WHITE_PCS);

/** Index of a white key: octave * 7 + letter. A black key gives the white key below it. */
const whiteDown = (midi) => (Math.floor(midi / 12) - 1) * 7 + WHITE_AT_OR_BELOW[((midi % 12) + 12) % 12];
/** The same, but a black key gives the white key above it. */
const whiteUp = (midi) => whiteDown(midi) + (IS_WHITE.has(((midi % 12) + 12) % 12) ? 0 : 1);
const midiOfWhite = (idx) => (Math.floor(idx / 7) + 1) * 12 + WHITE_PCS[((idx % 7) + 7) % 7];

const LOWEST = whiteUp(MIDI_MIN); // A0
const HIGHEST = whiteDown(MIDI_MAX); // C8

/** Grows [lo, hi] to `width` white keys, balanced on both sides, and slides it back inside A0 to C8. */
function widen(lo, hi, width) {
  const extra = Math.max(0, width - (hi - lo + 1));
  let a = lo - Math.floor(extra / 2);
  let b = hi + Math.ceil(extra / 2);
  if (a < LOWEST) [a, b] = [LOWEST, Math.min(HIGHEST, b + (LOWEST - a))];
  if (b > HIGHEST) [a, b] = [Math.max(LOWEST, a - (b - HIGHEST)), HIGHEST];
  return [a, b];
}

function span(midis) {
  const lo = Math.min(...midis.map(whiteDown));
  const hi = Math.max(...midis.map(whiteUp));
  return [lo, hi];
}

/**
 * learnRegion({ phraseMidis, positionMidis, stepMidis, maxWhite, minWhite = 9, marginWhite = 1 })
 *   -> { low, high, mode: "phrase" | "position" } (MIDI of the lowest and highest white key shown).
 * Phrase mode frames every key of the phrase plus a margin, at least `minWhite` white keys. When that is
 * wider than `maxWhite` (what the screen width allows) the region frames the current position and step
 * instead (position mode) and then moves only on a shift. The keys of the step and of the position are
 * always inside, even when that needs more than `maxWhite`: fewer keys is allowed, hiding one is not.
 */
export function learnRegion({ phraseMidis = [], positionMidis = [], stepMidis = [], maxWhite = Infinity, minWhite = 9, marginWhite = 1 } = {}) {
  const required = [...positionMidis, ...stepMidis];
  const floor = Math.min(minWhite, maxWhite);
  if (phraseMidis.length > 0) {
    const [lo, hi] = span([...phraseMidis, ...required]);
    const width = hi - lo + 1 + 2 * marginWhite;
    if (width <= maxWhite) {
      const [a, b] = widen(lo - marginWhite, hi + marginWhite, Math.max(width, floor));
      return { low: midiOfWhite(a), high: midiOfWhite(b), mode: "phrase" };
    }
  }
  const [lo, hi] = span(required.length > 0 ? required : [60]);
  const core = hi - lo + 1;
  const room = Math.max(0, maxWhite - core);
  const margin = Math.min(marginWhite, Math.floor(room / 2));
  const [a, b] = widen(lo - margin, hi + margin, Math.max(core + 2 * margin, floor));
  return { low: midiOfWhite(a), high: midiOfWhite(b), mode: "position" };
}
