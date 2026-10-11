import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIDI_MIN,
  MIDI_MAX,
  FULL_RANGE,
  WHITE_WIDTH,
  BLACK_WIDTH,
  isBlackKey,
  keyGeometry,
  layoutRange,
  fittedRange,
} from "../../src/core/keyboard-layout.js";

const all = Array.from({ length: MIDI_MAX - MIDI_MIN + 1 }, (_, i) => keyGeometry(MIDI_MIN + i));
const whites = all.filter((k) => !k.isBlack);
const blacks = all.filter((k) => k.isBlack);
const notes = (...midis) => midis.map((midi) => ({ midi }));

test("A0 to C8 has 52 white and 36 black keys", () => {
  assert.equal(all.length, 88);
  assert.equal(whites.length, 52);
  assert.equal(blacks.length, 36);
});

test("white keys are contiguous from x = 0 with width 1", () => {
  whites.forEach((k, i) => {
    assert.equal(k.x, i * WHITE_WIDTH);
    assert.equal(k.width, WHITE_WIDTH);
  });
  assert.equal(keyGeometry(21).x, 0); // A0
  assert.equal(keyGeometry(60).x, 23); // C4 is the 24th white key
  assert.equal(keyGeometry(108).x, 51); // C8
});

test("black keys straddle the seam between the right two white keys", () => {
  for (const k of blacks) {
    const below = whites.find((w) => w.midi === k.midi - 1);
    const above = whites.find((w) => w.midi === k.midi + 1);
    assert.ok(below && above, `black key ${k.midi} has white neighbors`);
    const center = k.x + k.width / 2;
    assert.ok(Math.abs(center - above.x) <= 0.1, `black ${k.midi} centered near the seam`);
    assert.ok(k.x > below.x && k.x + k.width < above.x + above.width, `black ${k.midi} stays over its two whites`);
    assert.equal(k.width, BLACK_WIDTH);
    assert.ok(k.width < WHITE_WIDTH);
  }
});

test("isBlackKey follows the pitch class, including octaves outside the range", () => {
  assert.deepEqual([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].map(isBlackKey), [false, true, false, true, false, false, true, false, true, false, true, false]);
  assert.equal(isBlackKey(22), true); // Bb0
  assert.equal(isBlackKey(-2), true); // pitch class 10 for a negative number
});

test("keyGeometry returns null outside A0 to C8 and for non-integers", () => {
  assert.equal(keyGeometry(20), null);
  assert.equal(keyGeometry(109), null);
  assert.equal(keyGeometry(60.5), null);
  assert.equal(keyGeometry(Number.NaN), null);
});

test("layoutRange measures x from the first white key of the range", () => {
  const { whites: w, blacks: b, width } = layoutRange({ low: 60, high: 71 }); // C4 to B4
  assert.equal(w.length, 7);
  assert.equal(b.length, 5);
  assert.equal(width, 7);
  assert.equal(w[0].x, 0);
  assert.equal(w[6].x, 6);
  assert.ok(b[0].x > 0 && b[0].x < 1); // C# between C and D
  assert.equal(layoutRange(FULL_RANGE).width, 52);
});

test("layoutRange rejects an inverted or out-of-range request", () => {
  assert.throws(() => layoutRange({ low: 72, high: 60 }), RangeError);
  assert.throws(() => layoutRange({ low: 10, high: 60 }), RangeError);
  assert.throws(() => layoutRange({ low: 60, high: 120 }), RangeError);
});

test("fittedRange pads 3 semitones and snaps outward to C and B", () => {
  // E4 (64) to G4 (67) padded is 61 to 70; snapped to C4 (60) and B4 (71), widened to 36 keys.
  const r = fittedRange(notes(64, 67));
  assert.equal(r.low % 12, 0);
  assert.equal(r.high % 12, 11);
  assert.ok(r.low <= 61 && r.high >= 70);
});

test("fittedRange: padding crosses into the next octave when the note sits on C or B", () => {
  // C4 minus 3 is 57, so the range starts at C3 (48), not C4; B5 (83) plus 3 is 86, so it ends at B6 (95).
  const r = fittedRange(notes(60, 83), { minSpan: 12 });
  assert.deepEqual(r, { low: 48, high: 95 });
});

test("fittedRange counter-proof: with no padding the same notes would start at C4", () => {
  assert.deepEqual(fittedRange(notes(60, 71), { pad: 0, minSpan: 12 }), { low: 60, high: 71 });
  assert.deepEqual(fittedRange(notes(60, 71), { pad: 3, minSpan: 12 }), { low: 48, high: 83 });
});

test("fittedRange keeps a minimum span of 36 keys and still ends on C and B", () => {
  for (const m of [40, 60, 72, 90]) {
    const r = fittedRange(notes(m));
    assert.ok(r.high - r.low + 1 >= 36, `span for ${m}`);
    assert.equal(r.low % 12, 0);
    assert.equal(r.high % 12, 11);
    assert.ok(r.low <= m && r.high >= m);
  }
});

test("fittedRange always contains every note, across a sweep of single notes and pairs", () => {
  for (let a = MIDI_MIN; a <= MIDI_MAX; a += 3) {
    for (const b of [a, Math.min(MIDI_MAX, a + 7), Math.min(MIDI_MAX, a + 40)]) {
      const r = fittedRange(notes(a, b));
      assert.ok(r.low <= a && r.high >= b, `${a},${b} inside ${r.low}-${r.high}`);
      assert.ok(r.low >= MIDI_MIN && r.high <= MIDI_MAX);
    }
  }
});

test("fittedRange clamps to the 88-key keyboard at both ends", () => {
  assert.deepEqual(fittedRange(notes(21, 108)), FULL_RANGE);
  const bottom = fittedRange(notes(21));
  assert.equal(bottom.low, 21);
  const top = fittedRange(notes(108));
  assert.equal(top.high, 108);
});

test("fittedRange ignores rests and falls back to C3 to B5 without pitched notes", () => {
  assert.deepEqual(fittedRange([]), { low: 48, high: 83 });
  assert.deepEqual(fittedRange([{ midi: null, rest: true }]), { low: 48, high: 83 });
  assert.deepEqual(fittedRange([{ midi: null }, { midi: 64 }, { midi: 67 }]), fittedRange(notes(64, 67)));
});

test("the full 88 range is A0 to C8", () => {
  assert.deepEqual(FULL_RANGE, { low: 21, high: 108 });
  assert.ok(Object.isFrozen(FULL_RANGE));
});
