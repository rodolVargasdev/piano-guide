import { test } from "node:test";
import assert from "node:assert/strict";
import { TRIAD_QUALITIES, arpeggio, triad } from "../../src/theory/triads.js";
import { TONICS } from "../../src/theory/keys.js";
import { parsePitch } from "../../src/core/pitch.js";

const pitches = (x) => x.notes.map((n) => n.pitch);
const fingers = (x) => x.notes.map((n) => n.finger).join(" ");
const PCS = { major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8] };

test("C major right hand: root, first and second inversion are C4 E4 G4, E4 G4 C5, G4 C5 E5 with 1 3 5, 1 2 5, 1 3 5", () => {
  const [a, b, c] = [0, 1, 2].map((i) => triad("C", "major", i, "R"));
  assert.deepEqual(pitches(a), ["C4", "E4", "G4"]);
  assert.deepEqual(pitches(b), ["E4", "G4", "C5"]);
  assert.deepEqual(pitches(c), ["G4", "C5", "E5"]);
  assert.deepEqual([fingers(a), fingers(b), fingers(c)], ["1 3 5", "1 2 5", "1 3 5"]);
});

test("C major left hand: C3 E3 G3, E3 G3 C4, G3 C4 E4 with 5 3 1, 5 3 1, 5 2 1", () => {
  const [a, b, c] = [0, 1, 2].map((i) => triad("C", "major", i, "L"));
  assert.deepEqual(pitches(a), ["C3", "E3", "G3"]);
  assert.deepEqual(pitches(b), ["E3", "G3", "C4"]);
  assert.deepEqual(pitches(c), ["G3", "C4", "E4"]);
  assert.deepEqual([fingers(a), fingers(b), fingers(c)], ["5 3 1", "5 3 1", "5 2 1"]);
});

test("A minor in root position is A3 C4 E4, and inversion 3 is the root an octave higher", () => {
  assert.deepEqual(pitches(triad("A", "minor", 0, "R")), ["A3", "C4", "E4"]);
  assert.equal(triad("A", "minor", 0, "R").symbol, "Am");
  assert.deepEqual(pitches(triad("C", "major", 3, "R")), ["C5", "E5", "G5"]);
});

test("spelling: Eb major is Eb G Bb, F# minor is F# A C#, Db minor is written C# minor, dim and aug follow the letters", () => {
  assert.deepEqual(pitches(triad("Eb", "major", 0, "R")).map((p) => p.replace(/\d/, "")), ["Eb", "G", "Bb"]);
  assert.deepEqual(pitches(triad("F#", "minor", 0, "R")).map((p) => p.replace(/\d/, "")), ["F#", "A", "C#"]);
  const cs = triad("Db", "minor", 0, "R");
  assert.equal(cs.name, "C#");
  assert.equal(cs.symbol, "C#m");
  assert.deepEqual(pitches(cs).map((p) => p.replace(/\d/, "")), ["C#", "E", "G#"]);
  assert.deepEqual(pitches(triad("C", "dim", 0, "R")).map((p) => p.replace(/\d/, "")), ["C", "Eb", "Gb"]);
  assert.deepEqual(pitches(triad("C", "aug", 0, "R")).map((p) => p.replace(/\d/, "")), ["C", "E", "G#"]);
  assert.equal(triad("Db", "major", 0, "R").symbol, "Db");
});

test("every tonic, quality, inversion and hand: the right pitch classes, ascending, one letter apiece, root in its window", () => {
  for (const tonic of TONICS) {
    for (const quality of TRIAD_QUALITIES) {
      for (const hand of ["R", "L"]) {
        const root = triad(tonic, quality, 0, hand).notes[0].midi;
        const floor = hand === "R" ? 57 : 45;
        assert.ok(root >= floor && root <= floor + 11, `${tonic} ${quality} ${hand} root ${root}`);
        for (const inversion of [0, 1, 2, 3]) {
          const t = triad(tonic, quality, inversion, hand);
          const midis = t.notes.map((n) => n.midi);
          assert.deepEqual([...midis].sort((a, b) => a - b), midis, "ascending");
          const classes = new Set(midis.map((m) => (((m - root) % 12) + 12) % 12));
          assert.deepEqual([...classes].sort((a, b) => a - b), PCS[quality], `${t.symbol} inversion ${inversion}`);
          assert.equal(new Set(t.notes.map((n) => parsePitch(n.pitch).letter)).size, 3, `${t.symbol}: three letters`);
          assert.ok(t.notes.every((n) => n.finger >= 1 && n.finger <= 5 && n.hand === hand));
          assert.ok(midis.at(-1) - midis[0] <= 11, "within one octave");
        }
      }
    }
  }
});

