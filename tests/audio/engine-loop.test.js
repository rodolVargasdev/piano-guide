import { test } from "node:test";
import assert from "node:assert/strict";
import { rig } from "./engine-rig.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const TPS = 576; // 72 BPM quarter
const quarters = (count) => ({
  meter: { num: 4, den: 4 },
  pickupTicks: 0,
  tempo: { bpm: 72, beatUnit: "quarter" },
  lengthTicks: count * 480,
  notes: Array.from({ length: count }, (_, i) => ({ tick: i * 480, dur: 480, midi: 60 + i, hand: i % 2 ? "L" : "R" })),
  pedal: [],
});
const LOOP = { startTick: 960, endTick: 1920 }; // bar 1 beats 3 and 4 of an 8-quarter song

test("a loop wraps seamlessly: 20 passes with no gap and no doubled note", () => {
  const { engine, notes, run } = rig({ timeline: quarters(8) });
  const passes = [];
  engine.on("loop-pass", () => passes.push(1));
  engine.setLoop(LOOP);
  engine.seek(960);
  engine.play();
  run(20 * (960 / TPS) + 0.2);
  const whens = notes.map((n) => n.when);
  assert.ok(whens.length >= 40);
  for (let i = 1; i < whens.length; i += 1) near(whens[i] - whens[i - 1], 480 / TPS, 1e-6);
  assert.deepEqual(notes.slice(0, 4).map((n) => n.midi), [62, 63, 62, 63], "the loop plays beats 3 and 4 over and over");
  assert.equal(passes.length, 20, "one loop-pass event per completed pass");
});

test("a loop never ends the song; without it the same run ends", () => {
  const withLoop = rig({ timeline: quarters(8) });
  let ended = 0;
  withLoop.engine.on("ended", () => (ended += 1));
  withLoop.engine.setLoop(LOOP);
  withLoop.engine.seek(960);
  withLoop.engine.play();
  withLoop.run(12);
  assert.equal(ended, 0);
  assert.ok(withLoop.engine.isPlaying());
  const without = rig({ timeline: quarters(8) });
  without.engine.on("ended", () => (ended += 1));
  without.engine.seek(960);
  without.engine.play();
  without.run(12);
  assert.equal(ended, 1);
});

test("a note straddling the loop end is cut at the loop end", () => {
  const tl = quarters(8);
  tl.notes[3].dur = 2000;
  const { engine, notes, run } = rig({ timeline: tl });
  engine.setLoop({ startTick: 0, endTick: 1920 });
  engine.play();
  run(3);
  const long = notes.find((n) => n.midi === 63);
  near(long.dur, (1920 - 1440) / TPS, 1e-9);
});

test("disabling the loop mid-playback lets the song continue past B to the end", () => {
  const { engine, run } = rig({ timeline: quarters(8) });
  let ended = 0;
  engine.on("ended", () => (ended += 1));
  engine.setLoop(LOOP);
  engine.seek(960);
  engine.play();
  run(3);
  engine.setLoop(null);
  run(6);
  assert.equal(ended, 1);
});

test("with a loop, stop and seek past the loop end go to the loop start", () => {
  const { engine } = rig({ timeline: quarters(8) });
  engine.setLoop(LOOP);
  engine.seek(3000);
  assert.equal(engine.position().tick, 960);
  engine.seek(1200);
  assert.equal(engine.position().tick, 1200);
  engine.stop();
  assert.equal(engine.position().tick, 960);
});

test("enabling a loop while the position is past B moves playback to A without cutting sounding notes", () => {
  const { engine, cancels, run } = rig({ timeline: quarters(8) });
  engine.play();
  run(3.5); // tick about 2000, past B
  engine.setLoop(LOOP);
  assert.equal(cancels.at(-1).releaseSounding, false);
  assert.ok(engine.position().tick >= 960 && engine.position().tick < 1920);
});

test("hand modes: muting one hand drops only its notes; both muted leaves the metronome", () => {
  const { engine, notes, clicks, run } = rig({ timeline: quarters(8) });
  engine.setHandModes({ L: { muted: true } });
  engine.play();
  run(1);
  assert.ok(notes.length > 0 && notes.every((n) => n.midi % 2 === 0), "only the right hand (even midi here) sounds");
  engine.setHandModes({ R: { muted: true } });
  engine.setMetronome({ enabled: true });
  const before = notes.length;
  run(1);
  assert.equal(notes.length, before, "no note sound with both hands muted");
  assert.ok(clicks.length > 0, "the metronome still clicks");
});

test("hiding a hand does not change the audio and muting state survives seek and a loop wrap", () => {
  const { engine, notes, run } = rig({ timeline: quarters(8) });
  engine.setHandModes({ R: { hidden: true } });
  engine.play();
  run(0.1);
  assert.equal(notes.length >= 1, true, "hidden is a view flag: the hand still sounds");
  engine.setHandModes({ L: { muted: true } });
  engine.setLoop(LOOP);
  engine.seek(960);
  notes.length = 0;
  run(8 * (960 / TPS));
  assert.ok(notes.length > 4 && notes.every((n) => n.midi % 2 === 0), "the left hand stays muted across seek and loop wraps");
});

test("muting a hand while playing fades its sounding notes; unmuting does not cut anything", () => {
  const { engine, cancels, run } = rig({ timeline: quarters(8) });
  engine.play();
  run(0.5);
  engine.setHandModes({ L: { muted: true } });
  assert.equal(cancels.at(-1).releaseSounding, true);
  engine.setHandModes({ L: { muted: false } });
  assert.equal(cancels.at(-1).releaseSounding, false);
});

function fakeDocument() {
  const handlers = [];
  return {
    hidden: false,
    handlers,
    addEventListener: (type, fn) => type === "visibilitychange" && handlers.push(fn),
    removeEventListener: (type, fn) => handlers.splice(handlers.indexOf(fn), 1),
    fire() {
      handlers.slice().forEach((fn) => fn());
    },
  };
}

test("hidden tab widens the look-ahead to 1.5 s and visible restores 120 ms", () => {
  const visible = rig();
  visible.engine.play();
  visible.run(2);
  assert.equal(visible.notes.length, 4, "chord 2 (at 3.4 s) is not scheduled yet with a 120 ms window");
  const doc = fakeDocument();
  const hidden = rig({ document: doc });
  hidden.engine.play();
  doc.hidden = true;
  doc.fire();
  hidden.run(2);
  assert.equal(hidden.notes.length, 8, "chord 2 is already queued with a 1.5 s window");
  doc.hidden = false;
  doc.fire();
  assert.equal(doc.handlers.length, 1);
});

test("a background timer that wakes up late catches up exactly once and keeps the position", () => {
  const doc = fakeDocument();
  const { ctx, engine, notes, fire } = rig({ document: doc });
  engine.play();
  doc.hidden = true;
  doc.fire();
  ctx.currentTime = 3; // the throttled timer slept for 3 s
  fire();
  assert.equal(notes.length, 8, "both chords are queued, each once");
  near(engine.position().tick, (3 - 0.05) * TPS, 1e-6);
  fire();
  assert.equal(notes.length, 8, "a second wake-up schedules nothing twice");
});

test("dispose removes the visibility listener", () => {
  const doc = fakeDocument();
  const { engine } = rig({ document: doc });
  assert.equal(doc.handlers.length, 1);
  engine.dispose();
  assert.equal(doc.handlers.length, 0);
});
