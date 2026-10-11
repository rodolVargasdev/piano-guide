import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutScore, staffPos, keySignature, durationShape, barsOf, metricsFor, BAR_OFFSET } from "../../src/score/layout.js";
import { parsePitch } from "../../src/core/pitch.js";
import { resolveLevel } from "../../src/core/timeline.js";

const M44 = { num: 4, den: 4 };
const M128 = { num: 12, den: 8 };

// Minimal timeline built through the real resolver so `midi` and `key` come from production code.
function timelineOf(notes, { key = { tonic: "C", mode: "major" }, meter = M44, pickupTicks = 0, lengthTicks = 3840, notation = "engraved", strictBars = true } = {}) {
  const song = { key, meter, pickupTicks, lengthTicks, tempo: { bpm: 72, beatUnit: "quarter" }, levels: { x: { label: "X", notation, strictBars, notes } } };
  return resolveLevel(song, "x");
}
const R = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "R", ...extra });
const L = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "L", ...extra });
const noteAt = (layout, tick, staff, i = 0) => layout.events.find((e) => e.tick === tick && e.staff === staff && !e.grace).notes[i];

test("resolveLevel carries the key so the layout can build the signature", () => {
  assert.deepEqual(timelineOf([R(0, 1920, "E4")], { key: { tonic: "Eb", mode: "major" } }).key, { tonic: "Eb", mode: "major" });
});

test("pitch placement: E4 sits on the first treble line, G2 on the first bass line", () => {
  assert.equal(staffPos(parsePitch("E4"), "treble"), 0);
  assert.equal(staffPos(parsePitch("G2"), "bass"), 0);
  assert.equal(staffPos(parsePitch("F5"), "treble"), 8, "top line");
  assert.equal(staffPos(parsePitch("B4"), "treble"), 4, "middle line");
  assert.equal(staffPos(parsePitch("A3"), "bass"), 8, "top bass line");
  const l = layoutScore(timelineOf([R(0, 1920, "E4"), L(0, 1920, "G2")]));
  assert.equal(noteAt(l, 0, "treble").pos, 0);
  assert.equal(noteAt(l, 0, "bass").pos, 0);
});

test("the right hand is on the treble staff and the left hand on the bass staff", () => {
  const l = layoutScore(timelineOf([R(0, 1920, "C5"), L(0, 1920, "C3")]));
  assert.deepEqual(l.events.map((e) => [e.hand, e.staff]).sort(), [["L", "bass"], ["R", "treble"]]);
});

test("middle C needs one ledger line below the treble staff and one above the bass staff", () => {
  const l = layoutScore(timelineOf([R(0, 1920, "C4"), L(0, 1920, "C4")]));
  assert.deepEqual(l.events.find((e) => e.staff === "treble").ledgers, [-2]);
  assert.equal(noteAt(l, 0, "bass").pos, 10);
  assert.deepEqual(l.events.find((e) => e.staff === "bass").ledgers, [10]);
  const inside = layoutScore(timelineOf([R(0, 1920, "E4"), R(1920, 1920, "G5")]));
  assert.deepEqual(inside.events.map((e) => e.ledgers), [[], []], "contra-case: inside the staff or one space above it, no ledger line");
});

test("Eb major draws three flats on both staves, B E A in order", () => {
  const sig = keySignature({ tonic: "Eb", mode: "major" });
  assert.equal(sig.kind, "flat");
  assert.deepEqual(sig.treble.map((a) => a.letter), ["B", "E", "A"]);
  assert.deepEqual(sig.bass.map((a) => a.letter), ["B", "E", "A"]);
  assert.deepEqual(sig.treble.map((a) => a.pos), [4, 7, 3]);
  assert.deepEqual(sig.bass.map((a) => a.pos), [2, 5, 1]);
  assert.equal(layoutScore(timelineOf([R(0, 1920, "Eb4")], { key: { tonic: "Eb", mode: "major" } })).keySignature.treble.length, 3);
});

test("key signatures: E major has four sharps F C G D, C major and A minor have none", () => {
  const e = keySignature({ tonic: "E", mode: "major" });
  assert.deepEqual(e.treble.map((a) => `${a.letter}${a.pos}`), ["F8", "C5", "G9", "D6"]);
  assert.equal(keySignature({ tonic: "C", mode: "major" }).treble.length, 0);
  assert.equal(keySignature({ tonic: "A", mode: "minor" }).kind, null);
});

test("counter-proof: a note outside the key signature gets an accidental, a note inside does not", () => {
  const eb = { tonic: "Eb", mode: "major" };
  const inside = layoutScore(timelineOf([R(0, 1920, "Eb4"), R(1920, 1920, "Bb4")], { key: eb }));
  assert.deepEqual(inside.events.flatMap((e) => e.notes.map((n) => n.accidental)), [null, null]);
  const outside = layoutScore(timelineOf([R(0, 1920, "E4"), R(1920, 1920, "F#4")], { key: eb }));
  assert.deepEqual(outside.events.flatMap((e) => e.notes.map((n) => n.accidental)), ["natural", "sharp"]);
  const dbl = layoutScore(timelineOf([R(0, 1920, "F##4"), R(1920, 1920, "Bbb4")]));
  assert.deepEqual(dbl.events.flatMap((e) => e.notes.map((n) => n.accidental)), ["double-sharp", "double-flat"]);
});

