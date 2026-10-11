import { test } from "node:test";
import assert from "node:assert/strict";
import { rig, compoundTimeline } from "./engine-rig.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
// Fixture: 4/4, 72 BPM quarter = 576 ticks per second; chords at tick 0 and 1920, length 3840.
const TPS = 576;

test("a BPM change mid-playback keeps the tick and re-times what has not started", () => {
  const { ctx, engine, notes, cancels, run } = rig();
  engine.play();
  run(1.05); // tick 576
  const t0 = ctx.currentTime;
  engine.setBpm(144); // twice as fast
  assert.equal(cancels.at(-1).releaseSounding, false, "sounding notes keep playing on a tempo change");
  near(engine.position().tick, 576, 1e-6);
  run(1.3);
  assert.equal(notes.length, 8, "the first chord is not repeated and the second is queued once");
  const chord2 = notes.filter((n) => n.when > 2);
  assert.equal(chord2.length, 4);
  near(chord2[0].when, t0 + (1920 - 576) / (2 * TPS), 1e-9);
});

test("setBpm clamps and returns the shown value; slow mode halves the speed", () => {
  const { engine, notes } = rig();
  assert.equal(engine.getBpm(), 72);
  assert.equal(engine.setBpm(500), 240);
  assert.equal(engine.setBpm(5), 20);
  assert.equal(engine.setBpm(72), 72);
  engine.setSlow(true);
  engine.play();
  near(notes[0].dur, 1920 / (TPS / 2), 1e-9);
  engine.setSlow(false);
  assert.equal(engine.getBpm(), 72, "disabling slow mode restores the user BPM");
});

test("metronome in 4/4 clicks four times per bar with the accent on beat 1", () => {
  const { engine, clicks, run } = rig();
  engine.setMetronome({ enabled: true });
  engine.play();
  run(1.1 * (1920 / TPS));
  const bar1 = clicks.filter((c) => c.when < 0.05 + 1920 / TPS - 1e-9);
  assert.equal(bar1.length, 4);
  assert.deepEqual(bar1.map((c) => Boolean(c.accent)), [true, false, false, false]);
  near(bar1[1].when - bar1[0].when, 480 / TPS, 1e-9);
});

test("metronome in 12/8 with a dotted-quarter beat unit clicks four times per bar", () => {
  const { engine, clicks, run } = rig({ timeline: compoundTimeline() });
  engine.setMetronome({ enabled: true });
  engine.play();
  run(5);
  const barSeconds = 2880 / (60 * 720 / 60);
  const bar1 = clicks.filter((c) => c.when < 0.05 + barSeconds - 1e-9);
  assert.equal(bar1.length, 4);
  assert.deepEqual(bar1.map((c) => Boolean(c.accent)), [true, false, false, false]);
});

test("counter-proof: with the eighth as beat unit the same 12/8 bar clicks twelve times", () => {
  const tl = compoundTimeline();
  tl.tempo = { bpm: 120, beatUnit: "eighth" };
  const { engine, clicks, run } = rig({ timeline: tl });
  engine.setMetronome({ enabled: true });
  engine.play();
  run(6.2);
  assert.equal(clicks.filter((c) => c.when < 0.05 + 2880 / 480 - 1e-9).length, 12);
});

test("a one-bar count-in clicks first, then the music starts and the position stays at 0 meanwhile", () => {
  const { engine, notes, clicks, run } = rig();
  engine.setMetronome({ countIn: true });
  engine.play();
  run(0.5);
  assert.equal(engine.position().tick, 0);
  assert.equal(notes.length, 0, "no notes during the count-in");
  run(3.5);
  const barSeconds = 1920 / TPS;
  assert.equal(clicks.length, 4, "count-in clicks only; the metronome itself is off");
  assert.equal(clicks[0].accent, true);
  near(notes[0].when, 0.05 + barSeconds, 1e-9);
});

test("the metronome subdivision adds a quieter click half a beat later", () => {
  const { engine, clicks } = rig();
  engine.setMetronome({ enabled: true, subdivision: true });
  engine.play();
  const sub = clicks.find((c) => c.sub);
  assert.ok(sub);
  near(sub.when - clicks[0].when, 240 / TPS, 1e-9);
});

test("a count-in that starts mid-song never plays the notes that lie inside the count-in span", () => {
  const { engine, notes, clicks, run } = rig();
  engine.setMetronome({ countIn: true });
  engine.seek(1920); // the count-in window covers ticks 0 to 1920, where chord 1 lies
  engine.play();
  run(4);
  assert.equal(clicks.length, 4);
  assert.equal(notes.length, 4, "only chord 2, after the count-in");
  near(notes[0].when, 0.05 + 1920 / TPS, 1e-9);
});
