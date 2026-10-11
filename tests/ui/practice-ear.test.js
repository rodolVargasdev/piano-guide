import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { PRACTICE_KEY, earGrown, emptyPracticeProgress, readPracticeProgress, withEarGrown, writePracticeProgress } from "../../src/practice/progress.js";
import { exerciseById } from "../../src/practice/catalog.js";
import { initEar, reduceEar } from "../../src/practice/ear.js";

const doc = fakeDoc();
const bodyAttrs = {};
globalThis.document = {
  createElement: (t) => doc.make(t),
  createElementNS: (ns, t) => doc.make(t),
  createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }),
  body: { setAttribute: (k, v) => (bodyAttrs[k] = v), removeAttribute: (k) => delete bodyAttrs[k] },
};
const { createEarPage } = await import("../../src/ui/practice-ear.js");
const { practiceView } = await import("../../src/ui/practice-view.js");

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k], data };
};
function fakeWin() {
  const listeners = {};
  return {
    document: globalThis.document, innerWidth: 1200, innerHeight: 800, navigator: { language: "en" }, isSecureContext: true, listeners,
    addEventListener: (t, f) => (listeners[t] ??= []).push(f),
    removeEventListener: (t, f) => void (listeners[t] = (listeners[t] ?? []).filter((x) => x !== f)),
    setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  };
}
const fakeEngine = () => {
  const calls = [];
  return { calls, startNote: (m) => calls.push(["startNote", m]), releaseNote: (m) => calls.push(["releaseNote", m]), playNotes: (n) => calls.push(["playNotes", n]), dispose: () => calls.push(["dispose"]) };
};
const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const hasClass = (n, c) => (n.attrs.class ?? "").split(" ").includes(c);

function open({ id = "ear-intervals", lang = "en", seed = 1, storage = memory(), engine = fakeEngine(), win = fakeWin() } = {}) {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });
  const page = createEarPage({ i18n, win, storage, exercise: exerciseById(id), makeEngine: () => engine, seed });
  const root = page.element;
  const q = (pred) => all(root, pred);
  const api = {
    page, root, engine, storage, i18n, win,
    text: (cls) => textOf(q((n) => hasClass(n, cls))[0] ?? { tag: "#text", text: "" }),
    actions: () => q((n) => n.tag === "button" && n.attrs["data-action"]).map((n) => n.attrs["data-action"]),
    click: (a) => q((n) => n.tag === "button" && n.attrs["data-action"] === a)[0].click(),
    option: (id2) => q((n) => n.tag === "button" && n.attrs["data-option"] === id2)[0],
    options: () => q((n) => n.tag === "button" && n.attrs["data-option"]).map((n) => n.attrs["data-option"]),
    status: (id2) => api.option(id2).attrs["data-status"],
    key: (midi) => q((n) => n.tag === "rect" && n.attrs["data-midi"] === String(midi))[0],
    press(midi) {
      (api.key(midi).listeners.pointerdown ?? []).forEach((f) => f({ pointerId: 1, button: 0, target: { releasePointerCapture() {} }, preventDefault() {} }));
      (api.key(midi).listeners.pointerup ?? []).forEach((f) => f({ pointerId: 1 }));
    },
    plays: () => engine.calls.filter(([n]) => n === "playNotes").map(([, notes]) => notes),
    phase: () => root.attrs["data-phase"],
    answer: () => initEar({ kind: id === "ear-chords" ? "chord" : "interval", seed }).question.answer,
  };
  return api;
}
const SIZE = { M3: 4, P5: 7, P8: 12 };

test("the page opens waiting for Play with the choices as buttons, a two-octave keyboard and nothing shaded (no clue)", () => {
  const v = open();
  assert.equal(v.text("learn-instruction"), "Press Play to hear it.");
  assert.deepEqual(v.actions(), ["LISTEN"]);
  assert.deepEqual(v.options(), ["M3", "P5", "P8"]);
  assert.equal(v.plays().length, 0, "nothing sounds until the learner asks");
  assert.equal(all(v.root, (n) => n.tag === "rect" && hasClass(n, "lk-expected")).length, 0);
  assert.equal(all(v.root, (n) => n.tag === "rect" && n.attrs["data-midi"] !== undefined && !hasClass(n, "lk-black")).length, 14, "C4 to B5: fourteen white keys");
  assert.equal(bodyAttrs["data-route"], "practice-run");
});

