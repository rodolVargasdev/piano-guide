import { test } from "node:test";
import assert from "node:assert/strict";
import { CHORD_GROWTH, CHORD_START, INTERVAL_GROWTH, INTERVAL_START, chordQuestion, chordSemitones, intervalQuestion } from "../../src/theory/drills.js";
import { INTERVALS, semitonesOf } from "../../src/theory/intervals.js";

const FOUR = ["m3", "M3", "P5", "P8"];

test("the same seed gives the same question, and different seeds give different ones", () => {
  assert.deepEqual(intervalQuestion(7, { options: FOUR }), intervalQuestion(7, { options: FOUR }));
  assert.deepEqual(chordQuestion(7), chordQuestion(7));
  const seen = new Set(Array.from({ length: 50 }, (_, s) => JSON.stringify(intervalQuestion(s, { options: FOUR }))));
  assert.ok(seen.size > 20, "the questions vary with the seed");
});

test("over 500 seeds the correct answer is among the four options exactly once, and no option repeats", () => {
  for (let seed = 0; seed < 500; seed += 1) {
    const q = intervalQuestion(seed, { options: FOUR });
    assert.equal(q.options.filter((o) => o === q.answer).length, 1, `seed ${seed}`);
    assert.equal(new Set(q.options).size, q.options.length);
    assert.deepEqual(q.options, FOUR);
    const c = chordQuestion(seed, { options: ["major", "minor", "dim", "aug"] });
    assert.equal(c.options.filter((o) => o === c.answer).length, 1);
  }
});

test("duplicates and unknown ids in the options are dropped and the answer is still one of the rest", () => {
  const q = intervalQuestion(3, { options: ["M3", "M3", "nope", "P5"] });
  assert.deepEqual(q.options, ["M3", "P5"]);
  assert.ok(["M3", "P5"].includes(q.answer));
  assert.equal(intervalQuestion(3, { options: ["nope"] }), null);
  assert.equal(chordQuestion(3, { options: ["sus"] }), null);
});

test("an ascending question plays the root then the note above it; descending plays the high note first; harmonic plays both at once", () => {
  const asc = intervalQuestion(11, { options: ["M3"], directions: ["asc"] });
  assert.deepEqual(asc.notes.map((n) => n.midi), [asc.root, asc.root + 4]);
  assert.ok(asc.notes[1].at > asc.notes[0].at);
  const desc = intervalQuestion(11, { options: ["M3"], directions: ["desc"] });
  assert.deepEqual(desc.notes.map((n) => n.midi), [desc.root + 4, desc.root]);
  const harm = intervalQuestion(11, { options: ["M3"], directions: ["harm"] });
  assert.deepEqual(harm.notes.map((n) => n.at), [0, 0]);
  assert.equal(asc.direction, "asc");
});

test("every note of every question lies in C3 to C6, for every interval, direction and 500 seeds", () => {
  const all = INTERVALS.map((i) => i.id);
  for (let seed = 0; seed < 500; seed += 1) {
    for (const directions of [["asc"], ["desc"], ["harm"]]) {
      const q = intervalQuestion(seed, { options: all, directions });
      for (const n of q.notes) assert.ok(n.midi >= 48 && n.midi <= 84, `seed ${seed}: ${n.midi}`);
      assert.equal(Math.abs(q.notes[1].midi - q.notes[0].midi), semitonesOf(q.answer));
    }
    const c = chordQuestion(seed, { options: ["major", "minor", "dim", "aug"] });
    for (const n of c.notes) assert.ok(n.midi >= 48 && n.midi <= 84);
  }
});

test("a chord question is a block of three notes with the intervals of its quality", () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const c = chordQuestion(seed, { options: ["major", "minor", "dim", "aug"] });
    assert.deepEqual(c.notes.map((n) => n.midi - c.root), chordSemitones(c.answer));
    assert.deepEqual(c.notes.map((n) => n.at), [0, 0, 0]);
  }
  assert.deepEqual(chordSemitones("major"), [0, 4, 7]);
  assert.equal(chordSemitones("sus"), null);
});

test("the drill vocabulary: it starts small and grows in the order of the design", () => {
  assert.deepEqual(INTERVAL_START, ["M3", "P5", "P8"]);
  assert.deepEqual(INTERVAL_GROWTH, ["P4", "m3", "M6", "M2", "m6", "m7", "M7", "TT", "m2"]);
  assert.deepEqual(CHORD_START, ["major", "minor"]);
  assert.deepEqual(CHORD_GROWTH, ["dim", "aug"]);
  assert.deepEqual([...INTERVAL_START, ...INTERVAL_GROWTH].sort(), INTERVALS.map((i) => i.id).sort(), "start and growth cover the twelve intervals once");
});

test("counter-proof: a question whose answer is missing from the options would be seen by the same check", () => {
  const bad = { options: ["M3", "P5"], answer: "P8" };
  assert.equal(bad.options.filter((o) => o === bad.answer).length, 0);
});

test("every option is the answer a fair share of the time (the answer is drawn, not fixed), and so is every direction", () => {
  const count = (items) => items.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
  const answers = count(Array.from({ length: 800 }, (_, s) => intervalQuestion(s, { options: FOUR }).answer));
  for (const id of FOUR) assert.ok(answers.get(id) > 120, `${id} was the answer ${answers.get(id)} times`);
  const dirs = count(Array.from({ length: 800 }, (_, s) => intervalQuestion(s, { options: FOUR, directions: ["asc", "desc", "harm"] }).direction));
  for (const d of ["asc", "desc", "harm"]) assert.ok(dirs.get(d) > 150, `${d} ${dirs.get(d)}`);
  const kinds = count(Array.from({ length: 400 }, (_, s) => chordQuestion(s).answer));
  assert.ok(kinds.get("major") > 120 && kinds.get("minor") > 120);
});
