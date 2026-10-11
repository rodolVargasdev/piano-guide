import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_FIELDS, EXERCISES, GROUPS, cardKeys, exerciseById, exercisesIn, generateExercise, keysToPractice, resolveOptions, tempoStepsValid } from "../../src/practice/catalog.js";
import { TONICS, introOrder } from "../../src/theory/keys.js";

const RUNS = EXERCISES.filter((e) => e.kind === "run");

test("the ten exercises of the spec exist, each with a group, in the order of the list", () => {
  assert.deepEqual(EXERCISES.map((e) => e.id), ["five-finger", "scale-major", "triads", "arpeggios", "cadence-i-iv-v-i", "progression-i-vi-iv-v", "progression-i-v-vi-iv", "ear-intervals", "ear-chords", "routine"]);
  for (const e of EXERCISES) assert.ok(GROUPS.includes(e.group), `${e.id} group ${e.group}`);
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length, "ids are unique");
  assert.deepEqual(GROUPS, ["technique", "harmony", "ear", "routine"]);
  assert.deepEqual(exercisesIn("ear").map((e) => e.id), ["ear-intervals", "ear-chords"]);
});

test("every exercise has the five card fields as string keys, and the tempo steps are inside 20 to 240 and ascending", () => {
  assert.deepEqual(CARD_FIELDS, ["title", "goal", "why", "how", "good"]);
  for (const e of EXERCISES) {
    assert.deepEqual(cardKeys(e.id), CARD_FIELDS.map((f) => `ex.${e.id}.${f}`));
    assert.ok(tempoStepsValid(e.tempoSteps), `${e.id} tempo steps ${e.tempoSteps}`);
  }
  for (const e of RUNS) assert.ok(e.tempoSteps.length >= 4, `${e.id} has steps to climb`);
  assert.deepEqual(exerciseById("scale-major").tempoSteps, [50, 60, 72, 88]);
});

test("counter-proof: the tempo check rejects a step outside the engine bounds, a repeat and a descending list", () => {
  assert.equal(tempoStepsValid([50, 300]), false);
  assert.equal(tempoStepsValid([10, 50]), false);
  assert.equal(tempoStepsValid([50, 50]), false);
  assert.equal(tempoStepsValid([60, 50]), false);
  assert.equal(tempoStepsValid([]), true);
});

test("an exercise id is looked up, never trusted: an unknown id, a prototype name or markup gives null", () => {
  assert.equal(exerciseById("does-not-exist"), null);
  assert.equal(exerciseById("__proto__"), null);
  assert.equal(exerciseById("<img src=x>"), null);
  assert.equal(generateExercise("nope"), null);
  assert.equal(generateExercise("routine"), null, "only a run is generated");
  assert.equal(generateExercise("ear-intervals"), null);
});

test("the C major scale starts as the spec says: right hand C D E with fingers 1 2 3, one octave, 8 steps", () => {
  const g = generateExercise("scale-major", { key: "C", hand: "R" });
  assert.equal(g.steps.length, 8);
  assert.deepEqual(g.steps.slice(0, 3).map((s) => [s.keys[0].pitch, s.keys[0].finger]), [["C4", 1], ["D4", 2], ["E4", 3]]);
  assert.equal(g.suggested, false);
  assert.deepEqual(g.options, { hand: "R", octaves: 1, direction: "up", key: "C" });
});

test("scale options: two octaves have 15 steps, up and back 15, left hand starts on the little finger, together has both hands per step", () => {
  assert.equal(generateExercise("scale-major", { octaves: 2 }).steps.length, 15);
  assert.equal(generateExercise("scale-major", { direction: "updown" }).steps.length, 15);
  const lh = generateExercise("scale-major", { hand: "L" });
  assert.equal(lh.steps[0].keys[0].finger, 5);
  const t = generateExercise("scale-major", { hand: "T" });
  assert.ok(t.steps.every((s) => s.keys.length === 2 && new Set(s.keys.map((k) => k.hand)).size === 2));
  assert.deepEqual(t.steps[0].keys.map((k) => k.midi), [48, 60]);
});

test("the Suggested fingering flag follows the flagged rows only: Bb right hand, F# left hand, and together when either is in the run", () => {
  assert.equal(generateExercise("scale-major", { key: "Bb", hand: "R" }).suggested, true);
  assert.equal(generateExercise("scale-major", { key: "Bb", hand: "L" }).suggested, false);
  assert.equal(generateExercise("scale-major", { key: "F#", hand: "L" }).suggested, true);
  assert.equal(generateExercise("scale-major", { key: "F#", hand: "T" }).suggested, true);
  assert.equal(generateExercise("scale-major", { key: "G", hand: "T" }).suggested, false);
  assert.equal(generateExercise("arpeggios", { key: "Db", hand: "L" }).suggested, true);
  assert.equal(generateExercise("arpeggios", { key: "C", hand: "R" }).suggested, false);
  assert.equal(generateExercise("arpeggios", { key: "C", hand: "L", octaves: 2 }).suggested, true, "the left hand crossing finger");
});

