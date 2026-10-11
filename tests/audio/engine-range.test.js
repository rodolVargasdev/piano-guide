import { test } from "node:test";
import assert from "node:assert/strict";
import { rig } from "./engine-rig.js";
import { resolveLevel } from "../../src/core/timeline.js";
import { BAR, Q, learnSong, line, note } from "../fixtures/learn-songs.js";

// Two bars at 72 BPM (576 ticks per second; 288 at the slow default of 36 BPM). Right hand: eight quarter
// notes C4 D4 E4 F4 G4 A4 B4 C5. Left hand: one whole note C3 on the first beat of each bar.
const RIGHT = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
const NOTES = [...line(RIGHT), note(0, BAR, "C3", "L"), note(BAR, BAR, "C3", "L")];
const MIDI = { C3: 48, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, C5: 72 };
const publicTimeline = () => learnSong({ notes: NOTES, bars: 2 }).timeline;
const privateTimeline = () => resolveLevel({ ...learnSong({ notes: NOTES, bars: 2 }).song, visibility: "private" }, "beginner");
const SLOW_TPS = (36 * 480) / 60;
const FULL_TPS = (72 * 480) / 60;
/** Settles a playRange promise after the clock ran; fails the test when it is still pending. */
const settled = async (promise) => Promise.race([promise, new Promise((resolve) => setImmediate(() => resolve("pending")))]);

test("a range plays only the notes whose onsets lie inside it, at the slow default, and stops itself", async () => {
  const { engine, notes, run } = rig({ timeline: publicTimeline() });
  const states = [];
  engine.on("state", (e) => states.push(e.state));
  const done = engine.playRange({ startTick: Q, endTick: 3 * Q, hand: "R" });
  assert.equal(engine.isRangePlaying(), true);
  run(10);
  assert.deepEqual(await settled(done), { status: "completed" });
  assert.deepEqual(notes.map((n) => n.midi), [MIDI.D4, MIDI.E4], "onsets at 480 and 960 only, no left-hand note");
  const gap = notes[1].when - notes[0].when;
  assert.ok(Math.abs(gap - Q / SLOW_TPS) < 1e-6, `slow tempo: ${gap}`);
  assert.equal(engine.isRangePlaying(), false);
  assert.equal(engine.isPlaying(), false);
  assert.deepEqual(states, ["playing", "stopped"]);
});

test("it does not finish early: the promise is pending while the range is still sounding", async () => {
  const { engine, run } = rig({ timeline: publicTimeline() });
  const done = engine.playRange({ startTick: 0, endTick: 4 * Q, hand: "R" });
  run(2); // 4 quarters at the slow tempo take 6.67 s
  assert.equal(await settled(done), "pending");
  run(6);
  assert.deepEqual(await settled(done), { status: "completed" });
});

test("a note that sounds past the end of the range is cut at it, so it is released without hanging on", async () => {
  const { engine, notes, run } = rig({ timeline: publicTimeline() });
  const done = engine.playRange({ startTick: 0, endTick: BAR / 2, hand: "L" });
  run(10);
  await done;
  assert.equal(notes.length, 1);
  assert.ok(Math.abs(notes[0].dur - BAR / 2 / SLOW_TPS) < 1e-6, "a whole note cut to half a bar");
});

test("an explicit bpm plays at that tempo; the default is never faster than the slow fraction of the song tempo", async () => {
  const slow = rig({ timeline: publicTimeline() });
  const a = slow.engine.playRange({ startTick: 0, endTick: 2 * Q, hand: "R" });
  slow.run(10);
  await a;
  const full = rig({ timeline: publicTimeline() });
  const b = full.engine.playRange({ startTick: 0, endTick: 2 * Q, hand: "R", bpm: 72 });
  full.run(10);
  await b;
  const dt = (r) => r.notes[1].when - r.notes[0].when;
  assert.ok(Math.abs(dt(full) - Q / FULL_TPS) < 1e-6);
  assert.ok(dt(slow) >= 2 * dt(full) - 1e-9, "the default is at most half the song tempo");
});

