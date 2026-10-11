import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { createCredits, LICENSE_HREF } = await import("../../src/ui/credits.js");

const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const setup = (navigatorLanguage) => {
  const i18n = createI18n({ table: STRINGS, storage: undefined, navigatorLanguage });
  return { i18n, credits: createCredits({ i18n }) };
};

test("the credit names the piano, the author, the license and the change, in English", () => {
  const { credits } = setup("en-US");
  assert.equal(credits.element.tag, "footer");
  const text = textOf(credits.element);
  for (const part of ["Salamander Grand Piano", "Alexander Holm", "CC BY 3.0", "converted to MP3", "tonejs.github.io/audio"]) assert.ok(text.includes(part), part);
});

test("the credit follows the language and links to the license file beside the samples", () => {
  const { credits, i18n } = setup("en-US");
  const link = all(credits.element, (n) => n.tag === "a")[0];
  assert.equal(link.getAttribute("href"), LICENSE_HREF);
  assert.equal(LICENSE_HREF, "./assets/audio/piano/LICENSE.txt");
  assert.equal(textOf(link), "License text");
  i18n.setLang("es");
  assert.ok(textOf(credits.element).includes("subconjunto convertido a MP3"));
  assert.equal(textOf(link), "Texto de la licencia");
  credits.dispose();
  i18n.setLang("en");
  assert.ok(textOf(credits.element).includes("subconjunto"), "a disposed credit stops following");
});

test("the boot script mounts the credit on every page, outside the routed content (counter-proof: the router never clears it)", () => {
  const main = readFileSync(new URL("../../src/main.js", import.meta.url), "utf8");
  assert.match(main, /mount\.after\(createCredits\(\{ i18n \}\)\.element\)/);
  const router = readFileSync(new URL("../../src/ui/router.js", import.meta.url), "utf8");
  assert.equal(/body\.replaceChildren|document\.body\.innerHTML/.test(router), false);
});

test("the sample license file sits at the path the link points to", () => {
  assert.ok(readFileSync(new URL("../../assets/audio/piano/LICENSE.txt", import.meta.url), "utf8").includes("Alexander Holm"));
});
