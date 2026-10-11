import { test } from "node:test";
import assert from "node:assert/strict";
import { STRINGS } from "../../src/i18n/strings.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { forbiddenTypography, instructionLimits, missingTranslations, placeholderMismatches, voseoForms } from "../../src/i18n/guards.js";

test("every key has both languages, matching placeholders, clean typography and no voseo", () => {
  assert.ok(Object.keys(STRINGS).length > 80, "the table is not empty");
  assert.deepEqual(missingTranslations(STRINGS), []);
  assert.deepEqual(placeholderMismatches(STRINGS), []);
  assert.deepEqual(forbiddenTypography(STRINGS), []);
  assert.deepEqual(voseoForms(STRINGS), []);
});

test("counter-proof: the same guards flag the real table once a defect is added to a copy", () => {
  const broken = { ...STRINGS, "x.missing": { en: "Only English" }, "x.placeholder": { en: "{count} keys", es: "teclas" }, "x.dash": { en: `A ${String.fromCodePoint(0x2014)} B`, es: "A - B" }, "x.voseo": { en: "You can", es: "Vos podés" } };
  assert.deepEqual(missingTranslations(broken), ["x.missing"]);
  assert.deepEqual(placeholderMismatches(broken), ["x.placeholder"]);
  assert.deepEqual(forbiddenTypography(broken), ["x.dash.en U+2014"]);
  assert.deepEqual(voseoForms(broken), ["x.voseo"]);
});

test("every plural pair is complete: key_one comes with key_other and the other way round", () => {
  const keys = Object.keys(STRINGS);
  for (const key of keys.filter((k) => k.endsWith("_one"))) assert.ok(STRINGS[`${key.slice(0, -4)}_other`], `${key} has no _other`);
  for (const key of keys.filter((k) => k.endsWith("_other"))) assert.ok(STRINGS[`${key.slice(0, -6)}_one`], `${key} has no _one`);
});

test("the defined pairs of music terms exist: feedback, flow, hands, fingers and fixed-do solfege", () => {
  const needed = ["common.correct", "common.tryAgain", "common.listen", "common.myTurn", "common.continue", "common.startOver", "common.resetProgress", "common.playAlong", "common.practice", "common.private", "hand.R", "hand.L", "input.midi.noDevice", "input.midi.noDeviceHint", "input.connect", "input.midiSound"];
  for (const key of needed) assert.ok(STRINGS[key], key);
  for (const n of [1, 2, 3, 4, 5]) assert.ok(STRINGS[`finger.${n}`], `finger.${n}`);
  const solfege = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
  for (const [letter, name] of Object.entries(solfege)) assert.deepEqual(STRINGS[`note.${letter}`], { en: name, es: name }, "fixed-do in both languages");
});

test("the aligned MIDI texts match the note-input and practice specs exactly", () => {
  assert.deepEqual(STRINGS["input.midi.noDevice"], { en: "MIDI: no device", es: "MIDI: sin dispositivo" });
  assert.equal(STRINGS["input.midi.noDeviceHint"].en, "No MIDI device found. Use the computer keys or tap the keys.");
  assert.equal(STRINGS["input.midi.noDeviceHint"].es, "No se encontró ningún dispositivo MIDI. Use el teclado de la computadora o toque las teclas.");
});

function i18nIn(lang) {
  const i18n = createI18n({ table: STRINGS, warn: () => assert.fail("a key used by the instruction was not found") });
  i18n.setLang(lang);
  return i18n;
}

// A composition of the step templates in the way the instruction module will, to run the length guard
// on the real table (the instruction module itself arrives in a later slice).
function render({ lang, hand, finger, count, move }) {
  const i18n = i18nIn(lang);
  const note = (letter, solfege) => i18n.t("note.display", { letter, solfege });
  const handName = i18n.t(`hand.${hand}`);
  const lower = i18n.t(`hand.${hand}.lower`);
  const f = i18n.t(`finger.${finger}`);
  // Sentence 1 names the hand, finger and note (or the move); sentence 2 adds the key count or, for a
  // single-note move, the first finger to play.
  const first = move ? i18n.t("step.move", { hand: lower, thumb: note("F#", "Fa#") }) : i18n.t("step.one", { hand: handName, finger: f, note: note("G#", "Sol#") });
  if (count > 1) return `${first} ${i18n.t("step.together", { count })}`;
  return move ? `${first} ${i18n.t("step.thenPlay", { finger: f, note: note("G#", "Sol#") })}` : first;
}

test("the step templates, composed for every hand, finger, count and move in both languages, stay within two sentences and 25 words", () => {
  assert.deepEqual(instructionLimits(render), []);
});

test("the spec examples render: English single note and the Spanish chord step", () => {
  const en = i18nIn("en");
  assert.equal(en.t("step.one", { hand: en.t("hand.R"), finger: en.t("finger.1"), note: en.t("note.display", { letter: "E", solfege: "Mi" }) }), "Right hand: thumb on E (Mi).");
  const es = i18nIn("es");
  const first = es.t("step.one", { hand: es.t("hand.R"), finger: es.t("finger.1"), note: es.t("note.display", { letter: "E", solfege: "Mi" }) });
  assert.equal(`${first} ${es.t("step.together", { count: 3 })}`, "Mano derecha: pulgar en Mi (E). Presione estas 3 teclas a la vez.");
  assert.equal(en.t("step.together", { count: 3 }), "Press these 3 keys together.");
});

test("a note shows letter first in English and solfege first in Spanish, and G is Sol in both", () => {
  assert.equal(i18nIn("en").t("note.display", { letter: "E", solfege: "Mi" }), "E (Mi)");
  assert.equal(i18nIn("es").t("note.display", { letter: "E", solfege: "Mi" }), "Mi (E)");
  assert.equal(i18nIn("en").t("note.G"), "Sol");
  assert.equal(i18nIn("es").t("note.G"), "Sol");
});
