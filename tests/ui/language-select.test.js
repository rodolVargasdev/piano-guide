import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { createLanguageSelect } = await import("../../src/ui/language-select.js");

const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const buttons = (root) => all(root, (n) => n.tag === "button");
const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), data };
};
const setup = (navigatorLanguage = "en-US") => {
  const storage = memory();
  const i18n = createI18n({ table: STRINGS, storage, navigatorLanguage });
  return { storage, i18n, select: createLanguageSelect({ i18n }) };
};

test("renders both options with the languages' own names, as a labelled group", () => {
  const { select } = setup();
  assert.deepEqual(buttons(select.element).map(textOf), ["English", "Español"]);
  assert.equal(select.element.getAttribute("role"), "group");
  assert.equal(select.element.getAttribute("aria-label"), "Language");
  assert.deepEqual(buttons(select.element).map((b) => b.getAttribute("lang")), ["en", "es"], "each name is marked with its own language");
});

test("the current language is the pressed one, for an English and a Spanish browser", () => {
  const en = setup("en-US").select;
  assert.deepEqual(buttons(en.element).map((b) => b.getAttribute("aria-pressed")), ["true", "false"]);
  const es = setup("es-SV").select;
  assert.deepEqual(buttons(es.element).map((b) => b.getAttribute("aria-pressed")), ["false", "true"]);
  assert.equal(es.element.getAttribute("aria-label"), "Idioma");
});

test("choosing an option calls setLang, saves it, and moves the pressed state at once", () => {
  const { select, i18n, storage } = setup("en-US");
  const [, spanish] = buttons(select.element);
  spanish.click();
  assert.equal(i18n.lang(), "es");
  assert.equal(storage.data["piano-guide:lang"], "es");
  assert.deepEqual(buttons(select.element).map((b) => b.getAttribute("aria-pressed")), ["false", "true"]);
  assert.equal(select.element.getAttribute("aria-label"), "Idioma");
});

test("a language change made elsewhere is reflected, and a disposed selector stops following", () => {
  const { select, i18n } = setup("en-US");
  i18n.setLang("es");
  assert.deepEqual(buttons(select.element).map((b) => b.getAttribute("aria-pressed")), ["false", "true"]);
  select.dispose();
  i18n.setLang("en");
  assert.deepEqual(buttons(select.element).map((b) => b.getAttribute("aria-pressed")), ["false", "true"], "no longer updated after dispose");
});

test("clicking the already current language changes nothing and does not throw", () => {
  const { select, i18n } = setup("en-US");
  let changes = 0;
  i18n.onChange(() => (changes += 1));
  buttons(select.element)[0].click();
  assert.equal(changes, 0);
  assert.equal(i18n.lang(), "en");
});

test("the stylesheet styles the selector as one segmented control with a 36 px minimum touch height", () => {
  const css = readFileSync(new URL("../../styles/app.css", import.meta.url), "utf8");
  assert.match(css, /\.language-select\s*\{/);
  assert.match(css, /\.language-select \.btn\s*\{[^}]*min-height:\s*2\.25rem/s);
});
