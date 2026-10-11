import { test } from "node:test";
import assert from "node:assert/strict";
import { createMetronome, ACCENT_HZ, CLICK_HZ, SUB_HZ } from "../../src/audio/metronome.js";
import { createAudio } from "../../src/audio/context.js";
import { FakeAudioContext } from "./fake-audio.js";

test("the accent click is higher and louder than a normal click; a subdivision is the quietest", () => {
  const ctx = new FakeAudioContext();
  const m = createMetronome(ctx);
  m.click(1, { accent: true });
  m.click(2);
  m.click(3, { sub: true });
  assert.deepEqual(ctx.oscillators.map((o) => o.frequency.value), [ACCENT_HZ, CLICK_HZ, SUB_HZ]);
  assert.deepEqual([ACCENT_HZ, CLICK_HZ], [1500, 1000]);
  const level = (o) => o.connections[0].gain.calls[0][1];
  assert.ok(level(ctx.oscillators[0]) > level(ctx.oscillators[1]));
  assert.ok(level(ctx.oscillators[1]) > level(ctx.oscillators[2]));
});

test("a click is a short burst that starts at the requested time", () => {
  const ctx = new FakeAudioContext();
  createMetronome(ctx).click(5);
  const [o] = ctx.oscillators;
  assert.equal(o.startTime, 5);
  assert.ok(o.stopTime - o.startTime < 0.05);
});

test("cancelPending drops future clicks and leaves the ones already sounding", () => {
  const ctx = new FakeAudioContext();
  const m = createMetronome(ctx);
  m.click(0.9);
  m.click(2);
  ctx.currentTime = 1;
  m.cancelPending(1);
  assert.ok(ctx.oscillators[1].stopTime <= 1, "the future click never plays");
  assert.ok(ctx.oscillators[0].stopTime > 0.9, "the click that started keeps its own stop time");
});

test("audio context is created lazily on ensure and resumed inside that call", () => {
  let created = 0;
  class Ctx extends FakeAudioContext {
    constructor(o) {
      super(o);
      created += 1;
    }
  }
  const audio = createAudio({ AudioContextCtor: Ctx });
  assert.equal(audio.context, null);
  assert.equal(created, 0);
  const ctx = audio.ensure();
  assert.equal(created, 1);
  assert.equal(ctx.state, "running");
  assert.equal(audio.ensure(), ctx, "one context per audio object");
  assert.equal(created, 1);
  assert.equal(ctx.options.latencyHint, "interactive");
});

test("suspend only acts on a running context, and ensure resumes it again", () => {
  const audio = createAudio({ AudioContextCtor: FakeAudioContext });
  audio.suspend(); // nothing to suspend yet
  const ctx = audio.ensure();
  audio.suspend();
  assert.equal(ctx.suspended, 1);
  assert.equal(ctx.state, "suspended");
  audio.ensure();
  assert.equal(ctx.state, "running");
});

test("outputLatency falls back to baseLatency and then to 0", () => {
  const audio = createAudio({ AudioContextCtor: FakeAudioContext });
  assert.equal(audio.outputLatency(), 0);
  const ctx = audio.ensure();
  assert.equal(audio.outputLatency(), 0);
  ctx.baseLatency = 0.01;
  assert.equal(audio.outputLatency(), 0.01);
  ctx.outputLatency = 0.05;
  assert.equal(audio.outputLatency(), 0.05);
});

test("without Web Audio, ensure throws a readable error", () => {
  const audio = createAudio({ AudioContextCtor: null });
  assert.throws(() => audio.ensure(), /Web Audio is not available/);
});
