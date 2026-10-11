import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveLevel } from "../../src/core/timeline.js";
import { createMarkerPlan, ringStrength, MAX_MARKERS, GHOST_ALPHA, HAND_BIT } from "../../src/scene/marker-plan.js";

const BEAT = 480; // quarter-note beat in these fixtures

// A tiny resolved timeline: the plan only reads notes (sorted), tempo and shifts.
function tl(notes, shifts = []) {
  const sorted = notes.map((x) => ({ midi: x.rest ? null : x.midi, ...x })).sort((a, b) => a.tick - b.tick);
  return { notes: sorted, tempo: { bpm: 72, beatUnit: "quarter" }, shifts: new Set(shifts) };
}
const note = (tick, midi, finger, hand = "R", dur = 480) => ({ tick, dur, midi, hand, finger });
const rows = (plan) => Array.from({ length: plan.count }, (_, i) => ({ midi: plan.midi[i], hand: plan.hand[i], finger: plan.finger[i], ghost: plan.ghost[i], ring: plan.ring[i] }));

test("a sounding note with a finger gets a full-strength marker with its number", () => {
  const plan = createMarkerPlan(tl([note(0, 64, 3)]));
  assert.equal(plan.update(100), 1);
  assert.deepEqual(rows(plan), [{ midi: 64, hand: HAND_BIT.R, finger: 3, ghost: 0, ring: 0 }]);
});

test("a note starting within the next beat is a ghost; one farther away, or already ended, is not shown", () => {
  const plan = createMarkerPlan(tl([note(0, 60, 1), note(960, 64, 3), note(2400, 67, 5)]));
  plan.update(500); // the first ended at 480; the second starts in 460 ticks; the third is far away
  assert.deepEqual(rows(plan), [{ midi: 64, hand: HAND_BIT.R, finger: 3, ghost: 1, ring: 0 }]);
  plan.update(960 - BEAT - 1); // 1 tick before the ghost window opens
  assert.deepEqual(rows(plan).filter((r) => r.midi === 64), []);
  plan.update(960 - BEAT);
  assert.equal(rows(plan).find((r) => r.midi === 64).ghost, 1);
  plan.update(960);
  assert.equal(rows(plan).find((r) => r.midi === 64).ghost, 0);
  plan.update(960 + 480); // end is exclusive
  assert.deepEqual(rows(plan).filter((r) => r.midi === 64), []);
});

test("the ghost strength is 40 percent", () => {
  assert.equal(GHOST_ALPHA, 0.4);
});

test("an event without a finger shows no marker and nothing errors (its key still lights elsewhere)", () => {
  const plan = createMarkerPlan(tl([{ tick: 0, dur: 480, midi: 64, hand: "R" }]));
  assert.equal(plan.update(0), 0);
  const withOut = createMarkerPlan(tl([{ tick: 0, dur: 480, midi: 64, hand: "R", finger: 9 }, { tick: 0, dur: 480, midi: 66, hand: "R", finger: 0 }]));
  assert.equal(withOut.update(0), 0, "a finger outside 1 to 5 is no finger");
});

test("a shift destination gets a ring one beat early, with or without a finger", () => {
  const plan = createMarkerPlan(tl([note(0, 60, 1), note(960, 80, 5), note(1440, 40, undefined, "L")], [1, 2]));
  plan.update(960 - BEAT);
  assert.deepEqual(rows(plan).filter((r) => r.midi === 80), [{ midi: 80, hand: HAND_BIT.R, finger: 5, ghost: 1, ring: 1 }]);
  plan.update(1440 - BEAT);
  assert.deepEqual(rows(plan).filter((r) => r.midi === 40), [{ midi: 40, hand: HAND_BIT.L, finger: 0, ghost: 1, ring: 1 }], "ring only, no number");
  plan.update(10);
  assert.equal(rows(plan).find((r) => r.midi === 60).ring, 0, "a note that is not a shift has no ring");
});

