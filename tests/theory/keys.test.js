import { test } from "node:test";
import assert from "node:assert/strict";
import { TONICS, circleOfFifths, introOrder, scaleOf } from "../../src/theory/keys.js";
import { parsePitch } from "../../src/core/pitch.js";

test("the circle of fifths has the 12 major tonics from C through the sharps and then the flats", () => {
  assert.deepEqual(circleOfFifths(), ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"]);
  assert.equal(circleOfFifths().length, 12);
  assert.equal(new Set(circleOfFifths()).size, 12);
  assert.deepEqual(circleOfFifths(), [...TONICS]);
});

test("each call returns a fresh array and TONICS cannot be changed", () => {
  const a = circleOfFifths();
  a.reverse();
  assert.equal(circleOfFifths()[0], "C");
  assert.throws(() => TONICS.push("X"), TypeError);
  const b = introOrder();
  b.pop();
  assert.equal(introOrder().length, 12);
});

test("the introduction order is C G D F A E B Bb Eb Ab Db F# and holds the same 12 keys", () => {
  assert.deepEqual(introOrder(), ["C", "G", "D", "F", "A", "E", "B", "Bb", "Eb", "Ab", "Db", "F#"]);
  assert.deepEqual([...introOrder()].sort(), [...TONICS].sort());
});

test("scaleOf spells the major scale of every tonic from octave 4, one letter per degree", () => {
  assert.deepEqual(scaleOf("C"), ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]);
  assert.deepEqual(scaleOf("F#"), ["F#4", "G#4", "A#4", "B4", "C#5", "D#5", "E#5"]);
  assert.deepEqual(scaleOf("Db"), ["Db4", "Eb4", "F4", "Gb4", "Ab4", "Bb4", "C5"]);
  assert.deepEqual(scaleOf("F"), ["F4", "G4", "A4", "Bb4", "C5", "D5", "E5"]);
  for (const tonic of TONICS) {
    const letters = scaleOf(tonic).map((p) => parsePitch(p).letter);
    assert.equal(new Set(letters).size, 7, `${tonic} uses each letter once`);
    const midis = scaleOf(tonic).map((p) => parsePitch(p).midi);
    assert.deepEqual(midis.slice(1).map((m, i) => m - midis[i]), [2, 2, 1, 2, 2, 2], `${tonic} has the major step pattern`);
  }
});

test("scaleOf returns null for a name that is not a tonic", () => {
  assert.equal(scaleOf("H"), null);
  assert.equal(scaleOf(undefined), null);
});
