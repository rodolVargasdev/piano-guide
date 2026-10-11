import { test } from "node:test";
import assert from "node:assert/strict";
import { learnRegion } from "../../src/learn/region.js";
import { mulberry32 } from "../../src/theory/random.js";

const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const isWhite = (midi) => WHITE.has(midi % 12);
const whiteCount = ({ low, high }) => {
  let n = 0;
  for (let m = low; m <= high; m += 1) if (isWhite(m)) n += 1;
  return n;
};
const C4 = 60;
const G4 = 67;

test("a short phrase is framed with a one-key margin and widened to nine white keys, edges on white keys", () => {
  const r = learnRegion({ phraseMidis: [60, 62, 64, 65, 67], positionMidis: [60, 67], stepMidis: [64], maxWhite: 15 });
  assert.equal(r.mode, "phrase");
  assert.equal(whiteCount(r), 9);
  assert.deepEqual([r.low, r.high], [57, 71], "A3 to B4: the phrase C4 to G4 sits in the middle");
  assert.ok(isWhite(r.low) && isWhite(r.high));
});

test("a phrase wider than nine keys is framed by its own range plus the margin", () => {
  const r = learnRegion({ phraseMidis: [60, 84], positionMidis: [60], stepMidis: [60], maxWhite: 20 });
  assert.equal(r.mode, "phrase");
  assert.deepEqual([r.low, r.high], [59, 86], "B3 to D6: C4 to C6 plus one white key each side");
});

test("a phrase that does not fit the width falls back to the position and step (position mode)", () => {
  const r = learnRegion({ phraseMidis: [48, 84], positionMidis: [60, 62, 64, 65, 67], stepMidis: [64], maxWhite: 10 });
  assert.equal(r.mode, "position");
  assert.ok(r.low <= 60 && r.high >= 67);
  assert.ok(whiteCount(r) <= 10);
  assert.ok(whiteCount(r) >= 9);
});

test("counter-proof: the same phrase in phrase mode when the width allows it", () => {
  const r = learnRegion({ phraseMidis: [48, 84], positionMidis: [60, 67], stepMidis: [64], maxWhite: 40 });
  assert.equal(r.mode, "phrase");
  assert.ok(r.low <= 48 && r.high >= 84);
});

test("a black key at the edge extends the region to the white key beyond it", () => {
  const lowBlack = learnRegion({ phraseMidis: [66, 67], positionMidis: [66], stepMidis: [66], maxWhite: 15, marginWhite: 0, minWhite: 1 });
  assert.equal(lowBlack.low, 65, "F#4 is framed from F4");
  const highBlack = learnRegion({ phraseMidis: [64, 66], positionMidis: [64], stepMidis: [66], maxWhite: 15, marginWhite: 0, minWhite: 1 });
  assert.equal(highBlack.high, 67, "F#4 is framed up to G4");
});

test("the region stays inside A0 to C8 and keeps its width", () => {
  const low = learnRegion({ phraseMidis: [21, 23], positionMidis: [21], stepMidis: [21], maxWhite: 15 });
  assert.equal(low.low, 21);
  assert.equal(whiteCount(low), 9);
  const high = learnRegion({ phraseMidis: [106, 108], positionMidis: [108], stepMidis: [108], maxWhite: 15 });
  assert.equal(high.high, 108);
  assert.equal(whiteCount(high), 9);
});

test("a screen narrower than nine keys shows fewer, never hiding a key of the step or the position", () => {
  const r = learnRegion({ phraseMidis: [60, 72], positionMidis: [60, 62, 64, 65, 67], stepMidis: [64], maxWhite: 7 });
  assert.equal(r.mode, "position");
  assert.ok(r.low <= 60 && r.high >= 67);
  assert.equal(whiteCount(r), 7, "the five-key position plus the margin, which still fits the width");
  const tight = learnRegion({ phraseMidis: [60, 72], positionMidis: [60, 62, 64, 65, 67], stepMidis: [64], maxWhite: 5 });
  assert.equal(whiteCount(tight), 5, "a margin that would not fit is dropped, the position itself is kept");
  const wider = learnRegion({ phraseMidis: [], positionMidis: [C4, G4], stepMidis: [C4], maxWhite: 4 });
  assert.ok(wider.low <= C4 && wider.high >= G4, "even above maxWhite the required keys stay visible");
});

test("random inputs: edges are white keys, every step and position key is inside, the piano range is respected", () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 300; i += 1) {
    const pick = () => 21 + Math.floor(rand() * 88);
    const centre = pick();
    const around = (n, spread) => Array.from({ length: n }, () => Math.min(108, Math.max(21, centre + Math.floor((rand() - 0.5) * spread))));
    const phraseMidis = around(1 + Math.floor(rand() * 8), 40);
    const positionMidis = around(1 + Math.floor(rand() * 3), 8);
    const stepMidis = around(1 + Math.floor(rand() * 3), 8);
    const maxWhite = 7 + Math.floor(rand() * 10);
    const r = learnRegion({ phraseMidis, positionMidis, stepMidis, maxWhite });
    assert.ok(isWhite(r.low) && isWhite(r.high), `edges ${r.low} ${r.high}`);
    assert.ok(r.low >= 21 && r.high <= 108);
    for (const m of [...positionMidis, ...stepMidis]) assert.ok(m >= r.low && m <= r.high, `key ${m} outside ${r.low}-${r.high}`);
    if (r.mode === "phrase") for (const m of phraseMidis) assert.ok(m >= r.low && m <= r.high);
  }
});
