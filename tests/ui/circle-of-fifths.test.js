import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { TONICS } from "../../src/theory/keys.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { createCircleOfFifths } = await import("../../src/ui/circle-of-fifths.js");

const i18nIn = (lang) => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });
const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));

function make(lang = "en") {
  const picks = [];
  const i18n = i18nIn(lang);
  const circle = createCircleOfFifths({ i18n, onPick: (k) => picks.push(k) });
  const buttons = () => all(circle.element, (n) => n.tag === "button");
  const key = (tonic) => buttons().find((b) => b.attrs["data-key"] === tonic);
  return { circle, picks, i18n, buttons, key };
}

test("twelve keys around the circle in the order of fifths, C first, and the selected key named in the middle", () => {
  const { circle, buttons } = make();
  assert.deepEqual(buttons().map(textOf), ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"]);
  assert.deepEqual(buttons().map((b) => b.attrs["data-key"]), [...TONICS]);
  assert.equal(textOf(all(circle.element, (n) => (n.attrs.class ?? "").includes("cof-center"))[0]), "C major");
});

test("tapping a key picks it", () => {
  const { picks, key } = make();
  key("Eb").click();
  key("F#").click();
  assert.deepEqual(picks, ["Eb", "F#"]);
});

test("the selected key is pressed, practiced keys and suggested keys are marked, and each says so in words", () => {
  const { circle, key } = make();
  circle.set({ current: "G", done: ["C", "G"], next: ["D", "F", "G"] });
  assert.equal(key("G").attrs["aria-pressed"], "true");
  assert.equal(key("C").attrs["aria-pressed"], "false");
  assert.equal(key("C").attrs["data-done"], "true");
  assert.equal(key("D").attrs["data-next"], "true");
  assert.equal(key("D").attrs["data-done"], "false");
  assert.equal(key("G").attrs["data-next"], "false", "the selected key is not also suggested");
  assert.equal(key("G").attrs["aria-label"], "G major, selected, practiced");
  assert.equal(key("C").attrs["aria-label"], "C major, practiced");
  assert.equal(key("F").attrs["aria-label"], "F major, suggested next");
  assert.equal(key("A").attrs["aria-label"], "A major");
  assert.equal(textOf(all(circle.element, (n) => (n.attrs.class ?? "").includes("cof-center"))[0]), "G major");
});

test("the labels follow the language at once", () => {
  const { circle, i18n, key } = make();
  circle.set({ current: "D", done: ["C"], next: ["G"] });
  i18n.setLang("es");
  assert.equal(key("D").attrs["aria-label"], "D mayor, elegida");
  assert.equal(key("C").attrs["aria-label"], "C mayor, practicada");
  assert.equal(key("G").attrs["aria-label"], "G mayor, sugerida a continuación");
  assert.equal(circle.element.attrs["aria-label"], "Elija una tonalidad en el círculo de quintas");
});

test("counter-proof: with nothing marked no key claims to be practiced or suggested", () => {
  const { circle, buttons } = make();
  circle.set({ current: "C" });
  assert.equal(buttons().filter((b) => b.attrs["data-done"] === "true" || b.attrs["data-next"] === "true").length, 0);
  circle.set({ current: "C", done: [], next: [] });
  assert.equal(buttons().filter((b) => b.attrs["aria-label"].includes(",")).length, 1, "only the selected key has a state word");
});

test("a disposed circle no longer redraws on a language change", () => {
  const { circle, i18n, key } = make();
  circle.dispose();
  i18n.setLang("es");
  assert.equal(key("C").attrs["aria-label"], "C major, selected");
});