test("single hand: a range for the left hand schedules no right-hand note, and the reverse", async () => {
  const left = rig({ timeline: publicTimeline() });
  const a = left.engine.playRange({ startTick: 0, endTick: 2 * BAR, hand: "L" });
  left.run(30);
  await a;
  assert.deepEqual(left.notes.map((n) => n.midi), [MIDI.C3, MIDI.C3]);
  const both = rig({ timeline: publicTimeline() });
  const b = both.engine.playRange({ startTick: 0, endTick: BAR });
  both.run(10);
  await b;
  assert.ok(both.notes.some((n) => n.midi === MIDI.C3) && both.notes.some((n) => n.midi === MIDI.C4), "no hand given: both play");
});

test("a range with no onset resolves empty at once, starts no clock and sounds nothing", async () => {
  const { engine, notes, hasTimer } = rig({ timeline: publicTimeline() });
  assert.deepEqual(await engine.playRange({ startTick: 10, endTick: 20 }), { status: "empty" });
  assert.deepEqual(await engine.playRange({ startTick: Q, endTick: 2 * Q, hand: "L" }), { status: "empty" }, "the other hand has onsets, this one has none");
  assert.deepEqual(await engine.playRange({ startTick: 5 * BAR, endTick: 6 * BAR }), { status: "empty" }, "beyond the song");
  assert.equal(engine.isRangePlaying(), false);
  assert.equal(hasTimer(), false);
  assert.equal(notes.length, 0);
});

test("a private song resolves silent with zero scheduled notes; the same range on a public song sounds", async () => {
  const priv = rig({ timeline: privateTimeline() });
  assert.deepEqual(await priv.engine.playRange({ startTick: 0, endTick: BAR }), { status: "silent" });
  assert.deepEqual(await priv.engine.playRange({ startTick: 0, endTick: BAR, hand: "R", bpm: 72 }), { status: "silent" }, "an explicit tempo does not open it");
  priv.run(10);
  assert.equal(priv.notes.length, 0);
  assert.equal(priv.engine.isRangePlaying(), false);
  const pub = rig({ timeline: publicTimeline() });
  const done = pub.engine.playRange({ startTick: 0, endTick: BAR });
  pub.run(10);
  await done;
  assert.ok(pub.notes.length > 0, "counter-proof");
});

test("fail closed: a hand-built timeline without the silent field resolves silent", async () => {
  const handBuilt = { ...publicTimeline() };
  delete handBuilt.silent;
  const { engine, notes, run } = rig({ timeline: handBuilt });
  assert.deepEqual(await engine.playRange({ startTick: 0, endTick: BAR }), { status: "silent" });
  run(5);
  assert.equal(notes.length, 0);
});

test("stopRange cancels with no stuck note: the voices fade, the promise says cancelled, nothing more is scheduled", async () => {
  const { engine, notes, cancels, run } = rig({ timeline: publicTimeline() });
  const done = engine.playRange({ startTick: 0, endTick: 2 * BAR, hand: "R" });
  run(3);
  const before = notes.length;
  engine.stopRange();
  assert.deepEqual(await done, { status: "cancelled" });
  assert.equal(cancels.at(-1).releaseSounding, true);
  run(20);
  assert.equal(notes.length, before);
  assert.equal(engine.isRangePlaying(), false);
  engine.stopRange(); // nothing to stop: no throw
});

test("a new range cancels the one that is playing", async () => {
  const { engine, notes, run } = rig({ timeline: publicTimeline() });
  const first = engine.playRange({ startTick: 0, endTick: 2 * BAR, hand: "R" });
  run(1);
  const second = engine.playRange({ startTick: 0, endTick: Q, hand: "R" });
  assert.deepEqual(await first, { status: "cancelled" });
  run(5);
  assert.deepEqual(await second, { status: "completed" });
  assert.equal(notes.filter((n) => n.midi === MIDI.C4).length, 2, "the new range played its note again");
});

test("the range runs on the single audio clock: the position advances from the range start and is restored at the end", async () => {
  const { engine, run } = rig({ timeline: publicTimeline() });
  engine.seek(3 * Q);
  const done = engine.playRange({ startTick: Q, endTick: 3 * Q, hand: "R" });
  run(1);
  const tick = engine.position().tick;
  assert.ok(tick > Q && tick < 3 * Q, `inside the range: ${tick}`);
  run(5);
  await done;
  assert.equal(engine.position().tick, 3 * Q, "back where the transport was");
});

