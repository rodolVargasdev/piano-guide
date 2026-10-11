import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { PRACTICE_KEY, readPracticeProgress } from "../../src/practice/progress.js";

const doc = fakeDoc();
const bodyAttrs = {};
globalThis.document = {
  createElement: (t) => doc.make(t),
  createElementNS: (ns, t) => doc.make(t),
  createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }),
  body: { setAttribute: (k, v) => (bodyAttrs[k] = v), removeAttribute: (k) => delete bodyAttrs[k] },
};
const { practiceView } = await import("../../src/ui/practice-view.js");

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k], data };
};
function fakeWin() {
  const listeners = {};
  const timers = [];
  return {
    document: globalThis.document,
    innerWidth: 1200,
    innerHeight: 800,
    navigator: { language: "en" },
    isSecureContext: true,
    listeners,
    timers,
    addEventListener: (t, f) => (listeners[t] ??= []).push(f),
    removeEventListener: (t, f) => void (listeners[t] = (listeners[t] ?? []).filter((x) => x !== f)),
    fire: (t, ev = {}) => (listeners[t] ?? []).forEach((f) => f(ev)),
    setTimeout: (fn, ms) => (timers.push({ fn, ms }), timers.length),
    clearTimeout: () => {},
    flush() {
      while (timers.length) timers.shift().fn();
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  };
}
function fakeEngine() {
  const calls = [];
  return {
    calls,
    startNote: (midi) => calls.push(["startNote", midi]),
    releaseNote: (midi) => calls.push(["releaseNote", midi]),
    playNotes: (notes) => calls.push(["playNotes", notes]),
    stopNotes: () => calls.push(["stopNotes"]),
    dispose: () => calls.push(["dispose"]),
  };
}

const textOfNode = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOfNode).join(""));
const hasClass = (n, cls) => (n.attrs.class ?? "").split(" ").includes(cls);

function open({ id = "scale-major", lang = "en", storage = memory(), engine = fakeEngine(), win = fakeWin() } = {}) {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });
  const root = doc.make("div");
  const handle = practiceView({ i18n, win, storage, makeEngine: () => engine })({ songId: id }, root);
  const q = (pred) => all(root, pred);
  const api = {
    root, win, engine, storage, i18n, handle,
    text: (cls) => textOfNode(q((n) => hasClass(n, cls))[0] ?? { tag: "#text", text: "" }),
    actions: () => q((n) => n.tag === "button" && n.attrs["data-action"]).map((n) => n.attrs["data-action"]),
    action: (a) => q((n) => n.tag === "button" && n.attrs["data-action"] === a)[0],
    click: (a) => api.action(a).click(),
    key: (midi) => q((n) => n.tag === "rect" && n.attrs["data-midi"] === String(midi))[0],
    expected: () => q((n) => n.tag === "rect" && hasClass(n, "lk-expected")).map((n) => Number(n.attrs["data-midi"])),
    down: (midi, pointerId = 1) => (api.key(midi).listeners.pointerdown ?? []).forEach((f) => f({ pointerId, button: 0, target: { releasePointerCapture() {} }, preventDefault() {} })),
    up: (midi, pointerId = 1) => (api.key(midi).listeners.pointerup ?? []).forEach((f) => f({ pointerId })),
    press(midi) {
      api.down(midi);
      api.up(midi);
    },
    phase: () => q((n) => n.attrs["data-phase"] && hasClass(n, "practice-run"))[0]?.attrs["data-phase"],
    choice: (name, value) => q((n) => n.tag === "div" && n.attrs["data-choice"] === name)[0].children.find((b) => b.attrs["data-value"] === String(value)),
    pressAll() {
      let guard = 0;
      while (api.phase() === "running" && guard++ < 100) for (const m of api.expected()) api.press(m);
    },
  };
  return api;
}

test("a scale page starts ready: the goal in one sentence, Start and Listen, the first key shaded with its finger, the choices", () => {
  const v = open();
  assert.equal(v.phase(), "ready");
  assert.equal(v.text("learn-instruction"), "Play the notes of a major scale in order, with the standard fingering.");
  assert.deepEqual(v.actions(), ["START", "LISTEN"]);
  assert.deepEqual(v.expected(), [60], "the first key is shaded so the learner sees where to begin");
  assert.deepEqual(["hand", "octaves", "direction"].map((c) => v.choice(c, c === "hand" ? "R" : c === "octaves" ? 1 : "up").attrs["aria-pressed"]), ["true", "true", "true"]);
  assert.equal(bodyAttrs["data-route"], "practice-run");
});

