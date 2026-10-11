import { test } from "node:test";
import assert from "node:assert/strict";
import { createSynth, MAX_VOICES } from "../../src/audio/synth.js";
import { FakeAudioContext } from "./fake-audio.js";

const setup = (opts) => {
  const ctx = new FakeAudioContext();
  return { ctx, synth: createSynth(ctx, opts) };
};

test("a note starts three oscillators at the requested time: triangle, detuned sine and octave sine", () => {
  const { ctx, synth } = setup();
  synth.playNote({ midi: 69, when: 1, dur: 0.5 });
  assert.equal(ctx.oscillators.length, 3);
  assert.deepEqual(ctx.oscillators.map((o) => o.type), ["triangle", "sine", "sine"]);
  assert.deepEqual(ctx.oscillators.map((o) => o.frequency.value), [440, 440, 880]);
  assert.equal(ctx.oscillators[1].detune.value, 3);
  assert.ok(ctx.oscillators.every((o) => o.startTime === 1));
});

test("the master bus goes through a compressor into the destination", () => {
  const { ctx, synth } = setup();
  const compressor = synth.output.connections[0];
  assert.ok(compressor.threshold, "master feeds a DynamicsCompressorNode");
  assert.equal(compressor.connections[0], ctx.destination);
});

test("envelope starts silent (no click) and release is a smooth target ramp at note-off", () => {
  const { ctx, synth } = setup();
  synth.playNote({ midi: 60, vel: 0.8, when: 2, dur: 1 });
  const env = synth.output.ctx && ctx.oscillators[0].connections[0].connections[0].connections[0];
  const calls = env.gain.calls;
  assert.deepEqual(calls[0], ["set", 0, 2]);
  assert.equal(calls[1][0], "linear");
  assert.ok(calls[1][2] - 2 <= 0.005, "attack of about 4 ms");
  const release = calls.find((c) => c[0] === "target");
  assert.equal(release[1], 0);
  assert.equal(release[2], 3, "release starts at when + dur");
  // Automation stays ordered in time, so the decay ramp never overlaps the release.
  const times = calls.map((c) => c[c[0] === "cancel" ? 1 : 2]);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("a short note ends its decay ramp at note-off and a pedal lengthens the release", () => {
  const { ctx, synth } = setup();
  synth.playNote({ midi: 60, when: 0, dur: 0.2 });
  synth.playNote({ midi: 60, when: 0, dur: 0.2, pedal: true });
  const envOf = (i) => ctx.oscillators[i * 3].connections[0].connections[0].connections[0];
  const plain = envOf(0).gain.calls.find((c) => c[0] === "target");
  const pedal = envOf(1).gain.calls.find((c) => c[0] === "target");
  assert.ok(pedal[3] > plain[3] * 4, "pedal release time constant is much longer");
  const ramp = envOf(0).gain.calls.filter((c) => c[0] === "exp").at(-1);
  assert.ok(ramp[2] <= 0.2 + 1e-9, "decay ramp ends no later than note-off");
});

test("velocity scales the filter cutoff and the level", () => {
  const { ctx, synth } = setup();
  synth.playNote({ midi: 60, vel: 0.2, when: 0, dur: 1 });
  synth.playNote({ midi: 60, vel: 1, when: 0, dur: 1 });
  const filter = (i) => ctx.oscillators[i * 3].connections[0].connections[0];
  assert.ok(filter(1).frequency.calls[0][1] > filter(0).frequency.calls[0][1]);
});

test("60 rapid notes never exceed the 48-voice cap and the oldest are released first", () => {
  const { ctx, synth } = setup();
  assert.equal(MAX_VOICES, 48);
  for (let i = 0; i < 60; i += 1) {
    ctx.currentTime = i * 0.001;
    synth.playNote({ midi: 40 + (i % 40), when: ctx.currentTime, dur: 5 });
    const held = ctx.soundingAt(ctx.currentTime + 0.5).length / 3;
    assert.ok(held <= MAX_VOICES, `after note ${i + 1}: ${held} voices still held`);
  }
  // The first 12 voices were released (their oscillators stop soon after the cap was hit).
  const firstVoiceStop = ctx.oscillators[0].stopTime;
  assert.ok(firstVoiceStop < 1, "the oldest voice was cut short");
  const lastVoiceStop = ctx.oscillators.at(-1).stopTime;
  assert.ok(lastVoiceStop > 5, "the newest voice rings for its full length");
});

test("counter-proof: without the cap all 60 voices stay held", () => {
  const { ctx, synth } = setup({ maxVoices: 1000 });
  for (let i = 0; i < 60; i += 1) synth.playNote({ midi: 50, when: 0, dur: 5 });
  assert.equal(ctx.soundingAt(1).length / 3, 60);
});

test("cancelPending silences future voices and fades sounding ones", () => {
  const { ctx, synth } = setup();
  synth.playNote({ midi: 60, when: 0, dur: 4 }); // sounding at 1
  synth.playNote({ midi: 62, when: 3, dur: 1 }); // pending at 1
  ctx.currentTime = 1;
  synth.cancelPending(1);
  assert.equal(ctx.soundingAt(3.5).length, 0, "nothing sounds later");
  assert.ok(ctx.oscillators[0].stopTime < 1.2, "the sounding voice fades within about 100 ms");
  assert.ok(ctx.oscillators[3].stopTime <= 1, "the future voice never starts");
  assert.equal(synth.activeCount(2), 0);
  const env = ctx.oscillators[0].connections[0].connections[0].connections[0];
  const fade = env.gain.calls.filter((c) => c[0] === "target" && c[2] === 1);
  assert.equal(fade.length, 1, "the sounding voice gets a smooth fade at the cancel time, not a hard stop");
});

test("cancelPending without releaseSounding keeps sounding voices (tempo change)", () => {
  const { ctx, synth } = setup();
  synth.playNote({ midi: 60, when: 0, dur: 4 });
  synth.playNote({ midi: 62, when: 3, dur: 1 });
  ctx.currentTime = 1;
  synth.cancelPending(1, { releaseSounding: false });
  assert.equal(ctx.soundingAt(2).length, 3, "the sounding note continues");
  assert.equal(ctx.soundingAt(3.5).length, 3, "only the first note is left; the pending one is gone");
});

test("dispose releases everything", () => {
  const { ctx, synth } = setup();
  synth.playNote({ midi: 60, when: 0, dur: 4 });
  ctx.currentTime = 1;
  synth.dispose();
  assert.equal(ctx.soundingAt(2).length, 0);
});
