import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveChord } from "../../src/import/chords.js";
import { parseChord } from "../../src/core/chords.js";

const E = { tonic: "E", mode: "major" };
const P = "sections.verse.chords[0]";
const chord = (extra) => ({ root: 1, type: 5, inversion: 0, applied: 0, borrowed: "", adds: [], suspensions: [], alterations: [], omits: [], substitutions: [], alternate: "", ...extra });
const derive = (extra, key = E) => deriveChord(chord(extra), key, P);
const symbolOf = (extra, key) => {
  const r = derive(extra, key);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.symbol;
};

test("diatonic triads in E major: degree 6 is C#m, and the others follow the key", () => {
  const expected = { 1: "E", 2: "F#m", 3: "G#m", 4: "A", 5: "B", 6: "C#m", 7: "D#dim" };
  for (const [root, symbol] of Object.entries(expected)) assert.equal(symbolOf({ root: Number(root) }), symbol, `degree ${root}`);
});

test("diatonic seventh chords use the core suffixes", () => {
  const expected = { 1: "Emaj7", 2: "F#m7", 4: "Amaj7", 5: "B7", 6: "C#m7", 7: "D#m7b5" };
  for (const [root, symbol] of Object.entries(expected)) assert.equal(symbolOf({ root: Number(root), type: 7 }), symbol, `degree ${root}`);
});

test("roman numerals: case follows the quality, diatonic chords carry no accidental", () => {
  assert.equal(derive({ root: 1 }).roman, "I");
  assert.equal(derive({ root: 6 }).roman, "vi");
  assert.equal(derive({ root: 5, type: 7 }).roman, "V7");
  assert.equal(derive({ root: 7 }).roman, "viidim");
  assert.equal(derive({ root: 2, type: 7 }).roman, "ii7");
  assert.equal(derive({ root: 1, type: 7 }).roman, "Imaj7");
});

test("inversion writes the slash bass: third, fifth, seventh", () => {
  assert.equal(symbolOf({ root: 1, inversion: 1 }), "E/G#");
  assert.equal(symbolOf({ root: 1, inversion: 2 }), "E/B");
  assert.equal(symbolOf({ root: 5, type: 7, inversion: 3 }), "B7/A");
  assert.equal(symbolOf({ root: 6, inversion: 1 }), "C#m/E");
});

test("applied 5 is the major triad (or dominant seventh) a fifth above the root degree: V/vi in E major is G#", () => {
  const r = derive({ root: 6, applied: 5 });
  assert.equal(r.symbol, "G#");
  assert.equal(r.roman, "V/vi");
  assert.equal(r.rootName, "G#");
  assert.equal(symbolOf({ root: 6, applied: 5, type: 7 }), "G#7");
  assert.equal(derive({ root: 6, applied: 5, type: 7 }).roman, "V7/vi");
  assert.equal(symbolOf({ root: 6, applied: 5, inversion: 1 }), "G#/B#", "the third of G# major is B#, not C");
  assert.equal(symbolOf({ root: 2, applied: 5 }), "C#");
  assert.equal(derive({ root: 5, applied: 5 }).roman, "V/V");
});

test("applied 7 is the diminished chord a semitone below the root degree, spelled with the letter below", () => {
  assert.equal(symbolOf({ root: 6, applied: 7 }), "B#dim");
  assert.equal(derive({ root: 6, applied: 7 }).roman, "viidim/vi");
  assert.equal(symbolOf({ root: 6, applied: 7, type: 7 }), "B#m7b5");
  assert.equal(symbolOf({ root: 5, applied: 7 }), "A#dim");
});

test("borrowed chords come from the named mode: bVI of the minor mode in E major is C", () => {
  const r = derive({ root: 6, borrowed: "minor" });
  assert.equal(r.symbol, "C");
  assert.equal(r.roman, "bVI");
  assert.equal(symbolOf({ root: 3, borrowed: "minor" }), "G");
  assert.equal(derive({ root: 3, borrowed: "minor" }).roman, "bIII");
  assert.equal(symbolOf({ root: 4, borrowed: "minor" }), "Am", "the fourth of the minor mode is minor");
});

test("phrygian dominant: degree 1 is major, bII is F major and bVII with a seventh is Dm7", () => {
  assert.equal(symbolOf({ root: 1, borrowed: "phrygianDominant" }), "E");
  assert.equal(derive({ root: 1, borrowed: "phrygianDominant" }).roman, "I");
  assert.equal(symbolOf({ root: 2, borrowed: "phrygianDominant" }), "F");
  assert.equal(derive({ root: 2, borrowed: "phrygianDominant" }).roman, "bII");
  assert.equal(symbolOf({ root: 7, type: 7, borrowed: "phrygianDominant" }), "Dm7");
  assert.equal(derive({ root: 7, type: 7, borrowed: "phrygianDominant" }).roman, "bvii7");
});

