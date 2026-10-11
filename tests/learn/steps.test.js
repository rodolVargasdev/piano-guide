import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePhrases } from "../../src/learn/phrases.js";
import { deriveSteps } from "../../src/learn/steps.js";
import { renderInstruction } from "../../src/learn/instructions.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { BAR, Q, learnSong, line, note, rest } from "../fixtures/learn-songs.js";

const C_MAJOR = { tonic: "C", mode: "major" };
const i18n = createI18n({ table: STRINGS, warn: () => {} });
const phraseOf = (timeline) => derivePhrases(timeline)[0];
const stepsOf = (notes, hand = "R", opts = {}) => {
  const { timeline } = learnSong({ notes, bars: opts.bars ?? 2 });
  const phrase = phraseOf(timeline);
  return { timeline, phrase, steps: deriveSteps(timeline, phrase, hand, { key: C_MAJOR }) };
};

test("a melody of eight single notes becomes eight steps with one key, one finger and one instruction each", () => {
  const { steps } = stepsOf(line(["C4", "D4", "E4", "F4", "G4", "F4", "E4", "D4"]));
  assert.equal(steps.length, 8);
  assert.deepEqual(steps.map((s) => s.keys[0].finger), [1, 2, 3, 4, 5, 4, 3, 2]);
  assert.ok(steps.every((s) => s.keys.length === 1 && s.hand === "R" && s.instruction.key === "step.one" && s.shift === false));
  assert.deepEqual(steps.map((s) => s.tick), [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * Q));
  assert.equal(new Set(steps.map((s) => s.id)).size, 8, "step ids are unique");
  assert.match(steps[0].id, /^p1\./);
});

test("three notes starting together are one step holding the three keys, lowest first", () => {
  const { steps } = stepsOf([note(0, Q, "G4"), note(0, Q, "C4"), note(0, Q, "E4"), ...line(["D4"], { startTick: Q })]);
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[0].keys.map((k) => k.pitch), ["C4", "E4", "G4"]);
  assert.deepEqual(steps[0].keys.map((k) => k.finger), [1, 3, 5]);
  assert.equal(steps[0].instruction.params.count, 3);
  assert.equal(renderInstruction(i18n.t, steps[0].instruction, "en"), "Right hand: thumb on C (Do). Press these 3 keys together.");
});

test("a leap out of the position flags the shift and the instruction says the hand moves to the new thumb key", () => {
  const { steps } = stepsOf(line(["C4", "D4", "E4", "C5", "D5"]));
  assert.deepEqual(steps.map((s) => s.shift), [false, false, false, true, false]);
  assert.equal(steps[3].instruction.key, "step.move");
  assert.equal(steps[3].instruction.params.thumb, "C5");
  assert.equal(renderInstruction(i18n.t, steps[3].instruction, "en"), "Move the right hand: thumb on C (Do). Then press that key.");
  assert.equal(steps[4].instruction.key, "step.one", "the step after a move is an ordinary step");
});

test("a tied note is one step at its first onset: the continuation is not a step", () => {
  const { steps } = stepsOf([note(0, Q, "C4", "R", { tie: true }), note(Q, Q, "C4"), ...line(["D4"], { startTick: 2 * Q })]);
  assert.deepEqual(steps.map((s) => s.tick), [0, 2 * Q]);
  const untied = stepsOf([note(0, Q, "C4"), note(Q, Q, "C4"), ...line(["D4"], { startTick: 2 * Q })]).steps;
  assert.equal(untied.length, 3, "counter-proof: without the tie the repeated note is a step of its own");
});

test("rests and grace notes produce no step", () => {
  const { steps } = stepsOf([rest(0, Q), note(Q, Q, "C4"), note(2 * Q - 60, 60, "D4", "R", { grace: true }), note(2 * Q, Q, "E4"), rest(3 * Q, Q)]);
  assert.deepEqual(steps.map((s) => s.keys[0].pitch), ["C4", "E4"]);
});

test("only the chosen hand produces steps, and a hand with no notes yields none", () => {
  const notes = [...line(["E4", "F4", "G4"]), ...line(["C3", "G3"], { hand: "L", dur: 2 * Q })];
  const right = stepsOf(notes, "R").steps;
  const left = stepsOf(notes, "L").steps;
  assert.equal(right.length, 3);
  assert.deepEqual(left.map((s) => s.keys[0].pitch), ["C3", "G3"]);
  assert.ok(left.every((s) => s.hand === "L" && s.keys[0].hand === "L"));
  assert.deepEqual(stepsOf(line(["E4", "F4"]), "L").steps, []);
});

test("left hand fingers mirror the right: the little finger is on the lowest note of the position", () => {
  const { steps } = stepsOf(line(["C3", "D3", "E3", "F3", "G3"], { hand: "L" }), "L");
  assert.deepEqual(steps.map((s) => s.keys[0].finger), [5, 4, 3, 2, 1]);
  assert.equal(renderInstruction(i18n.t, steps[0].instruction, "en"), "Left hand: little finger on C (Do).");
});

