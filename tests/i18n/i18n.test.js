import { test } from "node:test";
import assert from "node:assert/strict";
import { LANG_KEY, createI18n, format, pickLanguage } from "../../src/i18n/i18n.js";

const TABLE = {
  "common.correct": { en: "Correct", es: "Correcto" },
  "only.english": { en: "English only", es: "" },
  "step.one": { en: "{hand}: {finger} on {note}.", es: "{hand}: {finger} en {note}." },
  "keys_one": { en: "{count} key", es: "{count} tecla" },
  "keys_other": { en: "{count} keys", es: "{count} teclas" },
  "count.only": { en: "{count} items", es: "{count} elementos" },
};
const memory = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), data };
};
const blocked = () => ({
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
});
const make = (extra = {}) => createI18n({ table: TABLE, warn: () => {}, ...extra });

test("pickLanguage: a Spanish browser gets Spanish, anything else English, and a saved choice wins", () => {
  assert.equal(pickLanguage(null, "es-SV"), "es");
  assert.equal(pickLanguage(null, "es"), "es");
  assert.equal(pickLanguage(null, "ES-mx"), "es");
  assert.equal(pickLanguage(null, "en-US"), "en");
  assert.equal(pickLanguage(null, "fr"), "en");
  assert.equal(pickLanguage(null, "est"), "en", "only the es language code counts");
  assert.equal(pickLanguage(null, undefined), "en");
  assert.equal(pickLanguage("en", "es-SV"), "en");
  assert.equal(pickLanguage("es", "en-US"), "es");
  assert.equal(pickLanguage("de", "es-SV"), "es", "an unknown saved value is ignored");
});

test("format fills placeholders and leaves an unknown one visible", () => {
  assert.equal(format("{a} and {b}", { a: 1, b: "two" }), "1 and two");
  assert.equal(format("{a} and {b}", { a: 1 }), "1 and {b}");
  assert.equal(format("no placeholders"), "no placeholders");
  assert.equal(format("{count}", { count: 0 }), "0", "zero is a value, not a missing parameter");
  assert.equal(format("{toString}", {}), "{toString}", "an inherited name is not a parameter");
});

test("the first visit follows the browser language and sets the document language", () => {
  const documentElement = { lang: "" };
  const i18n = make({ storage: memory(), navigatorLanguage: "es-SV", documentElement });
  assert.equal(i18n.lang(), "es");
  assert.equal(i18n.t("common.correct"), "Correcto");
  assert.equal(documentElement.lang, "es");
});

test("a saved choice is applied on the next visit, and setLang saves it", () => {
  const storage = memory();
  const first = make({ storage, navigatorLanguage: "es-SV" });
  first.setLang("en");
  assert.equal(storage.data[LANG_KEY], "en");
  const second = make({ storage, navigatorLanguage: "es-SV" });
  assert.equal(second.lang(), "en", "the saved choice beats the Spanish browser");
  assert.equal(second.t("common.correct"), "Correct");
});

test("blocked storage: the page still switches for the session and shows no error", () => {
  const documentElement = { lang: "" };
  const i18n = make({ storage: blocked(), navigatorLanguage: "en-US", documentElement });
  assert.equal(i18n.lang(), "en");
  assert.doesNotThrow(() => i18n.setLang("es"));
  assert.equal(i18n.lang(), "es");
  assert.equal(documentElement.lang, "es");
  assert.equal(i18n.t("common.correct"), "Correcto");
});

test("a missing Spanish value falls back to English and an unknown key is never shown raw", () => {
  const warnings = [];
  const i18n = make({ navigatorLanguage: "es", warn: (m) => warnings.push(m) });
  assert.equal(i18n.t("only.english"), "English only");
  assert.equal(warnings.length, 0, "a fallback to English is not an error");
  assert.equal(i18n.t("no.such.key"), "");
  assert.deepEqual(warnings, ['i18n: no text for "no.such.key"']);
});

test("templates take parameters in both languages", () => {
  const i18n = make({ navigatorLanguage: "en" });
  assert.equal(i18n.t("step.one", { hand: "Right hand", finger: "thumb", note: "E (Mi)" }), "Right hand: thumb on E (Mi).");
  i18n.setLang("es");
  assert.equal(i18n.t("step.one", { hand: "Mano derecha", finger: "pulgar", note: "Mi (E)" }), "Mano derecha: pulgar en Mi (E).");
});

test("plural forms: 1 key, 3 keys, 0 keys, 1 tecla, 3 teclas", () => {
  const i18n = make({ navigatorLanguage: "en" });
  assert.equal(i18n.t("keys", { count: 1 }), "1 key");
  assert.equal(i18n.t("keys", { count: 3 }), "3 keys");
  assert.equal(i18n.t("keys", { count: 0 }), "0 keys");
  i18n.setLang("es");
  assert.equal(i18n.t("keys", { count: 1 }), "1 tecla");
  assert.equal(i18n.t("keys", { count: 3 }), "3 teclas");
  assert.equal(i18n.t("count.only", { count: 1 }), "1 elementos", "a key without plural variants uses its single text");
});

test("onChange runs synchronously, only on a real change, and can be unsubscribed", () => {
  const i18n = make({ navigatorLanguage: "en" });
  const seen = [];
  const off = i18n.onChange((lang) => seen.push([lang, i18n.t("common.correct")]));
  i18n.setLang("es");
  assert.deepEqual(seen, [["es", "Correcto"]], "the callback already sees the new language");
  i18n.setLang("es");
  assert.equal(seen.length, 1, "no change, no notification");
  off();
  i18n.setLang("en");
  assert.equal(seen.length, 1, "unsubscribed");
});

test("setLang ignores a value that is not a language and returns the current one", () => {
  const storage = memory();
  const i18n = make({ storage, navigatorLanguage: "en" });
  assert.equal(i18n.setLang("fr"), "en");
  assert.equal(i18n.setLang(undefined), "en");
  assert.equal(storage.data[LANG_KEY], undefined);
});

test("works with no storage, no document and no table", () => {
  const i18n = createI18n({ warn: () => {} });
  assert.equal(i18n.lang(), "en");
  assert.equal(i18n.t("anything"), "");
  assert.doesNotThrow(() => i18n.setLang("es"));
});
