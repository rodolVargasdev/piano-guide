import { test } from "node:test";
import assert from "node:assert/strict";
import { pickLevel, debugRequested, clockJitterMs } from "../../src/ui/player.js";

const song = { defaultLevel: "beginner", levels: { beginner: {}, original: {} } };

test("pickLevel uses the requested level when the song has it", () => {
  assert.equal(pickLevel(song, "original"), "original");
  assert.equal(pickLevel(song, "beginner"), "beginner");
});

test("pickLevel falls back to the default for a missing, unknown or inherited level", () => {
  assert.equal(pickLevel(song, null), "beginner");
  assert.equal(pickLevel(song, "expert"), "beginner");
  assert.equal(pickLevel(song, "toString"), "beginner", "prototype keys are not levels");
  assert.equal(pickLevel({ defaultLevel: "original", levels: { original: {} } }, "beginner"), "original");
});

test("debugRequested is true only for debug=1 in the page query or the hash query", () => {
  assert.equal(debugRequested("?debug=1", "#/song/example-song"), true);
  assert.equal(debugRequested("", "#/song/example-song?debug=1"), true);
  assert.equal(debugRequested("", "#/song/example-song?level=beginner&debug=1"), true);
});

test("counter-proof: debugRequested is false without the parameter or with another value", () => {
  assert.equal(debugRequested("", "#/song/example-song"), false);
  assert.equal(debugRequested("?debug=0", ""), false);
  assert.equal(debugRequested("?debug=11", ""), false);
  assert.equal(debugRequested("?nodebug=1", "#/song/example-song?x=1"), false);
  assert.equal(debugRequested(undefined, undefined), false);
});

test("clockJitterMs is the gap between the audio advance and the frame advance, so a healthy step reads near zero at any frame rate", () => {
  assert.equal(clockJitterMs(1, 1.0167, 1000, 1016.7).toFixed(2), "0.00", "60 Hz, both clocks agree");
  assert.equal(clockJitterMs(1, 1.0083, 1000, 1008.3).toFixed(2), "0.00", "120 Hz, both clocks agree: no floor of one frame period");
  assert.equal(clockJitterMs(1, 1.0217, 1000, 1016.7).toFixed(1), "5.0", "the audio clock advanced 5 ms more than the frame clock");
  assert.equal(clockJitterMs(1, 1.0117, 1000, 1016.7).toFixed(1), "5.0", "and 5 ms less is the same size of error");
});

test("counter-proof: the old metric read one frame period on a healthy page; this one does not", () => {
  const oldDrift = (a, b) => Math.max(0, (b - a) * 1000);
  assert.ok(oldDrift(1, 1.0167) > 16, "the step between two frames is a floor of about 16.7 ms");
  assert.ok(clockJitterMs(1, 1.0167, 1000, 1016.7) < 0.01, "the new metric is 0 for the same frames");
});

test("clockJitterMs ignores steps that are not plain playback: seek, loop wrap, no advance, a stall", () => {
  assert.equal(clockJitterMs(5, 1, 1000, 1016), null, "a backward jump (loop wrap or seek)");
  assert.equal(clockJitterMs(1, 1, 1000, 1016), null, "the audio clock did not advance (paused)");
  assert.equal(clockJitterMs(1, 1.0167, 1016, 1000), null, "a frame clock that did not advance");
  assert.equal(clockJitterMs(1, 11, 1000, 11000), null, "a ten second frame (hidden tab)");
});

test("frameStats gives the average and the 95th percentile of the frame window", async () => {
  const { frameStats } = await import("../../src/ui/player.js");
  assert.deepEqual(frameStats([]), { avg: 0, p95: 0 });
  const flat = frameStats(new Array(100).fill(16));
  assert.equal(flat.avg, 16);
  assert.equal(flat.p95, 16);
  // 95 fast frames and 5 slow ones: the average moves a little, the p95 still reads as fast; 6 slow ones tip it.
  const mixed = [...new Array(95).fill(10), ...new Array(5).fill(100)];
  assert.equal(frameStats(mixed).p95, 10);
  assert.ok(frameStats(mixed).avg > 10 && frameStats(mixed).avg < 20);
  assert.equal(frameStats([...new Array(94).fill(10), ...new Array(6).fill(100)]).p95, 100);
});
