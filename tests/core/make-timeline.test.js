import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTimeline, activeAt } from "../../src/core/timeline.js";
import { schedulableNotes } from "../../src/core/practice.js";
import { ticksPerBar } from "../../src/core/timing.js";
import { rig } from "../audio/engine-rig.js";

test("makeTimeline gives whole bars with no notes and silent: false", () => {
  const tl = makeTimeline({ meter: { num: 4, den: 4 }, bpm: 72, bars: 64 });
  assert.equal(tl.notes.length, 0);
  assert.equal(tl.silent, false);
  assert.equal(tl.lengthTicks, 64 * 1920);
  assert.equal(tl.lengthTicks % ticksPerBar(tl.meter), 0);
  assert.deepEqual(tl.tempo, { bpm: 72, beatUnit: "quarter" });
  assert.equal(tl.pickupTicks, 0);
  assert.equal(tl.range, null);
  assert.deepEqual(tl.chords, []);
  assert.deepEqual(activeAt(tl, 100), []);
});

test("other meters give whole bars too, and the defaults are 4/4 at 60", () => {
  assert.equal(makeTimeline({ meter: { num: 3, den: 4 }, bars: 2 }).lengthTicks, 2 * 1440);
  const d = makeTimeline();
  assert.deepEqual([d.meter, d.tempo.bpm], [{ num: 4, den: 4 }, 60]);
});

test("bad meters or bar counts throw RangeError", () => {
  assert.throws(() => makeTimeline({ meter: { num: 0, den: 4 } }), RangeError);
  assert.throws(() => makeTimeline({ meter: null }), RangeError);
  assert.throws(() => makeTimeline({ bars: 0 }), RangeError);
  assert.throws(() => makeTimeline({ bars: 1.5 }), RangeError);
});

test("the engine fail-closed rule lets this timeline run (silent: false) and it still schedules no note", () => {
  const tl = makeTimeline({ bpm: 60, bars: 8 });
  assert.deepEqual(schedulableNotes(tl, { L: { muted: false }, R: { muted: false } }), []);
  const { engine, notes, clicks, run } = rig({ timeline: tl });
  engine.setMetronome({ enabled: true });
  const result = engine.play();
  assert.equal(result.silent, false, "the clock is not treated as a silent song");
  run(4.5);
  assert.equal(notes.length, 0, "nothing sounds but clicks");
  assert.ok(clicks.length >= 4, `clicks ${clicks.length}`);
  assert.equal(clicks[0].accent, true, "the first beat of the bar is accented");
  assert.equal(clicks[1].accent, false);
  engine.dispose();
});

test("counter-proof: a timeline without silent: false schedules nothing even when it has notes (fail closed stays on)", () => {
  const tl = { ...makeTimeline(), silent: undefined };
  assert.deepEqual(schedulableNotes({ ...tl, notes: [{ tick: 0, dur: 480, midi: 60, hand: "R" }] }, { L: { muted: false }, R: { muted: false } }), []);
});
