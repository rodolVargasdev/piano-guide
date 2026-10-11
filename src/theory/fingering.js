// Pure fingering assigner. A hand "position" covers five consecutive diatonic steps; the assigner
// groups the notes into the fewest positions (greedy longest run, which is optimal for covering a
// line with windows of fixed width), names a finger for every note, and flags where the hand moves.
// No DOM, no audio, no dependency.
import { parsePitch } from "../core/pitch.js";
import { scaleOf } from "./keys.js";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);
const SHARP_LETTER = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];

/** Diatonic step index of a spelled pitch: octave * 7 + letter, so a chromatic note takes its letter's step. */
export function stepOf(pitch) {
  const p = parsePitch(pitch);
  return p ? p.octave * 7 + LETTERS.indexOf(p.letter) : null;
}

/** Spelled pitch of a step in a major key ("E" in E major is F# at step F), natural when the key says nothing. */
export function stepToPitch(step, key) {
  const letter = LETTERS[((step % 7) + 7) % 7];
  const octave = Math.floor(step / 7);
  const scale = key && key.mode === "major" ? scaleOf(key.tonic) : null;
  const inKey = scale?.find((p) => p[0] === letter);
  const accidental = inKey ? inKey.slice(1).replace(/-?\d+$/, "") : "";
  return `${letter}${accidental}${octave}`;
}

// One note: its step, whether it is a black key, and the anchor an authored finger pins (or null).
function describe(note, hand) {
  const step = note.pitch !== undefined ? stepOf(note.pitch) : Math.floor(note.midi / 12 - 1) * 7 + LETTERS.indexOf(SHARP_LETTER[note.midi % 12]);
  const authored = Number.isInteger(note.finger) && note.finger >= 1 && note.finger <= 5 ? note.finger : null;
  const pin = authored === null ? null : hand === "L" ? step + authored - 5 : step - (authored - 1);
  return { note, step, black: BLACK.has(((note.midi % 12) + 12) % 12), authored, pin };
}

function describeGroup(group, hand) {
  const notes = group.notes.map((n) => describe(n, hand));
  const steps = notes.map((n) => n.step);
  const min = Math.min(...steps);
  const max = Math.max(...steps);
  const midis = notes.map((n) => n.note.midi);
  const distinct = new Set(steps).size === steps.length;
  // The pins of the group must agree and must fit the group, else the authored fingers cannot place the hand.
  const pins = [...new Set(notes.map((n) => n.pin).filter((p) => p !== null))];
  const pin = pins.length === 1 && pins[0] <= min && pins[0] + 4 >= max ? pins[0] : null;
  let kind = "unplayable";
  if (distinct && max - min <= 4) kind = "positional";
  else if (distinct && notes.length <= 3 && Math.max(...midis) - Math.min(...midis) <= 12) kind = "stretch";
  return { tick: group.tick, notes, min, max, pin, kind };
}

// Fingers for a group wider than five steps: outer notes take the outer fingers, a middle note 2 or 3.
function stretchFingers(g, hand) {
  const sorted = g.notes.map((n, i) => ({ i, midi: n.note.midi })).sort((a, b) => a.midi - b.midi);
  const fingers = Array(g.notes.length).fill(null);
  const [low, high] = [sorted[0], sorted.at(-1)];
  fingers[low.i] = hand === "L" ? 5 : 1;
  fingers[high.i] = hand === "L" ? 1 : 5;
  if (sorted.length === 3) {
    const lowerGap = sorted[1].midi - low.midi;
    const upperGap = high.midi - sorted[1].midi;
    // Closer to the thumb side takes 2, closer to the little finger takes 3, equal gaps take 3.
    const nearThumb = hand === "L" ? upperGap < lowerGap : lowerGap < upperGap;
    fingers[sorted[1].i] = nearThumb ? 2 : 3;
  }
  return fingers;
}

/** Position of one group: anchor step, the thumb key, and the five-step range as spelled pitches. */
function positionOf(anchor, hand, key) {
  const thumb = hand === "L" ? anchor + 4 : anchor;
  return { anchorStep: anchor, thumbPitch: stepToPitch(thumb, key), lowPitch: stepToPitch(anchor, key), highPitch: stepToPitch(anchor + 4, key) };
}

