import { test } from "node:test";
import assert from "node:assert/strict";
import { initSession, practiceOrder } from "../../src/practice/session.js";
import { emptyPracticeProgress, recordRun } from "../../src/practice/progress.js";

const clean = (p, key, exerciseId = "scale-major") => recordRun(p, { exerciseId, key, bpm: 60, clean: true, date: "2026-10-10" });
const unclean = (p, key, exerciseId = "scale-major") => recordRun(p, { exerciseId, key, bpm: 60, clean: false, date: "2026-10-10" });

test("a learner with no clean scale gets C pre-selected and G, D, F next: the order of introduction", () => {
  assert.deepEqual(practiceOrder(emptyPracticeProgress(), "scale-major").slice(0, 4), ["C", "G", "D", "F"]);
  assert.equal(initSession({ exerciseId: "scale-major" }).options.key, "C");
  assert.equal(initSession({ exerciseId: "scale-major", progress: emptyPracticeProgress() }).options.key, "C");
});

test("after a clean C scale the page opens on G; keys with only an unclean run still count as not practiced", () => {
  let p = clean(emptyPracticeProgress(), "C");
  assert.deepEqual(practiceOrder(p, "scale-major").slice(0, 3), ["G", "D", "F"]);
  assert.equal(initSession({ exerciseId: "scale-major", progress: p }).options.key, "G");
  p = unclean(p, "G");
  assert.equal(initSession({ exerciseId: "scale-major", progress: p }).options.key, "G", "an unclean G is not a practiced G");
  p = clean(clean(clean(p, "G"), "D"), "F");
  assert.equal(initSession({ exerciseId: "scale-major", progress: p }).options.key, "A");
});

test("the order is per exercise: a clean triad in C does not move the scale", () => {
  const p = clean(emptyPracticeProgress(), "C", "triads");
  assert.equal(initSession({ exerciseId: "scale-major", progress: p }).options.key, "C");
  assert.equal(initSession({ exerciseId: "triads", progress: p }).options.key, "G");
});

test("an explicit key always wins over the order, and the other keys stay selectable", () => {
  const p = clean(emptyPracticeProgress(), "C");
  assert.equal(initSession({ exerciseId: "scale-major", progress: p, options: { key: "F#" } }).options.key, "F#");
  assert.equal(initSession({ exerciseId: "scale-major", options: { key: "Bb" } }).options.key, "Bb");
});

test("when every key is practiced the page opens on C and the order is empty", () => {
  let p = emptyPracticeProgress();
  for (const k of ["C", "G", "D", "F", "A", "E", "B", "Bb", "Eb", "Ab", "Db", "F#"]) p = clean(p, k);
  assert.deepEqual(practiceOrder(p, "scale-major"), []);
  assert.equal(initSession({ exerciseId: "scale-major", progress: p }).options.key, "C");
});

test("the rotation of the opening key goes around the circle from it", () => {
  const p = clean(emptyPracticeProgress(), "C");
  assert.deepEqual(initSession({ exerciseId: "scale-major", progress: p }).rotation.keys.slice(0, 3), ["G", "D", "A"]);
});
