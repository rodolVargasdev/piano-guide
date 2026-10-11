import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { EXERCISES } from "../../src/practice/catalog.js";
import { PRACTICE_KEY, emptyPracticeProgress, recordRun, writePracticeProgress } from "../../src/practice/progress.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createElementNS: (ns, t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }), body: { setAttribute() {}, removeAttribute() {} } };
const { cardModel, listModel, practiceView, summaryChips } = await import("../../src/ui/practice-view.js");

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k], data };
};
const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const hasClass = (n, c) => (n.attrs.class ?? "").split(" ").includes(c);
const i18nIn = (lang) => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });

// A window and an engine that do nothing: these tests read the cards, the run itself is tested in practice-run.test.js.
const fakeWin = () => ({ document: globalThis.document, innerWidth: 1200, innerHeight: 800, navigator: { language: "en" }, isSecureContext: true, addEventListener() {}, removeEventListener() {}, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
const quietEngine = () => ({ startNote() {}, releaseNote() {}, stopNotes() {}, playNotes() {}, dispose() {} });

function open({ id = null, lang = "en", storage = memory() } = {}) {
  const i18n = i18nIn(lang);
  const root = doc.make("div");
  const handle = practiceView({ i18n, win: fakeWin(), storage, makeEngine: quietEngine })({ songId: id }, root);
  return { root, i18n, storage, handle, all: (pred) => all(root, pred), text: () => textOf(root) };
}

test("the list shows the four groups in order with the ten exercises, each a link to its own address", () => {
  const v = open();
  const groups = v.all((n) => n.tag === "section" && n.attrs["data-group"]);
  assert.deepEqual(groups.map((g) => g.attrs["data-group"]), ["technique", "harmony", "ear", "routine"]);
  const items = v.all((n) => n.tag === "li" && n.attrs["data-exercise"]);
  assert.deepEqual(items.map((n) => n.attrs["data-exercise"]), ["five-finger", "scale-major", "arpeggios", "triads", "cadence-i-iv-v-i", "progression-i-vi-iv-v", "progression-i-v-vi-iv", "ear-intervals", "ear-chords", "routine"]);
  const links = v.all((n) => n.tag === "a" && /^#\/practice\//.test(n.attrs.href ?? ""));
  assert.equal(links.length, 10);
  assert.equal(links.find((l) => textOf(l) === "Major scales").attrs.href, "#/practice/scale-major");
});

test("each entry has a short goal line and no paragraph, and the heading says Practice exercises", () => {
  const v = open();
  assert.equal(textOf(v.all((n) => n.tag === "h2")[0]), "Practice exercises");
  const first = v.all((n) => n.tag === "li")[0];
  assert.equal(textOf(first.children[1]), "Put one finger on each of five neighboring keys and play them evenly.");
});

test("nothing practiced yet: no chips; after runs the entry shows best tempo, clean streak, runs and the last day", () => {
  const storage = memory();
  assert.equal(open({ storage }).all((n) => hasClass(n, "chip")).length, 0);
  let p = emptyPracticeProgress();
  for (const bpm of [60, 60, 72]) p = recordRun(p, { exerciseId: "scale-major", key: "G", bpm, clean: true, date: "2026-10-10" });
  writePracticeProgress(storage, p);
  const v = open({ storage });
  const item = v.all((n) => n.tag === "li" && n.attrs["data-exercise"] === "scale-major")[0];
  assert.deepEqual(all(item, (n) => hasClass(n, "chip")).map(textOf), ["Best tempo 72", "Clean streak 3", "3 clean runs", "Last practiced 2026-10-10"]);
  assert.equal(all(v.root, (n) => hasClass(n, "chip")).length, 4, "only the practiced exercise has chips");
});

test("summaryChips drops the zero facts and says one clean run in the singular", () => {
  const t = i18nIn("en").t;
  assert.deepEqual(summaryChips({ keys: 1, bestTempo: 60, cleanStreak: 0, cleanRuns: 1, lastPracticed: "2026-10-10" }, t), ["Best tempo 60", "1 clean run", "Last practiced 2026-10-10"]);
  assert.deepEqual(summaryChips({ keys: 0, bestTempo: 0, cleanStreak: 0, cleanRuns: 0, lastPracticed: null }, t), []);
});

test("corrupt or blocked storage shows the list with no chips and no error", () => {
  const storage = memory();
  storage.setItem(PRACTICE_KEY, "{not json");
  assert.equal(open({ storage }).all((n) => hasClass(n, "chip")).length, 0);
  const blocked = { getItem() { throw new Error("denied"); } };
  const v = open({ storage: blocked });
  assert.equal(v.all((n) => n.tag === "li").length, 10);
});

test("the C major scale card has the goal, why, how and what good looks like, the tempo steps and the fingering note", () => {
  const v = open({ id: "scale-major" });
  assert.equal(textOf(v.all((n) => n.tag === "h2")[0]), "Major scales");
  const sections = v.all((n) => n.tag === "section" && hasClass(n, "practice-field"));
  assert.deepEqual(sections.map((s) => textOf(s.children[0])), ["Goal", "Why it matters", "How to do it", "What good looks like"]);
  assert.match(textOf(sections[0]), /Play the notes of a major scale in order/);
  assert.equal(textOf(v.all((n) => hasClass(n, "practice-tempos"))[0]), "Tempo steps (beats per minute): 50, 60, 72, 88");
  assert.equal(textOf(v.all((n) => hasClass(n, "practice-note"))[0]), "Standard fingering; some books differ.");
  assert.equal(v.all((n) => n.tag === "a" && n.attrs.href === "#/practice").length, 1, "a link back to the list");
});

test("a card without a fingering note (chords) shows none, and the routine card has no tempo steps", () => {
  assert.equal(open({ id: "triads" }).all((n) => hasClass(n, "practice-note")).length, 0);
  assert.equal(open({ id: "routine" }).all((n) => hasClass(n, "practice-tempos")).length, 0);
});

test("every card opens with all five fields in Spanish when Spanish is selected", () => {
  for (const e of EXERCISES) {
    const v = open({ id: e.id, lang: "es" });
    assert.equal(textOf(v.all((n) => n.tag === "h2")[0]), STRINGS[`ex.${e.id}.title`].es, e.id);
    const sections = v.all((n) => n.tag === "section" && hasClass(n, "practice-field"));
    assert.deepEqual(sections.map((s) => textOf(s.children[0])), ["Objetivo", "Por qué importa", "Cómo hacerlo", "Cómo reconocer que va bien"]);
    assert.deepEqual(sections.map((s) => textOf(s.children[1])), ["goal", "why", "how", "good"].map((f) => STRINGS[`ex.${e.id}.${f}`].es));
  }
});

test("an unknown exercise shows Exercise not found with a link back, and never shows the id (even markup)", () => {
  const id = '<img src=x onerror="alert(1)">';
  const v = open({ id });
  assert.equal(textOf(v.all((n) => n.tag === "h2")[0]), "Exercise not found");
  assert.equal(v.all((n) => n.attrs.role === "alert").length, 1);
  assert.equal(v.all((n) => n.tag === "a" && n.attrs.href === "#/practice").length, 1);
  assert.equal(v.text().includes("onerror"), false);
  assert.equal(v.all((n) => n.tag === "img").length, 0, "no element was built from the id");
  assert.equal(textOf(open({ id: "nope", lang: "es" }).all((n) => n.tag === "h2")[0]), "Ejercicio no encontrado");
});

test("switching language redraws the page in place, and after dispose it no longer redraws", () => {
  const v = open({ id: "scale-major" });
  v.i18n.setLang("es");
  assert.equal(textOf(v.all((n) => n.tag === "h2")[0]), "Escalas mayores");
  v.handle.dispose();
  v.i18n.setLang("en");
  assert.equal(textOf(v.all((n) => n.tag === "h2")[0]), "Escalas mayores", "a disposed view leaves the page alone");
});

test("the models are plain data: the list names the same ten exercises and the card carries the five texts", () => {
  const i18n = i18nIn("en");
  const m = listModel({ progress: emptyPracticeProgress(), i18n });
  assert.equal(m.groups.flatMap((g) => g.items).length, 10);
  const c = cardModel({ exercise: EXERCISES.find((e) => e.id === "arpeggios"), i18n });
  assert.deepEqual(c.sections.map((s) => s.id), ["goal", "why", "how", "good"]);
  assert.deepEqual(c.notes, ["Standard fingering; some books differ."]);
});

test("counter-proof: markup in a string cannot become an element (text nodes only)", () => {
  const src = readFileSync(new URL("../../src/ui/practice-view.js", import.meta.url), "utf8");
  assert.equal(/innerHTML|insertAdjacentHTML|outerHTML/.test(src), false);
});