test("Play and Listen again play the question through the engine, as many times as asked, with no penalty", () => {
  const v = open();
  v.click("LISTEN");
  assert.equal(v.plays().length, 1);
  assert.equal(v.plays()[0].length, 2);
  assert.equal(v.text("learn-instruction"), "How far apart are the two notes?");
  for (let i = 0; i < 4; i += 1) v.click("LISTEN");
  assert.equal(v.plays().length, 5);
  assert.deepEqual(v.plays()[4], v.plays()[0], "the same question every time");
  assert.equal(v.text("learn-progress"), "Question 1 of 10");
});

test("a wrong button says Try again and strikes that choice; a second one reveals the right one by name and tag", () => {
  const v = open();
  v.click("LISTEN");
  const answer = v.answer();
  const [first, second] = v.options().filter((o) => o !== answer);
  v.option(first).click();
  assert.equal(v.text("learn-chip"), "Try again");
  assert.equal(v.status(first), "wrong");
  assert.equal(v.status(answer), "idle", "the answer stays hidden after one wrong pick");
  v.option(second).click();
  assert.equal(v.phase(), "revealed");
  assert.equal(v.status(answer), "right");
  assert.match(v.text("learn-instruction"), /^It was: /);
  assert.deepEqual(v.actions(), ["NEXT", "LISTEN"]);
});

test("the right button says Correct with the score; Next question plays a new question and the count goes up", () => {
  const v = open();
  v.click("LISTEN");
  v.option(v.answer()).click();
  assert.equal(v.text("learn-chip"), "Correct");
  assert.equal(v.text("learn-progress"), "Question 1 of 10 | Score 1/1");
  v.click("NEXT");
  assert.equal(v.plays().length, 2, "the new question is played at once, inside the click");
  assert.notDeepEqual(v.plays()[1], v.plays()[0]);
  assert.equal(v.text("learn-progress"), "Question 2 of 10 | Score 1/1");
  assert.equal(v.phase(), "asking");
});

test("playing it back on the keyboard answers it: the right distance in any octave is Correct, a wrong one is Try again", () => {
  const v = open();
  v.click("LISTEN");
  const size = SIZE[v.answer()];
  const wrongSize = size === 4 ? 7 : 4;
  v.press(60);
  v.press(60 + wrongSize);
  assert.equal(v.text("learn-chip"), "Try again");
  assert.equal(v.phase(), "asking");
  v.press(62);
  v.press(62 + size);
  assert.equal(v.phase(), "answered");
  assert.equal(v.text("learn-chip"), "Correct");
  assert.equal(v.status(v.answer()), "right");
  assert.ok(v.engine.calls.some(([n, m]) => n === "startNote" && m === 62), "the learner's own keys sound");
});

test("a chord drill takes the three notes of the chord in any order and octave", () => {
  const v = open({ id: "ear-chords", seed: 4 });
  v.click("LISTEN");
  assert.deepEqual(v.options(), ["major", "minor"]);
  assert.equal(v.text("learn-instruction"), "What kind of chord is it?");
  const q = initEar({ kind: "chord", seed: 4 }).question;
  const notes = q.notes.map((n) => n.midi);
  // The learner plays the chord one octave lower than it sounded, from the top down, on the visible keys.
  const onScreen = (m) => ((((m - 60) % 12) + 12) % 12) + 60;
  for (const m of [...notes].reverse()) v.press(onScreen(m));
  assert.equal(v.phase(), "answered");
});

// The page asks the questions of its seed in order, so a mirror of the reducer knows each answer without reading the page.
function playRound(v, { right }) {
  let mirror = initEar({ kind: "interval", seed: 1 });
  for (let i = 0; i < 10; i += 1) {
    v.click("LISTEN");
    const answer = mirror.question.answer;
    if (right) v.option(answer).click();
    else for (const o of v.options().filter((x) => x !== answer).slice(0, 2)) v.option(o).click();
    v.click("NEXT");
    const picks = right ? [answer] : mirror.question.options.filter((x) => x !== answer).slice(0, 2);
    for (const p of picks) mirror = reduceEar(mirror, { type: "ANSWER", id: p }).state;
    mirror = reduceEar(mirror, { type: "NEXT" }).state;
  }
}

