import { test } from "node:test";
import assert from "node:assert/strict";
import { createVoice } from "../../src/audio/voice.js";
import { createAudio } from "../../src/audio/context.js";
import { createEngine } from "../../src/audio/engine.js";
import { resolveLevel } from "../../src/core/timeline.js";
import { mutated } from "../fixtures/helpers.js";
import { FakeAudioContext } from "./fake-audio.js";

const MANIFEST = { samples: [60, 63, 66].map((midi) => ({ midi, file: `n${midi}.mp3` })) };
const WIDE = { samples: Array.from({ length: 21 }, (_, i) => ({ midi: 36 + 3 * i, file: `n${36 + 3 * i}.mp3` })) };
const BASE = "http://test.local/piano/";

function fakeFetch({ manifest = MANIFEST, manifestStatus = 200, missing = [] } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const file = url.split("/").pop();
    if (file === "manifest.json") return manifestStatus === 200 ? { ok: true, status: 200, json: async () => manifest } : { ok: false, status: manifestStatus };
    if (missing.includes(file)) return { ok: false, status: 404 };
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  fn.calls = calls;
  return fn;
}

const make = (opts = {}) => {
  const ctx = opts.ctx ?? new FakeAudioContext();
  const fetch = opts.fetch ?? fakeFetch();
  return { ctx, fetch, voice: createVoice(ctx, { baseUrl: BASE, fetch }) };
};

test("the voice has the synth interface the engine uses", () => {
  const { voice } = make();
  for (const name of ["playNote", "startHeld", "releaseHeld", "releaseAllHeld", "cancelPending", "activeCount", "dispose"]) assert.equal(typeof voice[name], "function", name);
});

test("a note requested before the samples are decoded is played by the synth", () => {
  const { ctx, voice } = make();
  voice.playNote({ midi: 60, when: 0, dur: 1 });
  assert.equal(ctx.oscillators.length, 3, "the oscillator synth sounded");
  assert.equal(ctx.bufferSources.length, 0);
  assert.equal(voice.sourceFor(60), "synth");
});

test("after loading, a note near a sample uses the sample and not the oscillators", async () => {
  const { ctx, voice } = make();
  await voice.ready();
  assert.equal(voice.sourceFor(61), "sampler");
  voice.playNote({ midi: 61, when: 0, dur: 1 });
  assert.equal(ctx.bufferSources.length, 1);
  assert.equal(ctx.oscillators.length, 0);
});

test("a note too far from any decoded sample falls back to the synth", async () => {
  const { ctx, voice } = make();
  await voice.ready();
  voice.playNote({ midi: 90, when: 0, dur: 1 });
  assert.equal(ctx.bufferSources.length, 0);
  assert.equal(ctx.oscillators.length, 3);
});

test("a missing manifest leaves the synth as the only voice, with no error", async () => {
  const { ctx, voice } = make({ fetch: fakeFetch({ manifestStatus: 404 }) });
  await voice.ready();
  voice.playNote({ midi: 60, when: 0, dur: 1 });
  assert.equal(ctx.bufferSources.length, 0);
  assert.equal(ctx.oscillators.length, 3);
});

test("a fetch that throws (samples blocked) leaves the synth as the only voice", async () => {
  const blocked = async () => {
    throw new TypeError("Failed to fetch");
  };
  const ctx = new FakeAudioContext();
  const voice = createVoice(ctx, { baseUrl: BASE, fetch: blocked });
  await voice.ready();
  const id = voice.startHeld({ midi: 60, when: 0 });
  assert.equal(ctx.bufferSources.length, 0);
  assert.equal(ctx.oscillators.length, 3);
  voice.releaseHeld(id, 1);
});

test("every file corrupt or missing: the synth plays every note", async () => {
  const ctx = new FakeAudioContext();
  ctx.decodeFails = () => true;
  const { voice } = make({ ctx });
  await voice.ready();
  voice.playNote({ midi: 62, when: 0, dur: 1 });
  assert.equal(ctx.bufferSources.length, 0);
  assert.equal(ctx.oscillators.length, 3);
});

