import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { emptyPracticeProgress, recordRoutine, recordRun, writePracticeProgress } from "../../src/practice/progress.js";
import { buildRoutine } from "../../src/practice/routine.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createElementNS: (ns, t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }), body: { setAttribute() {}, removeAttribute() {} } };
const { createTodayCard, todayModel } = await import("../../src/ui/practice-today.js");
const { practiceView } = await import("../../src/ui/practice-view.js");

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k], data };
};
const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const hasClass = (n, c) => (n.attrs.class ?? "").split(" ").includes(c);
const i18nIn = (lang) => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });
const finished = (progress, day) => recordRoutine(progress, { date: day, blocks: buildRoutine(progress, day).blocks.map((b) => ({ id: b.id, key: b.key, status: "done" })) });

test("a new learner's Today: C is the key of the day, the four things with minutes, About 10 minutes, no streak", () => {
  const m = todayModel({ progress: emptyPracticeProgress(), today: "2026-10-10", i18n: i18nIn("en") });
  assert.equal(m.heading, "Today");
  assert.equal(m.key, "C");
  assert.equal(m.keyLine, "Today's key: C major");
  assert.equal(m.lines.length, 4);
  assert.equal(m.lines[1], "Scale: Major scales in C major, 3 minutes");
  assert.equal(m.total, "About 10 minutes");
  assert.equal(m.streak, "");
  assert.equal(m.doneToday, "");
  assert.deepEqual(m.chips, []);
  assert.deepEqual(m.doneKeys, []);
});

test("after a routine the next day: the key of the day moves to G, the streak is shown, and the keys with a scale are marked", () => {
  const p = finished(emptyPracticeProgress(), "2026-10-10");
  const m = todayModel({ progress: p, today: "2026-10-11", i18n: i18nIn("en") });
  assert.equal(m.key, "G");
  assert.equal(m.streak, "1 day in a row");
  assert.deepEqual(m.doneKeys, ["C"]);
  const same = todayModel({ progress: p, today: "2026-10-10", i18n: i18nIn("en") });
  assert.equal(same.doneToday, "You practiced today.");
});

test("the chips show how the learner is doing in today's key: best tempo, clean streak and runs", () => {
  // Every key practiced, C the longest ago: C is the key of the day, with its record.
  let p = emptyPracticeProgress();
  for (const key of ["G", "D", "F", "A", "E", "B", "Bb", "Eb", "Ab", "Db", "F#"]) p = recordRun(p, { exerciseId: "scale-major", key, bpm: 60, clean: true, date: "2026-10-05" });
  for (const bpm of [60, 72]) p = recordRun(p, { exerciseId: "scale-major", key: "C", bpm, clean: true, date: "2026-09-01" });
  const m = todayModel({ progress: p, today: "2026-10-11", i18n: i18nIn("en") });
  assert.equal(m.key, "C");
  assert.deepEqual(m.chips, ["Best tempo 72", "Clean streak 2", "2 clean runs", "Last practiced 2026-09-01"]);
  assert.equal(todayModel({ progress: p, today: "2026-10-11", i18n: i18nIn("es") }).keyLine, "Tonalidad de hoy: C mayor");
});

test("practicing a scale on its own page, even unclean, moves the key of the day on (the routine does not repeat it)", () => {
  const p = recordRun(emptyPracticeProgress(), { exerciseId: "scale-major", key: "C", bpm: 72, clean: false, date: "2026-10-10" });
  const m = todayModel({ progress: p, today: "2026-10-11", i18n: i18nIn("en") });
  assert.equal(m.key, "G");
  assert.deepEqual(m.doneKeys, [], "but only a clean run marks the key as practiced on the circle");
});

test("a date that is not a day gives no card", () => {
  assert.equal(todayModel({ progress: emptyPracticeProgress(), today: "later", i18n: i18nIn("en") }), null);
  const card = createTodayCard({ i18n: i18nIn("en") });
  card.set({ progress: emptyPracticeProgress(), today: "later" });
  assert.equal(card.element.hidden, true);
  assert.equal(card.element.children.length, 0);
});