test("an accidental is printed once per bar and again after the barline", () => {
  const l = layoutScore(timelineOf([R(0, 960, "F#4"), R(960, 960, "F#4"), R(1920, 960, "F#4"), R(2880, 960, "F#4")]));
  assert.deepEqual(l.events.map((e) => e.notes[0].accidental), ["sharp", null, "sharp", null]);
});

test("an accidental applies to its own octave only, and a natural cancels it later in the bar", () => {
  const l = layoutScore(timelineOf([R(0, 480, "F#4"), R(480, 480, "F#5"), R(960, 480, "F4"), R(1440, 480, "F4")]));
  assert.deepEqual(l.events.map((e) => e.notes[0].accidental), ["sharp", "sharp", "natural", null]);
});

test("the accidental state is per staff: the same pitch in both hands prints in each", () => {
  const l = layoutScore(timelineOf([R(0, 1920, "F#4"), L(0, 1920, "F#3")]));
  assert.deepEqual(l.events.map((e) => e.notes[0].accidental), ["sharp", "sharp"]);
});

test("a pickup is bar 0 and its accidentals do not carry into bar 1", () => {
  const l = layoutScore(timelineOf([R(0, 480, "F#4"), R(480, 1920, "F#4")], { pickupTicks: 480, lengthTicks: 2400 }));
  assert.deepEqual(l.events.map((e) => e.notes[0].accidental), ["sharp", "sharp"]);
  assert.deepEqual(barsOf(M44, 480, 2400).map((b) => [b.bar, b.startTick, b.endTick]), [[0, 0, 480], [1, 480, 2400]]);
});

test("durationShape: values, dots and tuplets", () => {
  assert.deepEqual(durationShape(1920), { base: "whole", dots: 0 });
  assert.deepEqual(durationShape(720), { base: "quarter", dots: 1 });
  assert.deepEqual(durationShape(2880), { base: "whole", dots: 1 }, "a 12/8 bar is a dotted whole");
  assert.deepEqual(durationShape(80, { n: 3, inSpaceOf: 2 }), { base: "16th", dots: 0 }, "a sixteenth triplet");
  const odd = durationShape(500);
  assert.equal(odd.approximate, true, "contra-case: a value that cannot be written is flagged");
  assert.equal(odd.base, "quarter");
});

test("tickToX is monotonic over the whole piece and strictly increasing at anchors", () => {
  const l = layoutScore(timelineOf([R(0, 480, "C5"), R(480, 480, "D5"), R(960, 960, "E5"), R(1920, 1920, "F5"), L(0, 1920, "C3")]));
  let prev = -Infinity;
  for (let t = 0; t <= 3840; t += 30) {
    const x = l.tickToX(t);
    assert.ok(x >= prev, `x at ${t}`);
    prev = x;
  }
  for (let i = 1; i < l.anchors.length; i += 1) assert.ok(l.anchors[i].x > l.anchors[i - 1].x);
  assert.equal(l.tickToX(-100), 0, "before the start clamps to the first anchor");
  assert.equal(l.tickToX(99999), l.width, "after the end clamps to the last anchor");
  const mid = (l.tickToX(480) + l.tickToX(960)) / 2;
  assert.ok(Math.abs(l.tickToX(720) - mid) < 1e-9, "linear between anchors");
});

test("the anchor table holds every onset, bar start, chord, analysis tick, tick 0 and the end", () => {
  const tl = { ...timelineOf([R(0, 480, "C5"), R(480, 480, "D5"), R(2400, 480, "E5")], { lengthTicks: 3840 }), chords: [{ tick: 1000, dur: 500, symbol: "C" }], analysis: [{ tick: 3000, endTick: 3500, kind: "harmony", title: "t", text: "x" }] };
  const have = new Set(layoutScore(tl).anchors.map((a) => a.tick));
  for (const t of [0, 480, 1000, 1920, 2400, 3000, 3500, 3840]) assert.ok(have.has(t), `anchor at ${t}`);
  assert.ok(!have.has(720), "counter-proof: an arbitrary tick is not an anchor (it is interpolated)");
});

test("barlines sit just before the first onset of each bar, in both meters", () => {
  const l = layoutScore(timelineOf([R(0, 1920, "C5"), R(1920, 1920, "D5")]));
  assert.deepEqual(l.measures.map((m) => m.bar), [1, 2]);
  assert.equal(l.measures[1].x, l.tickToX(1920) - BAR_OFFSET);
  const c = layoutScore(timelineOf([R(0, 2880, "Eb5")], { meter: M128, lengthTicks: 5760, key: { tonic: "Eb", mode: "major" } }));
  assert.deepEqual(c.measures.map((m) => [m.startTick, m.endTick]), [[0, 2880], [2880, 5760]]);
});

test("labelled noteheads are larger and spaced wider than engraved ones", () => {
  const a = metricsFor("labelled");
  const b = metricsFor("engraved");
  assert.ok(a.headW > b.headW && a.minGap > b.minGap);
  const notes = [R(0, 240, "C5"), R(240, 240, "D5")];
  const wide = layoutScore(timelineOf(notes, { notation: "labelled", lengthTicks: 480 }));
  const tight = layoutScore(timelineOf(notes, { notation: "engraved", lengthTicks: 480 }));
  assert.ok(wide.tickToX(240) > tight.tickToX(240));
});

test("a hostile pitch string is skipped, never thrown", () => {
  const l = layoutScore(timelineOf([R(0, 1920, "<script>"), R(0, 1920, "C5")]));
  assert.equal(l.events.length, 1);
});
