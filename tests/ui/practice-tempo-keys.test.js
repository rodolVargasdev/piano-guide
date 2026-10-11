import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { PRACTICE_KEY, emptyPracticeProgress, readPracticeProgress, recordRun, writePracticeProgress } from "../../src/practice/progress.js";

const doc = fakeDoc();
globalThis.document = {
  createElement: (t) => doc.make(t),
  createElementNS: (ns, t) => doc.make(t),
  createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }),
  body: { setAttribute() {}, removeAttribute() {} },
};
const { practiceView } = await import("../../src/ui/practice-view.js");

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k], data };
};
const fakeWin = () => ({
  document: globalThis.document, innerWidth: 1200, innerHeight: 800, navigator: { language: "en" }, isSecureContext: true,
  addEventListener() {}, removeEventListener() {}, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
});
function fakeEngine() {
  const calls = [];
  const rec = (name) => (...a) => calls.push([name, ...a]);
  return { calls, startNote: rec("startNote"), releaseNote: rec("releaseNote"), playNotes: rec("playNotes"), stopNotes: rec("stopNotes"), setTimeline: (tl) => calls.push(["setTimeline", tl]), setBpm: rec("setBpm"), setMetronome: (c) => calls.push(["setMetronome", c.enabled]), play: rec("play"), stop: rec("stop"), dispose: rec("dispose") };
}
const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const hasClass = (n, c) => (n.attrs.class ?? "").split(" ").includes(c);

function open({ id = "scale-major", lang = "en", storage = memory(), engine = fakeEngine() } = {}) {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });
  const root = doc.make("div");
  const handle = practiceView({ i18n, win: fakeWin(), storage, makeEngine: () => engine })({ songId: id }, root);
  const q = (pred) => all(root, pred);
  const api = {
    root, engine, storage, i18n, handle,
    text: (cls) => textOf(q((n) => hasClass(n, cls))[0] ?? { tag: "#text", text: "" }),
    click: (a) => q((n) => n.tag === "button" && n.attrs["data-action"] === a)[0].click(),
    key: (midi) => q((n) => n.tag === "rect" && n.attrs["data-midi"] === String(midi))[0],
    expected: () => q((n) => n.tag === "rect" && hasClass(n, "lk-expected")).map((n) => Number(n.attrs["data-midi"])),
    press(midi) {
      (api.key(midi).listeners.pointerdown ?? []).forEach((f) => f({ pointerId: 1, button: 0, target: { releasePointerCapture() {} }, preventDefault() {} }));
      (api.key(midi).listeners.pointerup ?? []).forEach((f) => f({ pointerId: 1 }));
    },
    phase: () => q((n) => n.attrs["data-phase"] && hasClass(n, "practice-run"))[0]?.attrs["data-phase"],
    seg: (name) => q((n) => n.tag === "div" && n.attrs["data-choice"] === name)[0],
    btn: (name, value) => api.seg(name).children.find((b) => b.attrs["data-value"] === String(value)),
    pressed: (name) => api.seg(name).children.filter((b) => b.attrs["aria-pressed"] === "true").map((b) => b.attrs["data-value"]),
    metronome: () => q((n) => n.attrs["data-toggle"] === "metronome")[0],
    cofKey: (tonic) => q((n) => n.tag === "button" && n.attrs["data-key"] === tonic)[0],
    chips: () => all(q((n) => hasClass(n, "practice-summary"))[0], (n) => hasClass(n, "chip")).map(textOf),
    pressAll() {
      let guard = 0;
      while (api.phase() === "running" && guard++ < 100) for (const m of api.expected()) api.press(m);
    },
  };
  return api;
}
const clean = (p, key, bpm = 60, id = "scale-major") => recordRun(p, { exerciseId: id, key, bpm, clean: true, date: "2026-10-10" });

test("the tempo buttons are the steps of the card, the first is pressed, and choosing one sets the tempo", () => {
  const v = open();
  assert.deepEqual(v.seg("tempo").children.map(textOf), ["50", "60", "72", "88"]);
  assert.deepEqual(v.pressed("tempo"), ["50"]);
  v.btn("tempo", 72).click();
  assert.deepEqual(v.pressed("tempo"), ["72"]);
  v.root && v.click("START");
  assert.equal(v.text("learn-progress"), "Step 1 of 8 | Tempo 72");
});

