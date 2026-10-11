// SVG score view: one continuous grand staff scrolling under a fixed playhead. It is a pure
// subscriber of the player loop (`render(tick)`); it never schedules or keeps time. The layout
// and the drawing come from layout.js and draw.js, this module only builds the SVG elements,
// moves the scroll group and steps per beat under reduced motion. Song text is always inserted
// with textContent.

import { layoutScore } from "./layout.js";
import { drawScore, HEIGHT_SP, HEIGHT_ANALYSIS_SP } from "./draw.js";
import { ticksPerBeatUnit, ticksPerBar } from "../core/timing.js";

const NS = "http://www.w3.org/2000/svg";
const BASE_UNIT = { labelled: 11, engraved: 10 };

/** Start of the beat that contains `tick` (the beat unit of the tempo, counted from the pickup). */
export function quantizeToBeat(tick, tl) {
  const beat = ticksPerBeatUnit(tl.tempo.beatUnit);
  return Math.max(0, Math.floor((tick - tl.pickupTicks) / beat) * beat + tl.pickupTicks);
}

/** Text alternative: `title` is "<song>, <level> score", `desc` summarizes key, meter, tempo and length. */
export function scoreText(title, tl) {
  const bars = Math.ceil((tl.lengthTicks - tl.pickupTicks) / ticksPerBar(tl.meter));
  const k = tl.key ? `${tl.key.tonic} ${tl.key.mode}, ` : "";
  return {
    title: `${title}, ${tl.label} score`,
    desc: `${k}${tl.meter.num}/${tl.meter.den}, ${tl.tempo.bpm} ${tl.tempo.beatUnit} beats per minute, ${bars} ${bars === 1 ? "bar" : "bars"}${tl.pickupTicks > 0 ? " after a pickup" : ""}.`,
  };
}

function build(doc, d) {
  const e = doc.createElementNS(NS, d.tag);
  for (const [k, v] of Object.entries(d.attrs)) e.setAttribute(k, String(v));
  if (d.text !== undefined) e.textContent = d.text;
  for (const c of d.children ?? []) e.append(build(doc, c));
  return e;
}

let clipSeq = 0;

/**
 * createScore(slot, { timeline, title, names, analysis, chords, doc }) mounts the SVG in `slot`.
 * Returns { setTimeline(tl, { title }), setMode({ names, analysis, chords }), setHandModes(m),
 * setReducedMotion(b), resize(), render(tick), dispose() }.
 */
export function createScore(slot, { timeline, title = "", names = "solfege", analysis = false, chords, doc = slot.ownerDocument } = {}) {
  let tl = timeline;
  let heading = title;
  let mode = { names, analysis, chords };
  let handModes;
  let reduced = false;
  let layout;
  let drawn;
  let unit = 10;
  let width = 800;
  let playheadX = 0;
  let svg = null;
  let scroll = null;
  let translate = null;
  let lastX = NaN;
  let lastTick = null;
  let builtSize = "";
  const clipId = `score-clip-${(clipSeq += 1)}`;

  function rebuild() {
    const analysisHeight = tl.analysis?.length ? HEIGHT_ANALYSIS_SP : HEIGHT_SP;
    const base = BASE_UNIT[tl.notation] ?? 10;
    const h = slot.clientHeight;
    unit = h > 0 ? Math.max(6, Math.min(base, h / analysisHeight)) : base;
    width = slot.clientWidth || 800;
    builtSize = `${slot.clientWidth}x${slot.clientHeight}`;
    layout = layout ?? layoutScore(tl);
    drawn = drawScore(layout, tl, { unit, names: mode.names, analysis: mode.analysis, chords: mode.chords, handModes });
    playheadX = Math.max(drawn.headerWidth + 3 * unit, width * 0.3);
    const text = scoreText(heading, tl);
    svg?.remove();
    svg = doc.createElementNS(NS, "svg");
    for (const [k, v] of Object.entries({ class: `score-svg score-${tl.notation}`, role: "img", viewBox: `0 0 ${width} ${drawn.height}`, preserveAspectRatio: "xMidYMid meet" })) svg.setAttribute(k, v);
    const t = doc.createElementNS(NS, "title");
    t.textContent = text.title;
    const desc = doc.createElementNS(NS, "desc");
    desc.textContent = text.desc;
    const clip = doc.createElementNS(NS, "clipPath");
    clip.setAttribute("id", clipId);
    const rect = doc.createElementNS(NS, "rect");
    for (const [k, v] of Object.entries({ x: drawn.headerWidth, y: 0, width: Math.max(0, width - drawn.headerWidth), height: drawn.height })) rect.setAttribute(k, String(v));
    clip.append(rect);
    const defs = doc.createElementNS(NS, "defs");
    defs.append(clip);
    const paper = doc.createElementNS(NS, "rect");
    for (const [k, v] of Object.entries({ class: "paper", x: 0, y: 0, width, height: drawn.height })) paper.setAttribute(k, String(v));
    const lines = doc.createElementNS(NS, "g");
    for (const ys of Object.values(drawn.staffLines)) for (const y of ys) lines.append(build(doc, { tag: "line", attrs: { class: "staff-line", x1: 0, x2: width, y1: y, y2: y } }));
    const header = doc.createElementNS(NS, "g");
    for (const d of drawn.header) header.append(build(doc, d));
    const clipped = doc.createElementNS(NS, "g");
    clipped.setAttribute("clip-path", `url(#${clipId})`);
    scroll = doc.createElementNS(NS, "g");
    scroll.setAttribute("transform", "translate(0 0)");
    clipped.append(scroll);
    const head = build(doc, { tag: "line", attrs: { class: "playhead", x1: playheadX, x2: playheadX, y1: 0, y2: drawn.height } });
    svg.append(t, desc, defs, paper, lines, header, clipped, head);
    slot.replaceChildren(svg);
    translate = scroll.transform.baseVal.getItem(0);
    for (const m of drawn.measures) {
      const g = doc.createElementNS(NS, "g");
      g.setAttribute("data-bar", String(m.bar));
      for (const d of m.nodes) g.append(build(doc, d));
      scroll.append(g);
    }
    lastX = NaN;
    // render(tick) is called every frame; this one call places the new drawing at the last tick.
    if (lastTick !== null) render(lastTick);
  }

  function render(tick) {
    lastTick = tick;
    if (!svg) return;
    const shown = reduced ? quantizeToBeat(tick, tl) : tick;
    const x = playheadX - layout.tickToX(shown) * unit;
    if (x !== lastX) {
      translate.setTranslate(x, 0);
      lastX = x;
    }
  }

  rebuild();
  return {
    setTimeline(next, { title: nextTitle } = {}) {
      tl = next;
      if (nextTitle !== undefined) heading = nextTitle;
      layout = undefined;
      rebuild();
    },
    setMode(next) {
      mode = { ...mode, ...next };
      rebuild();
    },
    setHandModes(modes) {
      handModes = modes;
      rebuild();
    },
    setReducedMotion(on) {
      reduced = on === true;
      lastX = NaN;
      if (lastTick !== null) render(lastTick);
    },
    resize() {
      if (`${slot.clientWidth}x${slot.clientHeight}` !== builtSize) rebuild();
    },
    render,
    dispose() {
      svg?.remove();
      svg = null;
      scroll = null;
      translate = null;
    },
  };
}
