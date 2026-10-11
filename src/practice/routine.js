// The 10-minute routine: what to practice today, built from the learner's progress, and the session that walks through
// its four blocks (a warm-up, a scale, a chord drill, an ear drill). `buildRoutine(progress, isoDate)` is a pure function
// of its two arguments: the same progress and the same day always give the same routine, and the keys move on after a
// day that was recorded. `routineReducer` tracks which block is current and how each one ended. No DOM, no storage.
import { daysBetween } from "./progress.js";
import { introOrder, circleOfFifths } from "../theory/keys.js";

/** The four blocks in order, with the exercise each one runs and its minutes (they add up to ten). */
export const BLOCKS = Object.freeze([
  { id: "warmup", minutes: 2 },
  { id: "scale", minutes: 3 },
  { id: "chords", minutes: 3 },
  { id: "ear", minutes: 2 },
]);

// The chord block rotates over three drills so every day brings a different one: triads and inversions, the cadence,
// and the progression that so many songs use. The ear block alternates intervals and chords by the parity of the day.
const CHORD_DRILLS = Object.freeze(["triads", "cadence-i-iv-v-i", "progression-i-v-vi-iv"]);
const EAR_DRILLS = Object.freeze(["ear-intervals", "ear-chords"]);

/** Whole days since 1970-01-01 of a YYYY-MM-DD date (NaN for anything else). */
export function dayNumber(isoDate) {
  return daysBetween("1970-01-01", isoDate);
}

// The key after `last` around the circle of fifths (C when there is none).
function nextWarmupKey(last) {
  const ring = circleOfFifths();
  const at = ring.indexOf(last);
  return at === -1 ? ring[0] : ring[(at + 1) % ring.length];
}

// The key of the scale: never practiced first, then the one practiced longest ago; ties and the never practiced follow the
// order of introduction. What counts as practiced is the routine's own record and any scale run on the exercise page.
function scaleKey(progress) {
  const seen = (key) => [progress.routine.scaleLastPracticed[key], progress.exercises["scale-major"]?.[key]?.lastPracticed].filter(Boolean).sort().at(-1) ?? null;
  const order = introOrder();
  return order.map((key, i) => ({ key, i, last: seen(key) })).sort((a, b) => (a.last ?? "").localeCompare(b.last ?? "") || a.i - b.i)[0].key;
}

/**
 * buildRoutine(progress, isoDate) -> { date, minutes, blocks: [{ id, exercise, key, minutes, options }] } or null for a
 * date that is not YYYY-MM-DD. `key` is a major tonic, or null for the ear drill.
 *   warm-up: the five-finger pattern in the key after the last warm-up on the circle of fifths (C the first time);
 *   scale:   the major scale in the key practiced least recently or never, in the order of introduction;
 *   chords:  triads, the cadence or the I-V-vi-IV progression in that same key, a different one each day;
 *   ear:     intervals or chords, alternating by the parity of the day.
 * The result depends only on `progress` and `isoDate`.
 */
export function buildRoutine(progress, isoDate) {
  const day = dayNumber(isoDate);
  if (!Number.isFinite(day)) return null;
  const key = scaleKey(progress);
  const warm = nextWarmupKey(progress.routine.lastWarmupKey);
  const by = Object.fromEntries(BLOCKS.map((b) => [b.id, b.minutes]));
  const blocks = [
    { id: "warmup", exercise: "five-finger", key: warm, minutes: by.warmup, options: { key: warm, hand: "R", quality: "major", direction: "updown" } },
    { id: "scale", exercise: "scale-major", key, minutes: by.scale, options: { key, hand: "R", octaves: 1, direction: "up" } },
    { id: "chords", exercise: CHORD_DRILLS[((day % 3) + 3) % 3], key, minutes: by.chords, options: { key } },
    { id: "ear", exercise: EAR_DRILLS[((day % 2) + 2) % 2], key: null, minutes: by.ear, options: {} },
  ];
  return { date: isoDate, minutes: blocks.reduce((sum, b) => sum + b.minutes, 0), blocks };
}

/** A routine as a session to walk through: every block pending, the first one current. */
export function startRoutine(routine) {
  return { date: routine.date, blocks: routine.blocks.map((b) => ({ ...b, status: "pending" })), current: 0, ended: routine.blocks.length === 0 };
}

const firstPending = (blocks) => blocks.findIndex((b) => b.status === "pending");

/**
 * routineReducer(session, { type }) -> session. DONE_BLOCK marks the current block done and moves to the next one,
 * SKIP_BLOCK marks it skipped and moves on, END skips everything still pending. The routine ends when no block is
 * pending: finishing or skipping the last open block ends it. Nothing changes once it has ended.
 */
export function routineReducer(session, action) {
  if (session.ended) return session;
  const settle = (status) => {
    const blocks = session.blocks.map((b, i) => (i === session.current ? { ...b, status } : b));
    const at = firstPending(blocks);
    return { ...session, blocks, current: at === -1 ? session.current : at, ended: at === -1 };
  };
  if (action.type === "DONE_BLOCK") return settle("done");
  if (action.type === "SKIP_BLOCK") return settle("skipped");
  if (action.type === "END") {
    const blocks = session.blocks.map((b) => (b.status === "pending" ? { ...b, status: "skipped" } : b));
    return { ...session, blocks, ended: true };
  }
  return session;
}

/**
 * summaryOfRoutine(session) -> { done, skipped, blocks: [{ id, exercise, key, status }], counts }: what to show at the
 * end and what `recordRoutine` takes. The day counts when at least one block was done.
 */
export function summaryOfRoutine(session) {
  const blocks = session.blocks.map(({ id, exercise, key, minutes, status }) => ({ id, exercise, key, minutes, status }));
  const done = blocks.filter((b) => b.status === "done").length;
  return { done, skipped: blocks.filter((b) => b.status === "skipped").length, counts: done > 0, blocks };
}