test("a hidden hand shows nothing; a muted hand still does", () => {
  const plan = createMarkerPlan(tl([note(0, 64, 3, "R"), note(0, 48, 5, "L")]));
  const modes = { L: { muted: true, hidden: false }, R: { muted: false, hidden: true } };
  plan.update(0, modes);
  assert.deepEqual(rows(plan).map((r) => r.midi), [48]);
  plan.update(0, { L: { hidden: false }, R: { hidden: false } });
  assert.equal(plan.count, 2);
});

test("a repeated note on one key shows one marker, the sounding one winning over the ghost", () => {
  const plan = createMarkerPlan(tl([note(0, 64, 3, "R", 480), note(480, 64, 3, "R", 480)]));
  plan.update(470); // the first is nearly over, the second starts in 10 ticks
  assert.equal(plan.count, 1);
  assert.equal(plan.ghost[0], 0);
});

test("the plan never grows past its capacity and reuses its arrays between frames", () => {
  const many = Array.from({ length: 40 }, (_, i) => note(0, 30 + i, 1 + (i % 5)));
  const plan = createMarkerPlan(tl(many));
  const arrays = [plan.midi, plan.hand, plan.finger, plan.ghost, plan.ring];
  assert.equal(plan.update(0), MAX_MARKERS);
  plan.update(10);
  assert.deepEqual([plan.midi, plan.hand, plan.finger, plan.ghost, plan.ring], arrays, "the same typed arrays on every call");
});

test("a long note that began long before the tick is still found (lower bound uses the longest note)", () => {
  const plan = createMarkerPlan(tl([note(0, 64, 2, "R", 4000), note(900, 60, 1), note(1000, 62, 1)]));
  plan.update(2000);
  assert.deepEqual(rows(plan).map((r) => r.midi), [64]);
});

test("rests are never shown", () => {
  const plan = createMarkerPlan(tl([{ tick: 0, dur: 480, hand: "R", rest: true, finger: 2 }]));
  assert.equal(plan.update(0), 0);
});

test("ringStrength pulses once per beat between 0.35 and 1, and is a steady 1 under reduced motion", () => {
  const values = Array.from({ length: 48 }, (_, i) => ringStrength((i * BEAT) / 48, BEAT, false));
  assert.ok(Math.min(...values) >= 0.35 - 1e-9 && Math.max(...values) <= 1 + 1e-9);
  assert.ok(Math.max(...values) - Math.min(...values) > 0.5, "it really pulses");
  assert.ok(Math.abs(ringStrength(0, BEAT, false) - ringStrength(BEAT, BEAT, false)) < 1e-9, "one period per beat");
  for (const t of [0, 100, 240, 777]) assert.equal(ringStrength(t, BEAT, true), 1);
});

test("on the real Nocturne, the key that takes a shift gets a ring a beat early and a within-position note does not", () => {
  const song = JSON.parse(readFileSync(new URL("../../songs/chopin-nocturne-op9-no2.json", import.meta.url), "utf8"));
  const timeline = resolveLevel(song, "original");
  const plan = createMarkerPlan(timeline);
  const beat = plan.beat;
  assert.equal(beat, 720, "dotted-quarter beat");
  // RH C6 (midi 84, finger 5) at tick 3840 is a leap from C5 (72): a ring, with its number.
  plan.update(3840 - beat);
  const c6 = rows(plan).find((r) => r.midi === 84 && r.hand === HAND_BIT.R);
  assert.deepEqual(c6, { midi: 84, hand: HAND_BIT.R, finger: 5, ghost: 1, ring: 1 });
  // RH F5 (77, finger 3) at tick 1200 follows G5 (79): inside the hand position, so no ring.
  plan.update(1200);
  const f5 = rows(plan).find((r) => r.midi === 77 && r.hand === HAND_BIT.R);
  assert.deepEqual(f5, { midi: 77, hand: HAND_BIT.R, finger: 3, ghost: 0, ring: 0 });
});
