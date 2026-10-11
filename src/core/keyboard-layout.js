// Pure keyboard geometry and range fitting. No DOM, no three.js.
// Units: one white key is 1 unit wide. x is the LEFT edge of a key, measured from the left
// edge of A0 (MIDI 21), so the white key with index i spans [i, i + 1].

export const MIDI_MIN = 21; // A0
export const MIDI_MAX = 108; // C8
export const FULL_RANGE = Object.freeze({ low: MIDI_MIN, high: MIDI_MAX });

export const WHITE_WIDTH = 1;
export const BLACK_WIDTH = 0.58; // 13.7 mm over 23.5 mm on a real keyboard
export const BLACK_LENGTH_RATIO = 0.63; // black key length over white key length (95 / 150)

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
// Index of the white key at or just below each pitch class inside its octave.
const WHITE_INDEX_IN_OCTAVE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const A0_WHITE_OFFSET = Math.floor(MIDI_MIN / 12) * 7 + WHITE_INDEX_IN_OCTAVE[MIDI_MIN % 12]; // 12
// Black keys sit off the exact seam so each group looks balanced (C# and F# lean left, A# and D# right).
const BLACK_OFFSET = { 1: -0.07, 3: 0.07, 6: -0.08, 8: 0, 10: 0.08 };

const inRange = (midi) => Number.isInteger(midi) && midi >= MIDI_MIN && midi <= MIDI_MAX;

export function isBlackKey(midi) {
  return BLACK_PCS.has(((midi % 12) + 12) % 12);
}

/** Index of the white key at or below `midi`, counted from A0 (A0 is 0, C8 is 51). */
function whiteIndex(midi) {
  return Math.floor(midi / 12) * 7 + WHITE_INDEX_IN_OCTAVE[midi % 12] - A0_WHITE_OFFSET;
}

/**
 * Geometry of one key: { midi, isBlack, x, width }, or null when `midi` is outside A0 to C8.
 * A black key is centered on the seam between its two white neighbors plus a small group offset.
 */
export function keyGeometry(midi) {
  if (!inRange(midi)) return null;
  const wi = whiteIndex(midi);
  if (!isBlackKey(midi)) return { midi, isBlack: false, x: wi * WHITE_WIDTH, width: WHITE_WIDTH };
  const seam = (wi + 1) * WHITE_WIDTH;
  return { midi, isBlack: true, x: seam - BLACK_WIDTH / 2 + BLACK_OFFSET[midi % 12], width: BLACK_WIDTH };
}

/**
 * Keys of an inclusive MIDI range split in white and black arrays, with x measured from the
 * left edge of the first white key of the range and the total width of the white keys.
 * Throws RangeError for an inverted range or one outside A0 to C8.
 */
export function layoutRange(range) {
  const { low, high } = range;
  if (!inRange(low) || !inRange(high) || low > high) throw new RangeError(`Invalid keyboard range: ${low} to ${high}`);
  const origin = whiteIndex(isBlackKey(low) ? low + 1 : low) * WHITE_WIDTH;
  const whites = [];
  const blacks = [];
  for (let m = low; m <= high; m += 1) {
    const k = keyGeometry(m);
    (k.isBlack ? blacks : whites).push({ ...k, x: k.x - origin });
  }
  const last = whites[whites.length - 1];
  return { whites, blacks, width: last ? last.x + last.width : 0 };
}

const snapDownToC = (m) => m - (((m % 12) + 12) % 12);
const snapUpToB = (m) => m + ((11 - (((m % 12) + 12) % 12) + 12) % 12);
const DEFAULT_FIT = Object.freeze({ low: 48, high: 83 }); // C3 to B5

/**
 * Smallest C-to-B range holding every pitched note, padded by `pad` semitones on both sides,
 * at least `minSpan` keys wide (semitones counted inclusively) and inside A0 to C8.
 * `notes` carry `midi` (resolved timeline notes); rests and non-numeric midi are ignored.
 * Without pitched notes it returns C3 to B5.
 */
export function fittedRange(notes, { pad = 3, minSpan = 36 } = {}) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) {
    if (!Number.isFinite(n.midi)) continue;
    if (n.midi < lo) lo = n.midi;
    if (n.midi > hi) hi = n.midi;
  }
  if (lo === Infinity) return { ...DEFAULT_FIT };
  let low = Math.max(MIDI_MIN, snapDownToC(lo - pad));
  let high = Math.min(MIDI_MAX, snapUpToB(hi + pad));
  let growHigh = true;
  while (high - low + 1 < minSpan && (low > MIDI_MIN || high < MIDI_MAX)) {
    // Grow by whole octaves, alternating sides, so the range keeps starting at a C and ending at a B.
    if ((growHigh && high < MIDI_MAX) || low === MIDI_MIN) high = Math.min(MIDI_MAX, high + 12);
    else low = Math.max(MIDI_MIN, low - 12);
    growHigh = !growHigh;
  }
  return { low, high };
}
