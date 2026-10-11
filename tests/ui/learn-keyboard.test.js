import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { createLearnKeyboard } from "../../src/ui/learn-keyboard.js";
import { keyboardMetrics, namesFor, spellMidi } from "../../src/ui/keyboard-labels.js";

function setup({ lang = "en", width = 900, height = 600 } = {}) {
  const doc = fakeDoc();
  doc.createElement = (tag) => doc.make(tag);
  const mount = doc.make("div");
  mount.clientWidth = width;
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} });
  const keyboard = createLearnKeyboard({ mount, i18n, doc });
  keyboard.fit({ width, height });
  const svg = mount.children[0].children[0];
  return { doc, mount, i18n, keyboard, svg };
}
const rects = (svg, cls) => all(svg, (n) => n.tag === "rect" && n.attrs.class.includes(cls));
const texts = (svg, cls) => all(svg, (n) => n.tag === "text" && n.attrs.class === cls).map((n) => n.textContent);
const WHITE = { en: ["C", "D", "E", "F", "G", "A", "B", "C", "D"], solfege: ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Do", "Re"] };

test("a region of 9 white keys draws 9 white and 6 black keys and nothing outside it", () => {
  const { svg } = setup();
  assert.equal(rects(svg, "lk-white").length, 9);
  assert.equal(rects(svg, "lk-black").length, 6); // C# D# F# G# A# C# between C4 and D5
  const midis = rects(svg, "lk-key").map((r) => Number(r.attrs["data-midi"]));
  assert.ok(midis.every((m) => m >= 60 && m <= 74), "no key outside the region is drawn");
  assert.equal(new Set(midis).size, midis.length);
});

test("every white key shows its letter and its solfege, in the order of the language", () => {
  const en = setup({ lang: "en" });
  assert.deepEqual(texts(en.svg, "lk-name lk-name-primary"), WHITE.en);
  assert.deepEqual(texts(en.svg, "lk-name lk-name-secondary"), WHITE.solfege);
  const es = setup({ lang: "es" });
  assert.deepEqual(texts(es.svg, "lk-name lk-name-primary"), WHITE.solfege);
  assert.deepEqual(texts(es.svg, "lk-name lk-name-secondary"), WHITE.en);
});

test("switching the language redraws the names at once", () => {
  const { svg, i18n } = setup({ lang: "en" });
  const first = () => texts(svg, "lk-name lk-name-primary")[0];
  assert.equal(first(), "C");
  i18n.setLang("es");
  assert.equal(first(), "Do");
});

test("black keys are named in the strip above, spelled for the key of the song", () => {
  const e = setup();
  e.keyboard.setKeyContext({ tonic: "E", mode: "major" });
  const letters = texts(e.svg, "lk-strip-name lk-name-primary");
  assert.equal(letters.length, 6);
  assert.ok(letters.includes("F#") && letters.includes("G#") && !letters.includes("Gb"), "E major spells F# and not Gb");
  assert.deepEqual(texts(e.svg, "lk-strip-name lk-name-secondary").slice(0, 2), ["Do#", "Re#"]);
  const flat = setup();
  flat.keyboard.setKeyContext({ tonic: "Db", mode: "major" });
  const flats = texts(flat.svg, "lk-strip-name lk-name-primary");
  assert.ok(flats.includes("Gb") && flats.includes("Db") && !flats.includes("F#"), "Db major spells Gb and not F#");
});

test("the spelling the data gives wins: E# and Cb appear where the key asks for them", () => {
  assert.equal(namesFor({ midi: 65, key: { tonic: "F#", mode: "major" } }).letters, "E#");
  assert.equal(namesFor({ midi: 71, key: { tonic: "Gb", mode: "major" } }).letters, "Cb");
  assert.equal(namesFor({ midi: 65, key: null, pitch: "E#4" }).letters, "E#", "an explicit pitch beats the context");
  assert.equal(namesFor({ midi: 65, key: { tonic: "C", mode: "major" } }).letters, "F");
  const { svg, keyboard } = setup();
  keyboard.setKeyContext({ tonic: "F#", mode: "major" });
  assert.ok(texts(svg, "lk-name lk-name-primary").includes("E#"), "the white key F is drawn as E# in F# major");
});

test("without a key context a black key shows both spellings, with one the sharp name", () => {
  assert.deepEqual(namesFor({ midi: 61, lang: "en" }), { primary: "C#/Db", secondary: "Do#/Reb", letters: "C#/Db", solfege: "Do#/Reb" });
  assert.equal(namesFor({ midi: 61, lang: "es" }).primary, "Do#/Reb");
  assert.equal(spellMidi(61, null), "C#4");
  assert.equal(spellMidi(61, { tonic: "Db", mode: "major" }), "Db4");
});

test("black keys are drawn after every white key, so their hit area wins", () => {
  const { svg } = setup();
  const order = rects(svg, "lk-key").map((r) => r.attrs.class.includes("lk-black"));
  const firstBlack = order.indexOf(true);
  assert.ok(firstBlack > 0 && order.slice(firstBlack).every(Boolean), "all black after all white");
});

test("the group has an accessible label naming the region and a viewBox in pixels", () => {
  const { svg, keyboard } = setup();
  assert.equal(svg.attrs.role, "group");
  assert.equal(svg.attrs["aria-label"], "Keyboard, C4 to D5");
  keyboard.setRegion({ low: 52, high: 69 }); // E3 to A4
  assert.equal(keyboard.region().low, 52);
  const sized = all(keyboard.element, (n) => n.tag === "svg")[0];
  assert.match(sized.attrs.viewBox, /^0 0 \d+ \d+$/);
  assert.equal(sized.attrs["aria-label"], "Keyboard, E3 to A4");
});

test("label sizes: 12 px or more everywhere, and white keys of 36 px or more at 360 px for 9 keys", () => {
  for (const [width, whiteCount] of [[1168, 11], [820, 11], [358, 9], [360, 9], [1440, 15]]) {
    const m = keyboardMetrics({ whiteCount, width });
    assert.ok(m.secondary >= 12 && m.primary >= 12 && m.strip >= 12 && m.letter >= 12, `labels at ${width}`);
    assert.ok(m.badge >= 22);
  }
  assert.ok(keyboardMetrics({ whiteCount: 9, width: 360 }).keyW >= 36);
  assert.equal(keyboardMetrics({ whiteCount: 11, width: 1168 }).keyW, 88);
  assert.equal(keyboardMetrics({ whiteCount: 11, width: 1168 }).size, "lg");
  assert.equal(keyboardMetrics({ whiteCount: 9, width: 358 }).size, "sm");
});

test("counter-proof: a narrow width really shrinks the keys, and a short room limits the key height", () => {
  const wide = keyboardMetrics({ whiteCount: 9, width: 900, height: 600 });
  const narrow = keyboardMetrics({ whiteCount: 9, width: 300, height: 600 });
  assert.ok(narrow.keyW < wide.keyW);
  const short = keyboardMetrics({ whiteCount: 9, width: 900, height: 220 });
  assert.ok(short.keyH < wide.keyH);
  assert.ok(short.keyH + short.stripH <= 220);
});

test("fit changes the drawn width, and dispose removes the keyboard and stops following the language", () => {
  const { keyboard, svg, i18n, mount } = setup({ width: 900 });
  const before = Number(svg.attrs.width);
  keyboard.fit({ width: 400 });
  assert.ok(Number(all(keyboard.element, (n) => n.tag === "svg")[0].attrs.width) < before);
  keyboard.dispose();
  assert.equal(mount.children.length, 0);
  i18n.setLang("es"); // must not throw
});
