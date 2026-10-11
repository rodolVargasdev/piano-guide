// Turns a score layout into plain drawing descriptors. No DOM: render.js builds SVG elements
// from these nodes, and tests read them directly. A node is { tag, attrs, text?, children? }; numbers in
// attrs are rounded to two decimals. Coordinates are pixels; `unit` is the size of one staff
// space in pixels. Styling is by class only (the page CSP forbids inline styles).

import { GLYPHS, restGlyph, restHooks, waveLine, bracketPath } from "./glyphs.js";
import { noteName } from "../core/pitch.js";
import { BAR_OFFSET } from "./layout.js";

// Vertical layout in staff spaces from the top of the drawing.
export const TREBLE_TOP = 8;
export const BASS_TOP = 19;
const STAFF_TOP = { treble: TREBLE_TOP, bass: BASS_TOP };
export const HEIGHT_SP = 28;
export const HEIGHT_ANALYSIS_SP = 32;
const FINGER_ABOVE_SP = 2; // finger row baseline above the treble staff
const FINGER_BELOW_SP = 3.2; // finger row baseline below the bass staff
const CHORD_Y_SP = 1.8;
const ROMAN_Y_SP = 28.6;
const CALLOUT_Y_SP = 29.6;

const round = (v) => Math.round(v * 100) / 100;
export function node(tag, attrs = {}, text, children) {
  const out = { tag, attrs: {} };
  if (children) out.children = children;
  for (const [k, v] of Object.entries(attrs)) out.attrs[k] = typeof v === "number" ? round(v) : v;
  if (text !== undefined) out.text = String(text);
  return out;
}

/** Path nodes for one glyph, drawn at (x, y) pixels and scaled to `unit` pixels per staff space. */
export function glyph(name, x, y, unit, cls = "") {
  const g = GLYPHS[name];
  const transform = `translate(${round(x)} ${round(y)}) scale(${round(unit)})`;
  const out = [];
  if (g.stroke) out.push(node("path", { d: g.stroke, transform, class: `glyph-stroke ${cls}`.trim(), "stroke-width": g.w }));
  if (g.fill) out.push(node("path", { d: g.fill, transform, class: `glyph-fill ${cls}`.trim() }));
  return out;
}

/** y in pixels of `pos` half-spaces above the bottom line of a staff. */
export const yOf = (staff, pos, unit) => (STAFF_TOP[staff] + 4 - pos * 0.5) * unit;

