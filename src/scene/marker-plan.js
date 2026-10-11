// Which finger markers and shift rings the scene shows at a tick. Pure: no three.js, no DOM.
// The plan reuses typed arrays between calls, so asking for it every frame allocates nothing.
//
// A note is shown while it sounds (current, full strength) and during the beat before it starts
// (ghost, 40 percent). A note with a `finger` gets a numbered marker; a note without one gets no
// marker, only its lit key. A note that shiftHints flagged also gets a ring on its key over the
// same window, so the ring appears one beat before the hand has to move.
import { ticksPerBeatUnit } from "../core/timing.js";

export const MAX_MARKERS = 24;
export const GHOST_ALPHA = 0.4;
export const HAND_BIT = Object.freeze({ L: 1, R: 2 });

/**
 * createMarkerPlan(timeline) returns { count, midi, hand, finger, ghost, ring, update(tick, handModes) }.
 * After update(), entries 0..count-1 describe one key each: `midi`, `hand` (HAND_BIT), `finger`
 * (1 to 5, or 0 for no marker), `ghost` (1 when the note has not started yet) and `ring` (1 for a
 * shift destination). One entry per key and hand: a repeated note shows its current marker.
 * A hidden hand shows nothing; a muted hand still does (muted is audio only).
 */
export function createMarkerPlan(timeline) {
  const notes = timeline.notes;
  const beat = ticksPerBeatUnit(timeline.tempo.beatUnit);
  let longest = 0;
  for (const n of notes) if (n.midi !== null && n.dur > longest) longest = n.dur;
  const plan = {
    count: 0,
    midi: new Uint8Array(MAX_MARKERS),
    hand: new Uint8Array(MAX_MARKERS),
    finger: new Uint8Array(MAX_MARKERS),
    ghost: new Uint8Array(MAX_MARKERS),
    ring: new Uint8Array(MAX_MARKERS),
    beat,
    update(tick, handModes) {
      plan.count = 0;
      // First note that could still be sounding: notes are sorted by tick.
      let lo = 0;
      let hi = notes.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (notes[mid].tick < tick - longest) lo = mid + 1;
        else hi = mid;
      }
      for (let i = lo; i < notes.length; i += 1) {
        const n = notes[i];
        if (n.tick > tick + beat) break;
        if (n.midi === null || tick >= n.tick + n.dur) continue;
        if (handModes?.[n.hand]?.hidden) continue;
        const wantsMarker = n.finger >= 1 && n.finger <= 5;
        const ring = timeline.shifts.has(i);
        if (!wantsMarker && !ring) continue;
        add(plan, n, wantsMarker ? n.finger : 0, n.tick > tick ? 1 : 0, ring ? 1 : 0);
      }
      return plan.count;
    },
  };
  return plan;
}

function add(plan, n, finger, ghost, ring) {
  const bit = HAND_BIT[n.hand];
  for (let j = 0; j < plan.count; j += 1) {
    if (plan.midi[j] !== n.midi || plan.hand[j] !== bit) continue;
    // Same key and hand twice (a repeated note): the sounding one wins over the ghost.
    if (plan.ghost[j] === 1 && ghost === 0) {
      plan.ghost[j] = 0;
      if (finger > 0) plan.finger[j] = finger;
    } else if (plan.finger[j] === 0 && finger > 0 && plan.ghost[j] === ghost) plan.finger[j] = finger;
    if (ring === 1) plan.ring[j] = 1;
    return;
  }
  if (plan.count >= MAX_MARKERS) return;
  const k = plan.count;
  plan.midi[k] = n.midi;
  plan.hand[k] = bit;
  plan.finger[k] = finger;
  plan.ghost[k] = ghost;
  plan.ring[k] = ring;
  plan.count += 1;
}

/**
 * Ring strength from 0.35 to 1, pulsing once per beat in musical time (so it follows tempo and
 * pauses with the music). Reduced motion gets a steady 1: a static ring, no animation.
 */
export function ringStrength(tick, beatTicks, reducedMotion) {
  if (reducedMotion) return 1;
  return 0.675 + 0.325 * Math.cos((tick / beatTicks) * 2 * Math.PI);
}