test("Start shows one step at a time with its finger; each right key says Correct and moves on; a press sounds", () => {
  const v = open();
  v.click("START");
  assert.equal(v.phase(), "running");
  assert.equal(v.text("learn-instruction"), "Right hand: thumb on C (Do).");
  assert.equal(v.text("learn-progress"), "Step 1 of 8 | Tempo 50");
  assert.deepEqual(v.actions(), ["STOP"]);
  v.press(60);
  assert.equal(v.text("learn-chip"), "Correct");
  assert.equal(v.text("learn-instruction"), "Right hand: index finger on D (Re).");
  assert.deepEqual(v.expected(), [62]);
  assert.ok(v.engine.calls.some(([n, m]) => n === "startNote" && m === 60), "the learner's own press sounds");
});

test("a wrong key says Try again and Use the shaded key, the shaded key stays, and the run ends not clean and is recorded so", () => {
  const v = open();
  v.click("START");
  v.press(61);
  assert.equal(v.text("learn-chip"), "Try again");
  assert.equal(v.text("learn-chip-detail"), "Use the shaded key.");
  assert.deepEqual(v.expected(), [60]);
  v.pressAll();
  assert.equal(v.phase(), "done");
  assert.equal(v.text("learn-instruction"), "Finished, with 1 wrong key. Try again for a clean run.");
  assert.deepEqual(v.actions(), ["AGAIN", "NEXT_KEY", "LISTEN"], "no tempo step and no next hand after an unclean run");
  const entry = readPracticeProgress(v.storage).exercises["scale-major"].C;
  assert.deepEqual([entry.cleanStreak, entry.cleanRuns, entry.bestTempo], [0, 0, 0]);
});

test("a clean run ends with Correct, the next tempo to try, and Again, Faster, Next hand, Next key and Listen; the run is saved", () => {
  const v = open();
  v.click("START");
  v.pressAll();
  assert.equal(v.phase(), "done");
  assert.equal(v.text("learn-instruction"), "Clean run: no wrong key. Well done.");
  assert.equal(v.text("learn-sub"), "Next tempo to try: 60.");
  assert.equal(v.text("learn-chip"), "Correct");
  assert.deepEqual(v.actions(), ["AGAIN", "FASTER", "NEXT_STAGE", "NEXT_KEY", "LISTEN"]);
  const entry = readPracticeProgress(v.storage).exercises["scale-major"].C;
  assert.deepEqual([entry.cleanStreak, entry.cleanRuns, entry.bestTempo], [1, 1, 50]);
});

test("Again restarts at step 1 in the same key and tempo; Faster starts at the suggested tempo", () => {
  const v = open();
  v.click("START");
  v.pressAll();
  v.click("AGAIN");
  assert.equal(v.text("learn-progress"), "Step 1 of 8 | Tempo 50");
  v.pressAll();
  v.click("FASTER");
  assert.equal(v.text("learn-progress"), "Step 1 of 8 | Tempo 60");
});

test("Next key announces the next key in one line and shows its scale: G major with the F sharp", () => {
  const v = open();
  v.click("START");
  v.pressAll();
  v.click("NEXT_KEY");
  assert.equal(v.text("practice-notice"), "Next key: G major");
  assert.equal(v.text("learn-instruction"), "Right hand: thumb on G (Sol).");
  assert.deepEqual(v.expected(), [67]);
  v.pressAll();
  assert.equal(v.phase(), "done");
  assert.deepEqual(Object.keys(readPracticeProgress(v.storage).exercises["scale-major"]).sort(), ["C", "G"], "each key has its own record");
});

test("the next hand stage: after the right hand comes the left hand, and its first key is the left C with the little finger", () => {
  const v = open();
  v.click("START");
  v.pressAll();
  v.click("NEXT_STAGE");
  assert.equal(v.text("practice-notice"), "Now: left hand");
  assert.equal(v.text("learn-instruction"), "Left hand: little finger on C (Do).");
  assert.deepEqual(v.expected(), [48]);
});

test("Listen plays the generated notes through the engine one beat apart and returns to ready when it ends; Stop cancels it", () => {
  const v = open();
  v.click("LISTEN");
  assert.equal(v.phase(), "listening");
  assert.equal(v.text("learn-instruction"), "Listen.");
  assert.deepEqual(v.actions(), ["STOP"]);
  const [, notes] = v.engine.calls.find(([n]) => n === "playNotes");
  assert.equal(notes.length, 8);
  assert.deepEqual(notes.slice(0, 2).map((n) => [n.midi, n.at]), [[60, 0], [62, 1.2]]);
  v.win.flush();
  assert.equal(v.phase(), "ready");
  v.click("LISTEN");
  v.click("STOP");
  assert.equal(v.phase(), "ready");
  assert.ok(v.engine.calls.some(([n]) => n === "stopNotes"));
});

