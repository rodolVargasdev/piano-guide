import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChord, chordMidis } from "../../src/core/chords.js";

const names = (s) => parseChord(s)?.names;

test("E gives E G# B, spelled with a sharp and never Ab", () => {
  assert.deepEqual(names("E"), ["E", "G#", "B"]);
  assert.deepEqual(parseChord("E").pitches, ["E4", "G#4", "B4"]);
  assert.equal(parseChord("E").quality, "major");
  assert.ok(!names("E").includes("Ab"));
});

// symbol -> notes, one row per supported quality (table-driven)
const TABLE = [
  ["Am", "minor", ["A", "C", "E"]],
  ["C#m", "minor", ["C#", "E", "G#"]],
  ["G7", "dominant7", ["G", "B", "D", "F"]],
  ["Cmaj7", "major7", ["C", "E", "G", "B"]],
  ["Dm7", "minor7", ["D", "F", "A", "C"]],
  ["Bdim", "diminished", ["B", "D", "F"]],
  ["Bdim7", "diminished7", ["B", "D", "F", "Ab"]],
  ["Bm7b5", "half-diminished7", ["B", "D", "F", "A"]],
  ["Caug", "augmented", ["C", "E", "G#"]],
  ["Csus2", "sus2", ["C", "D", "G"]],
  ["Csus4", "sus4", ["C", "F", "G"]],
  ["Cadd9", "add9", ["C", "E", "G", "D"]],
  ["Bb", "major", ["Bb", "D", "F"]],
  ["Ebm", "minor", ["Eb", "Gb", "Bb"]],
  ["F#m", "minor", ["F#", "A", "C#"]],
];
for (const [symbol, quality, notes] of TABLE) {
  test(`${symbol} is ${quality}: ${notes.join(" ")}`, () => {
    const c = parseChord(symbol);
    assert.equal(c.quality, quality);
    assert.deepEqual(c.names, notes);
  });
}

test("each letter appears once per tone: a dominant seventh on B has A (not G##)", () => {
  assert.deepEqual(names("B7"), ["B", "D#", "F#", "A"]);
});

test("slash bass: F#/A# keeps the F# triad and puts A# below the root", () => {
  const c = parseChord("F#/A#");
  assert.equal(c.bass, "A#");
  assert.deepEqual(c.names, ["F#", "A#", "C#"]);
  assert.deepEqual(c.pitches, ["A#3", "F#4", "A#4", "C#5"]);
});

test("the root octave is a parameter and the bass follows it", () => {
  assert.deepEqual(parseChord("E", 3).pitches, ["E3", "G#3", "B3"]);
  assert.deepEqual(parseChord("C/E", 3).pitches, ["E2", "C3", "E3", "G3"]);
});

test("chordMidis gives MIDI numbers, bass included; Bb is 70 (not a sharp reading)", () => {
  assert.deepEqual(chordMidis("E"), [64, 68, 71]);
  assert.deepEqual(chordMidis("F#/A#"), [58, 66, 70, 73]);
  assert.deepEqual(chordMidis("Bb"), [70, 74, 77]);
});

test("an unknown symbol returns null", () => {
  for (const s of ["", "H", "Xyz", "E13", "Emaj", "Esus", "E/", "E/H", "e", "Em7b", "C##m"]) assert.equal(parseChord(s), null, s);
});

test("counter-proof: a malformed or non-string symbol never throws", () => {
  for (const s of [undefined, null, 5, {}, [], "///", "E//B", "\u0000", "E".repeat(10000), " "]) {
    assert.doesNotThrow(() => parseChord(s));
    assert.doesNotThrow(() => chordMidis(s));
    assert.equal(parseChord(s), null);
  }
});

test("counter-proof: inherited object keys are not qualities", () => {
  assert.equal(parseChord("EtoString"), null);
  assert.equal(parseChord("Econstructor"), null);
});
