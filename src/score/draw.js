// Turns a score layout into plain drawing descriptors. No DOM: render.js builds SVG elements
// from these nodes, and tests read them directly. A node is { tag, attrs, text? }; numbers in
// attrs are rounded to two decimals. Coordinates are pixels; `unit` is the size of one staff
// space in pixels. Styling is by class only (the page CSP forbids inline styles).

import { GLYPHS, restGlyph, restHooks } from "./glyphs.js";
import { noteName } from "../core/pitch.js";
import { BAR_OFFSET } from "./layout.js";

// Vertical layout in staff spaces from the top of the drawing.
export const TREBLE_TOP = 8;
export const BASS_TOP = 19;
const STAFF_TOP = { treble: TREBLE_TOP, bass: BASS_TOP };
export const HEIGHT_SP = 28;
export const HEIGHT_ANALYSIS_SP = 32;

const round = (v) => Math.round(v * 100) / 100;
export function node(tag, attrs = {}, text) {
  const out = { tag, attrs: {} };
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

/**
 * Draws a layout. opts: { unit = 10 (pixels per staff space), names = "solfege" | "letters",
 * handModes = { L: { hidden }, R: { hidden } } }. Returns
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
    else drawNoteEvent(e, layout, o, out);
  }
  for (const b of layout.beams) if (!hidden(b.staff)) drawBeam(b, unit, into(b.x1));
  return { unit, height: (tl.analysis?.length ? HEIGHT_ANALYSIS_SP : HEIGHT_SP) * unit, headerWidth: header.width, header: header.nodes, staffLines, measures: ms };
}
