import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { resolveLevel, activeAt, shiftHints } from "../../src/core/timeline.js";
import { validSong, mutated } from "../fixtures/helpers.js";

const n = (tick, pitch, hand = "R", extra = {}) => ({ tick, dur: 480, pitch, hand, ...extra });
const resolved = (notes) => notes.map((x) => ({ ...x, midi: x.rest ? null : { C4: 60, E4: 64, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, C3: 48, B2: 47 }[x.pitch] }));

test("resolveLevel adds midi, sorts, computes range and lengthTicks", () => {
  const song = mutated((s) => s.levels.beginner.notes.reverse());
  const tl = resolveLevel(song, "beginner");
  assert.equal(tl.lengthTicks, 3840);
  assert.deepEqual(tl.range, { low: 43, high: 67 }); // G2 .. G4
  const ticks = tl.notes.map((x) => x.tick);
  assert.deepEqual(ticks, [...ticks].sort((a, b) => a - b));
  assert.ok(tl.notes.every((x) => Number.isInteger(x.midi)));
  assert.equal(tl.notes[0].midi, 48); // C3 first at tick 0 (lowest midi first)
  assert.equal(tl.meter.num, 4);
  assert.equal(tl.tempo.beatUnit, "quarter");
  assert.equal(tl.sections.length, 1);
});

test("resolveLevel does not mutate the song and rejects an unknown level", () => {
  const song = validSong();
  const before = JSON.stringify(song);
  resolveLevel(song, "beginner");
  assert.equal(JSON.stringify(song), before);
  assert.throws(() => resolveLevel(song, "original"), RangeError);
});

test("resolveLevel keeps rests without midi and ignores them in the range", () => {
  const song = mutated((s) => s.levels.beginner.notes.push({ tick: 3840, dur: 0, hand: "R", rest: true }));
  const tl = resolveLevel(song, "beginner");
  assert.equal(tl.notes.at(-1).midi, null);
  assert.deepEqual(tl.range, { low: 43, high: 67 });
});

test("resolveLevel on a level without pitched notes has a null range", () => {
  const song = mutated((s) => (s.levels.beginner.notes = []));
  assert.equal(resolveLevel(song, "beginner").range, null);
});

test("resolveLevel stamps silent: false for a public song and true for a private one", () => {
  assert.equal(resolveLevel(validSong(), "beginner").silent, false);
  assert.equal(resolveLevel(mutated((s) => void (s.visibility = "private")), "beginner").silent, true);
  assert.equal(resolveLevel(mutated((s) => void (s.visibility = "public")), "beginner").silent, false);
});

test("resolveLevel passes the level learn block along, or null when the level has none", () => {
  const learn = { phrases: [{ id: "p1", startTick: 0, endTick: 1920 }], transposeTo: ["G"] };
  assert.deepEqual(resolveLevel(mutated((s) => void (s.levels.beginner.learn = learn)), "beginner").learn, learn);
  assert.equal(resolveLevel(validSong(), "beginner").learn, null);
});

test("activeAt: start inclusive, end exclusive, rests never active", () => {
  const tl = { notes: resolved([n(0, "C4"), n(480, "E4"), { tick: 0, dur: 480, hand: "L", rest: true }]) };
  assert.deepEqual(activeAt(tl, 0).map((x) => x.pitch), ["C4"]);
  assert.deepEqual(activeAt(tl, 479).map((x) => x.pitch), ["C4"]);
  assert.deepEqual(activeAt(tl, 480).map((x) => x.pitch), ["E4"]);
  assert.deepEqual(activeAt(tl, 960), []);
});

test("activeAt reuses the output array it is given", () => {
  const tl = { notes: resolved([n(0, "C4")]) };
  const out = [];
  assert.equal(activeAt(tl, 0, out), out);
  assert.equal(out.length, 1);
  activeAt(tl, 5000, out);
  assert.equal(out.length, 0);
});

test("shiftHints: 6 semitones outside the previous span is a shift, exactly 5 is not", () => {
  // previous group C4 (60) alone: B4 is 11 above, E4 is 4 above, 66 would be 6 above, 65 is 5 above.
  const notes = [
    { tick: 0, dur: 480, pitch: "C4", hand: "R", midi: 60 },
    { tick: 480, dur: 480, pitch: "F4", hand: "R", midi: 65 }, // exactly 5 above: no shift
    { tick: 960, dur: 480, pitch: "C5", hand: "R", midi: 72 }, // 7 above 65: shift
    { tick: 1440, dur: 480, pitch: "F#5", hand: "R", midi: 78 }, // 6 above 72: shift
  ];
  assert.deepEqual([...shiftHints(notes, "R")], [2, 3]);
});