test("bad input gives null", () => {
  assert.equal(triad("H"), null);
  assert.equal(triad("C", "sus"), null);
  assert.equal(triad("C", "major", 4), null);
  assert.equal(triad("C", "major", 0, "T"), null);
  assert.equal(arpeggio("C", "major", { octaves: 3 }), null);
  assert.equal(arpeggio("H"), null);
});

test("arpeggios: C major right hand one octave is C4 E4 G4 C5 with 1 2 3 5; left hand C3 E3 G3 C4 with 5 4 2 1", () => {
  const rh = arpeggio("C", "major");
  assert.deepEqual(pitches(rh), ["C4", "E4", "G4", "C5"]);
  assert.equal(fingers(rh), "1 2 3 5");
  assert.equal(rh.suggested, false);
  const lh = arpeggio("C", "major", { hand: "L" });
  assert.deepEqual(pitches(lh), ["C3", "E3", "G3", "C4"]);
  assert.equal(fingers(lh), "5 4 2 1");
  assert.equal(lh.suggested, false);
});

test("two octaves repeat the pattern: 7 notes with 1 2 3 1 2 3 5 and 5 4 2 1 3 2 1, the left hand flagged", () => {
  const rh = arpeggio("G", "major", { octaves: 2 });
  assert.equal(rh.notes.length, 7);
  assert.equal(fingers(rh), "1 2 3 1 2 3 5");
  assert.equal(rh.notes[6].pitch, "G6");
  assert.equal(rh.suggested, false);
  const lh = arpeggio("G", "major", { octaves: 2, hand: "L" });
  assert.equal(fingers(lh), "5 4 2 1 3 2 1");
  assert.equal(lh.suggested, true, "the left hand crossing finger varies by book");
});

test("descending is the ascending sequence reversed, notes and fingers", () => {
  const upSeq = arpeggio("G", "major", { octaves: 2 });
  const down = arpeggio("G", "major", { octaves: 2, direction: "down" });
  assert.deepEqual(pitches(down), [...pitches(upSeq)].reverse());
  assert.equal(fingers(down), [...upSeq.notes].reverse().map((n) => n.finger).join(" "));
});

test("flat roots: the right hand has its table row (2 1 2 4), the left hand is the assigner's and is flagged", () => {
  for (const tonic of ["Db", "Eb", "Ab", "Bb"]) {
    const rh = arpeggio(tonic, "major");
    assert.equal(fingers(rh), "2 1 2 4", tonic);
    assert.equal(rh.suggested, false);
    const lh = arpeggio(tonic, "major", { hand: "L" });
    assert.equal(lh.suggested, true, `${tonic} left hand is a suggestion`);
    assert.ok(lh.notes.every((n) => n.finger >= 1 && n.finger <= 5));
  }
});

test("rows the table does not have are flagged: minor on B, F# and the flat roots", () => {
  for (const tonic of ["B", "F#", "Db", "Eb", "Ab", "Bb"]) assert.equal(arpeggio(tonic, "minor").suggested, true, `${tonic} minor`);
  for (const tonic of ["C", "D", "E", "F", "G", "A"]) assert.equal(arpeggio(tonic, "minor").suggested, false, `${tonic} minor right hand is standard`);
  assert.equal(arpeggio("B", "major").suggested, false);
  assert.equal(arpeggio("F#", "major").suggested, false);
});

test("every tonic, quality, hand and size: right number of notes, root-third-fifth-root intervals, fingers 1 to 5", () => {
  for (const tonic of TONICS) {
    for (const quality of ["major", "minor"]) {
      for (const hand of ["R", "L"]) {
        for (const octaves of [1, 2]) {
          const a = arpeggio(tonic, quality, { octaves, hand });
          assert.equal(a.notes.length, 3 * octaves + 1);
          assert.ok(a.notes.every((n) => n.finger >= 1 && n.finger <= 5), `${tonic} ${quality} ${hand}`);
          const m = a.notes.map((n) => n.midi);
          assert.equal(m.at(-1) - m[0], 12 * octaves);
          assert.deepEqual(m.slice(0, 3).map((x) => x - m[0]), PCS[quality]);
        }
      }
    }
  }
});

test("a flagged row carries the flag only where it applies (counter-proof against flagging everything)", () => {
  const all = [];
  for (const tonic of TONICS) for (const hand of ["R", "L"]) for (const octaves of [1, 2]) all.push(arpeggio(tonic, "major", { hand, octaves }).suggested);
  assert.ok(all.includes(true) && all.includes(false));
});
