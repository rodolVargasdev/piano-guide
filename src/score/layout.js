// Pure notation layout for the score view. No DOM, no dependencies outside src/core.
//
// Units: x is measured in staff spaces (sp). Vertical placement is `pos`: half-spaces above
// the bottom line of the staff the note sits on (0 = bottom line, 4 = middle line, 8 = top
// line; negative and above 8 are ledger-line territory). The renderer owns the pixel scale.
// The right hand is engraved on the treble staff and the left hand on the bass staff;
// cross-staff notes are not supported.

import { parsePitch, keyFifths } from "../core/pitch.js";
import { ticksPerBar } from "../core/timing.js";
import { placeStems, placeBeams, computedRests, placeTies, placeTuplets, placeGraces, placeOrnaments } from "./engraving.js";

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
// Diatonic step of the bottom line: E4 for the treble clef, G2 for the bass clef.
const BOTTOM_STEP = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };
const STAFF_OF_HAND = { R: "treble", L: "bass" };

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
// Treble-staff position of each signature accidental, in order of appearance. The bass staff
// uses the same pattern two half-spaces lower.
const SHARP_POS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_POS = [4, 7, 3, 6, 2, 5, 1];

const BASES = [
  ["whole", 1920],
  ["half", 960],
  ["quarter", 480],
  ["eighth", 240],
  ["16th", 120],
  ["32nd", 60],
];
const FLAGS = { whole: 0, half: 0, quarter: 0, eighth: 1, "16th": 2, "32nd": 3 };
const ACCIDENTAL_OF_ALTER = { "-2": "double-flat", "-1": "flat", 0: "natural", 1: "sharp", 2: "double-sharp" };

export const BAR_PAD = 3.4; // extra space before the first onset of a bar
export const BAR_OFFSET = 3.0; // the barline sits this far before that onset

/** Spacing and notehead metrics. Labelled noteheads are larger because they carry the note name. */
export function metricsFor(notation) {
  const labelled = notation === "labelled";
  const headW = labelled ? 2.1 : 1.2;
  // chordStep: the vertical distance (half-spaces) under which two heads of a chord must not share a column.
  return { headW, chordStep: Math.floor(headW * 2), minGap: labelled ? 3.6 : 2.4, gapK: labelled ? 3.6 : 3, maxGap: 14 };
}

/** Half-spaces above the bottom line for a parsed pitch on `clef` ("treble" or "bass"). */
export function staffPos(parsed, clef) {
  return parsed.octave * 7 + LETTERS.indexOf(parsed.letter) - BOTTOM_STEP[clef];
}

/**
 * Notated value of a duration in ticks: { base, dots }. A tuplet event stores its actual
 * (shortened) duration, so the written value is dur * n / inSpaceOf. A value that cannot be
 * written is approximated by the longest base that fits and flagged `approximate`.
 */
export function durationShape(dur, tuplet) {
  const nominal = tuplet ? (dur * tuplet.n) / tuplet.inSpaceOf : dur;
  for (const [base, ticks] of BASES) {
    if (nominal === ticks) return { base, dots: 0 };
    if (nominal === ticks * 1.5) return { base, dots: 1 };
    if (nominal === ticks * 1.75) return { base, dots: 2 };
  }
  const fit = BASES.find(([, ticks]) => ticks <= nominal) ?? BASES[BASES.length - 1];
  return { base: fit[0], dots: 0, approximate: true };
}

/** Key signature as { fifths, kind, treble: [{ letter, pos }], bass: [...] } plus the default alter per letter. */
export function keySignature(key) {
  const fifths = keyFifths(key) ?? 0;
  const kind = fifths > 0 ? "sharp" : fifths < 0 ? "flat" : null;
  const order = fifths > 0 ? SHARP_ORDER : FLAT_ORDER;
  const posTable = fifths > 0 ? SHARP_POS : FLAT_POS;
  const count = Math.min(7, Math.abs(fifths));
  const treble = order.slice(0, count).map((letter, i) => ({ letter, pos: posTable[i] }));
  const bass = treble.map((a) => ({ letter: a.letter, pos: a.pos - 2 }));
  const alters = Object.fromEntries(LETTERS.map((l) => [l, 0]));
  for (const a of treble) alters[a.letter] = fifths > 0 ? 1 : -1;
  return { fifths, kind, treble, bass, alters };
}

function gapWidth(gap, m) {
  return Math.min(m.maxGap, Math.max(m.minGap, m.gapK * (gap / 480) ** 0.75));
}

function makeTickToX(anchors) {
  const last = anchors.length - 1;
  return (tick) => {
    if (tick <= anchors[0].tick) return anchors[0].x;
    if (tick >= anchors[last].tick) return anchors[last].x;
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (anchors[mid].tick <= tick) lo = mid;
      else hi = mid;
    }
    const a = anchors[lo];
    const b = anchors[hi];
    return a.x + ((b.x - a.x) * (tick - a.tick)) / (b.tick - a.tick);
  };
}

/** Bars as [{ bar, startTick, endTick }]; the pickup is bar 0 and bar 1 follows it. */
export function barsOf(meter, pickupTicks, lengthTicks) {
  const len = ticksPerBar(meter);
  const bars = [];
  if (pickupTicks > 0) bars.push({ bar: 0, startTick: 0, endTick: Math.min(pickupTicks, lengthTicks) });
  for (let start = pickupTicks, n = 1; start < lengthTicks; start += len, n += 1) {
    bars.push({ bar: n, startTick: start, endTick: Math.min(start + len, lengthTicks) });
  }
  return bars;
}

function barIndexOf(tick, pickupTicks, barLen) {
  return tick < pickupTicks ? 0 : 1 + Math.floor((tick - pickupTicks) / barLen);
}

