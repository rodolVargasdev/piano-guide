import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { readPracticeProgress } from "../../src/practice/progress.js";
import { buildRoutine } from "../../src/practice/routine.js";
import { initEar } from "../../src/practice/ear.js";
import { emptyPracticeProgress } from "../../src/practice/progress.js";

const doc = fakeDoc();
const bodyAttrs = {};
globalThis.document = {
  createElement: (t) => doc.make(t),
  createElementNS: (ns, t) => doc.make(t),
  createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }),
  body: { setAttribute: (k, v) => (bodyAttrs[k] = v), removeAttribute: (k) => delete bodyAttrs[k] },
};
const { createRoutinePage, blockLine } = await import("../../src/ui/practice-routine.js");
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
const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const hasClass = (n, c) => (n.attrs.class ?? "").split(" ").includes(c);

function open({ lang = "en", day = "2026-10-10", storage = memory(), win = fakeWin() } = {}) {
  const engines = [];
  const makeEngine = () => {
    const calls = [];
    engines.push(calls);
    return { startNote: (m) => calls.push(["startNote", m]), releaseNote() {}, playNotes: (n) => calls.push(["playNotes", n]), dispose: () => calls.push(["dispose"]) };
  };
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });
  const page = createRoutinePage({ i18n, win, storage, makeEngine, today: () => day, seed: 1 });
  const root = page.element;
  const q = (pred) => all(root, pred);
  const api = {
    page, root, i18n, storage, engines, win,
    phase: () => root.attrs["data-phase"],
    action: (a) => q((n) => n.tag === "button" && n.attrs["data-action"] === a)[0],
    click: (a) => api.action(a).click(),
    visible: (a) => { const b = api.action(a); return b !== undefined && b.hidden !== true; },
    key: (midi) => q((n) => n.tag === "rect" && n.attrs["data-midi"] === String(midi))[0],
    expected: () => q((n) => n.tag === "rect" && hasClass(n, "lk-expected")).map((n) => Number(n.attrs["data-midi"])),
    press(midi) {
      (api.key(midi).listeners.pointerdown ?? []).forEach((f) => f({ pointerId: 1, button: 0, target: { releasePointerCapture() {} }, preventDefault() {} }));
      (api.key(midi).listeners.pointerup ?? []).forEach((f) => f({ pointerId: 1 }));
    },
    list: () => q((n) => n.tag === "li" && n.parent && hasClass(n.parent, "routine-list")).map(textOf),
    steps: () => q((n) => hasClass(n, "routine-step")).map((n) => `${textOf(n.children[0])}:${n.attrs["data-status"]}`),
    now: () => textOf(q((n) => hasClass(n, "routine-now"))[0] ?? { tag: "#text", text: "" }),
    // Plays the run block on the page to its end with every right key.
    playRun() {
      api.click("START");
      let guard = 0;
      while (guard++ < 100 && api.visible("STOP")) for (const m of api.expected()) api.press(m);
    },
    // Answers one ear question right (the page asks the questions of its seed: the first one of seed 1 + block index).
    answerEar(seed) {
      const kind = api.now().includes("chord") || api.now().includes("Hear the chord") ? "chord" : "interval";
      const answer = initEar({ kind, seed }).question.answer;
      api.click("LISTEN");
      q((n) => n.tag === "button" && n.attrs["data-option"] === answer)[0].click();
    },
  };
  return api;
}
const finishRoutine = (v, { skip = [] } = {}) => {
  v.click("START_ROUTINE");
  for (let i = 0; i < 4; i += 1) {
    if (skip.includes(i)) v.click("SKIP_BLOCK");
    else {
      if (i < 3) v.playRun();
      else v.answerEar(1 + 3);
      v.click("NEXT_BLOCK");
    }
  }
};