test("the card has the four lines, a Start the routine link to the routine, and a read-only circle with today's key selected", () => {
  const card = createTodayCard({ i18n: i18nIn("en") });
  card.set({ progress: emptyPracticeProgress(), today: "2026-10-10" });
  const e = card.element;
  assert.equal(e.hidden, false);
  assert.equal(all(e, (n) => n.tag === "li").length, 4);
  const start = all(e, (n) => n.tag === "a")[0];
  assert.equal(textOf(start), "Start the routine");
  assert.equal(start.attrs.href, "#/practice/routine");
  const keys = all(e, (n) => n.tag === "button" && n.attrs["data-key"]);
  assert.equal(keys.length, 12);
  assert.ok(keys.every((b) => b.attrs.disabled !== undefined), "the circle only shows: every key is disabled");
  assert.equal(keys.find((b) => b.attrs["aria-pressed"] === "true").attrs["data-key"], "C");
  assert.equal(textOf(all(e, (n) => hasClass(n, "cof-center"))[0]), "C major");
});

test("redrawn for another day: the circle moves to G with C marked practiced; the card follows the language", () => {
  const card = createTodayCard({ i18n: i18nIn("en") });
  const p = recordRun(emptyPracticeProgress(), { exerciseId: "scale-major", key: "C", bpm: 60, clean: true, date: "2026-10-10" });
  card.set({ progress: p, today: "2026-10-11" });
  const keys = () => all(card.element, (n) => n.tag === "button" && n.attrs["data-key"]);
  assert.equal(keys().find((b) => b.attrs["aria-pressed"] === "true").attrs["data-key"], "G");
  assert.equal(keys().find((b) => b.attrs["data-key"] === "C").attrs["data-done"], "true");
  assert.equal(keys().find((b) => b.attrs["data-key"] === "G").attrs["aria-label"], "G major, selected");
});

test("the card in Spanish, and a language switch redraws it in place", () => {
  const i18n = i18nIn("en");
  const card = createTodayCard({ i18n });
  card.set({ progress: emptyPracticeProgress(), today: "2026-10-10" });
  i18n.setLang("es");
  assert.equal(textOf(all(card.element, (n) => hasClass(n, "practice-today-label"))[0]), "Hoy");
  assert.equal(textOf(all(card.element, (n) => n.tag === "a")[0]), "Empezar la rutina");
  assert.equal(all(card.element, (n) => n.tag === "li").map(textOf)[0], "Calentamiento: Patrones de cinco dedos en C mayor, 2 minutos");
});

test("the practice list opens with the Today card first, then the groups, and Reset progress empties its streak too", () => {
  const storage = memory();
  writePracticeProgress(storage, finished(emptyPracticeProgress(), "2026-10-10"));
  const i18n = i18nIn("en");
  const root = doc.make("div");
  const win = { document: globalThis.document, innerWidth: 1200, innerHeight: 800, navigator: {}, addEventListener() {}, removeEventListener() {} };
  const handle = practiceView({ i18n, win, storage, today: () => "2026-10-11" })({ songId: null }, root);
  const section = all(root, (n) => hasClass(n, "practice"))[0];
  assert.equal(hasClass(section.children[1], "practice-today"), true, "right after the heading");
  assert.match(textOf(section.children[1]), /1 day in a row/);
  assert.match(textOf(section.children[1]), /Today's key: G major/);
  all(root, (n) => n.tag === "button" && n.attrs["data-action"] === "RESET")[0].click();
  all(root, (n) => n.tag === "button" && n.attrs["data-action"] === "RESET_YES")[0].click();
  assert.equal(/day in a row/.test(textOf(all(root, (n) => hasClass(n, "practice-today"))[0])), false, "the streak is gone");
  assert.match(textOf(all(root, (n) => hasClass(n, "practice-today"))[0]), /Today's key: C major/);
  handle.dispose();
  assert.equal(i18n.lang(), "en");
});

test("leaving the list disposes the card: no redraw on a language change afterwards", () => {
  const i18n = i18nIn("en");
  const card = createTodayCard({ i18n });
  card.set({ progress: emptyPracticeProgress(), today: "2026-10-10" });
  card.dispose();
  i18n.setLang("es");
  assert.equal(textOf(all(card.element, (n) => hasClass(n, "practice-today-label"))[0]), "Today", "the card was left as it was, not redrawn in Spanish");
});
