import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSampler, nearestSample, playbackRate, MAX_DISTANCE } from "../../src/audio/sampler.js";
import { FakeAudioContext } from "./fake-audio.js";

const MANIFEST = { samples: [60, 63, 66, 69].map((midi) => ({ midi, file: `n${midi}.mp3` })) };
const BASE = "http://test.local/piano/";

/** A fetch that serves every sample file as `midi` bytes long, except the ones named in `missing`. */
function fakeFetch({ missing = [] } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const file = url.split("/").pop();
    if (missing.includes(file)) return { ok: false, status: 404 };
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(Number(/n(\d+)/.exec(file)[1])) };
  };
  fn.calls = calls;
  return fn;
}

const setup = (opts = {}) => {
  const ctx = new FakeAudioContext();
  const fetch = opts.fetch ?? fakeFetch();
  return { ctx, fetch, sampler: createSampler(ctx, { manifest: MANIFEST, baseUrl: BASE, fetch, ...opts.sampler }) };
};

test("nearestSample picks the closest point and the lower one on a tie", () => {
  const pts = [{ midi: 60 }, { midi: 63 }, { midi: 66 }];
  assert.equal(nearestSample(61, pts).midi, 60);
  assert.equal(nearestSample(62, pts).midi, 63);
  assert.equal(nearestSample(61.5, pts).midi, 60, "a tie takes the lower point");
  assert.equal(nearestSample(100, pts).midi, 66);
  assert.equal(nearestSample(60, []), null);
});

test("the playback rate is 2 to the power of the semitone distance over 12", () => {
  assert.equal(playbackRate(60, 60), 1);
  assert.equal(playbackRate(72, 60), 2);
  assert.equal(playbackRate(48, 60), 0.5);
  assert.ok(Math.abs(playbackRate(61, 60) - 1.0594630943592953) < 1e-12);
});

test("the shipped manifest has 30 points, one every minor third from A0 to C8, so no note is more than 1.5 semitones from one", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../assets/audio/piano/manifest.json", import.meta.url), "utf8"));
  const midis = manifest.samples.map((s) => s.midi);
  assert.equal(midis.length, 30);
  assert.equal(midis[0], 21);
  assert.equal(midis.at(-1), 108);
  for (let i = 1; i < midis.length; i += 1) assert.equal(midis[i] - midis[i - 1], 3, "a minor third apart");
  let worst = 0;
  for (let m = 21; m <= 108; m += 1) worst = Math.max(worst, Math.abs(nearestSample(m, manifest.samples).midi - m));
  assert.ok(worst <= 1.5 && worst <= MAX_DISTANCE, `worst distance ${worst}`);
});

test("nothing is fetched until load() is called (lazy)", async () => {
  const { sampler, fetch } = setup();
  assert.equal(fetch.calls.length, 0);
  assert.equal(sampler.canPlay(60), false, "no sample decoded yet");
  await sampler.load();
  assert.equal(fetch.calls.length, 4);
  assert.deepEqual(sampler.status(), { decoded: 4, failed: 0, total: 4 });
  assert.ok(fetch.calls.every((u) => u.startsWith(BASE)));
});

test("load() fetches the middle of the keyboard first and is idempotent", async () => {
  const { sampler, fetch } = setup();
  const a = sampler.load();
  assert.equal(sampler.load(), a);
  await a;
  assert.equal(fetch.calls[0], `${BASE}n60.mp3`);
  assert.equal(fetch.calls.length, 4, "a second call does not fetch again");
});

test("a note plays its nearest decoded sample with the rate that reaches the pitch", async () => {
  const { ctx, sampler } = setup();
  await sampler.load();
  assert.equal(sampler.playNote({ midi: 62, when: 1, dur: 0.5 }), true);
  const src = ctx.bufferSources[0];
  assert.equal(src.buffer.decodedBytes, 63, "62 is nearer to 63 than to 60");
  assert.equal(src.playbackRate.value, 2 ** (-1 / 12));
  assert.equal(src.startTime, 1);
  assert.ok(src.stopTime > 1.5, "stops after the release tail");
});

test("the envelope starts silent and releases with a smooth target ramp at note-off", async () => {
  const { ctx, sampler } = setup();
  await sampler.load();
  sampler.playNote({ midi: 60, vel: 0.8, when: 2, dur: 1 });
  const env = ctx.bufferSources[0].connections[0];
  assert.deepEqual(env.gain.calls[0], ["set", 0, 2]);
  assert.equal(env.gain.calls[1][0], "linear");
  const release = env.gain.calls.find((c) => c[0] === "target");
  assert.equal(release[2], 3, "release starts at when + dur");
});

test("a failed fetch or a failed decode marks that point failed and the others still play", async () => {
  const ctx = new FakeAudioContext();
  ctx.decodeFails = (bytes) => bytes === 66; // n66 fetches fine but does not decode
  const sampler = createSampler(ctx, { manifest: MANIFEST, baseUrl: BASE, fetch: fakeFetch({ missing: ["n69.mp3"] }) }); // n69 is a 404
  await sampler.load();
  assert.deepEqual(sampler.status(), { decoded: 2, failed: 2, total: 4 });
  assert.equal(sampler.canPlay(60), true);
  assert.equal(sampler.canPlay(69), false, "69 failed and the next decoded point is 6 semitones away");
  assert.equal(sampler.playNote({ midi: 69, when: 0, dur: 1 }), false, "no sample near enough: the caller falls back");
  assert.equal(ctx.bufferSources.length, 0);
  assert.equal(sampler.canPlay(65), true, "65 uses 63 (2 away) although 66 failed");
});

test("a sample farther than 3 semitones is never used", async () => {
  const { sampler } = setup();
  await sampler.load();
  assert.equal(sampler.canPlay(72), true, "69 is 3 away");
  assert.equal(sampler.canPlay(73), false, "69 is 4 away");
});

test("held voices sound until released, are not cancelled by cancelPending, and release without a click", async () => {
  const { ctx, sampler } = setup();
  await sampler.load();
  const id = sampler.startHeld({ midi: 60, when: 0 });
  assert.equal(typeof id, "number");
  sampler.cancelPending(1, { releaseSounding: true });
  assert.equal(ctx.bufferSources[0].stopTime, null, "the learner's key keeps sounding");
  sampler.releaseHeld(id, 2);
  const target = ctx.bufferSources[0].connections[0].gain.calls.filter((c) => c[0] === "target").at(-1);
  assert.equal(target[1], 0);
  assert.equal(target[2], 2);
  assert.ok(ctx.bufferSources[0].stopTime > 2);
  assert.equal(sampler.startHeld({ midi: 100 }), null, "no sample near: the caller falls back");
});

test("the voice cap releases the oldest voices first", async () => {
  const { ctx, sampler } = setup({ sampler: { maxVoices: 3 } });
  await sampler.load();
  for (let i = 0; i < 5; i += 1) sampler.playNote({ midi: 60, when: 0, dur: 100 });
  const stopped = ctx.bufferSources.filter((s) => s.stopTime !== null && s.stopTime < 50).length;
  assert.equal(stopped, 2, "two voices past the cap were released early (the oldest first)");
  assert.equal(ctx.bufferSources[0].stopTime < 50, true);
  assert.equal(ctx.bufferSources[4].stopTime > 50, true);
});
