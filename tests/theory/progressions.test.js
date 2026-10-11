import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRESSIONS, progression } from "../../src/theory/progressions.js";
import { TONICS } from "../../src/theory/keys.js";
import { parsePitch } from "../../src/core/pitch.js";

const symbols = (p) => p.chords.map((c) => c.symbol);
const right = (c) => c.right.notes.map((n) => n.pitch);
const midis = (c) => c.right.notes.map((n) => n.midi);
const pc = (m) => ((m % 12) + 12) % 12;
const move = (a, b) => a.reduce((s, m, i) => s + Math.abs(m - b[i]), 0);

test("C major I-IV-V-I: the chords are C F G C, the left hand roots C3 F3 G3 C3, each right hand voicing has the chord's three notes", () => {
  const p = progression("C", "I-IV-V-I");
  assert.deepEqual(symbols(p), ["C", "F", "G", "C"]);
  assert.deepEqual(p.chords.map((c) => c.bass.pitch), ["C3", "F3", "G3", "C3"]);
  assert.ok(p.chords.every((c) => c.bass.finger === 5 && c.bass.hand === "L"));
  const wanted = [[0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]];
  p.chords.forEach((c, i) => assert.deepEqual([...new Set(midis(c).map(pc))].sort((a, b) => a - b), [...wanted[i]].sort((a, b) => a - b), `chord ${i}`));
  assert.deepEqual(right(p.chords[0]), ["C4", "E4", "G4"], "the first chord is the root position triad");
});

test("a common tone is kept: from C to F the C stays and the other two voices move by the smallest intervals", () => {
  const p = progression("C", "I-IV-V-I");
  const [c, f] = [midis(p.chords[0]), midis(p.chords[1])];
  assert.ok(f.includes(c[0]), "the C is held");
  assert.equal(move(c, f), 3);
});

test("the total movement is no worse than playing every chord in root position, for all 12 tonics and 3 progressions", () => {
  for (const tonic of TONICS) {
    for (const name of Object.keys(PROGRESSIONS)) {
      const p = progression(tonic, name);
      // Brute force: the first chord fixed, every later chord in root position at any octave of the region.
      const roots = p.chords.map((c) => {
        const base = parsePitch(`${c.name}4`).midi;
        const options = [];
        for (let k = -3; k <= 3; k += 1) {
          const third = c.quality === "minor" ? 3 : 4;
          const m = [base + 12 * k, base + 12 * k + third, base + 12 * k + 7];
          if (m[0] >= 55 && m[2] <= 79) options.push(m);
        }
        return options;
      });
      const first = midis(p.chords[0]);
      let level = new Map([[first.join(), { m: first, cost: 0 }]]);
      for (let i = 1; i < roots.length; i += 1) {
        const next = new Map();
        for (const o of roots[i]) next.set(o.join(), { m: o, cost: Math.min(...[...level.values()].map((x) => x.cost + move(x.m, o))) });
        level = next;
      }
      const allRoot = Math.min(...[...level.values()].map((x) => x.cost));
      assert.ok(p.movement <= allRoot, `${tonic} ${name}: ${p.movement} > ${allRoot}`);
      const sum = p.chords.slice(1).reduce((s, c, i) => s + move(midis(p.chords[i]), midis(c)), 0);
      assert.equal(sum, p.movement, "the reported movement is the real one");
    }
  }
});

test("vi is minor: G major I-vi-IV-V is G Em C D", () => {
  assert.deepEqual(symbols(progression("G", "I-vi-IV-V")), ["G", "Em", "C", "D"]);
});

test("flat keys are spelled in the key: Bb major I-V-vi-IV is Bb F Gm Eb, and F# major has Ebs of the sharp kind", () => {
  const p = progression("Bb", "I-V-vi-IV");
  assert.deepEqual(symbols(p), ["Bb", "F", "Gm", "Eb"]);
  assert.deepEqual(right(p.chords[2]).map((x) => x.replace(/\d/, "")).sort(), ["Bb", "D", "G"]);
  const fs = progression("F#", "I-V-vi-IV");
  assert.deepEqual(symbols(fs), ["F#", "C#", "D#m", "B"]);
  assert.deepEqual(right(fs.chords[1]).map((x) => x.replace(/\d/, "")).sort(), ["C#", "E#", "G#"]);
});

test("every voicing is ascending, inside the region, fingered 1 3 5 or 1 2 5, and the bass is in its window", () => {
  for (const tonic of TONICS) {
    for (const name of Object.keys(PROGRESSIONS)) {
      for (const c of progression(tonic, name).chords) {
        const m = midis(c);
        assert.deepEqual([...m].sort((a, b) => a - b), m);
        assert.ok(m[0] >= 55 && m[2] <= 79, `${tonic} ${c.symbol} ${m}`);
        assert.equal(c.right.notes.map((n) => n.finger).join(" "), c.right.inversion === 1 ? "1 2 5" : "1 3 5", "first inversion is 1 2 5, the others 1 3 5");
        assert.ok(c.bass.midi >= 45 && c.bass.midi <= 56, `${tonic} ${c.symbol} bass ${c.bass.pitch}`);
        assert.equal(pc(c.bass.midi), pc(parsePitch(`${c.name}4`).midi), "the bass is the root");
      }
    }
  }
});

test("the same input gives the same progression, and the numerals can be given as a list", () => {
  assert.deepEqual(progression("D", "I-V-vi-IV"), progression("D", ["I", "V", "vi", "IV"]));
});

test("bad input gives null: unknown tonic, unknown numeral, empty list", () => {
  assert.equal(progression("H", "I-IV-V-I"), null);
  assert.equal(progression("C", ["I", "VII"]), null);
  assert.equal(progression("C", []), null);
  assert.equal(progression("C", "nope"), null);
});

test("counter-proof: the all-root-position comparison does see a worse sequence", () => {
  const far = [[60, 64, 67], [72, 76, 79]];
  assert.ok(move(far[0], far[1]) > 3, "a jump of an octave is a large movement");
});
