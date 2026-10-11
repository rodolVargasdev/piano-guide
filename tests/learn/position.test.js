import { test } from "node:test";
import assert from "node:assert/strict";
import { positionKeys, stepMidi } from "../../src/learn/position.js";
import { stepOf } from "../../src/theory/fingering.js";
import { parsePitch } from "../../src/core/pitch.js";

test("stepMidi is the white key of a diatonic step, and agrees with stepOf for every natural note", () => {
  assert.equal(stepMidi(stepOf("C4")), 60);
  assert.equal(stepMidi(stepOf("A0")), 21);
  assert.equal(stepMidi(stepOf("C8")), 108);
  for (const pitch of ["D3", "E4", "F4", "G5", "B2"]) assert.equal(stepMidi(stepOf(pitch)), parsePitch(pitch).midi, pitch);
});

test("the right-hand position C4 to G4 is the five fingers 1 to 5; the left-hand one is mirrored", () => {
  const anchor = stepOf("C4");
  assert.deepEqual(positionKeys({ anchorStep: anchor }, "R").map((k) => [k.midi, k.finger]), [[60, 1], [62, 2], [64, 3], [65, 4], [67, 5]]);
  assert.deepEqual(positionKeys({ anchorStep: anchor }, "L").map((k) => [k.midi, k.finger]), [[60, 5], [62, 4], [64, 3], [65, 2], [67, 1]]);
});

test("counter-proof: no position, or no anchor, gives no keys; the hand is carried on each key", () => {
  assert.deepEqual(positionKeys(null, "R"), []);
  assert.deepEqual(positionKeys({}, "R"), []);
  assert.ok(positionKeys({ anchorStep: 28 }, "L").every((k) => k.hand === "L"));
});
