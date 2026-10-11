import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORBIDDEN_CHARS,
  VOSEO_WORDS,
  countSentences,
  countWords,
  forbiddenTypography,
  instructionLimits,
  missingTranslations,
  placeholderMismatches,
  voseoForms,
} from "../../src/i18n/guards.js";

const CLEAN = {
  "common.correct": { en: "Correct", es: "Correcto" },
  "step.one": { en: "{hand}: {finger} on {note}.", es: "{hand}: {finger} en {note}." },
  "step.together_other": { en: "Press these {count} keys together.", es: "Presione estas {count} teclas a la vez." },
};
const withKey = (key, value) => ({ ...CLEAN, [key]: value });

test("a clean table passes every guard", () => {
  assert.deepEqual(missingTranslations(CLEAN), []);
  assert.deepEqual(placeholderMismatches(CLEAN), []);
  assert.deepEqual(forbiddenTypography(CLEAN), []);
  assert.deepEqual(voseoForms(CLEAN), []);
});

test("missingTranslations flags a key lacking Spanish, lacking English, or empty, naming the key", () => {
  assert.deepEqual(missingTranslations(withKey("bad.es", { en: "Hello" })), ["bad.es"]);
  assert.deepEqual(missingTranslations(withKey("bad.en", { es: "Hola" })), ["bad.en"]);
  assert.deepEqual(missingTranslations(withKey("bad.empty", { en: "Hello", es: "   " })), ["bad.empty"]);
  assert.deepEqual(missingTranslations(withKey("bad.null", null)), ["bad.null"]);
});

test("placeholderMismatches flags a placeholder present in one language only, or renamed", () => {
  assert.deepEqual(placeholderMismatches(withKey("bad.one", { en: "{count} keys", es: "teclas" })), ["bad.one"]);
  assert.deepEqual(placeholderMismatches(withKey("bad.name", { en: "{count} keys", es: "{total} teclas" })), ["bad.name"]);
  assert.deepEqual(placeholderMismatches(withKey("fine.order", { en: "{a} then {b}", es: "{b} luego {a}" })), [], "order may differ");
  assert.deepEqual(placeholderMismatches(withKey("fine.repeat", { en: "{a} {a}", es: "{a}" })), [], "repeats do not matter");
});

test("forbiddenTypography flags every character of the list, in either language, naming key and code point", () => {
  assert.ok(FORBIDDEN_CHARS.length >= 11);
  for (const ch of FORBIDDEN_CHARS) {
    const found = forbiddenTypography(withKey("bad.en", { en: `Hello${ch}world`, es: "Hola" }));
    assert.equal(found.length, 1, `U+${ch.codePointAt(0).toString(16)}`);
    assert.match(found[0], /^bad\.en\.en U\+[0-9A-F]{4}$/);
  }
  assert.equal(forbiddenTypography(withKey("bad.es", { en: "Hello", es: `Hola${String.fromCodePoint(0x2014)}mundo` }))[0], "bad.es.es U+2014");
});

test("forbiddenTypography leaves Spanish orthography alone: accents, enye, opening marks and straight quotes", () => {
  assert.deepEqual(forbiddenTypography(withKey("fine", { en: 'Say "hi" - it is fine', es: "¿Cómo está? ¡Señal de año! \"sí\" - bien" })), []);
});

test("voseoForms flags each listed form as a whole word, in any case, in Spanish only", () => {
  for (const word of VOSEO_WORDS) {
    assert.deepEqual(voseoForms(withKey("bad", { en: "x", es: `Ahora ${word} aquí` })), ["bad"], word);
  }
  assert.deepEqual(voseoForms(withKey("bad", { en: "x", es: "Mirá la tecla" })), ["bad"], "capitalized");
  assert.deepEqual(voseoForms(withKey("bad", { en: "x", es: "PODÉS seguir" })), ["bad"], "upper case");
});

test("voseoForms does not flag the formal register or words that merely contain a listed form", () => {
  assert.deepEqual(voseoForms(withKey("fine", { en: "x", es: "Presione la tecla. Toque, mire y puede seguir." })), []);
  assert.deepEqual(voseoForms(withKey("fine2", { en: "You can look here", es: "Cada nota avos acádemica" })), [], "avos and acádemica contain vos and acá");
  assert.deepEqual(voseoForms(withKey("english", { en: "vos podés", es: "Hola" })), [], "only the Spanish text is checked");
});

test("sentences and words are counted from the text", () => {
  assert.equal(countSentences("Right hand: thumb on E (Mi)."), 1);
  assert.equal(countSentences("Right hand: thumb on E (Mi). Press these 3 keys together."), 2);
  assert.equal(countSentences("No final mark"), 1);
  assert.equal(countSentences("¿Listo? ¡Adelante!"), 2);
  assert.equal(countSentences(""), 0);
  assert.equal(countWords("Right hand: thumb on E (Mi)."), 6);
  assert.equal(countWords("  spaced   out  "), 2);
});

test("instructionLimits passes a short renderer and enumerates 2 languages x 2 hands x 5 fingers x 5 counts x 2 moves", () => {
  let calls = 0;
  const ok = instructionLimits(() => {
    calls += 1;
    return "Right hand: thumb on E (Mi). Press these 3 keys together.";
  });
  assert.deepEqual(ok, []);
  assert.equal(calls, 2 * 2 * 5 * 5 * 2);
});

test("instructionLimits flags a third sentence and a 26th word, naming the combination", () => {
  const sentences = instructionLimits(({ count }) => (count === 5 ? "One. Two. Three." : "One. Two."));
  assert.equal(sentences.length, 2 * 2 * 5 * 2, "every count-5 combination");
  assert.match(sentences[0], /count 5 move (false|true): 3 sentences/);
  const words = instructionLimits(({ lang }) => (lang === "es" ? Array(26).fill("palabra").join(" ") + "." : "Short."));
  assert.equal(words.length, 2 * 5 * 5 * 2);
  assert.match(words[0], /^es /);
  const edge = instructionLimits(() => Array(25).fill("word").join(" ") + ".");
  assert.deepEqual(edge, [], "exactly 25 words is allowed");
});
