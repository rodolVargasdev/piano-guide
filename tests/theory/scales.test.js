import { test } from "node:test";
import assert from "node:assert/strict";
import { SCALE_FINGERING, directed, fiveFinger, majorScale } from "../../src/theory/scales.js";
import { TONICS, introOrder } from "../../src/theory/keys.js";
import { parsePitch } from "../../src/core/pitch.js";

const pitches = (s) => s.notes.map((n) => n.pitch);
const fingers = (s) => s.notes.map((n) => n.finger).join(" ");

test("C major one octave, right hand: C4 to C5 with fingers 1 2 3 1 2 3 4 5", () => {
  const s = majorScale("C");
  assert.deepEqual(pitches(s), ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]);
  assert.equal(fingers(s), "1 2 3 1 2 3 4 5");
  assert.ok(s.notes.every((n) => n.hand === "R" && Number.isInteger(n.midi)));
});

test("C major one octave, left hand: C3 to C4 with fingers 5 4 3 2 1 3 2 1", () => {
  const s = majorScale("C", { hand: "L" });
  assert.deepEqual(pitches(s), ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4"]);
  assert.equal(fingers(s), "5 4 3 2 1 3 2 1");
});

test("the fingering rows the design lists", () => {
  assert.equal(fingers(majorScale("F")), "1 2 3 4 1 2 3 4");
  assert.deepEqual(pitches(majorScale("F")), ["F4", "G4", "A4", "Bb4", "C5", "D5", "E5", "F5"]);
  assert.equal(fingers(majorScale("B", { hand: "L" })), "4 3 2 1 4 3 2 1");
  assert.equal(fingers(majorScale("Bb")), "2 1 2 3 1 2 3 4");
  assert.equal(fingers(majorScale("F#", { hand: "L" })), "4 3 2 1 3 2 1 4");
  assert.equal(fingers(majorScale("B")), "1 2 3 1 2 3 4 5");
});

test("two octaves: 15 notes, the cycle repeats, and the right and left hand rows match the table", () => {
  const rh = majorScale("C", { octaves: 2 });
  assert.equal(rh.notes.length, 15);
  assert.equal(fingers(rh), "1 2 3 1 2 3 4 1 2 3 1 2 3 4 5");
  assert.equal(rh.notes[14].pitch, "C6");
  const lh = majorScale("C", { octaves: 2, hand: "L" });
  assert.equal(fingers(lh), "5 4 3 2 1 3 2 1 4 3 2 1 3 2 1");
  assert.equal(lh.notes[0].pitch, "C3");
  assert.equal(lh.notes[14].pitch, "C5");
});

test("descending reverses notes and fingers, and up-and-down does not repeat the top note", () => {
  const up = majorScale("G");
  const down = majorScale("G", { direction: "down" });
  assert.deepEqual(pitches(down), [...pitches(up)].reverse());
  assert.equal(fingers(down), [...up.notes].reverse().map((n) => n.finger).join(" "));
  const both = majorScale("G", { direction: "updown" });
  assert.equal(both.notes.length, 15);
  assert.equal(both.notes[7].pitch, "G5");
  assert.deepEqual(pitches(both).slice(8), [...pitches(up)].reverse().slice(1));
});

test("spelling follows the key: F# major has E#, Db major has Gb, no scale mixes sharps and flats", () => {
  assert.deepEqual(pitches(majorScale("F#")), ["F#4", "G#4", "A#4", "B4", "C#5", "D#5", "E#5", "F#5"]);
  assert.ok(pitches(majorScale("Db")).includes("Gb4"));
  for (const t of TONICS) {
    const accidentals = new Set(pitches(majorScale(t)).map((p) => parsePitch(p)).map((p) => p.alter).filter((a) => a !== 0));
    assert.ok(accidentals.size <= 1, `${t} mixes sharps and flats`);
  }
});

test("all twelve tonics, both hands, one and two octaves: right length, fingers 1 to 5, each note one scale step up", () => {
  for (const tonic of TONICS) {
    for (const hand of ["R", "L"]) {
      for (const octaves of [1, 2]) {
        const s = majorScale(tonic, { octaves, hand });
        assert.equal(s.notes.length, 7 * octaves + 1, `${tonic} ${hand} ${octaves}`);
        assert.ok(s.notes.every((n) => n.finger >= 1 && n.finger <= 5), `${tonic} ${hand} fingers`);
        s.notes.slice(1).forEach((n, i) => {
          const step = n.midi - s.notes[i].midi;
          assert.ok(step === 1 || step === 2, `${tonic} ${hand}: ${s.notes[i].pitch} to ${n.pitch}`);
          const [a, b] = [parsePitch(s.notes[i].pitch).letter, parsePitch(n.pitch).letter];
          assert.equal("CDEFGAB".indexOf(b), ("CDEFGAB".indexOf(a) + 1) % 7, `${tonic}: ${a} to ${b} is the next letter`);
        });
        assert.equal(s.notes.at(-1).midi - s.notes[0].midi, 12 * octaves);
        assert.equal(s.notes.at(-1).pitch.slice(0, -1), s.notes[0].pitch.slice(0, -1), "ends on the tonic");
      }
    }
  }
});

test("the pattern of the table: a right hand thumb never lands on a black key in the white-key scales, and every key is in the table", () => {
  assert.deepEqual(Object.keys(SCALE_FINGERING).sort(), [...TONICS].sort());
  for (const t of ["C", "G", "D", "A", "E", "F"]) {
    for (const n of majorScale(t).notes) if (n.finger === 1 && [1, 3, 6, 8, 10].includes(n.midi % 12)) assert.fail(`${t}: thumb on ${n.pitch}`);
  }
});

test("the introduction order holds the same twelve keys the table has", () => {
  assert.deepEqual([...introOrder()].sort(), Object.keys(SCALE_FINGERING).sort());
  assert.deepEqual(introOrder(), ["C", "G", "D", "F", "A", "E", "B", "Bb", "Eb", "Ab", "Db", "F#"]);
});

test("the two flagged fingerings carry the suggested flag, the others do not (counter-proof)", () => {
  assert.equal(majorScale("Bb").suggested, true);
  assert.equal(majorScale("F#", { hand: "L" }).suggested, true);
  assert.equal(majorScale("Bb", { hand: "L" }).suggested, false);
  assert.equal(majorScale("F#").suggested, false);
  for (const t of TONICS.filter((x) => x !== "Bb" && x !== "F#")) for (const hand of ["R", "L"]) assert.equal(majorScale(t, { hand }).suggested, false, `${t} ${hand}`);
});

test("bad input gives null, never a throw", () => {
  assert.equal(majorScale("H"), null);
  assert.equal(majorScale("C", { hand: "T" }), null);
  assert.equal(majorScale("C", { octaves: 3 }), null);
  assert.equal(majorScale(undefined), null);
  assert.equal(fiveFinger("C", "X"), null);
  assert.equal(fiveFinger("H"), null);
});

test("five-finger patterns: G right hand G4 A4 B4 C5 D5 with 1 2 3 4 5; D left hand D3 E3 F#3 G3 A3 with 5 4 3 2 1", () => {
  const g = fiveFinger("G", "R");
  assert.deepEqual(pitches(g), ["G4", "A4", "B4", "C5", "D5"]);
  assert.equal(fingers(g), "1 2 3 4 5");
  const d = fiveFinger("D", "L");
  assert.deepEqual(pitches(d), ["D3", "E3", "F#3", "G3", "A3"]);
  assert.equal(fingers(d), "5 4 3 2 1");
});

test("the minor five-finger pattern lowers the third and uses sharp names for Db, Ab and Eb", () => {
  assert.deepEqual(pitches(fiveFinger("C", "R", { minor: true })), ["C4", "D4", "Eb4", "F4", "G4"]);
  assert.deepEqual(pitches(fiveFinger("A", "R", { minor: true })), ["A4", "B4", "C5", "D5", "E5"]);
  const cs = fiveFinger("Db", "R", { minor: true });
  assert.equal(cs.name, "C#");
  assert.deepEqual(pitches(cs), ["C#4", "D#4", "E4", "F#4", "G#4"]);
  assert.equal(fiveFinger("Db", "R").name, "Db", "major keeps the tonic name");
});

test("directed gives up, down and updown of any list", () => {
  assert.deepEqual(directed([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(directed([1, 2, 3], "down"), [3, 2, 1]);
  assert.deepEqual(directed([1, 2, 3], "updown"), [1, 2, 3, 2, 1]);
});

test("the modules load in plain Node and need no browser global", () => {
  assert.equal(typeof globalThis.document, "undefined");
  assert.ok(majorScale("C"));
});
