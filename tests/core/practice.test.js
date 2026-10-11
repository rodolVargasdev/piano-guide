import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BPM_MIN,
  BPM_MAX,
  clampBpm,
  effectiveBpm,
  normalizeLoop,
  loopFromSection,
  passesBetween,
  canRamp,
  defaultRamp,
  normalizeRamp,
  nextRampBpm,
  audibleNotes,
  visibleNotes,
} from "../../src/core/practice.js";

const M44 = { num: 4, den: 4 };
const M128 = { num: 12, den: 8 };
const ctx44 = { snap: "bar", meter: M44, pickupTicks: 0, lengthTicks: 7680, tempo: { bpm: 72, beatUnit: "quarter" } };
const ctx128 = { snap: "bar", meter: M128, pickupTicks: 480, lengthTicks: 480 + 2880 * 4, tempo: { bpm: 60, beatUnit: "dotted-quarter" } };

test("clampBpm bounds, rounds and survives garbage", () => {
  assert.equal(BPM_MIN, 20);
  assert.equal(BPM_MAX, 240);
  assert.equal(clampBpm(500), 240);
  assert.equal(clampBpm(5), 20);
  assert.equal(clampBpm(72), 72);
  assert.equal(clampBpm(72.6), 73);
  assert.equal(clampBpm("90"), 90);
  assert.equal(clampBpm(Infinity), 240);
  assert.equal(clampBpm(-Infinity), 20);
  assert.equal(clampBpm(NaN), 20);
  assert.equal(clampBpm("abc"), 20);
});

test("effectiveBpm applies slow mode and restores on disable", () => {
  assert.equal(effectiveBpm({ userBpm: 100, slowMode: true }), 50);
  assert.equal(effectiveBpm({ userBpm: 100, slowMode: false }), 100);
  assert.equal(effectiveBpm({ userBpm: 100, slowMode: true, slowFactor: 0.75 }), 75);
});

test("normalizeLoop swaps an inverted range", () => {
  assert.deepEqual(normalizeLoop({ startTick: 3840, endTick: 1920 }, ctx44), { startTick: 1920, endTick: 3840 });
});

test("normalizeLoop snaps A down and B up on the bar grid", () => {
  assert.deepEqual(normalizeLoop({ startTick: 2000, endTick: 3000 }, ctx44), { startTick: 1920, endTick: 3840 });
  assert.deepEqual(normalizeLoop({ startTick: 1920, endTick: 3840 }, ctx44), { startTick: 1920, endTick: 3840 });
});

test("normalizeLoop snaps on the beat grid using tempo.beatUnit", () => {
  const beat = { ...ctx44, snap: "beat" };
  assert.deepEqual(normalizeLoop({ startTick: 500, endTick: 1000 }, beat), { startTick: 480, endTick: 1440 });
  const dotted = { ...ctx128, snap: "beat" };
  // first full bar starts at 480; beats are 720 ticks: 480, 1200, 1920, 2640
  assert.deepEqual(normalizeLoop({ startTick: 1300, endTick: 1900 }, dotted), { startTick: 1200, endTick: 1920 });
});

test("normalizeLoop honors the pickup as a partial bar", () => {
  assert.deepEqual(normalizeLoop({ startTick: 100, endTick: 600 }, ctx128), { startTick: 0, endTick: 480 + 2880 });
  assert.deepEqual(normalizeLoop({ startTick: 0, endTick: 480 }, ctx128), { startTick: 0, endTick: 480 });
});

test("normalizeLoop clamps to [0, lengthTicks]", () => {
  assert.deepEqual(normalizeLoop({ startTick: -500, endTick: 99999 }, ctx44), { startTick: 0, endTick: 7680 });
  assert.deepEqual(normalizeLoop({ startTick: 7000, endTick: 99999 }, ctx44), { startTick: 5760, endTick: 7680 });
});

test("normalizeLoop returns null for a zero-length or invalid result", () => {
  assert.equal(normalizeLoop({ startTick: 1920, endTick: 1920 }, ctx44), null);
  assert.equal(normalizeLoop({ startTick: 7680, endTick: 9000 }, ctx44), null);
  assert.equal(normalizeLoop({ startTick: -50, endTick: -10 }, ctx44), null);
  assert.equal(normalizeLoop(null, ctx44), null);
  assert.equal(normalizeLoop({ startTick: NaN, endTick: 100 }, ctx44), null);
});

test("loopFromSection returns the section range", () => {
  assert.deepEqual(loopFromSection({ id: "v", name: "Verse", startTick: 1920, endTick: 5760 }), { startTick: 1920, endTick: 5760 });
});