test("every borrowed mode derives a parseable symbol for every degree", () => {
  for (const borrowed of ["minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian", "harmonicMinor", "phrygianDominant"]) {
    for (let root = 1; root <= 7; root += 1) {
      const r = derive({ root, borrowed });
      // A mode degree whose stacked thirds have no symbol (for example a minor-major triad) fails with a path, never a bad symbol.
      if (r.ok) assert.ok(parseChord(r.symbol), `${borrowed} ${root}: ${r.symbol}`);
      else assert.match(r.errors[0].path, /chords\[0\]/);
    }
  }
});

test("add 9 on a major triad, and suspensions replace the third", () => {
  assert.equal(symbolOf({ adds: [9] }), "Eadd9");
  assert.equal(symbolOf({ root: 4, adds: [9] }), "Aadd9");
  assert.equal(symbolOf({ suspensions: [2] }), "Esus2");
  assert.equal(symbolOf({ suspensions: [4] }), "Esus4");
  assert.equal(symbolOf({ root: 6, suspensions: [4] }), "C#sus4", "a minor chord loses its third as well");
  assert.equal(symbolOf({ suspensions: [4], inversion: 1 }), "Esus4/A");
});

test("a raised fifth on a major triad is augmented", () => {
  assert.equal(symbolOf({ alterations: ["#5"] }), "Eaug");
});

test("spelling follows the key: flat and sharp-heavy tonics", () => {
  assert.equal(symbolOf({ root: 4 }, { tonic: "Eb", mode: "major" }), "Ab");
  assert.equal(symbolOf({ root: 6 }, { tonic: "Eb", mode: "major" }), "Cm");
  assert.equal(symbolOf({ root: 7 }, { tonic: "F#", mode: "major" }), "E#dim");
  assert.equal(symbolOf({ root: 3 }, { tonic: "Db", mode: "major" }), "Fm");
});

test("every degree, size and allowed inversion in three keys gives a symbol that parseChord reads", () => {
  for (const tonic of ["E", "Eb", "F#"]) {
    for (let root = 1; root <= 7; root += 1) {
      for (const type of [5, 7]) {
        for (const inversion of type === 5 ? [0, 1, 2] : [0, 1, 2, 3]) {
          for (const applied of [0, 5, 7]) {
            const r = derive({ root, type, inversion, applied }, { tonic, mode: "major" });
            if (r.ok) assert.ok(parseChord(r.symbol), `${tonic} ${root} ${type} ${inversion} ${applied}: ${r.symbol}`);
            else assert.ok(r.errors.length > 0);
          }
        }
      }
    }
  }
});

const BAD = [
  { name: "root 8", extra: { root: 8 }, field: "root" },
  { name: "root 0", extra: { root: 0 }, field: "root" },
  { name: "type 9", extra: { type: 9 }, field: "type" },
  { name: "inversion 4", extra: { inversion: 4 }, field: "inversion" },
  { name: "inversion 3 on a triad", extra: { inversion: 3 }, field: "inversion" },
  { name: "applied 3", extra: { applied: 3 }, field: "applied" },
  { name: "an unknown borrowed mode", extra: { borrowed: "enigmatic" }, field: "borrowed" },
  { name: "an inherited name as the borrowed mode", extra: { borrowed: "toString" }, field: "borrowed" },
  { name: "add 11", extra: { adds: [11] }, field: "adds" },
  { name: "two suspensions", extra: { suspensions: [2, 4] }, field: "suspensions" },
  { name: "a flat five alteration", extra: { alterations: ["b5"] }, field: "alterations" },
  { name: "omitted notes", extra: { omits: [3] }, field: "omits" },
  { name: "a substitution", extra: { substitutions: ["x"] }, field: "substitutions" },
  { name: "an alternate chord", extra: { alternate: "yes" }, field: "alternate" },
  { name: "add 9 on a minor chord", extra: { root: 6, adds: [9] }, field: "adds" },
  { name: "add 9 on a seventh chord", extra: { type: 7, adds: [9] }, field: "adds" },
  { name: "a raised fifth on a minor chord", extra: { root: 6, alterations: ["#5"] }, field: "alterations" },
  { name: "a suspension on an applied chord", extra: { root: 6, applied: 5, suspensions: [4] }, field: "suspensions" },
];

for (const c of BAD) {
  test(`unsupported input fails naming the path of the field: ${c.name}`, () => {
    const r = derive(c.extra);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.path === `${P}.${c.field}`), JSON.stringify(r.errors));
  });
}

test("counter-proof: the same chords without the unsupported field derive normally", () => {
  assert.equal(derive({ root: 6, applied: 5, suspensions: [] }).ok, true);
  assert.equal(derive({ root: 6, alterations: [] }).ok, true);
  assert.equal(derive({ type: 7, adds: [] }).ok, true);
});

test("a chord that is not an object or a key that is not major fails cleanly", () => {
  assert.equal(deriveChord(null, E, P).ok, false);
  assert.equal(deriveChord(chord({}), { tonic: "E", mode: "minor" }, P).ok, false);
  assert.equal(deriveChord(chord({}), { tonic: "H", mode: "major" }, P).ok, false);
});
