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
  MAJOR_STEPS,
  pitchFromParts,
  transposeInterval,
  spellDegree,
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

const E_MAJOR = { tonic: "E", mode: "major" };

test("MAJOR_STEPS is the major scale in semitones", () => {
  assert.deepEqual(MAJOR_STEPS, [0, 2, 4, 5, 7, 9, 11]);
});

test("pitchFromParts joins letter, alteration and octave, and refuses what the format cannot spell", () => {
  assert.equal(pitchFromParts("E", 1, 4), "E#4");
  assert.equal(pitchFromParts("C", -1, 5), "Cb5");
  assert.equal(pitchFromParts("B", 0, 3), "B3");
  assert.equal(pitchFromParts("F", 2, 4), "F##4");
  assert.equal(pitchFromParts("F", 3, 4), null, "triple sharp");
  assert.equal(pitchFromParts("F", -3, 4), null, "triple flat");
  assert.equal(pitchFromParts("C", 0, 10), null, "octave above 9");
  assert.equal(pitchFromParts("C", 0, -2), null, "octave below -1");
  assert.equal(pitchFromParts("H", 0, 4), null);
  assert.equal(pitchFromParts("toString", 0, 4), null, "no inherited property passes as a letter");
  assert.equal(pitchFromParts("C", 0.5, 4), null);
});

test("transposeInterval keeps letter arithmetic: D5 down a major third is Bb4, not A#4", () => {
  assert.equal(transposeInterval("D5", -2, -4), "Bb4");
  assert.equal(transpose("D5", -4, { tonic: "C", mode: "major" }), "A#4", "counter-proof: the key-based transpose spells the same sound by key, which is why this helper exists");
  assert.equal(transposeInterval("E4", 0, 0), "E4", "identity");
  assert.equal(transposeInterval("B4", 1, 1), "C5", "letters carry into the next octave");
  assert.equal(transposeInterval("C4", -1, -1), "B3", "and back down");
  assert.equal(transposeInterval("E4", 2, 3), "G4", "a minor third up");
  assert.equal(transposeInterval("F#4", 0, 1), "F##4", "a double accidental is still spellable");
});

test("transposeInterval returns null beyond a double accidental, outside the octaves, or for bad input", () => {
  assert.equal(transposeInterval("F##4", 0, 1), null, "triple sharp");
  assert.equal(transposeInterval("C9", 7, 12), null, "octave 10");
  assert.equal(transposeInterval("C-1", -1, -1), null, "octave -2");
  assert.equal(transposeInterval("bad", 1, 1), null);
  assert.equal(transposeInterval("C4", 1.5, 1), null);
});

test("transposeInterval moves a whole melody by one interval with every semitone distance intact", () => {
  const melody = ["E4", "G#4", "B4", "D5", "C#5", "E5"];
  const moved = melody.map((p) => transposeInterval(p, -2, -4)); // E major to C major
  assert.deepEqual(moved, ["C4", "E4", "G4", "Bb4", "A4", "C5"]);
  const gaps = (list) => list.slice(1).map((p, i) => midiOf(p) - midiOf(list[i]));
  assert.deepEqual(gaps(moved), gaps(melody));
});

test("spellDegree spells degrees of a major key with offset 0 putting the tonic in octave 4", () => {
  assert.equal(spellDegree(E_MAJOR, 1, 0, 0), "E4");
  assert.equal(spellDegree(E_MAJOR, 3, 0, 0), "G#4");
  assert.equal(spellDegree(E_MAJOR, 5, 0, 0), "B4");
  assert.equal(spellDegree(E_MAJOR, 7, 0, 0), "D#5");
});

test("spellDegree: a lowered seventh is D5 natural (never C##5), and a negative offset drops the octave", () => {
  assert.equal(spellDegree(E_MAJOR, 7, -1, 0), "D5");
  assert.equal(spellDegree(E_MAJOR, 1, 0, -1), "E3");
  assert.equal(spellDegree(E_MAJOR, 3, 0, -1), "G#3");
});

test("spellDegree in flat and sharp-heavy keys: Eb major 3 is G4 and 4 is Ab4, F# major has E#", () => {
  const eb = { tonic: "Eb", mode: "major" };
  assert.equal(spellDegree(eb, 3, 0, 0), "G4");
  assert.equal(spellDegree(eb, 4, 0, 0), "Ab4");
  assert.equal(spellDegree({ tonic: "F#", mode: "major" }, 7, 0, 0), "E#5");
  assert.equal(spellDegree({ tonic: "Db", mode: "major" }, 4, 0, 0), "Gb4");
  assert.equal(spellDegree({ tonic: "C", mode: "major" }, 7, 1, 0), "B#4", "a raised seventh keeps the B letter");
});

test("spellDegree returns null for bad degrees, keys and results out of range", () => {
  assert.equal(spellDegree(E_MAJOR, 0, 0, 0), null);
  assert.equal(spellDegree(E_MAJOR, 8, 0, 0), null);
  assert.equal(spellDegree(E_MAJOR, 1.5, 0, 0), null);
  assert.equal(spellDegree({ tonic: "E", mode: "minor" }, 1, 0, 0), null, "major keys only");
  assert.equal(spellDegree({ tonic: "H", mode: "major" }, 1, 0, 0), null);
  assert.equal(spellDegree(null, 1, 0, 0), null);
  assert.equal(spellDegree(E_MAJOR, 1, 0, 6), null, "octave 10");
  assert.equal(spellDegree(E_MAJOR, 1, 0, -6), null, "octave -2");
  assert.equal(spellDegree(E_MAJOR, 1, 3, 0), null, "triple sharp");
});

test("every spelled degree of every major key parses and its pitch class follows the major scale", () => {
  for (const tonic of ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"]) {
    const base = midiOf(`${tonic}4`);
    MAJOR_STEPS.forEach((step, i) => {
      const out = spellDegree({ tonic, mode: "major" }, i + 1, 0, 0);
      assert.equal(midiOf(out), base + step, `${tonic} degree ${i + 1} -> ${out}`);
    });
  }
});
