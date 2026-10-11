import { test } from "node:test";
import assert from "node:assert/strict";
import { instructionFor, noteLabel, renderInstruction } from "../../src/learn/instructions.js";
import { countSentences, instructionLimits } from "../../src/i18n/guards.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const i18n = createI18n({ table: STRINGS, warn: () => {} });
const render = (instr, lang) => renderInstruction(i18n.t, instr, lang);
const key = (pitch, finger, hand = "R") => ({ pitch, finger, hand, midi: 0 });
const position = (anchorStep, thumbPitch) => ({ anchorStep, thumbPitch, lowPitch: thumbPitch, highPitch: thumbPitch });
const step = (keys, { hand = "R", shift = false, anchorStep = 30, thumbPitch = "E4" } = {}) => ({ hand, keys, shift, position: position(anchorStep, thumbPitch) });

test("a single note step reads like the spec example in English and Spanish", () => {
  const s = step([key("E4", 1)]);
  assert.equal(render(instructionFor(s, null), "en"), "Right hand: thumb on E (Mi).");
  assert.equal(render(instructionFor(s, null), "es"), "Mano derecha: pulgar en Mi (E).");
});

test("a chord step adds how many keys to press together, with the lowest key named", () => {
  const s = step([key("E4", 1), key("G#4", 3), key("B4", 5)]);
  const instr = instructionFor(s, null);
  assert.equal(render(instr, "en"), "Right hand: thumb on E (Mi). Press these 3 keys together.");
  assert.equal(render(instr, "es"), "Mano derecha: pulgar en Mi (E). Presione estas 3 teclas a la vez.");
});

test("a black key keeps its written spelling in both note orders", () => {
  assert.equal(noteLabel(i18n.t, "F#4", "en"), "F# (Fa#)");
  assert.equal(noteLabel(i18n.t, "F#4", "es"), "Fa# (F#)");
  assert.equal(noteLabel(i18n.t, "Bb3", "en"), "Bb (Sib)");
  assert.equal(noteLabel(i18n.t, "E#4", "es"), "Mi# (E#)", "E# stays E#, it is not respelled as F");
});

test("the left hand names its finger and note the same way", () => {
  const s = step([key("C3", 5, "L")], { hand: "L" });
  assert.equal(render(instructionFor(s, null), "en"), "Left hand: little finger on C (Do).");
  assert.equal(render(instructionFor(s, null), "es"), "Mano izquierda: dedo meñique en Do (C).");
});

test("a move names the hand, the new thumb key and the first finger to play", () => {
  const prev = step([key("C4", 1)], { anchorStep: 28, thumbPitch: "C4" });
  const moved = step([key("G4", 1)], { shift: true, anchorStep: 32, thumbPitch: "G4" });
  const instr = instructionFor(moved, prev);
  assert.equal(instr.key, "step.move");
  assert.equal(render(instr, "en"), "Move the right hand: thumb on G (Sol). Then thumb on G (Sol).");
  assert.equal(render(instr, "es"), "Mueva la mano derecha: pulgar en Sol (G). Luego, pulgar en Sol (G).");
  const leftPrev = step([key("C3", 5, "L")], { hand: "L", anchorStep: 24, thumbPitch: "G3" });
  const left = step([key("F3", 5, "L")], { hand: "L", shift: true, anchorStep: 27, thumbPitch: "C4" });
  assert.equal(render(instructionFor(left, leftPrev), "en"), "Move the left hand: thumb on C (Do). Then little finger on F (Fa).");
});

test("a chord after a move keeps the two-sentence limit: the second sentence is the key count", () => {
  const prev = step([key("C4", 1)], { anchorStep: 28, thumbPitch: "C4" });
  const moved = step([key("G4", 1), key("B4", 3), key("D5", 5)], { shift: true, anchorStep: 32, thumbPitch: "G4" });
  const text = render(instructionFor(moved, prev), "en");
  assert.equal(text, "Move the right hand: thumb on G (Sol). Press these 3 keys together.");
  assert.equal(countSentences(text), 2);
});

test("counter-proofs: the hand does not move on the first step, nor when the position is the same as before", () => {
  const first = step([key("G4", 1)], { shift: true, anchorStep: 32, thumbPitch: "G4" });
  assert.equal(instructionFor(first, null).key, "step.one", "no previous step, nothing to move from");
  const prev = step([key("C4", 1)], { anchorStep: 32, thumbPitch: "G4" });
  assert.equal(instructionFor(first, prev).key, "step.one", "same anchor as the previous step");
  const noFlag = step([key("G4", 1)], { shift: false, anchorStep: 40, thumbPitch: "G4" });
  assert.equal(instructionFor(noFlag, prev).key, "step.one", "a differing anchor without the shift flag is not a move");
});

test("both hands together name the right and the left finger, and add the count only beyond two keys", () => {
  const two = step([key("E4", 1), key("C3", 5, "L")], { hand: "T" });
  assert.equal(render(instructionFor(two, null), "en"), "Both hands: thumb on E (Mi) right, little finger on C (Do) left.");
  assert.equal(render(instructionFor(two, null), "es"), "Ambas manos: pulgar en Mi (E) con la derecha, dedo meñique en Do (C) con la izquierda.");
  const three = step([key("E4", 1), key("G4", 3), key("C3", 5, "L")], { hand: "T" });
  assert.equal(render(instructionFor(three, null), "en"), "Both hands: thumb on E (Mi) right, little finger on C (Do) left. Press these 3 keys together.");
});

test("a one-key step never says '1 keys' and never mentions a count", () => {
  const text = render(instructionFor(step([key("E4", 1)]), null), "en");
  assert.ok(!/\bkeys?\b/.test(text), text);
});

/** The guard's render callback: the instruction of a step with `count` keys, a given hand and finger, with or without a move. */
const guardRender = (table) => {
  const t = createI18n({ table, warn: () => {} }).t;
  return ({ lang, hand, finger, count, move }) => {
    const keys = Array.from({ length: count }, (_, i) => key("C4", finger, hand));
    const prev = step([key("C4", 1, hand)], { hand, anchorStep: 28, thumbPitch: "C4" });
    const cur = step(keys, { hand, shift: move, anchorStep: move ? 35 : 28, thumbPitch: "C5" });
    return renderInstruction(t, instructionFor(cur, prev), lang);
  };
};

test("every hand x finger x count 1 to 5 x move x language stays within 2 sentences and 25 words", () => {
  assert.deepEqual(instructionLimits(guardRender(STRINGS)), []);
});

test("counter-proof: a template that adds a third sentence is flagged by the same enumeration", () => {
  const broken = { ...STRINGS, "step.together_other": { en: "Press these {count} keys. Hold them. Together now.", es: STRINGS["step.together_other"].es } };
  const over = instructionLimits(guardRender(broken));
  assert.ok(over.length > 0);
  assert.ok(over.every((l) => l.startsWith("en ")), "only the English template was broken");
});