test("changing a choice generates the exercise again: two octaves have 15 steps, the left hand starts on its own C", () => {
  const v = open();
  v.choice("octaves", 2).click();
  v.click("START");
  assert.equal(v.text("learn-progress"), "Step 1 of 15 | Tempo 50");
  v.click("STOP");
  v.choice("hand", "L").click();
  assert.deepEqual(v.expected(), [48]);
  v.choice("hand", "T").click();
  assert.deepEqual(v.expected(), [48, 60], "hands together: both hands' first keys are shaded");
  v.click("START");
  assert.equal(v.text("learn-instruction"), "Both hands: thumb on C (Do) right, little finger on C (Do) left.");
  v.press(60);
  assert.deepEqual(v.expected(), [48, 60], "one hand is not the whole step");
  v.press(48);
  assert.deepEqual(v.expected(), [50, 62]);
});

test("a chord exercise asks for the keys together: three keys, in any order, then the next chord", () => {
  const v = open({ id: "triads" });
  v.click("START");
  assert.equal(v.text("learn-instruction"), "Right hand: thumb on C (Do). Press these 3 keys together.");
  assert.deepEqual(v.expected(), [60, 64, 67]);
  v.press(67);
  v.press(60);
  assert.deepEqual(v.expected(), [60, 64, 67], "still the same chord");
  v.press(64);
  assert.deepEqual(v.expected(), [64, 67, 72], "the first inversion");
});

test("a progression shows its chord symbol and asks for the left hand root with the right hand chord", () => {
  const v = open({ id: "progression-i-v-vi-iv" });
  v.click("START");
  assert.equal(v.text("learn-sub"), "Chord: C");
  assert.deepEqual(v.expected(), [48, 60, 64, 67]);
  assert.match(v.text("learn-instruction"), /^Both hands: /);
});

test("Suggested fingering is shown only where the books disagree: left hand arpeggio over two octaves", () => {
  const v = open({ id: "arpeggios" });
  assert.equal(all(v.root, (n) => hasClass(n, "practice-flag"))[0].hidden, true, "hidden for the right hand");
  v.choice("hand", "L").click();
  v.choice("octaves", 2).click();
  const flag = all(v.root, (n) => hasClass(n, "practice-flag"))[0];
  assert.equal(flag.hidden, false);
  assert.match(textOfNode(flag), /Suggested fingering/);
  assert.match(textOfNode(flag), /Books do not agree/);
});

test("language switch in the middle of a scale keeps the step, the key and the pressed keys, and translates the text", () => {
  const v = open();
  v.choice("octaves", 2).click();
  v.click("START");
  v.press(60);
  v.press(62);
  const before = v.expected();
  v.i18n.setLang("es");
  assert.deepEqual(v.expected(), before);
  assert.equal(v.text("learn-progress"), "Paso 3 de 15 | Tempo 50");
  assert.equal(v.text("learn-instruction"), "Mano derecha: dedo medio en Mi (E).");
  assert.equal(v.text("practice-title"), "Escalas mayores");
  assert.equal(v.phase(), "running");
  v.press(64);
  assert.equal(v.text("learn-progress"), "Paso 4 de 15 | Tempo 50");
});

test("a chord in progress survives the language switch: the keys already pressed still count", () => {
  const v = open({ id: "triads" });
  v.click("START");
  v.press(60);
  v.i18n.setLang("es");
  v.press(64);
  v.press(67);
  assert.deepEqual(v.expected(), [64, 67, 72], "the chord was completed across the switch");
});

test("keys pressed before Start only sound; the run does not begin and nothing is recorded", () => {
  const v = open();
  v.press(60);
  assert.equal(v.phase(), "ready");
  assert.ok(v.engine.calls.some(([n]) => n === "startNote"));
  assert.equal(v.storage.getItem(PRACTICE_KEY), null);
});

test("leaving releases everything: the engine is disposed, the listeners are gone and a key afterwards does nothing", () => {
  const v = open();
  v.click("START");
  v.handle.dispose();
  assert.ok(v.engine.calls.some(([n]) => n === "dispose"));
  assert.equal(bodyAttrs["data-route"], undefined);
  assert.equal((v.win.listeners.resize ?? []).length, 0);
  assert.equal((v.win.listeners.keydown ?? []).length, 0);
});

test("the page text never uses innerHTML: the source is scanned (counter-proof for markup in the strings)", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["practice-run.js", "practice-screen.js", "practice-inputs.js", "practice-doc.js"]) {
    assert.equal(/innerHTML|insertAdjacentHTML|outerHTML/.test(readFileSync(new URL(`../../src/ui/${f}`, import.meta.url), "utf8")), false, f);
  }
});