function loosePosition(g, hand, key) {
  const byMidi = [...g.notes].sort((a, b) => a.note.midi - b.note.midi);
  const [low, high] = [byMidi[0], byMidi.at(-1)];
  const spell = (n) => n.note.pitch ?? stepToPitch(n.step, key);
  return { anchorStep: low.step, thumbPitch: spell(hand === "L" ? high : low), lowPitch: spell(low), highPitch: spell(high) };
}

/**
 * assignFingering(groups, { hand, key }) -> one result per group:
 *   { tick, fingers: (number|null)[], position: { anchorStep, thumbPitch, lowPitch, highPitch }, shift, unplayable }.
 * `groups` is [{ tick, notes: [{ midi, pitch, finger? }] }], the onset groups of ONE hand sorted by tick;
 * `fingers` follows the order of `notes`. Right hand: finger = step - anchor + 1 (the thumb on the lowest
 * step); left hand: finger = anchor + 4 - step + 1 (the thumb on the highest). A group within five steps
 * uses the position; a wider one within 12 semitones and up to three notes uses the stretch rule (outer
 * notes 1 and 5); anything else is `unplayable` with null fingers. Authored `finger` values pin the anchor
 * of their run and are always the finger reported for that note.
 */
export function assignFingering(groups, { hand = "R", key } = {}) {
  const info = groups.map((g) => describeGroup(g, hand));
  const out = Array(info.length);
  let previous = null; // anchor of the last positional run, for the closeness tie rule
  let i = 0;
  while (i < info.length) {
    const g = info[i];
    if (g.kind !== "positional") {
      const fingers = g.kind === "stretch" ? stretchFingers(g, hand) : g.notes.map(() => null);
      out[i] = { tick: g.tick, fingers, position: loosePosition(g, hand, key), shift: i > 0, unplayable: g.kind === "unplayable" };
      applyAuthored(out[i], g);
      previous = null;
      i += 1;
      continue;
    }
    // Grow the run while some anchor still fits every group of it (and authored pins agree).
    let lo = g.max - 4;
    let hi = g.min;
    let pin = g.pin;
    let end = i + 1;
    while (end < info.length && info[end].kind === "positional") {
      const next = info[end];
      const nlo = Math.max(lo, next.max - 4);
      const nhi = Math.min(hi, next.min);
      const npin = pin ?? next.pin;
      const agrees = pin === null || next.pin === null || pin === next.pin;
      if (nlo > nhi || !agrees || (npin !== null && (npin < nlo || npin > nhi))) break;
      [lo, hi, pin] = [nlo, nhi, npin];
      end += 1;
    }
    const run = info.slice(i, end);
    const anchor = pin ?? bestAnchor(run, lo, hi, hand, previous);
    for (let k = 0; k < run.length; k += 1) {
      const r = run[k];
      const fingers = r.notes.map((n) => (hand === "L" ? anchor + 4 - n.step + 1 : n.step - anchor + 1));
      out[i + k] = { tick: r.tick, fingers, position: positionOf(anchor, hand, key), shift: k === 0 && i > 0, unplayable: false };
      applyAuthored(out[i + k], r);
    }
    previous = anchor;
    i = end;
  }
  return out;
}

// An authored finger is reported as written, whatever the position says.
function applyAuthored(result, g) {
  g.notes.forEach((n, k) => {
    if (n.authored !== null) result.fingers[k] = n.authored;
  });
}

// Among the anchors that fit the whole run: no thumb on a black key it plays, the position starting as
// close as possible to the run's lowest note (on it when it can, so the right thumb or the left little
// finger takes it), the anchor closest to the previous one, then the lowest.
function bestAnchor(run, lo, hi, hand, previous) {
  const notes = run.flatMap((g) => g.notes);
  const lowest = Math.min(...notes.map((n) => n.step));
  const rank = (a) => {
    const thumb = hand === "L" ? a + 4 : a;
    const blackThumb = notes.some((n) => n.step === thumb && n.black) ? 1 : 0;
    return [blackThumb, Math.abs(a - lowest), previous === null ? 0 : Math.abs(a - previous), a];
  };
  let best = null;
  for (let a = lo; a <= hi; a += 1) {
    const r = rank(a);
    if (best === null || compare(r, best.r) < 0) best = { a, r };
  }
  return best.a;
}

const compare = (x, y) => {
  for (let k = 0; k < x.length; k += 1) if (x[k] !== y[k]) return x[k] - y[k];
  return 0;
};
