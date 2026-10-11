import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutScore } from "../../src/score/layout.js";
import { resolveLevel } from "../../src/core/timeline.js";

const M44 = { num: 4, den: 4 };
const M128 = { num: 12, den: 8 };
const EB = { tonic: "Eb", mode: "major" };

function timelineOf(notes, { key = { tonic: "C", mode: "major" }, meter = M44, pickupTicks = 0, lengthTicks = 1920, strictBars = true } = {}) {
  const song = { key, meter, pickupTicks, lengthTicks, tempo: { bpm: 72, beatUnit: "quarter" }, levels: { x: { label: "X", notation: "engraved", strictBars, notes } } };
  return resolveLevel(song, "x");
}
const R = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "R", ...extra });
const L = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "L", ...extra });
const eighths = (pitches, start = 0, hand = R) => pitches.map((p, i) => hand(start + i * 240, 240, p));

test("stem direction follows the staff position: up below the middle line, down from it", () => {
  const l = layoutScore(timelineOf([R(0, 480, "E4"), R(480, 480, "B4"), R(960, 480, "D5"), R(1440, 480, "A3")]));
  assert.deepEqual(l.events.map((e) => e.stem.dir), ["up", "down", "down", "up"]);
  assert.ok(l.events[0].stem.toPos >= 4 && l.events[0].stem.toPos > l.events[0].stem.fromPos);
});

test("a chord has one stem decided by its farthest note, and no stem on a whole note", () => {
  const l = layoutScore(timelineOf([R(0, 480, "C4"), R(0, 480, "E4"), R(0, 480, "B5"), R(480, 1440, "C5")]));
  assert.equal(l.events[0].notes.length, 3);
  assert.equal(l.events[0].stem.dir, "down", "B5 is farther from the middle line than C4");
  assert.equal(l.events[0].stem.fromPos, 11);
  const whole = layoutScore(timelineOf([R(0, 1920, "C5")])).events[0];
  assert.equal(whole.stem, undefined);
  assert.equal(whole.base, "whole");
});

test("two voices in one staff split the stems: voice 1 up, voice 2 down", () => {
  const l = layoutScore(timelineOf([R(0, 960, "C5", { voice: 1 }), R(0, 960, "E4", { voice: 2 })]));
  assert.deepEqual(l.events.map((e) => [e.voice, e.stem.dir]).sort(), [[1, "up"], [2, "down"]]);
});

test("a second in a chord puts the upper head on the other side of the stem", () => {
  const up = layoutScore(timelineOf([R(0, 480, "C4"), R(0, 480, "D4"), R(0, 480, "G4")])).events[0];
  assert.deepEqual(up.notes.map((n) => n.dx), [0, up.stem.dx * 2, 0]);
  const apart = layoutScore(timelineOf([R(0, 480, "C4"), R(0, 480, "E4")])).events[0];
  assert.deepEqual(apart.notes.map((n) => n.dx), [0, 0], "contra-case: a third needs no shift");
});

test("12/8 beams eighths in four groups of three", () => {
  const notes = eighths(["Eb5", "D5", "C5", "Bb4", "C5", "D5", "Eb5", "F5", "G5", "F5", "Eb5", "D5"]);
  const l = layoutScore(timelineOf(notes, { meter: M128, lengthTicks: 2880, key: EB }));
  assert.equal(l.beams.length, 4);
  assert.deepEqual(l.beams.map((b) => b.members.length), [3, 3, 3, 3]);
  assert.deepEqual(l.beams.map((b) => l.events[b.members[0].event].tick), [0, 720, 1440, 2160]);
});

