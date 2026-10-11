import { test } from "node:test";
import assert from "node:assert/strict";
import { pickLevel, debugRequested, driftMs } from "../../src/ui/player.js";

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
  assert.equal(debugRequested("?debug=1", "#/song/cancer"), true);
  assert.equal(debugRequested("", "#/song/cancer?debug=1"), true);
  assert.equal(debugRequested("", "#/song/cancer?level=beginner&debug=1"), true);
});

test("counter-proof: debugRequested is false without the parameter or with another value", () => {
  assert.equal(debugRequested("", "#/song/cancer"), false);
  assert.equal(debugRequested("?debug=0", ""), false);
  assert.equal(debugRequested("?debug=11", ""), false);
  assert.equal(debugRequested("?nodebug=1", "#/song/cancer?x=1"), false);
  assert.equal(debugRequested(undefined, undefined), false);
});

test("driftMs is the musical time between two drawn positions and never negative", () => {
  assert.equal(driftMs(1, 1.0167).toFixed(1), "16.7");
  assert.equal(driftMs(2, 1), 0, "a backward seek is not drift");
  assert.equal(driftMs(0, 0), 0);
});