function measureIndexOf(measures, x) {
  let lo = 0;
  let hi = measures.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measures[mid].x <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function drawHeader(layout, tl, unit) {
  const nodes = [];
  const sig = layout.keySignature;
  nodes.push(...glyph("gClef", 1.6 * unit, yOf("treble", 2, unit), unit));
  nodes.push(...glyph("fClef", 1.6 * unit, yOf("bass", 6, unit), unit));
  nodes.push(node("line", { class: "barline", x1: 0.5 * unit, x2: 0.5 * unit, y1: TREBLE_TOP * unit, y2: (BASS_TOP + 4) * unit }));
  for (const staff of ["treble", "bass"]) {
    sig[staff].forEach((a, i) => nodes.push(...glyph(sig.kind, (4.2 + i * 1.1) * unit, yOf(staff, a.pos, unit), unit)));
    const x = (4.2 + sig[staff].length * 1.1 + 1.4) * unit;
    nodes.push(node("text", { class: "time-sig", x, y: (STAFF_TOP[staff] + 1.95) * unit, "font-size": 2.3 * unit, "text-anchor": "middle" }, tl.meter.num));
    nodes.push(node("text", { class: "time-sig", x, y: (STAFF_TOP[staff] + 3.95) * unit, "font-size": 2.3 * unit, "text-anchor": "middle" }, tl.meter.den));
  }
  return { nodes, width: (4.2 + sig.treble.length * 1.1 + 1.4 + 2.4) * unit };
}

function drawNoteEvent(e, layout, opts, out) {
  const { unit } = opts;
  const labelled = layout.notation === "labelled";
  const s = e.small ? 0.7 : 1;
  const headW = layout.metrics.headW;
  const hand = `head-${e.hand}`;
  const hollow = e.base === "whole" || e.base === "half";
  for (const n of e.notes) {
    const cx = (e.x + n.dx) * unit;
    const cy = yOf(e.staff, n.pos, unit);
    const cls = `head ${hand}${hollow ? " hollow" : ""}`;
    if (labelled) {
      out.push(node("circle", { class: cls, cx, cy, r: (headW / 2) * unit * s }));
      const name = n.label ?? noteName(n.pitch, opts.names);
      if (name && !e.small) out.push(node("text", { class: "note-name", x: cx, y: cy, "font-size": unit * (name.length > 3 ? 0.72 : 0.9), "text-anchor": "middle", "dominant-baseline": "central" }, name));
    } else {
      out.push(node("ellipse", { class: cls, cx, cy, rx: 0.62 * unit * s, ry: 0.45 * unit * s, transform: `rotate(-20 ${round(cx)} ${round(cy)})` }));
    }
    if (n.accidental) out.push(...glyph(n.accidental, cx - (headW / 2 + 0.9) * unit * s, cy, unit * s, "accidental"));
    for (let k = 0; k < e.dots; k += 1) out.push(node("circle", { class: "dot", cx: cx + (headW / 2 + 0.6 + k * 0.5) * unit, cy: n.pos % 2 === 0 ? cy - 0.5 * unit : cy, r: 0.18 * unit }));
  }
  const half = (headW / 2 + 0.45) * unit;
  for (const p of e.ledgers) out.push(node("line", { class: "ledger", x1: e.x * unit - half, x2: e.x * unit + half, y1: yOf(e.staff, p, unit), y2: yOf(e.staff, p, unit) }));
  if (!e.stem) return;
  const x = (e.x + e.stem.dx) * unit;
  const y2 = yOf(e.staff, e.stem.toPos, unit);
  out.push(node("line", { class: "stem", x1: x, x2: x, y1: yOf(e.staff, e.stem.fromPos, unit), y2 }));
  if (e.stem.beamed) return;
  const up = e.stem.dir === "up";
  for (let k = 0; k < e.flags; k += 1) out.push(...glyph(up ? "flagUp" : "flagDown", x, y2 + (up ? 1 : -1) * k * 0.9 * unit, unit * s));
}

function drawRest(e, unit, out) {
  const { staff } = e;
  const x = e.x * unit;
  const base = e.base;
  const y = base === "whole" ? yOf(staff, 6, unit) : yOf(staff, 4, unit);
  const hooks = restHooks(base);
  if (hooks > 1) for (let k = 0; k < hooks; k += 1) out.push(...glyph("restEighth", x, y + (k - (hooks - 1) / 2) * unit, unit, "rest"));
  else out.push(...glyph(restGlyph(base), x, y, unit, "rest"));
  for (let k = 0; k < e.dots; k += 1) out.push(node("circle", { class: "dot", cx: x + (0.9 + k * 0.5) * unit, cy: yOf(staff, 5, unit), r: 0.18 * unit }));
}

function drawBeam(b, unit, out) {
  const sgn = b.dir === "up" ? 1 : -1;
  const line = (x1, x2, off) => out.push(node("line", { class: "beam", x1, x2, y1: yOf(b.staff, b.pos1, unit) + off, y2: yOf(b.staff, b.pos2, unit) + off, "stroke-width": 0.5 * unit }));
  line(b.x1 * unit, b.x2 * unit, 0);
  const at = (x) => b.pos1 + ((b.pos2 - b.pos1) * (x - b.x1)) / (b.x2 - b.x1);
  for (const seg of b.secondary) {
    const off = sgn * (seg.level - 1) * 0.8 * unit;
    out.push(node("line", { class: "beam", x1: seg.x1 * unit, x2: seg.x2 * unit, y1: yOf(b.staff, at(seg.x1), unit) + off, y2: yOf(b.staff, at(seg.x2), unit) + off, "stroke-width": 0.5 * unit }));
  }
}

function drawTie(t, unit, out) {
  const y = yOf(t.staff, t.pos, unit) + (t.dir === "up" ? -0.8 : 0.8) * unit;
  const lift = (t.dir === "up" ? -1.1 : 1.1) * unit;
  out.push(node("path", { class: "tie", d: `M${round(t.x1 * unit)} ${round(y)}Q${round(((t.x1 + t.x2) / 2) * unit)} ${round(y + lift)} ${round(t.x2 * unit)} ${round(y)}` }));
}

function drawTuplet(t, unit, out) {
  const y = yOf(t.staff, t.pos, unit);
  const tick = (t.dir === "up" ? 0.5 : -0.5) * unit;
  if (!t.beamed) out.push(node("path", { class: "tuplet", d: `M${round(t.x1 * unit)} ${round(y + tick)}V${round(y)}H${round(t.x2 * unit)}V${round(y + tick)}` }));
  out.push(node("text", { class: "tuplet-number", x: ((t.x1 + t.x2) / 2) * unit, y: y + (t.dir === "up" ? -0.3 : 1.1) * unit, "font-size": 1.1 * unit, "text-anchor": "middle" }, t.n));
}

function drawOrnament(o, unit, out) {
  const x = o.x * unit;
  const y = yOf(o.staff, o.pos, unit);
  if (o.kind === "trill") {
    out.push(node("text", { class: "ornament-text", x: x - 0.9 * unit, y, "font-size": 1.5 * unit }, "tr"));
    out.push(node("path", { class: "glyph-stroke", d: waveLine(3), transform: `translate(${round(x + 0.7 * unit)} ${round(y - 0.4 * unit)}) scale(${round(unit)})`, "stroke-width": 0.16 }));
  } else if (o.kind === "fioritura") {
    out.push(node("path", { class: "glyph-stroke", d: bracketPath(Math.max(1, o.x2 - o.x1)), transform: `translate(${round(o.x1 * unit)} ${round(y)}) scale(${round(unit)})`, "stroke-width": 0.1 }));
  } else if (GLYPHS[o.kind]) out.push(...glyph(o.kind, x, y, unit, "ornament"));
}

// One finger row per hand: the fingers of the chord from the lowest note to the highest, only the notes that carry one.
function drawFingers(e, unit, out) {
  if (e.kind !== "note" || e.grace) return;
  const text = e.notes.filter((n) => n.finger !== undefined).map((n) => n.finger).join(" ");
  if (text === "") return;
  const y = e.staff === "treble" ? (TREBLE_TOP - FINGER_ABOVE_SP) * unit : (BASS_TOP + 4 + FINGER_BELOW_SP) * unit;
  out.push(node("text", { class: `finger finger-${e.hand}`, x: e.x * unit, y, "font-size": 1.1 * unit, "text-anchor": "middle" }, text));
}

// Roman numerals from the analysis entries, plus the chord track where an entry has none at that tick.
function drawAnalysis(tl, layout, unit, into) {
  const romans = new Map();
  for (const c of tl.chords ?? []) if (c.roman) romans.set(c.tick, c.roman);
  for (const a of tl.analysis ?? []) if (a.roman) romans.set(a.tick, a.roman);
  for (const [tick, roman] of romans) into(layout.tickToX(tick)).push(node("text", { class: "roman", x: layout.tickToX(tick) * unit, y: ROMAN_Y_SP * unit, "font-size": 1.3 * unit }, roman));
  for (const a of tl.analysis ?? []) {
    const x = layout.tickToX(a.tick) * unit;
    const w = (a.title.length * 0.6 + 1) * unit;
    const kids = [node("rect", { class: "callout-box", x, y: CALLOUT_Y_SP * unit, width: w, height: 1.7 * unit, rx: 0.3 * unit }), node("text", { class: "callout-text", x: x + 0.5 * unit, y: (CALLOUT_Y_SP + 1.2) * unit, "font-size": 0.95 * unit }, a.title), node("title", {}, `${a.title}: ${a.text}`)];
    if (a.endTick !== undefined) kids.push(node("line", { class: "callout-span", x1: x, x2: layout.tickToX(a.endTick) * unit, y1: (CALLOUT_Y_SP + 1.9) * unit, y2: (CALLOUT_Y_SP + 1.9) * unit }));
    into(layout.tickToX(a.tick)).push(node("g", { class: `callout callout-${a.kind}` }, undefined, kids));
  }
}

/**
 * Draws a layout. opts: { unit = 10 (pixels per staff space), names = "solfege" | "letters",
 * handModes = { L: { hidden }, R: { hidden } }, chords = true on the labelled notation (a chord
 * row of symbols only, never the roman numeral), analysis = false }. Returns
 * { unit, height, headerWidth, header, staffLines: { treble: [y x5], bass: [y x5] }, measures }
 * where each measure is { index, bar, x0, x1, nodes } holding everything whose x falls in it.
 * A hidden hand draws no notes, rests or beams; the staff lines, header and barlines stay.
 */
export function drawScore(layout, tl, opts = {}) {
  const unit = opts.unit ?? 10;
  const o = { unit, names: opts.names ?? "solfege" };
  const hidden = (staff) => opts.handModes?.[staff === "treble" ? "R" : "L"]?.hidden === true;
  const header = drawHeader(layout, tl, unit);
  const staffLines = { treble: [], bass: [] };
  for (const staff of ["treble", "bass"]) for (let i = 0; i < 5; i += 1) staffLines[staff].push(round((STAFF_TOP[staff] + i) * unit));

  const ms = layout.measures.map((m, i) => ({ index: i, bar: m.bar, x0: m.x * unit, x1: (i + 1 < layout.measures.length ? layout.measures[i + 1].x : layout.tickToX(tl.lengthTicks) - BAR_OFFSET) * unit, nodes: [] }));
  const into = (x) => ms[measureIndexOf(layout.measures, x)].nodes;
  ms.forEach((m, i) => {
    if (i > 0) m.nodes.push(node("line", { class: "barline", x1: m.x0, x2: m.x0, y1: TREBLE_TOP * unit, y2: (BASS_TOP + 4) * unit }));
    if (m.bar >= 2) m.nodes.push(node("text", { class: "bar-number", x: m.x0 + 0.4 * unit, y: (TREBLE_TOP - 0.7) * unit, "font-size": 0.9 * unit }, m.bar));
  });
  const end = ms[ms.length - 1];
  if (end) end.nodes.push(node("line", { class: "barline", x1: end.x1, x2: end.x1, y1: TREBLE_TOP * unit, y2: (BASS_TOP + 4) * unit }), node("line", { class: "barline thick", x1: end.x1 + 0.35 * unit, x2: end.x1 + 0.35 * unit, y1: TREBLE_TOP * unit, y2: (BASS_TOP + 4) * unit }));

  for (const e of layout.events) {
    if (hidden(e.staff)) continue;
    const out = into(e.x);
    if (e.kind === "rest") drawRest(e, unit, out);
    else {
      drawNoteEvent(e, layout, o, out);
      drawFingers(e, unit, out);
    }
  }
  for (const b of layout.beams) if (!hidden(b.staff)) drawBeam(b, unit, into(b.x1));
  for (const t of layout.ties) if (!hidden(t.staff)) drawTie(t, unit, into(t.x1));
  for (const t of layout.tuplets) if (!hidden(t.staff)) drawTuplet(t, unit, into(t.x1));
  for (const r of layout.ornaments) if (!hidden(r.staff)) drawOrnament(r, unit, into(r.x));
  if (opts.chords ?? layout.notation === "labelled") {
    for (const c of tl.chords ?? []) into(layout.tickToX(c.tick)).push(node("text", { class: "chord", x: layout.tickToX(c.tick) * unit - 0.6 * unit, y: CHORD_Y_SP * unit, "font-size": 1.5 * unit }, c.symbol));
  }
  if (opts.analysis) drawAnalysis(tl, layout, unit, into);
  return { unit, height: (tl.analysis?.length ? HEIGHT_ANALYSIS_SP : HEIGHT_SP) * unit, headerWidth: header.width, header: header.nodes, staffLines, measures: ms };
}
