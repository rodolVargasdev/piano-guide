// The five keys of a hand position as keyboard data, for the quiet finger digits on the learn keyboard.
// A position covers five consecutive white-key steps (see theory/fingering.js); the right thumb is on the
// lowest, the left thumb on the highest. Pure, no DOM.

const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];

/** MIDI number of a diatonic step (octave * 7 + letter index, C = 0): the white key of that step. */
export function stepMidi(step) {
  return (Math.floor(step / 7) + 1) * 12 + WHITE_PC[((step % 7) + 7) % 7];
}

/**
 * positionKeys(position, hand) -> [{ midi, finger, hand }] for the five white keys of the position
 * ({ anchorStep } as the fingering gives it), lowest first. Right hand: finger = step - anchor + 1; left
 * hand: finger = anchor + 4 - step + 1. Without a position (or without an anchor) there are none.
 */
export function positionKeys(position, hand) {
  if (!position || !Number.isInteger(position.anchorStep)) return [];
  return [0, 1, 2, 3, 4].map((i) => ({ midi: stepMidi(position.anchorStep + i), finger: hand === "L" ? 5 - i : i + 1, hand }));
}