test("the tempo of a clean run is recorded, and the suggested next one appears as a tempo button when it is not a card step", () => {
  const v = open();
  v.btn("tempo", 60).click();
  v.click("START");
  v.pressAll();
  assert.equal(v.text("learn-sub"), "Next tempo to try: 72.");
  const entry = readPracticeProgress(v.storage).exercises["scale-major"].C;
  assert.equal(entry.bestTempo, 60);
  v.click("FASTER");
  assert.deepEqual(v.pressed("tempo"), ["72"]);
});

test("the metronome button turns the clicks on for the run only: a note-less timeline at the tempo, stopped when the run ends", () => {
  const v = open();
  assert.equal(v.metronome().attrs["aria-pressed"], "false");
  v.metronome().click();
  assert.equal(v.metronome().attrs["aria-pressed"], "true");
  assert.equal(v.engine.calls.some(([n]) => n === "play"), false, "turned on, but nothing runs yet");
  v.click("START");
  const timeline = v.engine.calls.find(([n]) => n === "setTimeline")[1];
  assert.equal(timeline.notes.length, 0, "no note can sound from the click track");
  assert.equal(timeline.silent, false);
  assert.deepEqual(v.engine.calls.filter(([n]) => ["setBpm", "setMetronome", "play"].includes(n)).map((c) => c.slice(0, 2)), [["setBpm", 50], ["setMetronome", true], ["play"]]);
  v.btn("tempo", 72).click();
  assert.deepEqual(v.engine.calls.at(-1).slice(0, 2), ["setBpm", 72], "a new tempo during the run is followed");
  v.pressAll();
  assert.ok(v.engine.calls.some(([n]) => n === "stop"), "the clicks stop when the run ends");
});

test("without the metronome nothing clicks, and leaving stops a running click", () => {
  const v = open();
  v.click("START");
  assert.equal(v.engine.calls.some(([n]) => n === "play"), false);
  const w = open();
  w.metronome().click();
  w.click("START");
  const stops = () => w.engine.calls.filter(([n]) => n === "stop").length;
  w.handle.dispose();
  assert.equal(stops(), 1, "the view closing stops the clicks");
});

test("the circle of fifths shows the selected key and choosing a key regenerates the exercise in it", () => {
  const v = open();
  assert.equal(v.cofKey("C").attrs["aria-pressed"], "true");
  v.cofKey("A").click();
  assert.equal(v.cofKey("A").attrs["aria-pressed"], "true");
  assert.deepEqual(v.expected(), [69], "the A scale starts on A4");
  v.click("START");
  assert.equal(v.text("learn-instruction"), "Right hand: thumb on A (La).");
});

test("a new learner sees C pre-selected with G, D and F marked as next; after a clean C the page opens on G", () => {
  const v = open();
  assert.equal(v.cofKey("C").attrs["aria-pressed"], "true");
  assert.deepEqual(["G", "D", "F"].map((k) => v.cofKey(k).attrs["data-next"]), ["true", "true", "true"]);
  assert.equal(v.cofKey("A").attrs["data-next"], "false");
  const storage = memory();
  writePracticeProgress(storage, clean(emptyPracticeProgress(), "C"));
  const w = open({ storage });
  assert.equal(w.cofKey("G").attrs["aria-pressed"], "true");
  assert.equal(w.cofKey("C").attrs["data-done"], "true");
  assert.deepEqual(["D", "F", "A"].map((k) => w.cofKey(k).attrs["data-next"]), ["true", "true", "true"]);
  assert.ok(w.key(67), "and the G scale is on the keyboard");
});

test("Next key rotation: the choices are circle of fifths, circle of fourths, random and same key; fourths goes C then F", () => {
  const v = open();
  assert.deepEqual(v.seg("rotation").children.map(textOf), ["Circle of fifths", "Circle of fourths", "Random", "Same key"]);
  assert.deepEqual(v.pressed("rotation"), ["circle"]);
  v.btn("rotation", "fourths").click();
  v.click("START");
  v.pressAll();
  v.click("NEXT_KEY");
  assert.equal(v.text("practice-notice"), "Next key: F major");
  assert.equal(v.cofKey("F").attrs["aria-pressed"], "true");
});

test("choosing Same key hides the Next key button after a run", () => {
  const v = open();
  v.btn("rotation", "same").click();
  v.click("START");
  v.pressAll();
  assert.equal(v.root && all(v.root, (n) => n.tag === "button" && n.attrs["data-action"] === "NEXT_KEY").length, 0);
});