test("the transport and a range take turns: play() cancels a range, and a range stops a playing song", async () => {
  const a = rig({ timeline: publicTimeline() });
  const range = a.engine.playRange({ startTick: 0, endTick: 2 * BAR });
  a.engine.play();
  assert.deepEqual(await range, { status: "cancelled" });
  assert.equal(a.engine.isPlaying(), true);
  assert.equal(a.engine.isRangePlaying(), false);
  const b = rig({ timeline: publicTimeline() });
  b.engine.play();
  b.run(1);
  const done = b.engine.playRange({ startTick: 0, endTick: Q, hand: "R" });
  b.run(5);
  assert.deepEqual(await done, { status: "completed" });
  assert.equal(b.engine.isPlaying(), false);
  const c = rig({ timeline: publicTimeline() });
  const paused = c.engine.playRange({ startTick: 0, endTick: BAR });
  c.engine.pause();
  assert.deepEqual(await paused, { status: "cancelled" });
  const d = rig({ timeline: publicTimeline() });
  const replaced = d.engine.playRange({ startTick: 0, endTick: BAR });
  d.engine.setTimeline(publicTimeline());
  assert.deepEqual(await replaced, { status: "cancelled" }, "a timeline change cancels it too");
});

test("the learner's own keys: startNote sounds at once, resumes the audio in the gesture, and releaseAllNotes leaves nothing held", () => {
  const { engine, ctx, heldCalls } = rig({ timeline: publicTimeline() });
  assert.equal(ctx.resumed, 0, "counter-proof: nothing woke the audio before the first key");
  engine.startNote(60);
  engine.startNote(64, { vel: 0.9 });
  assert.equal(ctx.resumed, 1);
  assert.deepEqual(heldCalls.map((c) => [c.type, c.midi, c.vel]), [["start", 60, 0.7], ["start", 64, 0.9]]);
  engine.releaseNote(60);
  engine.releaseNote(60); // a second release does nothing
  engine.startNote(67);
  engine.releaseAllNotes();
  const released = heldCalls.filter((c) => c.type === "release").map((c) => c.id);
  assert.deepEqual(released, [1, 2, 3], "every voice released exactly once");
  engine.releaseAllNotes();
  assert.equal(heldCalls.filter((c) => c.type === "release").length, 3, "nothing left to release");
});

test("a key pressed again while still held restarts: the old voice is released first", () => {
  const { engine, heldCalls } = rig({ timeline: publicTimeline() });
  engine.startNote(60);
  engine.startNote(60);
  assert.deepEqual(heldCalls.map((c) => c.type), ["start", "release", "start"]);
});

test("learner notes sound while a private song is open, with no song loaded, and a release before any note is harmless", () => {
  const priv = rig({ timeline: privateTimeline() });
  priv.engine.startNote(60);
  assert.equal(priv.heldCalls.length, 1);
  assert.equal(priv.notes.length, 0, "and the song itself still schedules nothing");
  const bare = rig({ timeline: publicTimeline() });
  bare.engine.releaseNote(60);
  bare.engine.releaseAllNotes();
  assert.equal(bare.heldCalls.length, 0);
});

test("playNotes schedules generated notes even when the loaded song is private, and stopNotes cancels them", () => {
  const { engine, ctx, notes, cancels } = rig({ timeline: privateTimeline() });
  ctx.currentTime = 10;
  engine.playNotes([{ midi: 60, at: 0, dur: 0.5 }, { midi: 64, at: 0.6, dur: 0.5, vel: 0.9 }]);
  assert.deepEqual(notes.map((n) => [n.midi, n.vel]), [[60, 0.7], [64, 0.9]]);
  assert.ok(notes[0].when >= 10 && notes[1].when - notes[0].when > 0.59 && notes[1].when - notes[0].when < 0.61);
  engine.stopNotes();
  assert.equal(cancels.at(-1).releaseSounding, true);
});