test("a context without decodeAudioData never fetches anything", () => {
  const ctx = new FakeAudioContext();
  ctx.decodeAudioData = undefined;
  const { fetch } = make({ ctx });
  assert.equal(fetch.calls.length, 0);
});

test("learner notes: a held key picks its source per note and the release reaches that same source", async () => {
  const { ctx, voice } = make();
  const early = voice.startHeld({ midi: 60, when: 0 }); // before the samples are ready: synth
  assert.equal(ctx.oscillators.length, 3);
  await voice.ready();
  const late = voice.startHeld({ midi: 60, when: 1 }); // sample
  assert.equal(ctx.bufferSources.length, 1);
  assert.notEqual(early, late);
  voice.releaseHeld(early, 2);
  assert.ok(ctx.oscillators.every((o) => o.stopTime !== null), "the synth voice was released");
  assert.equal(ctx.bufferSources[0].stopTime, null, "the sample voice still sounds");
  voice.releaseHeld(late, 3);
  assert.ok(ctx.bufferSources[0].stopTime > 3);
  voice.releaseHeld(late, 4); // a second release of the same id is ignored
});

test("releaseAllHeld and cancelPending reach both voices; activeCount adds them", async () => {
  const { ctx, voice } = make();
  voice.startHeld({ midi: 60, when: 0 });
  await voice.ready();
  voice.startHeld({ midi: 60, when: 0 });
  voice.playNote({ midi: 60, when: 5, dur: 1 });
  voice.playNote({ midi: 60, when: 5, dur: 1 });
  assert.equal(voice.activeCount(0), 4, "two held and two scheduled");
  voice.cancelPending(1, { releaseSounding: true });
  assert.equal(voice.activeCount(1), 2, "the two held notes stay");
  voice.releaseAllHeld(2);
  assert.ok(ctx.oscillators.every((o) => o.stopTime !== null));
  assert.ok(ctx.bufferSources.every((s) => s.stopTime !== null));
});

// The engine with the real voice: a public song and the learner's keys use the samples, a private song stays silent.
function engineWithVoice(song) {
  const ctx = new FakeAudioContext();
  let pending = null;
  let voice = null;
  const engine = createEngine({
    audio: createAudio({ AudioContextCtor: function Ctor() { return ctx; } }),
    timers: { set: (fn) => ((pending = fn), 1), clear: () => (pending = null) },
    makeSynth: (c) => (voice = createVoice(c, { baseUrl: BASE, fetch: fakeFetch({ manifest: WIDE }) })),
    makeMetronome: () => ({ click() {}, cancelPending() {}, dispose() {} }),
    document: undefined,
  });
  engine.setTimeline(resolveLevel(song, "beginner"));
  const run = (seconds) => {
    for (let i = 0; i < Math.round(seconds / 0.025); i += 1) {
      ctx.currentTime += 0.025;
      pending?.();
    }
  };
  return { ctx, engine, run, ready: () => voice.ready() };
}
const song = (visibility) => mutated((s) => void (s.levels.original = structuredClone(s.levels.beginner), (s.visibility = visibility)));

test("a public song played through the engine sounds with the samples once they are decoded", async () => {
  const { ctx, engine, run, ready } = engineWithVoice(song("public"));
  engine.startNote(60); // creates the voice inside the gesture and starts loading
  engine.releaseNote(60);
  await ready();
  engine.play();
  run(8);
  assert.ok(ctx.bufferSources.length >= 8, "the eight events of the fixture use samples");
});

test("a private song never sounds through the voice, but the learner's own key does use the samples", async () => {
  const { ctx, engine, run, ready } = engineWithVoice(song("private"));
  engine.startNote(60);
  engine.releaseNote(60);
  await ready();
  const afterKey = ctx.bufferSources.length + ctx.oscillators.length;
  assert.equal(afterKey, 3 + 0, "the first key came before the samples: the synth sounded");
  const before = { s: ctx.bufferSources.length, o: ctx.oscillators.length };
  assert.deepEqual(engine.play(), { silent: true });
  run(8);
  assert.deepEqual({ s: ctx.bufferSources.length, o: ctx.oscillators.length }, before, "the private song added no voice of either kind");
  engine.startNote(62);
  assert.equal(ctx.bufferSources.length, before.s + 1, "a learner key uses the sample now");
});