function buildEvents(notes) {
  const groups = new Map();
  notes.forEach((n, index) => {
    const staff = STAFF_OF_HAND[n.hand];
    if (!staff) return;
    const voice = n.voice ?? 1;
    const rest = n.rest === true;
    const parsed = rest ? null : parsePitch(n.pitch);
    if (!rest && !parsed) return;
    const key = `${staff}|${voice}|${n.tick}|${n.dur}|${n.grace ? 1 : 0}|${rest ? "r" : "n"}`;
    let e = groups.get(key);
    if (!e) {
      const shape = durationShape(n.dur, n.tuplet);
      e = { id: groups.size, staff, hand: n.hand, voice, tick: n.tick, dur: n.dur, kind: rest ? "rest" : "note", grace: n.grace === true, ...shape, flags: FLAGS[shape.base], notes: [] };
      if (n.tuplet) e.tuplet = n.tuplet;
      groups.set(key, e);
    }
    if (rest) return;
    const note = { index, pitch: n.pitch, midi: parsed.midi, letter: parsed.letter, alter: parsed.alter, octave: parsed.octave, pos: staffPos(parsed, staff), accidental: null };
    if (n.finger !== undefined) note.finger = n.finger;
    if (n.label !== undefined) note.label = n.label;
    if (n.ornament !== undefined) note.ornament = n.ornament;
    if (n.role !== undefined) note.role = n.role;
    if (n.tie) note.tie = true;
    e.notes.push(note);
  });
  const events = [...groups.values()];
  for (const e of events) e.notes.sort((a, b) => a.pos - b.pos);
  return events.sort((a, b) => a.tick - b.tick || (a.grace ? 0 : 1) - (b.grace ? 0 : 1) || a.id - b.id);
}

// An accidental is drawn when the note's alter differs from what is in force for that letter and
// octave: the key signature at the start of the bar, then earlier accidentals of the same bar.
function assignAccidentals(events, sig, tl) {
  const barLen = ticksPerBar(tl.meter);
  const inForce = new Map(); // `${staff}|${bar}|${letter}${octave}` -> alter
  for (const e of events) {
    if (e.kind !== "note") continue;
    const bar = barIndexOf(e.tick, tl.pickupTicks, barLen);
    for (const n of e.notes) {
      const k = `${e.staff}|${bar}|${n.letter}${n.octave}`;
      const current = inForce.get(k) ?? sig.alters[n.letter];
      if (n.alter !== current) {
        n.accidental = ACCIDENTAL_OF_ALTER[n.alter];
        inForce.set(k, n.alter);
      }
    }
  }
}

// Ledger lines an event needs: even positions below the staff (-2, -4, ...) and from 10 upward.
function placeLedgers(events) {
  for (const e of events) {
    if (e.kind !== "note") continue;
    const low = e.notes[0].pos;
    const high = e.notes[e.notes.length - 1].pos;
    const ledgers = [];
    for (let p = -2; p >= low; p -= 2) ledgers.push(p);
    for (let p = 10; p <= high; p += 2) ledgers.push(p);
    e.ledgers = ledgers;
  }
}

/**
 * Lays out a resolved timeline (see core/timeline.resolveLevel; `key` is required for the
 * signature). Returns { notation, metrics, keySignature, meter, measures, anchors, tickToX,
 * events, beams, ties, tuplets, ornaments, width }. Each event is one chord or rest of one
 * hand and voice with its x (staff spaces), stem, ledger lines and notes (pos, accidental).
 * `anchors` is the complete tick to x table: every onset, bar start, chord, analysis entry,
 * tick 0 and the end.
 */
export function layoutScore(tl, { notation = tl.notation } = {}) {
  const metrics = metricsFor(notation);
  const sig = keySignature(tl.key);
  const measures = barsOf(tl.meter, tl.pickupTicks, tl.lengthTicks);
  const events = buildEvents(tl.notes);
  // Levels that are not strictBars leave gaps; the score writes them as rests.
  if (!tl.strictBars) events.push(...computedRests(events, tl, durationShape));
  events.sort((a, b) => a.tick - b.tick || (a.grace ? 0 : 1) - (b.grace ? 0 : 1) || a.id - b.id);
  events.forEach((e, i) => (e.id = i));

  const barStarts = new Set(measures.map((m) => m.startTick).concat(tl.lengthTicks));
  const ticks = new Set([0, tl.lengthTicks, ...barStarts]);
  for (const e of events) if (!e.grace) ticks.add(e.tick);
  for (const c of tl.chords ?? []) ticks.add(c.tick);
  for (const a of tl.analysis ?? []) {
    ticks.add(a.tick);
    if (a.endTick !== undefined) ticks.add(a.endTick);
  }
  const sorted = [...ticks].filter((t) => t >= 0 && t <= tl.lengthTicks).sort((a, b) => a - b);
  const anchors = [];
  let x = 0;
  sorted.forEach((tick, i) => {
    if (i > 0) x += gapWidth(tick - sorted[i - 1], metrics) + (barStarts.has(tick) ? BAR_PAD : 0);
    anchors.push({ tick, x });
  });
  const tickToX = makeTickToX(anchors);

  assignAccidentals(events, sig, tl);
  placeLedgers(events);
  placeStems(events, metrics);
  for (const e of events) e.x = tickToX(e.tick);
  placeGraces(events);
  const beams = placeBeams(events, tl, metrics);
  const ties = placeTies(events, metrics);
  const tuplets = placeTuplets(events, metrics);
  const ornaments = placeOrnaments(events, metrics);
  for (const m of measures) m.x = tickToX(m.startTick) - BAR_OFFSET;

  return { notation, metrics, keySignature: sig, meter: tl.meter, measures, anchors, tickToX, events, beams, ties, tuplets, ornaments, width: x };
}