const LOOP = { startTick: 1920, endTick: 3840 };

test("passesBetween counts completed passes", () => {
  assert.equal(passesBetween(2000, 3000, LOOP), 0); // no pass
  assert.equal(passesBetween(3000, 4000, LOOP), 1); // one pass (abs 3840)
  assert.equal(passesBetween(3000, 7000, LOOP), 2); // two passes (3840, 5760)
  assert.equal(passesBetween(0, 1000, LOOP), 0); // before the loop
});

test("passesBetween counts a pass exactly once at its boundary", () => {
  assert.equal(passesBetween(3839, 3840, LOOP), 1);
  assert.equal(passesBetween(3840, 3841, LOOP), 0);
  assert.equal(passesBetween(1000, 1920, LOOP), 0); // loop start is not a completed pass
  assert.equal(passesBetween(3000, 3000, LOOP), 0);
  assert.equal(passesBetween(1920, 3840, LOOP), 1);
});

test("passesBetween without a usable loop and when moving backwards is 0", () => {
  assert.equal(passesBetween(0, 99999, null), 0);
  assert.equal(passesBetween(0, 99999, { startTick: 5, endTick: 5 }), 0);
  assert.equal(passesBetween(9000, 3000, LOOP), 0);
});

test("counter-proof: summing passesBetween over split steps equals one big step", () => {
  let total = 0;
  for (let t = 0; t < 20000; t += 137) total += passesBetween(t, Math.min(t + 137, 20000), LOOP);
  assert.equal(total, passesBetween(0, 20000, LOOP));
  assert.equal(total, 9);
});

test("ramp sequence 50, 55, 60, 65, 70 with target 70 and then holds", () => {
  const cfg = { start: 50, step: 5, target: 70 };
  const seq = [50];
  for (let i = 0; i < 6; i += 1) seq.push(nextRampBpm({ ...cfg, current: seq.at(-1) }));
  assert.deepEqual(seq, [50, 55, 60, 65, 70, 70, 70]);
});

test("ramp: a step larger than the gap lands on the target, and it never goes below the start", () => {
  assert.equal(nextRampBpm({ current: 68, start: 50, step: 5, target: 70 }), 70);
  assert.equal(nextRampBpm({ current: 40, start: 50, step: 5, target: 70 }), 50);
  assert.equal(nextRampBpm({ current: 50, start: 50, step: -10, target: 70 }), 50);
});

test("normalizeRamp swaps an inverted pair, clamps and fixes the step", () => {
  assert.deepEqual(normalizeRamp({ start: 90, step: 5, target: 60 }), { start: 60, step: 5, target: 90 });
  assert.deepEqual(normalizeRamp({ start: 5, step: 0, target: 500 }), { start: 20, step: 1, target: 240 });
  assert.deepEqual(normalizeRamp({ start: 60, step: "abc", target: 80 }), { start: 60, step: 1, target: 80 });
});

test("defaultRamp starts at 60 percent of the song tempo and targets the song tempo", () => {
  assert.deepEqual(defaultRamp(72), { start: 43, step: 5, target: 72 });
  assert.deepEqual(defaultRamp(25), { start: 20, step: 5, target: 25 });
});

test("canRamp needs an active loop", () => {
  assert.equal(canRamp(null), false);
  assert.equal(canRamp(undefined), false);
  assert.equal(canRamp({ startTick: 5, endTick: 5 }), false);
  assert.equal(canRamp(LOOP), true);
});

const NOTES = [
  { tick: 0, hand: "L", pitch: "C3" },
  { tick: 0, hand: "R", pitch: "C4" },
];

test("audibleNotes and visibleNotes follow the per-hand flags independently", () => {
  const modes = { L: { muted: true, hidden: false }, R: { muted: false, hidden: true } };
  assert.deepEqual(audibleNotes(NOTES, modes).map((n) => n.hand), ["R"]);
  assert.deepEqual(visibleNotes(NOTES, modes).map((n) => n.hand), ["L"]);
});

test("both hands muted gives no audible notes but they stay visible; missing modes mean active", () => {
  const both = { L: { muted: true, hidden: false }, R: { muted: true, hidden: false } };
  assert.deepEqual(audibleNotes(NOTES, both), []);
  assert.equal(visibleNotes(NOTES, both).length, 2);
  assert.equal(audibleNotes(NOTES, undefined).length, 2);
  assert.equal(visibleNotes(NOTES, {}).length, 2);
});