test("five-finger: up and back is 9 steps, the minor pattern lowers the third, together pairs the hands", () => {
  const g = generateExercise("five-finger", { key: "G" });
  assert.deepEqual(g.steps.map((s) => s.keys[0].pitch), ["G4", "A4", "B4", "C5", "D5", "C5", "B4", "A4", "G4"]);
  assert.equal(generateExercise("five-finger", { key: "C", quality: "minor", direction: "up" }).steps[2].keys[0].pitch, "Eb4");
  assert.equal(generateExercise("five-finger", { hand: "T" }).steps[0].keys.length, 2);
});

test("triads: root, first, second, the root an octave up and back, 7 chords of 3 keys; together has 6 keys per step", () => {
  const g = generateExercise("triads", { key: "C" });
  assert.equal(g.steps.length, 7);
  assert.ok(g.steps.every((s) => s.keys.length === 3));
  assert.deepEqual(g.steps[0].keys.map((k) => k.pitch), ["C4", "E4", "G4"]);
  assert.deepEqual(g.steps[1].keys.map((k) => k.finger), [1, 2, 5]);
  assert.equal(generateExercise("triads", { hand: "T" }).steps[0].keys.length, 6);
  assert.equal(generateExercise("triads", { key: "A", quality: "minor" }).steps[0].keys[0].pitch, "A3");
});

test("progressions: one step per chord with its symbol, left hand root plus right hand triad, or one hand only", () => {
  const g = generateExercise("cadence-i-iv-v-i", { key: "C" });
  assert.deepEqual(g.steps.map((s) => s.label), ["C", "F", "G", "C"]);
  assert.ok(g.steps.every((s) => s.keys.length === 4));
  assert.equal(g.steps[0].keys[0].hand, "L");
  assert.deepEqual(generateExercise("progression-i-vi-iv-v", { key: "G" }).steps.map((s) => s.label), ["G", "Em", "C", "D"]);
  assert.deepEqual(generateExercise("progression-i-v-vi-iv", { key: "Bb" }).steps.map((s) => s.label), ["Bb", "F", "Gm", "Eb"]);
  assert.ok(generateExercise("progression-i-v-vi-iv", { hand: "R" }).steps.every((s) => s.keys.length === 3 && s.keys.every((k) => k.hand === "R")));
  assert.ok(generateExercise("progression-i-v-vi-iv", { hand: "L" }).steps.every((s) => s.keys.length === 1 && s.keys[0].hand === "L"));
  assert.equal(generateExercise("progression-i-v-vi-iv").options.hand, "T", "both hands by default");
});

test("every run exercise in every key and with every choice gives playable steps: fingers 1 to 5, a hand on every key, ascending inside a step", () => {
  for (const e of RUNS) {
    for (const key of TONICS) {
      const choices = Object.entries(e.choices);
      const combos = choices.reduce((acc, [name, values]) => acc.flatMap((o) => values.map((v) => ({ ...o, [name]: v }))), [{}]);
      for (const options of combos) {
        const g = generateExercise(e.id, { ...options, key });
        assert.ok(g && g.steps.length > 0, `${e.id} ${key} ${JSON.stringify(options)}`);
        for (const s of g.steps) {
          assert.ok(s.keys.length >= 1);
          assert.ok(s.keys.every((k) => k.finger >= 1 && k.finger <= 5 && (k.hand === "R" || k.hand === "L") && Number.isInteger(k.midi)), `${e.id} ${key}`);
          assert.equal(typeof g.suggested, "boolean");
        }
      }
    }
  }
});

test("a choice the exercise does not offer, or a key outside the twelve, falls back to the default", () => {
  assert.deepEqual(resolveOptions(exerciseById("scale-major"), { hand: "X", octaves: 3, key: "H" }), { hand: "R", octaves: 1, direction: "up", key: "C" });
  assert.equal(resolveOptions(exerciseById("scale-major"), { key: "F#" }).key, "F#");
  assert.equal(generateExercise("triads", { quality: "dim" }).options.quality, "major", "dim is not offered here");
});

test("scales are suggested in the order C G D F then the rest, without locking the others", () => {
  const order = introOrder();
  assert.deepEqual(keysToPractice([], order).slice(0, 4), ["C", "G", "D", "F"]);
  assert.deepEqual(keysToPractice(["C"], order).slice(0, 3), ["G", "D", "F"]);
  assert.equal(keysToPractice(order, order).length, 0);
  assert.ok(generateExercise("scale-major", { key: "F#" }), "a key far down the order is still selectable");
});
