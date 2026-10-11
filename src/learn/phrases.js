// Phrases of a lesson: the slices of a song the learner practices one at a time. Pure, no DOM.
import { PPQ, ticksPerBar } from "../core/timing.js";

/** A silence shorter than this (an eighth note) is not a rest worth ending a phrase on. */
export const MIN_REST_TICKS = PPQ / 2;

const isSounding = (n) => n.rest !== true && n.grace !== true && n.midi !== null && n.midi !== undefined;

/** Merged [start, end) intervals where at least one pitched note of either hand sounds. */
function soundingSpans(notes) {
  const spans = [];
  for (const n of [...notes].filter(isSounding).sort((a, b) => a.tick - b.tick)) {
    const last = spans.at(-1);
    if (last && n.tick <= last[1]) last[1] = Math.max(last[1], n.tick + n.dur);
    else spans.push([n.tick, n.tick + n.dur]);
  }
  return spans;
}

/** Silences between sounding spans, as [start, end) with end the next onset. */
function restGaps(spans) {
  const gaps = [];
  for (let i = 1; i < spans.length; i += 1) {
    if (spans[i][0] - spans[i - 1][1] >= MIN_REST_TICKS) gaps.push([spans[i - 1][1], spans[i][0]]);
  }
  return gaps;
}

/**
 * derivePhrases(timeline) -> [{ id, startTick, endTick, title?, hint? }], never empty.
 * Authored `learn.phrases` win unchanged. Otherwise a phrase is about two bars (a pickup belongs to the
 * first phrase) and ends at a rest when one starts within half a bar of the two-bar mark; the next phrase
 * begins at the first note after that rest. Cuts fall on ticks, never inside an onset group, and a phrase
 * with no onset at all (trailing silence) is dropped.
 */
export function derivePhrases(timeline) {
  const authored = timeline.learn?.phrases;
  if (Array.isArray(authored) && authored.length > 0) {
    return authored.map((p) => ({ id: p.id, startTick: p.startTick, endTick: p.endTick, ...(p.title !== undefined ? { title: p.title } : {}), ...(p.hint !== undefined ? { hint: p.hint } : {}) }));
  }
  const bar = ticksPerBar(timeline.meter);
  const length = timeline.lengthTicks;
  const gaps = restGaps(soundingSpans(timeline.notes));
  const cuts = [];
  let start = 0;
  let first = true;
  while (start < length) {
    const nominal = start + (first ? (timeline.pickupTicks ?? 0) : 0) + 2 * bar;
    first = false;
    if (nominal >= length) {
      cuts.push([start, length]);
      break;
    }
    const near = gaps
      .filter(([a]) => a > start && Math.abs(a - nominal) <= bar / 2)
      .sort((x, y) => Math.abs(x[0] - nominal) - Math.abs(y[0] - nominal) || x[0] - y[0])[0];
    if (near) {
      cuts.push([start, near[0]]);
      start = near[1];
    } else {
      cuts.push([start, nominal]);
      start = nominal;
    }
  }
  const hasOnset = ([a, b]) => timeline.notes.some((n) => isSounding(n) && n.tick >= a && n.tick < b);
  const kept = cuts.filter(hasOnset);
  const spans = kept.length > 0 ? kept : [[0, length]];
  return spans.map(([startTick, endTick], i) => ({ id: `p${i + 1}`, startTick, endTick }));
}