test("a group no hand can span becomes consecutive single-note steps, lowest first, all fingered 1 to 5", () => {
  const { steps } = stepsOf([note(0, 2 * Q, "C4"), note(0, 2 * Q, "E4"), note(0, 2 * Q, "G4"), note(0, 2 * Q, "C5"), ...line(["D5"], { startTick: 2 * Q })]);
  assert.equal(steps.length, 5);
  assert.deepEqual(steps.slice(0, 4).map((s) => s.keys[0].pitch), ["C4", "E4", "G4", "C5"]);
  assert.ok(steps.slice(0, 4).every((s) => s.tick === 0 && s.keys.length === 1));
  assert.ok(steps.every((s) => s.keys.every((k) => Number.isInteger(k.finger) && k.finger >= 1 && k.finger <= 5)));
  assert.equal(new Set(steps.map((s) => s.id)).size, 5);
});

test("authored fingers are reported as written", () => {
  const { steps } = stepsOf([note(0, Q, "C4", "R", { finger: 2 }), note(Q, Q, "D4", "R", { finger: 3 })]);
  assert.deepEqual(steps.map((s) => s.keys[0].finger), [2, 3]);
});

test("steps stay inside their phrase, and a chord on the first beat of the next phrase is one step of that phrase", () => {
  const chord = ["C4", "E4", "G4"].map((p) => note(2 * BAR, Q, p));
  const { timeline } = learnSong({ notes: [...line(["C4", "D4", "E4", "F4", "G4", "F4", "E4", "D4"]), ...chord, ...line(["F4"], { startTick: 2 * BAR + Q })], bars: 4 });
  const [first, second] = derivePhrases(timeline);
  const a = deriveSteps(timeline, first, "R", { key: C_MAJOR });
  const b = deriveSteps(timeline, second, "R", { key: C_MAJOR });
  assert.equal(a.length, 8);
  assert.ok(a.every((s) => s.tick < first.endTick && s.keys.length === 1));
  assert.ok(b.every((s) => s.tick >= second.startTick && s.tick < second.endTick));
  assert.deepEqual(b[0].keys.map((k) => k.pitch), ["C4", "E4", "G4"], "the whole chord is in one step of the second phrase");
  assert.match(b[0].id, /^p2./);
});

test("every instruction of a step list renders in both languages with no placeholder left", () => {
  const { steps } = stepsOf(line(["E4", "F4", "G4", "E5", "F5", "G5"]));
  for (const lang of ["en", "es"]) {
    for (const s of steps) {
      const text = renderInstruction(i18n.t, s.instruction, lang);
      assert.ok(text.length > 0 && !text.includes("{"), `${lang}: ${text}`);
    }
  }
});

// ---- both hands (stages) -----------------------------------------------------------------------------------

test("hands together: one step per tick where either hand starts, holding the keys of both hands, lowest first", () => {
  // Right hand E4 F4 G4 on beats 1 to 3; left hand C3 held from beat 1 and G2 on beat 3.
  const { timeline, phrase } = stepsOf([...line(["E4", "F4", "G4"]), note(0, 2 * Q, "C3", "L"), note(2 * Q, Q, "G2", "L")], "R");
  const steps = deriveSteps(timeline, phrase, "T", { key: C_MAJOR });
  assert.deepEqual(steps.map((s) => s.tick), [0, Q, 2 * Q]);
  assert.ok(steps.every((s) => s.hand === "T"));
  assert.deepEqual(steps[0].keys.map((k) => [k.pitch, k.hand]), [["C3", "L"], ["E4", "R"]]);
  assert.deepEqual(steps[2].keys.map((k) => [k.pitch, k.hand]), [["G2", "L"], ["G4", "R"]]);
  assert.equal(new Set(steps.map((s) => s.id)).size, 3);
  assert.deepEqual(steps.map((s) => s.keys.every((k) => k.finger >= 1 && k.finger <= 5)), [true, true, true]);
  assert.ok(steps[0].positions.R && steps[0].positions.L, "each hand has its own position");
});

test("hands together: a step with both hands says both, a step with one hand keeps that hand's own sentence", () => {
  const { timeline, phrase } = stepsOf([...line(["E4", "F4"]), note(0, Q, "C3", "L")], "R");
  const steps = deriveSteps(timeline, phrase, "T", { key: C_MAJOR });
  assert.equal(steps[0].instruction.key, "step.both");
  assert.match(renderInstruction(i18n.t, steps[0].instruction, "en"), /^Both hands: .+ right, .+ left\.$/);
  assert.equal(steps[1].instruction.key, "step.one");
  assert.equal(steps[1].instruction.params.hand, "R");
  assert.equal(renderInstruction(i18n.t, steps[1].instruction, "en"), "Right hand: index finger on F (Fa).", "only the right hand plays on beat 2");
  assert.deepEqual(steps[1].positions.L, null);
});

test("hands together with one hand silent gives the steps of the other hand; the single-hand steps are unchanged by it (counter-proof)", () => {
  const melody = line(["C4", "D4", "E4"]);
  const { timeline, phrase } = stepsOf(melody, "R");
  const alone = deriveSteps(timeline, phrase, "R", { key: C_MAJOR });
  const together = deriveSteps(timeline, phrase, "T", { key: C_MAJOR });
  assert.deepEqual(together.map((s) => s.keys.map((k) => k.midi)), alone.map((s) => s.keys.map((k) => k.midi)));
  assert.deepEqual(together.map((s) => s.instruction), alone.map((s) => s.instruction));
  assert.deepEqual(deriveSteps(timeline, phrase, "L", { key: C_MAJOR }), [], "the other hand alone is still empty");
});
