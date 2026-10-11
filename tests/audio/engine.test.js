import { test } from "node:test";
import assert from "node:assert/strict";
import { rig } from "./engine-rig.js";
import { resolveLevel } from "../../src/core/timeline.js";
import { mutated } from "../fixtures/helpers.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
// Fixture: 4/4, 72 BPM quarter = 576 ticks per second; chords at tick 0 and 1920 (3.333 s), length 3840 (6.667 s).
const TPS = 576;

test("play resumes the context inside the call and schedules the first chord once", () => {
  const { ctx, engine, notes, run } = rig();
  assert.equal(ctx.resumed, 0);
  engine.play();
  assert.equal(ctx.resumed, 1, "the context is resumed synchronously, inside the user gesture");
  assert.equal(notes.length, 4);
  for (const n of notes) near(n.when, 0.05);
  near(notes[0].dur, 1920 / TPS);
  run(0.5);
  assert.equal(notes.length, 4, "nothing is scheduled twice");
});

test("each event is scheduled exactly once over the whole song and the song ends at 0 with an ended event", () => {
  const { engine, notes, run } = rig();
  const seen = [];
  engine.on("state", (e) => seen.push(e.state));
  let ended = 0;
  engine.on("ended", () => (ended += 1));
  engine.play();
  run(7);
  assert.equal(notes.length, 8);
  near(notes[4].when, 0.05 + 1920 / TPS, 1e-9);
  assert.equal(ended, 1);
  assert.equal(engine.isPlaying(), false);
  assert.equal(engine.position().tick, 0);
  assert.deepEqual(seen, ["playing", "stopped"]);
});

test("the end of the song releases everything", () => {
  const { engine, cancels, run } = rig();
  engine.play();
  run(7);
  assert.ok(cancels.some((c) => c.releaseSounding === true));
});

test("pause keeps the position and play resumes from it", () => {
  const { engine, notes, cancels, run } = rig();
  engine.play();
  run(1);
  const held = engine.position().tick;
  near(held, (1 - 0.05) * TPS, 1e-6);
  engine.pause();
  assert.ok(cancels.at(-1).releaseSounding);
  run(2);
  assert.equal(engine.position().tick, held, "the position does not move while paused");
  notes.length = 0;
  engine.play();
  run(0.2);
  assert.equal(notes.length, 0, "tick 1920 is still ahead, nothing replays the first chord");
  near(engine.position().tick, held + 0.15 * TPS, 1e-6);
});

test("seek during playback cancels pending voices and resumes from the new tick in the same call", () => {
  const { engine, notes, cancels, run } = rig();
  engine.play();
  run(0.5);
  const before = notes.length;
  engine.seek(1920);
  assert.equal(cancels.at(-1).releaseSounding, true);
  assert.equal(notes.length, before + 4, "the chord at 1920 is queued in the same call");
  assert.ok(notes.slice(before).every((n) => n.midi !== undefined));
  run(0.5);
  assert.equal(notes.length, before + 4, "no doubled notes");
  assert.ok(engine.position().tick >= 1920);
});

test("seek while paused only moves the position; seeks are clamped to the song", () => {
  const { engine, notes } = rig();
  engine.seek(960);
  assert.equal(engine.position().tick, 960);
  engine.seek(99999);
  assert.equal(engine.position().tick, 3840);
  engine.seek(-5);
  assert.equal(engine.position().tick, 0);
  assert.equal(notes.length, 0);
});

test("position reports bar, beat and seconds and reuses one object", () => {
  const { engine } = rig();
  engine.seek(1920 + 480);
  const p = engine.position();
  assert.deepEqual({ tick: p.tick, bar: p.bar, beat: p.beat }, { tick: 2400, bar: 2, beat: 2 });
  near(p.seconds, 2400 / TPS, 1e-9);
  assert.equal(engine.position(), p);
});

test("output latency is subtracted so views show what is heard", () => {
  const { engine, run } = rig({ latency: 0.1 });
  engine.play();
  run(1.05);
  near(engine.position().tick, 0.9 * TPS, 1e-6);
});

test("dispose stops the timer, suspends the context and drops listeners", () => {
  const { ctx, engine, hasTimer } = rig();
  let states = 0;
  engine.on("state", () => (states += 1));
  engine.play();
  assert.equal(hasTimer(), true);
  engine.dispose();
  assert.equal(hasTimer(), false);
  assert.equal(ctx.suspended, 1);
  const after = states;
  engine.stop();
  assert.equal(states, after, "listeners were dropped");
});

test("on returns an unsubscribe function", () => {
  const { engine } = rig();
  let n = 0;
  const off = engine.on("state", () => (n += 1));
  engine.play();
  off();
  engine.pause();
  assert.equal(n, 1);
});

test("seeking forward while playing never plays notes behind the new position", () => {
  const { engine, notes } = rig();
  engine.play();
  engine.seek(1000);
  assert.equal(notes.length, 4, "chord 1 from the first play only; nothing behind tick 1000");
});

test("a note whose note-off falls inside a pedal range is scheduled with the pedal flag", () => {
  const song = mutated((s) => (s.levels.beginner.pedal = [{ startTick: 1000, endTick: 2000 }]));
  const { engine, notes, run } = rig({ timeline: resolveLevel(song, "beginner") });
  engine.play();
  run(7);
  assert.ok(notes.slice(0, 4).every((n) => n.pedal === true), "chord 1 ends at 1920, inside the pedal");
  assert.ok(notes.slice(4).every((n) => n.pedal === false), "chord 2 ends at 3840, outside it");
});

test("a level switch while playing starts the notes of the new level that are already sounding, for their remaining length", () => {
  const { engine, notes, run } = rig();
  engine.play();
  run(0.5);
  const before = notes.length;
  engine.setTimeline(resolveLevel(mutated(() => {}), "beginner"), { tick: 1000 });
  assert.equal(notes.length, before + 4, "the chord that began at tick 0 is still sounding at tick 1000");
  for (const n of notes.slice(before)) near(n.dur, (1920 - 1000) / TPS, 1e-9);
  run(0.5);
  assert.equal(notes.length, before + 4, "nothing is started twice");
});

test("the sustained notes of a level switch are cut at the loop end", () => {
  const { engine, notes } = rig();
  engine.setLoop({ startTick: 0, endTick: 1500 });
  engine.play();
  const before = notes.length;
  engine.setTimeline(resolveLevel(mutated(() => {}), "beginner"), { tick: 1000 });
  assert.equal(notes.length, before + 4);
  for (const n of notes.slice(before)) near(n.dur, (1500 - 1000) / TPS, 1e-9);
});

test("counter-proof: a seek mid-note and a level switch while paused start nothing behind the position", () => {
  const { engine, notes } = rig();
  engine.play();
  const before = notes.length;
  engine.seek(1000);
  assert.equal(notes.length, before, "seek keeps its rule: no note behind the new position");
  engine.pause();
  const paused = notes.length;
  engine.setTimeline(resolveLevel(mutated(() => {}), "beginner"), { tick: 1000 });
  assert.equal(notes.length, paused, "nothing sounds while paused");
});