test("the progress of the key is on the page: none yet, then the streak, best tempo and runs of this key", () => {
  const v = open();
  assert.equal(v.text("practice-summary-title"), "Your progress in C major");
  assert.deepEqual(v.chips(), []);
  assert.match(textOf(all(v.root, (n) => hasClass(n, "practice-summary"))[0]), /No clean run in C major yet\./);
  let p = clean(clean(clean(emptyPracticeProgress(), "G", 60), "G", 60), "G", 72);
  const storage = memory();
  writePracticeProgress(storage, p);
  const w = open({ storage });
  w.cofKey("G").click();
  assert.deepEqual(w.chips(), ["Best tempo 72", "Clean streak 3", "3 clean runs", "Last practiced 2026-10-10"]);
  w.click("START");
  w.pressAll();
  assert.match(w.chips().join("|"), /Clean streak 4/);
});

test("an unclean run resets the streak on the page and keeps the best tempo", () => {
  const storage = memory();
  writePracticeProgress(storage, clean(clean(clean(emptyPracticeProgress(), "C", 60), "C", 60), "C", 72));
  const v = open({ storage });
  v.cofKey("C").click();
  v.btn("tempo", 88).click();
  v.click("START");
  v.press(61);
  v.pressAll();
  const chips = v.chips();
  assert.ok(chips.includes("Clean streak 0") === false && chips.some((c) => c.startsWith("Best tempo 72")), chips.join("|"));
  const e = readPracticeProgress(storage).exercises["scale-major"].C;
  assert.deepEqual([e.cleanStreak, e.bestTempo], [0, 72]);
});

test("the list has Reset progress with an inline question: No keeps everything, Yes empties it, and no dialog is used", () => {
  const storage = memory();
  writePracticeProgress(storage, clean(emptyPracticeProgress(), "C"));
  const v = open({ id: null, storage });
  const chipsBefore = () => all(v.root, (n) => hasClass(n, "chip")).length;
  assert.ok(chipsBefore() > 0);
  const action = (a) => all(v.root, (n) => n.tag === "button" && n.attrs["data-action"] === a)[0];
  action("RESET").click();
  assert.equal(textOf(all(v.root, (n) => hasClass(n, "practice-reset"))[0]), "Reset all practice progress?YesNo");
  action("RESET_NO").click();
  assert.ok(storage.getItem(PRACTICE_KEY), "No keeps the progress");
  assert.ok(chipsBefore() > 0);
  action("RESET").click();
  action("RESET_YES").click();
  assert.equal(storage.getItem(PRACTICE_KEY), null);
  assert.equal(chipsBefore(), 0, "the summary is empty");
  assert.ok(action("RESET"), "and the question is gone");
});

test("the reset question is in Spanish when Spanish is selected", () => {
  const v = open({ id: null, lang: "es" });
  all(v.root, (n) => n.tag === "button" && n.attrs["data-action"] === "RESET")[0].click();
  assert.equal(textOf(all(v.root, (n) => hasClass(n, "practice-reset"))[0]), "¿Reiniciar todo el progreso de práctica?SíNo");
});

test("exercises that do not rotate keys have no circle and no rotation choice", () => {
  const v = open({ id: "five-finger" });
  assert.ok(v.cofKey("C"), "five-finger rotates keys: it has the circle");
  const ear = open({ id: "ear-intervals" });
  assert.equal(ear.root && all(ear.root, (n) => hasClass(n, "cof")).length, 0);
});

const css = readFileSync(new URL("../../styles/app.css", import.meta.url), "utf8").replaceAll("\r\n", "\n");

test("every position has a CSS rule (no inline style) and the marks are not color only: a ring and a dashed outline", () => {
  for (let i = 0; i < 12; i += 1) assert.match(css, new RegExp(`\\.cof-pos-${i} \\{\\n  left: [\\d.]+%;\\n  top: [\\d.]+%;`), `position ${i}`);
  assert.match(css, /\.cof-key\[data-done="true"\] \{\n  box-shadow: inset/);
  assert.match(css, /\.cof-key\[data-next="true"\] \{\n  outline: 2px dashed/);
  assert.equal(css.includes(".cof-pos-12"), false, "counter-proof: there are twelve positions and no more");
});