test("shiftHints: going down follows the same rule", () => {
  const notes = [
    { tick: 0, dur: 480, hand: "R", midi: 72 },
    { tick: 480, dur: 480, hand: "R", midi: 67 }, // exactly 5 below
    { tick: 960, dur: 480, hand: "R", midi: 61 }, // 6 below 67
  ];
  assert.deepEqual([...shiftHints(notes, "R")], [2]);
});

test("shiftHints: the first onset group is never a shift and a chord counts as one group", () => {
  const notes = [
    { tick: 0, dur: 480, hand: "R", midi: 40 },
    { tick: 0, dur: 480, hand: "R", midi: 90 },
    { tick: 480, dur: 480, hand: "R", midi: 70 }, // within 5 of the span 40..90
    { tick: 960, dur: 480, hand: "R", midi: 100 }, // 30 above the previous group (70..70)
  ];
  assert.deepEqual([...shiftHints(notes, "R")], [3]);
});

test("shiftHints: hands are independent and grace notes and rests are ignored", () => {
  const notes = [
    { tick: 0, dur: 480, hand: "R", midi: 60 },
    { tick: 0, dur: 480, hand: "L", midi: 40 },
    { tick: 400, dur: 20, hand: "R", midi: 90, grace: true },
    { tick: 480, dur: 480, hand: "R", midi: 62 },
    { tick: 480, dur: 480, hand: "L", midi: 50 }, // L shift: 10 above 40
    { tick: 960, dur: 480, hand: "R", rest: true, midi: null },
  ];
  assert.deepEqual([...shiftHints(notes, "R")], []);
  assert.deepEqual([...shiftHints(notes, "L")], [4]);
});

test("shiftHints accepts raw notes with a pitch string and honors a custom threshold", () => {
  const notes = [n(0, "C4"), n(480, "A4")]; // 9 above
  assert.deepEqual([...shiftHints(notes, "R")], [1]);
  assert.deepEqual([...shiftHints(notes, "R", 9)], []);
});

test("resolveLevel flags the shifts of both hands in timeline.shifts", () => {
  const song = mutated((s) => s.levels.beginner.notes.push(n(3360, "D5", "R")));
  const tl = resolveLevel(song, "beginner");
  const flagged = [...tl.shifts].map((i) => tl.notes[i]);
  assert.ok(flagged.every((x) => x.tick > 0));
  assert.ok(flagged.some((x) => x.pitch === "D5"));
});

test("shiftHints on the real Nocturne: the right-hand leaps are flagged, the runs inside a position are not", () => {
  const song = JSON.parse(readFileSync(new URL("../../songs/chopin-nocturne-op9-no2.json", import.meta.url), "utf8"));
  const tl = resolveLevel(song, "original");
  // The opening (the pickup and bars 1 to 4); the later bars of the piece have their own leaps.
  const right = [...shiftHints(tl.notes, "R")].map((i) => `${tl.notes[i].tick} ${tl.notes[i].pitch}`).filter((s) => Number(s.split(" ")[0]) < 11760);
  // Bb4 to G5 on the first beat, G5 down to C5 and up to C6 in bar 1 (each more than 5 semitones outside the previous group).
  assert.deepEqual(right, ["240 G5", "3120 G5", "3600 C5", "3840 C6", "9120 D6", "10080 C5"]);
  // The melody G5 F5 G5 F5 Eb5 of the first bar stays inside one hand position: none of it is flagged.
  const inside = tl.notes.map((x, i) => [x, i]).filter(([x]) => x.hand === "R" && x.tick >= 960 && x.tick <= 2400);
  assert.ok(inside.length >= 5);
  for (const [x, i] of inside) assert.equal(tl.shifts.has(i), false, `${x.tick} ${x.pitch}`);
  // Counter-proof: with a threshold above any leap in the piece (40) nothing is flagged.
  assert.deepEqual([...shiftHints(tl.notes, "R", 40)], []);
});
