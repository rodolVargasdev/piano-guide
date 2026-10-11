// Pure practice rules: BPM clamp, loop normalization and passes, tempo ramp, hand modes.
// No DOM, no Web Audio. A loop is { startTick, endTick } on the song timeline, half-open.
import { ticksPerBar, ticksPerBeatUnit } from "./timing.js";

export const BPM_MIN = 20;
export const BPM_MAX = 240;

/** Integer BPM inside [BPM_MIN, BPM_MAX]. A value that is not a number gives BPM_MIN. */
export function clampBpm(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return BPM_MIN;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(v)));
}

/** BPM the engine plays: slow mode multiplies the user BPM (not clamped, so 20 can play at 10). */
export function effectiveBpm({ userBpm, slowMode, slowFactor = 0.5 }) {
  return slowMode ? userBpm * slowFactor : userBpm;
}

/**
 * Bar and beat boundaries are anchored at the first full bar (pickupTicks), so the
 * pickup counts as the tail of a virtual bar that starts before tick 0.
 */
function snapTick(t, mode, unit, barLen, pickupTicks) {
  const barStart = pickupTicks + Math.floor((t - pickupTicks) / barLen) * barLen;
  const rel = t - barStart;
  if (mode === "down") return barStart + Math.floor(rel / unit) * unit;
  return Math.min(barStart + Math.ceil(rel / unit) * unit, barStart + barLen);
}

/**
 * Valid loop for a user range, or null when nothing loopable results ("Loop not set").
 * Swaps an inverted range, snaps A down and B up to the bar or beat grid
 * (the beat is `tempo.beatUnit`), then clamps to [0, lengthTicks].
 */
export function normalizeLoop(range, { snap = "bar", meter, pickupTicks = 0, lengthTicks, tempo }) {
  if (!range || !Number.isFinite(range.startTick) || !Number.isFinite(range.endTick)) return null;
  const a = Math.min(range.startTick, range.endTick);
  const b = Math.max(range.startTick, range.endTick);
  const barLen = ticksPerBar(meter);
  const unit = snap === "beat" ? ticksPerBeatUnit(tempo.beatUnit) : barLen;
  const startTick = Math.max(0, snapTick(a, "down", unit, barLen, pickupTicks));
  const endTick = Math.min(lengthTicks, snapTick(b, "up", unit, barLen, pickupTicks));
  return endTick > startTick ? { startTick, endTick } : null;
}

/** Loop covering a named section. */
export function loopFromSection(section) {
  return { startTick: section.startTick, endTick: section.endTick };
}

/** True when the loop has a positive length. */
export function canRamp(loop) {
  return Boolean(loop) && loop.endTick > loop.startTick;
}

const completedPasses = (abs, loop) =>
  abs < loop.startTick ? 0 : Math.floor((abs - loop.startTick) / (loop.endTick - loop.startTick));

/**
 * Loop passes completed when the absolute position moves from `prevAbsTick` to `absTick`.
 * A pass completes exactly at its end boundary (start + n * length), counted once.
 */
export function passesBetween(prevAbsTick, absTick, loop) {
  if (!canRamp(loop)) return 0;
  return Math.max(0, completedPasses(absTick, loop) - completedPasses(prevAbsTick, loop));
}

/** Default ramp for a song: start at 60 percent, step 5, target the song tempo. */
export function defaultRamp(songBpm) {
  return { start: clampBpm(Math.round(0.6 * songBpm)), step: 5, target: clampBpm(songBpm) };
}

/** Clamp start and target, swap them when inverted, and keep the step a positive integer. */
export function normalizeRamp({ start, step, target }) {
  const a = clampBpm(start);
  const b = clampBpm(target);
  const s = Math.max(1, Math.round(Number(step)) || 1);
  return { start: Math.min(a, b), step: s, target: Math.max(a, b) };
}

/** BPM for the next pass: never above the target and never below the start. */
export function nextRampBpm({ current, start, step, target }) {
  return Math.max(start, Math.min(target, current + step));
}

const isOn = (modes, hand, flag) => !modes?.[hand]?.[flag];

/**
 * Tied notes sound once: a note with `tie: true` absorbs the following note of the same hand and
 * pitch that starts where it ends (and so on along the chain), and the absorbed notes are dropped.
 * Only the sounding list changes; the score still draws both notes. Input order is kept.
 */
export function mergeTies(notes) {
  if (!notes.some((n) => n.tie === true)) return notes;
  const starts = new Map(notes.filter((n) => n.midi !== null && n.midi !== undefined).map((n) => [`${n.hand}|${n.midi}|${n.tick}`, n]));
  const absorbed = new Set();
  const out = [];
  for (const n of notes) {
    if (absorbed.has(n)) continue;
    let end = n.tick + n.dur;
    let cur = n;
    while (cur.tie === true) {
      const next = starts.get(`${n.hand}|${n.midi}|${end}`);
      if (!next || next === cur || absorbed.has(next)) break;
      absorbed.add(next);
      end += next.dur;
      cur = next;
    }
    out.push(end === n.tick + n.dur ? n : { ...n, dur: end - n.tick });
  }
  return out;
}

/** Notes of hands that are not muted, with tied notes merged into one sounding note. */
export function audibleNotes(notes, handModes) {
  return mergeTies(notes.filter((n) => isOn(handModes, n.hand, "muted")));
}

/**
 * The notes the engine may schedule for a timeline: audible notes of a public song. Fails closed:
 * a timeline whose `silent` is not exactly `false` (private, or built by hand without the field)
 * schedules nothing, so no view can make a private song sound by mistake.
 */
export function schedulableNotes(timeline, handModes) {
  return timeline?.silent === false ? audibleNotes(timeline.notes, handModes) : [];
}

/** Notes of hands that are not hidden. */
export function visibleNotes(notes, handModes) {
  return notes.filter((n) => isOn(handModes, n.hand, "hidden"));
}