test("the intro for a new learner lists today's four things with keys and minutes, the total, and Start", () => {
  const v = open();
  assert.equal(v.phase(), "intro");
  const lines = v.list();
  assert.equal(lines.length, 4);
  assert.equal(lines[0], "Warm-up: Five-finger patterns in C major, 2 minutes");
  assert.equal(lines[1], "Scale: Major scales in C major, 3 minutes");
  assert.match(lines[2], /^Chords: .* in C major, 3 minutes$/);
  assert.match(lines[3], /^Ear: Hear the (interval|chord), 2 minutes$/);
  assert.match(textOf(v.root), /About 10 minutes/);
  assert.equal(v.visible("START_ROUTINE"), true);
  assert.equal(textOf(v.root).includes("day in a row"), false, "no streak yet");
});

test("the page marks the route (so the header language selector is hidden, the page has its own) and unmarks it on leaving", () => {
  const v = open();
  assert.equal(bodyAttrs["data-route"], "practice-run");
  v.page.dispose();
  assert.equal(bodyAttrs["data-route"], undefined);
});

test("Start opens the first block: Block 1 of 4, the step marks, the warm-up page without its own title bar, and Skip", () => {
  const v = open();
  v.click("START_ROUTINE");
  assert.equal(v.phase(), "block");
  assert.match(textOf(v.root), /Block 1 of 4/);
  assert.equal(v.now(), "Warm-up: Five-finger patterns in C major, 2 minutes");
  assert.deepEqual(v.steps(), ["Warm-up:current", "Scale:pending", "Chords:pending", "Ear:pending"]);
  assert.equal(all(v.root, (n) => hasClass(n, "practice-compact")).length, 1);
  assert.equal(all(v.root, (n) => n.tag === "h2" && hasClass(n, "practice-title")).length, 1, "only the routine has a title bar");
  assert.equal(v.visible("SKIP_BLOCK"), true);
  assert.equal(v.visible("NEXT_BLOCK"), false, "Next block waits for the run to end");
});

test("playing the warm-up to its end shows Next block; it moves on to the scale as Block 2 of 4 with the warm-up done", () => {
  const v = open();
  v.click("START_ROUTINE");
  v.playRun();
  assert.equal(v.visible("NEXT_BLOCK"), true);
  assert.equal(v.action("NEXT_KEY"), undefined, "the routine fixes the key of the block: no Next key inside it");
  v.click("NEXT_BLOCK");
  assert.match(textOf(v.root), /Block 2 of 4/);
  assert.equal(v.now(), "Scale: Major scales in C major, 3 minutes");
  assert.deepEqual(v.steps(), ["Warm-up:done", "Scale:current", "Chords:pending", "Ear:pending"]);
  assert.equal(v.visible("NEXT_BLOCK"), false, "the new block starts waiting");
  assert.ok(v.engines[0].some(([n]) => n === "dispose"), "the first block page was disposed");
});

test("Skip block marks the block skipped and moves on at any moment", () => {
  const v = open();
  v.click("START_ROUTINE");
  v.click("SKIP_BLOCK");
  assert.deepEqual(v.steps(), ["Warm-up:skipped", "Scale:current", "Chords:pending", "Ear:pending"]);
});

test("a whole routine: four blocks done, the summary with each block, 1 day in a row, and the day recorded with the keys", () => {
  const storage = memory();
  const v = open({ storage });
  finishRoutine(v);
  assert.equal(v.phase(), "summary");
  const text = textOf(v.root);
  assert.match(text, /Routine finished/);
  assert.match(text, /Warm-up: Five-finger patterns in C major, 2 minutes: Done/);
  assert.match(text, /Scale: Major scales in C major, 3 minutes: Done/);
  assert.match(text, /Today counts: 1 day in a row\./);
  const p = readPracticeProgress(storage);
  assert.deepEqual([p.routine.lastDate, p.routine.dayStreak, p.routine.lastWarmupKey], ["2026-10-10", 1, "C"]);
  assert.equal(p.routine.scaleLastPracticed.C, "2026-10-10");
});

test("skipping the ear block after three done still records the day", () => {
  const storage = memory();
  const v = open({ storage });
  finishRoutine(v, { skip: [3] });
  assert.match(textOf(v.root), /Ear: .*: Skipped/);
  assert.match(textOf(v.root), /Today counts: 1 day in a row\./);
  assert.equal(readPracticeProgress(storage).routine.dayStreak, 1);
});

