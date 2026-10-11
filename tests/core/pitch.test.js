import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIDI_MIN,
  MIDI_MAX,
  parsePitch,
  inPianoRange,
  noteName,
  keyFifths,
  transpose,
} from "../../src/core/pitch.js";

const midiOf = (s) => parsePitch(s).midi;

test("naturals map to scientific pitch numbers (C4 = 60)", () => {
  const table = { C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, C3: 48 };
  for (const [name, midi] of Object.entries(table)) assert.equal(midiOf(name), midi, name);
});

test("sharps, flats and doubles shift the MIDI number", () => {
  assert.equal(midiOf("C#4"), 61);
  assert.equal(midiOf("Eb4"), 63);
  assert.equal(midiOf("F##4"), 67);
  assert.equal(midiOf("Bbb3"), 57);
  assert.equal(midiOf("Bb3"), 58);
});

test("parsePitch keeps the written spelling", () => {
  assert.deepEqual(parsePitch("Eb4"), { letter: "E", alter: -1, octave: 4, midi: 63 });
  assert.deepEqual(parsePitch("D#4"), { letter: "D", alter: 1, octave: 4, midi: 63 });
});

test("piano bounds: A0 is 21 and C8 is 108, one step outside is out of range", () => {
  assert.equal(midiOf("A0"), MIDI_MIN);
  assert.equal(midiOf("C8"), MIDI_MAX);
  assert.ok(inPianoRange(midiOf("A0")));
  assert.ok(inPianoRange(midiOf("C8")));
  assert.equal(inPianoRange(midiOf("Ab0")), false);
  assert.equal(inPianoRange(midiOf("C#8")), false);
  assert.equal(inPianoRange(midiOf("C9")), false);
  assert.equal(inPianoRange(60.5), false);
});

test("unparsable input returns null and never throws", () => {
  const bad = ["", "H4", "c4", "C", "4", "C#", "C###4", "Cx4", "E-4b", " C4", "C4 ", "Eb 4", null, undefined, 60, {}, []];
  for (const input of bad) assert.equal(parsePitch(input), null, JSON.stringify(input));
});

test("noteName follows the written spelling: Eb4 is Mib, never Re#", () => {
  assert.equal(noteName("Eb4", "solfege"), "Mib");
  assert.equal(noteName("Eb4", "letters"), "Eb");
  assert.equal(noteName("D#4", "solfege"), "Re#");
});

test("noteName covers the seven solfege syllables and letters", () => {
  const solfege = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  letters.forEach((l, i) => {
    assert.equal(noteName(`${l}4`, "solfege"), solfege[i]);
    assert.equal(noteName(`${l}4`, "letters"), l);
  });
});

test("noteName handles sharps, flats and doubles in both modes", () => {
  assert.equal(noteName("F#3", "solfege"), "Fa#");
  assert.equal(noteName("Bb2", "solfege"), "Sib");
  assert.equal(noteName("Bbb2", "letters"), "Bbb");
  assert.equal(noteName("G##5", "solfege"), "Sol##");
});

test("noteName accepts a parsed pitch and rejects bad input or unknown mode", () => {
  assert.equal(noteName(parsePitch("C4"), "solfege"), "Do");
  assert.equal(noteName("nope", "solfege"), null);
  assert.equal(noteName(null, "letters"), null);
  assert.equal(noteName("C4", "numbers"), null);
});

test("keyFifths counts sharps and flats for major and minor keys", () => {
  assert.equal(keyFifths({ tonic: "C", mode: "major" }), 0);
  assert.equal(keyFifths({ tonic: "E", mode: "major" }), 4);
  assert.equal(keyFifths({ tonic: "Eb", mode: "major" }), -3);
  assert.equal(keyFifths({ tonic: "A", mode: "minor" }), 0);
  assert.equal(keyFifths({ tonic: "C", mode: "minor" }), -3);
  assert.equal(keyFifths({ tonic: "F#", mode: "major" }), 6);
  assert.equal(keyFifths({ tonic: "Q", mode: "major" }), null);
  assert.equal(keyFifths({ tonic: "C", mode: "dorian" }), null);
  assert.equal(keyFifths(undefined), null);
});

test("transpose keeps diatonic notes in the scale spelling of the target key", () => {
  assert.equal(transpose("C4", 2, { tonic: "D", mode: "major" }), "D4");
  assert.equal(transpose("E4", 3, { tonic: "Eb", mode: "major" }), "G4");
  assert.equal(transpose("C4", 3, { tonic: "Eb", mode: "major" }), "Eb4");
  assert.equal(transpose("C4", 3, { tonic: "E", mode: "major" }), "D#4");
});

test("transpose follows the target key side for chromatic notes", () => {
  // pitch class 1 is outside both scales: flats in F major, sharps in G major
  assert.equal(transpose("C4", 1, { tonic: "F", mode: "major" }), "Db4");
  assert.equal(transpose("C4", 1, { tonic: "G", mode: "major" }), "C#4");
  assert.equal(transpose("C4", 6, { tonic: "Ab", mode: "major" }), "Gb4");
});

test("transpose: Eb4 never becomes Re# in a flat key (contra-case: it does in a sharp key)", () => {
  assert.equal(noteName(transpose("Eb4", 0, { tonic: "Bb", mode: "major" }), "solfege"), "Mib");
  assert.equal(noteName(transpose("Eb4", 0, { tonic: "E", mode: "major" }), "solfege"), "Re#");
});

test("transpose crosses octaves and keeps the MIDI distance exact", () => {
  assert.equal(transpose("B4", 1, { tonic: "C", mode: "major" }), "C5");
  assert.equal(transpose("C4", -1, { tonic: "C", mode: "major" }), "B3");
  for (const key of [{ tonic: "C", mode: "major" }, { tonic: "Eb", mode: "major" }, { tonic: "F#", mode: "major" }]) {
    for (let step = -14; step <= 14; step += 1) {
      const out = transpose("G4", step, key);
      assert.equal(midiOf(out), midiOf("G4") + step, `${key.tonic} ${step} -> ${out}`);
    }
  }
});

test("transpose without a key uses sharps, and returns null on bad input", () => {
  assert.equal(transpose("C4", 1), "C#4");
  assert.equal(transpose("C4", 1, { tonic: "??", mode: "major" }), "C#4");
  assert.equal(transpose("bad", 1, { tonic: "C", mode: "major" }), null);
  assert.equal(transpose("C4", Number.NaN, { tonic: "C", mode: "major" }), null);
});