test("a perfect round unlocks the perfect fourth: the count, the choice saved, the round a clean run, and the next round offers it", () => {
  const storage = memory();
  const v = open({ storage });
  playRound(v, { right: true });
  assert.equal(v.phase(), "roundDone");
  assert.equal(v.text("learn-instruction"), "Round finished: 10/10.");
  assert.equal(v.text("learn-sub"), "New choice unlocked: Perfect fourth.");
  assert.deepEqual(v.actions(), ["ROUND"]);
  const saved = readPracticeProgress(storage);
  assert.equal(earGrown(saved, "ear-intervals"), 1);
  const entry = saved.exercises["ear-intervals"]["-"];
  assert.deepEqual([entry.cleanRuns, entry.cleanStreak], [1, 1], "a round of 8 or more is a clean run");
  v.click("ROUND");
  assert.deepEqual(v.options(), ["M3", "P4", "P5", "P8"]);
  assert.equal(v.text("learn-progress"), "Question 1 of 10");
  assert.ok(v.plays().length > 10, "the new round is played at once");
});

test("a weak round (every question missed twice) unlocks nothing, says how to unlock, and is not a clean run", () => {
  const storage = memory();
  const v = open({ storage });
  playRound(v, { right: false });
  assert.equal(v.text("learn-instruction"), "Round finished: 0/10.");
  assert.equal(v.text("learn-sub"), "Get 8 of 10 right to unlock a new choice.");
  const saved = readPracticeProgress(storage);
  assert.equal(earGrown(saved, "ear-intervals"), 0);
  const entry = saved.exercises["ear-intervals"]["-"];
  assert.deepEqual([entry.cleanRuns, entry.cleanStreak], [0, 0]);
  v.click("ROUND");
  assert.deepEqual(v.options(), ["M3", "P5", "P8"], "still the three starting choices");
});

test("the unlocked choices come back on the next visit: a saved count of 2 starts with five choices", () => {
  const storage = memory();
  writePracticeProgress(storage, withEarGrown(emptyPracticeProgress(), "ear-intervals", 2));
  const v = open({ storage });
  assert.deepEqual(v.options(), ["m3", "M3", "P4", "P5", "P8"]);
  assert.equal(earGrown(readPracticeProgress(storage), "ear-intervals"), 2);
});

test("Spanish: the buttons, the question and the score; a language switch in the middle keeps the question, the pick and the count", () => {
  const v = open({ lang: "es" });
  v.click("LISTEN");
  assert.equal(v.text("learn-instruction"), "¿Qué tan separadas están las dos notas?");
  assert.deepEqual(v.options().map((o) => textOf(v.option(o).children[0])), ["Tercera mayor", "Quinta justa", "Octava"]);
  const wrong = v.options().find((o) => o !== v.answer());
  v.option(wrong).click();
  const before = v.plays().length;
  v.i18n.setLang("en");
  assert.equal(v.text("learn-instruction"), "How far apart are the two notes?");
  assert.equal(v.status(wrong), "wrong", "the pick survives the switch");
  assert.equal(v.plays().length, before, "the question is not played again by a language change");
  v.option(v.answer()).click();
  assert.equal(v.text("learn-progress"), "Question 1 of 10 | Score 0/1");
});

test("through the practice view: the ear drills open this page and the routine opens its own", () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => assert.fail("missing") });
  const root = doc.make("div");
  const handle = practiceView({ i18n, win: fakeWin(), storage: memory(), makeEngine: fakeEngine })({ songId: "ear-chords" }, root);
  assert.equal(all(root, (n) => hasClass(n, "practice-ear")).length, 1);
  handle.dispose();
  const routine = doc.make("div");
  practiceView({ i18n, win: fakeWin(), storage: memory(), makeEngine: fakeEngine })({ songId: "routine" }, routine);
  assert.equal(all(routine, (n) => hasClass(n, "practice-ear")).length, 0);
  assert.equal(all(routine, (n) => hasClass(n, "routine")).length, 1);
});

test("leaving releases everything: engine disposed, listeners and the page marker gone", () => {
  const v = open();
  v.page.dispose();
  assert.ok(v.engine.calls.some(([n]) => n === "dispose"));
  assert.equal(bodyAttrs["data-route"], undefined);
  assert.equal((v.win.listeners.keydown ?? []).length, 0);
  assert.equal(createEarPage({ i18n: createI18n({ table: STRINGS, navigatorLanguage: "en" }), win: fakeWin(), storage: memory(), exercise: exerciseById("scale-major"), makeEngine: fakeEngine }), null, "not an ear drill");
  assert.equal(memory().getItem(PRACTICE_KEY), null);
});