test("skipping all four records nothing: the summary says so and the saved day streak is untouched", () => {
  const storage = memory();
  const v = open({ storage });
  finishRoutine(v, { skip: [0, 1, 2, 3] });
  assert.equal(v.phase(), "summary");
  assert.match(textOf(v.root), /Every block was skipped, so today does not count\./);
  assert.equal(textOf(v.root).includes("Today counts"), false);
  const p = readPracticeProgress(storage);
  assert.deepEqual([p.routine.lastDate, p.routine.dayStreak], [null, 0]);
});

test("the next day: the scale and the warm-up are in G, yesterday's streak is shown, and finishing makes 2 days in a row", () => {
  const storage = memory();
  finishRoutine(open({ storage }));
  const v = open({ storage, day: "2026-10-11" });
  const lines = v.list();
  assert.equal(lines[0], "Warm-up: Five-finger patterns in G major, 2 minutes");
  assert.equal(lines[1], "Scale: Major scales in G major, 3 minutes");
  assert.match(textOf(v.root), /1 day in a row/);
  finishRoutine(v);
  assert.match(textOf(v.root), /Today counts: 2 days in a row\./);
});

test("opening it again on the same day says you practiced today, and a second finish does not add a day", () => {
  const storage = memory();
  finishRoutine(open({ storage }));
  const v = open({ storage });
  assert.match(textOf(v.root), /You practiced today\./);
  finishRoutine(v);
  assert.equal(readPracticeProgress(storage).routine.dayStreak, 1);
});

test("Spanish: the intro, the blocks and the summary with 1 día seguido", () => {
  const v = open({ lang: "es" });
  assert.equal(v.list()[0], "Calentamiento: Patrones de cinco dedos en C mayor, 2 minutos");
  assert.match(textOf(v.root), /Unos 10 minutos/);
  finishRoutine(v);
  assert.match(textOf(v.root), /Hoy cuenta: 1 día seguido\./);
  assert.match(textOf(v.root), /Rutina terminada/);
});

test("a language switch in the middle of a block keeps the block, the step and the keys already pressed", () => {
  const v = open();
  v.click("START_ROUTINE");
  v.click("START");
  v.press(60);
  v.i18n.setLang("es");
  assert.match(textOf(v.root), /Bloque 1 de 4/);
  assert.equal(v.now(), "Calentamiento: Patrones de cinco dedos en C mayor, 2 minutos");
  assert.deepEqual(v.expected(), [62], "still on the second key of the pattern");
  assert.equal(v.steps()[0], "Calentamiento:current");
});

test("through the practice view the routine opens, and leaving disposes the block page", () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => assert.fail("missing") });
  const engines = [];
  const root = doc.make("div");
  const handle = practiceView({ i18n, win: fakeWin(), storage: memory(), makeEngine: () => ((engines.push([]), { startNote() {}, releaseNote() {}, playNotes() {}, dispose: () => engines.at(-1).push("dispose") })) })({ songId: "routine" }, root);
  assert.equal(all(root, (n) => hasClass(n, "routine")).length, 1);
  all(root, (n) => n.tag === "button" && n.attrs["data-action"] === "START_ROUTINE")[0].click();
  assert.equal(engines.length, 1);
  handle.dispose();
  assert.deepEqual(engines[0], ["dispose"]);
});

test("block lines say the exercise, the key and the minutes; the ear block has no key", () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en" });
  const r = buildRoutine(emptyPracticeProgress(), "2026-10-10");
  assert.equal(blockLine(r.blocks[0], i18n.t), "Warm-up: Five-finger patterns in C major, 2 minutes");
  assert.match(blockLine(r.blocks[3], i18n.t), /^Ear: Hear the (interval|chord), 2 minutes$/);
});

test("a date that is not a day gives no page", () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en" });
  assert.equal(createRoutinePage({ i18n, win: fakeWin(), storage: memory(), makeEngine: () => ({}), today: () => "later" }), null);
});
