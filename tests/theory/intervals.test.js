import { test } from "node:test";
import assert from "node:assert/strict";
import { INTERVALS, intervalNotes, midiPitch, semitonesOf } from "../../src/theory/intervals.js";

test("the twelve intervals run from a minor second to the octave in semitones 1 to 12", () => {
  assert.deepEqual(INTERVALS.map((i) => i.id), ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"]);
  assert.deepEqual(INTERVALS.map((i) => i.semitones), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.throws(() => INTERVALS.push({ id: "x" }), TypeError);
});

test("a major third above C4 is C4 then E4", () => {
  const notes = intervalNotes("C4", "M3");
  assert.deepEqual(notes.map((n) => n.pitch), ["C4", "E4"]);
  assert.deepEqual(notes.map((n) => n.midi), [60, 64]);
  assert.deepEqual(intervalNotes(60, "P8").map((n) => n.midi), [60, 72]);
});

test("every interval above every root of C3 to C5 is exactly its size above the root", () => {
  for (const { id, semitones } of INTERVALS) for (let low = 48; low <= 72; low += 1) {
    const [a, b] = intervalNotes(low, id);
    assert.equal(b.midi - a.midi, semitones);
  }
});

test("a bad id, a bad pitch or a result beyond MIDI 127 gives null", () => {
  assert.equal(intervalNotes("C4", "M9"), null);
  assert.equal(intervalNotes("H4", "M3"), null);
  assert.equal(intervalNotes(125, "P5"), null);
  assert.equal(intervalNotes(-1, "M3"), null);
  assert.equal(semitonesOf("nope"), null);
  assert.equal(semitonesOf("P5"), 7);
});

test("midiPitch names a key with a sharp when it is black", () => {
  assert.equal(midiPitch(61), "C#4");
  assert.equal(midiPitch(60), "C4");
});