test("4/4 beams eighths per beat, and 12/8 never beams across a dotted-quarter group", () => {
  const l = layoutScore(timelineOf(eighths(["C5", "D5", "E5", "F5", "G5", "A5", "B5", "C5"])));
  assert.deepEqual(l.beams.map((b) => b.members.length), [2, 2, 2, 2]);
  const odd = layoutScore(timelineOf([R(0, 240, "C5"), R(240, 240, "D5"), R(480, 240, "E5"), R(720, 240, "F5")], { meter: M128, lengthTicks: 2880, strictBars: false }));
  assert.deepEqual(odd.beams.map((b) => b.members.length), [3], "the fourth eighth starts the next group and has no partner");
});

test("a rest or a longer value ends a beam, a lone eighth keeps its flag", () => {
  const l = layoutScore(timelineOf([R(0, 240, "C5"), { tick: 240, dur: 240, hand: "R", rest: true }, R(480, 240, "D5"), R(720, 240, "E5"), R(960, 960, "F5")]));
  assert.equal(l.beams.length, 1);
  assert.equal(l.beams[0].members.length, 2);
  assert.equal(l.events[0].stem.beamed, undefined);
  assert.equal(l.events[0].flags, 1);
  assert.equal(l.events[2].stem.beamed, true);
});

test("beamed stems end on one beam line with a bounded slope and a minimum length", () => {
  const l = layoutScore(timelineOf(eighths(["C5", "G5"])));
  const b = l.beams[0];
  assert.ok(Math.abs(b.pos2 - b.pos1) <= 2, "slope is clamped");
  for (const m of b.members) {
    const e = l.events[m.event];
    assert.ok(Math.abs(e.stem.toPos - e.stem.fromPos) >= 6, "at least three staff spaces");
  }
  const sixteenths = layoutScore(timelineOf([R(0, 120, "C5"), R(120, 120, "D5"), R(240, 240, "E5"), R(480, 1440, "C5")]));
  assert.deepEqual(sixteenths.beams[0].secondary.map((s) => s.level), [2], "a double beam over the two sixteenths");
  assert.ok(sixteenths.beams[0].secondary[0].x2 > sixteenths.beams[0].secondary[0].x1);
});

test("rests are computed from gaps when the level is not strictBars, and never when it is", () => {
  const gap = layoutScore(timelineOf([R(0, 480, "C5"), R(1440, 480, "D5")], { strictBars: false }));
  const rests = gap.events.filter((e) => e.kind === "rest");
  assert.deepEqual(rests.map((r) => [r.tick, r.dur, r.base]), [[480, 960, "half"]]);
  assert.equal(rests[0].computed, true);
  const strict = layoutScore(timelineOf([R(0, 480, "C5"), R(1440, 480, "D5")], { strictBars: true }));
  assert.equal(strict.events.filter((e) => e.kind === "rest").length, 0, "counter-proof: strictBars trusts the explicit rests");
});

test("computed rests split at barlines, fill an empty bar and skip a hand with no notes", () => {
  const l = layoutScore(timelineOf([R(0, 480, "C5")], { strictBars: false, lengthTicks: 3840 }));
  assert.deepEqual(l.events.filter((e) => e.kind === "rest").map((r) => [r.tick, r.dur, r.base, r.dots]), [[480, 1440, "half", 1], [1920, 1920, "whole", 0]]);
  assert.ok(l.events.every((e) => e.staff === "treble"), "no bass rests for a bass staff without notes");
  const twelve = layoutScore(timelineOf([R(0, 720, "C5")], { strictBars: false, meter: M128, lengthTicks: 2880 }));
  assert.deepEqual(twelve.events.filter((e) => e.kind === "rest").map((r) => [r.tick, r.dur]), [[720, 1920], [2640, 240]], "greedy values, never across the barline");
});

test("a pickup bar with a gap is rested only up to the barline", () => {
  const l = layoutScore(timelineOf([R(0, 240, "C5"), R(480, 1920, "D5")], { strictBars: false, pickupTicks: 480, lengthTicks: 2400 }));
  assert.deepEqual(l.events.filter((e) => e.kind === "rest").map((r) => [r.tick, r.dur, r.base]), [[240, 240, "eighth"]]);
});
