// Pure key-press bookkeeping for the scene: which hands press each MIDI key right now.
// No three.js. Buffers are reused between frames, so the render path allocates nothing.

export const HAND_L = 1;
export const HAND_R = 2;

export function createKeyState() {
  return { pressed: new Uint8Array(128), next: new Uint8Array(128), changed: [] };
}

/**
 * Update `state.pressed[midi]` (a bit set of HAND_L and HAND_R) with the visible hands whose
 * notes sound at `tick`. A hidden hand lights nothing; a muted hand still does (muted is audio
 * only). With `playing` false nothing is pressed: a paused scene shows no keys lit by playback.
 * Returns `state.changed`, the reused list of MIDI numbers whose value changed in this call.
 */
export function updateKeyState(state, timeline, tick, playing, handModes) {
  const { next, pressed, changed } = state;
  next.fill(0);
  if (playing) {
    // Same rule as core/timeline.activeAt (start inclusive, end exclusive, rests never active),
    // scanned in place: filling a reused array still allocated on every call (measured).
    const notes = timeline.notes;
    for (let i = 0; i < notes.length; i += 1) {
      const n = notes[i];
      if (n.tick > tick) break;
      if (n.midi === null || tick >= n.tick + n.dur) continue;
      if (handModes?.[n.hand]?.hidden) continue;
      next[n.midi] |= n.hand === "L" ? HAND_L : HAND_R;
    }
  }
  changed.length = 0;
  for (let m = 0; m < 128; m += 1) {
    if (next[m] !== pressed[m]) {
      pressed[m] = next[m];
      changed.push(m);
    }
  }
  return changed;
}
