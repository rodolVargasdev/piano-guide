import { test } from "node:test";
import assert from "node:assert/strict";
import { unitsPerTick, groupY, horizonY, noteBox, fallingNotes, HORIZON_BARS, NOTE_GAP } from "../../src/scene/notes-layout.js";
import { LANDING_Y, WALL_HEIGHT } from "../../src/scene/dims.js";
import { ticksPerBar } from "../../src/core/timing.js";

const M44 = { num: 4, den: 4 };
const M128 = { num: 12, den: 8 };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("two bars fill the wall in both 4/4 and 12/8, so beats on screen are constant", () => {
  for (const meter of [M44, M128]) {
    near(unitsPerTick(meter) * ticksPerBar(meter) * HORIZON_BARS, WALL_HEIGHT);
  }
  // One bar of look-ahead (the Minimum tier) is half the wall.
  near(unitsPerTick(M44, 1) * ticksPerBar(M44), WALL_HEIGHT);
  near(horizonY(2), LANDING_Y + WALL_HEIGHT);
  near(horizonY(1), LANDING_Y + WALL_HEIGHT / 2);
});

test("arrival: when the engine tick equals the note tick, the lower edge touches the key-top line", () => {
  const upt = unitsPerTick(M44);
  for (const tick of [0, 480, 1920, 7777]) {
    const note = { tick, dur: 480 };
    near(groupY(tick, upt) + noteBox(note, upt).y, LANDING_Y);
  }
});

test("a note ahead is above the line by exactly its tick distance, and one already started is below it", () => {
  const upt = unitsPerTick(M44);
  const note = { tick: 1920, dur: 480 };
  near(groupY(1920 - 480, upt) + noteBox(note, upt).y - LANDING_Y, 480 * upt);
  assert.ok(groupY(1920 + 100, upt) + noteBox(note, upt).y < LANDING_Y);
});

test("duration is proportional: a note twice as long draws twice as high (up to the repeat gap)", () => {
  const upt = unitsPerTick(M44);
  const short = noteBox({ tick: 0, dur: 960 }, upt);
  const long = noteBox({ tick: 0, dur: 1920 }, upt);
  assert.ok(long.height > short.height);
  // Adding the fixed repeat gap back, the ratio is exactly 2.
  near((long.height + NOTE_GAP) / (short.height + NOTE_GAP), 2);
});

test("the repeat gap never swallows a very short note", () => {
  const upt = unitsPerTick(M44);
  const tiny = noteBox({ tick: 0, dur: 5 }, upt);
  assert.ok(tiny.height > 0);
  assert.ok(tiny.height >= 5 * upt * 0.6 - 1e-12);
});

test("position depends only on the tick: a seek needs no rebuild", () => {
  const upt = unitsPerTick(M44);
  assert.equal(groupY(5000, upt), groupY(5000, upt));
  near(groupY(0, upt), LANDING_Y);
  assert.ok(groupY(5000, upt) < groupY(0, upt), "the group moves down as time advances");
});

const VISIBLE = { L: { hidden: false }, R: { hidden: false } };
const tl = {
  notes: [
    { tick: 0, dur: 480, midi: 60, hand: "R" },
    { tick: 0, dur: 480, midi: 40, hand: "L" },
    { tick: 480, dur: 480, midi: 100, hand: "R" },
    { tick: 480, dur: 480, midi: null, hand: "R", rest: true },
  ],
};

test("fallingNotes keeps pitched notes inside the range and drops rests and out-of-range keys", () => {
  assert.deepEqual(fallingNotes(tl, VISIBLE, { low: 36, high: 72 }).map((n) => n.midi), [60, 40]);
  assert.deepEqual(fallingNotes(tl, VISIBLE, { low: 21, high: 108 }).map((n) => n.midi), [60, 40, 100]);
});

test("fallingNotes hides a hidden hand and keeps a muted one; counter-proof: both visible shows both", () => {
  const range = { low: 21, high: 108 };
  const hiddenRight = { L: { hidden: false }, R: { hidden: true } };
  assert.deepEqual(fallingNotes(tl, hiddenRight, range).map((n) => n.hand), ["L"]);
  const mutedRight = { L: { hidden: false }, R: { muted: true, hidden: false } };
  assert.equal(fallingNotes(tl, mutedRight, range).length, 3);
  assert.equal(fallingNotes(tl, undefined, range).length, 3);
});
