import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { createNoteBus } from "../../src/input/bus.js";
import { createLearnKeyboard } from "../../src/ui/learn-keyboard.js";

function setup({ lang = "en", width = 900, height = 600 } = {}) {
  const doc = fakeDoc();
  doc.createElement = (tag) => doc.make(tag);
  const mount = doc.make("div");
  mount.clientWidth = width;
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} });
  const bus = createNoteBus({ now: () => 0 });
  const queue = [];
  const timers = { setTimeout: (fn, ms) => queue.push({ fn, ms }), clearTimeout: (id) => void (queue[id - 1] = null) };
  const keyboard = createLearnKeyboard({ mount, i18n, bus, doc, timers });
  keyboard.fit({ width, height });
  const root = mount.children[0];
  return { keyboard, bus, queue, root, svg: root.children[0], live: root.children[1] };
}
const keyRect = (svg, midi) => all(svg, (n) => n.tag === "rect" && n.attrs["data-midi"] === String(midi))[0];
const overlayOf = (svg) => all(svg, (n) => n.tag === "g" && n.attrs.class === "lk-overlay")[0];
const inOverlay = (svg, pred) => all(overlayOf(svg), pred);
const hasClass = (n, name) => (n.attrs.class ?? "").split(" ").includes(name);
const fire = (rect, type, extra = {}) => (rect.listeners[type] ?? []).forEach((fn) => fn({ pointerId: 1, button: 0, target: { releasePointerCapture() {} }, preventDefault() {}, ...extra }));

test("the key to press is shaded, outlined and shows its finger number on the key (right hand: a circle)", () => {
  const { keyboard, svg } = setup();
  keyboard.setStepKeys([{ midi: 64, finger: 1, hand: "R" }]);
  assert.ok(hasClass(keyRect(svg, 64), "lk-expected") && hasClass(keyRect(svg, 64), "lk-hand-R"));
  assert.equal(hasClass(keyRect(svg, 62), "lk-expected"), false);
  assert.equal(inOverlay(svg, (n) => n.tag === "circle" && hasClass(n, "lk-badge-R")).length, 1);
  assert.deepEqual(inOverlay(svg, (n) => n.tag === "text" && hasClass(n, "lk-finger")).map((n) => n.textContent), ["1"]);
  assert.equal(inOverlay(svg, (n) => n.tag === "rect" && hasClass(n, "lk-outline")).length, 1, "a single outline for the right hand");
});

test("grayscale check: without any color the expected key still has an outline and a digit; a plain keyboard has neither", () => {
  const { keyboard, svg } = setup();
  assert.equal(inOverlay(svg, (n) => n.tag === "text" || n.tag === "rect").length, 0);
  keyboard.setStepKeys([{ midi: 64, finger: 3, hand: "R" }]);
  assert.ok(inOverlay(svg, (n) => hasClass(n, "lk-outline")).length > 0);
  assert.ok(inOverlay(svg, (n) => n.textContent === "3").length > 0);
});

test("left hand: a rounded square badge and a double outline; hands together name each hand in text", () => {
  const { keyboard, svg } = setup();
  keyboard.setStepKeys([{ midi: 62, finger: 5, hand: "L" }]);
  const badge = inOverlay(svg, (n) => hasClass(n, "lk-badge-L"));
  assert.equal(badge.length, 1);
  assert.equal(badge[0].tag, "rect");
  assert.equal(inOverlay(svg, (n) => n.tag === "rect" && hasClass(n, "lk-outline")).length, 2, "double line");
  keyboard.setStepKeys([{ midi: 62, finger: 5, hand: "L" }, { midi: 64, finger: 1, hand: "R" }]);
  assert.deepEqual(inOverlay(svg, (n) => hasClass(n, "lk-finger")).map((n) => n.textContent), ["L5", "R1"]);
});

test("hands together in Spanish use the Spanish hand letters", () => {
  const { keyboard, svg } = setup({ lang: "es" });
  keyboard.setStepKeys([{ midi: 62, finger: 5, hand: "L" }, { midi: 64, finger: 1, hand: "R" }]);
  assert.deepEqual(inOverlay(svg, (n) => hasClass(n, "lk-finger")).map((n) => n.textContent), ["I5", "D1"]);
});

test("keys of the hand position that are not required show a quiet digit, not a badge", () => {
  const { keyboard, svg } = setup();
  keyboard.setPositionKeys([{ midi: 62, finger: 2, hand: "R" }, { midi: 64, finger: 3, hand: "R" }]);
  keyboard.setStepKeys([{ midi: 64, finger: 3, hand: "R" }]);
  assert.deepEqual(inOverlay(svg, (n) => hasClass(n, "lk-quiet")).map((n) => n.textContent), ["2"]);
  assert.equal(inOverlay(svg, (n) => hasClass(n, "lk-badge")).length, 1);
});

test("computer-key letters are drawn on the mapped keys and follow the map", () => {
  const { keyboard, svg } = setup();
  keyboard.setLetters(new Map([[60, "A"], [61, "W"], [62, "S"]]));
  assert.deepEqual(inOverlay(svg, (n) => hasClass(n, "lk-letter")).map((n) => n.textContent), ["A", "W", "S"]);
  keyboard.setLetters(new Map([[64, "A"]]));
  assert.deepEqual(inOverlay(svg, (n) => hasClass(n, "lk-letter")).map((n) => n.textContent), ["A"]);
  keyboard.setLetters(new Map([[40, "Z"]]));
  assert.equal(inOverlay(svg, (n) => hasClass(n, "lk-letter")).length, 0, "a key outside the region draws nothing and breaks nothing");
});

test("a held key shows pressed from any source and clears on release; a key outside the region breaks nothing", () => {
  const { svg, bus } = setup();
  bus.noteOn(62, { source: "midi" });
  assert.ok(hasClass(keyRect(svg, 62), "lk-pressed"));
  assert.equal(keyRect(svg, 62).attrs.transform, "translate(0 2)");
  bus.noteOn(30, { source: "midi" });
  bus.noteOff(62, { source: "midi" });
  assert.equal(hasClass(keyRect(svg, 62), "lk-pressed"), false);
  assert.equal(keyRect(svg, 62).attrs.transform, "translate(0 0)");
});

test("a wrong key shows hatched with a cross for 1.2 s and the live region says Try again", () => {
  const { keyboard, svg, live, queue } = setup();
  keyboard.flashWrong(65);
  assert.ok(hasClass(keyRect(svg, 65), "lk-wrong"));
  assert.equal(inOverlay(svg, (n) => hasClass(n, "lk-mark-wrong")).length, 1);
  assert.equal(live.textContent, "Try again");
  assert.equal(queue.at(-1).ms, 1200);
  queue.at(-1).fn();
  assert.equal(hasClass(keyRect(svg, 65), "lk-wrong"), false, "the state clears when the time is up");
  assert.equal(inOverlay(svg, (n) => hasClass(n, "lk-mark-wrong")).length, 0);
  assert.equal(all(svg, (n) => n.tag === "pattern" && n.attrs.id === "lk-hatch").length, 1, "the hatch pattern exists");
});

test("a satisfied step shows a check for 0.7 s and the live region says Correct, in Spanish too", () => {
  const { keyboard, svg, live, queue } = setup({ lang: "es" });
  keyboard.flashCorrect([64, 67]);
  assert.equal(inOverlay(svg, (n) => hasClass(n, "lk-mark-correct")).length, 2);
  assert.equal(live.textContent, "Correcto");
  assert.deepEqual(queue.map((q) => q.ms), [700, 700]);
  queue.forEach((q) => q.fn());
  assert.equal(inOverlay(svg, (n) => hasClass(n, "lk-mark-correct")).length, 0);
});

test("the live region is polite and the keys can sound without badges (Listen)", () => {
  const { keyboard, svg, live } = setup();
  assert.equal(live.attrs["aria-live"], "polite");
  keyboard.setSounding([60, 64], "L");
  assert.ok(hasClass(keyRect(svg, 60), "lk-sounding") && hasClass(keyRect(svg, 60), "lk-hand-L"));
  assert.equal(inOverlay(svg, (n) => hasClass(n, "lk-badge")).length, 0);
  keyboard.setSounding([]);
  assert.equal(hasClass(keyRect(svg, 60), "lk-sounding"), false);
});

test("pointer down and up on a key send noteOn and noteOff with the source screen", () => {
  const { svg, bus } = setup();
  const events = [];
  bus.on("noteOn", (e) => events.push(["on", e.midi, e.source]));
  bus.on("noteOff", (e) => events.push(["off", e.midi, e.source]));
  fire(keyRect(svg, 64), "pointerdown");
  fire(keyRect(svg, 64), "pointerup");
  assert.deepEqual(events, [["on", 64, "screen"], ["off", 64, "screen"]]);
});

test("pointer leave and cancel end the note; a second pointer plays a second key", () => {
  const { svg, bus } = setup();
  fire(keyRect(svg, 60), "pointerdown", { pointerId: 1 });
  fire(keyRect(svg, 64), "pointerdown", { pointerId: 2 });
  assert.deepEqual([...bus.held()].sort(), [60, 64]);
  fire(keyRect(svg, 60), "pointerleave", { pointerId: 1 });
  assert.deepEqual([...bus.held()], [64]);
  fire(keyRect(svg, 64), "pointercancel", { pointerId: 2 });
  assert.equal(bus.held().size, 0);
});

test("counter-proof: an up without a down, a non-primary button and a repeated down send nothing extra", () => {
  const { svg, bus } = setup();
  const events = [];
  bus.on("noteOn", () => events.push("on"));
  bus.on("noteOff", () => events.push("off"));
  fire(keyRect(svg, 64), "pointerup");
  fire(keyRect(svg, 64), "pointerdown", { button: 2 });
  assert.deepEqual(events, []);
  fire(keyRect(svg, 64), "pointerdown");
  fire(keyRect(svg, 64), "pointerdown");
  assert.deepEqual(events, ["on"], "the same pointer pressing twice is one note");
});

test("a touch is released from its implicit capture so sliding off the key ends the note", () => {
  const { svg } = setup();
  let released = null;
  fire(keyRect(svg, 64), "pointerdown", { pointerId: 7, target: { releasePointerCapture: (id) => (released = id) } });
  assert.equal(released, 7);
});

test("the same note held by two pointers ends only with the last one", () => {
  const { svg, bus } = setup();
  fire(keyRect(svg, 64), "pointerdown", { pointerId: 1 });
  fire(keyRect(svg, 64), "pointerdown", { pointerId: 2 });
  fire(keyRect(svg, 64), "pointerup", { pointerId: 1 });
  assert.equal(bus.held().has(64), true);
  fire(keyRect(svg, 64), "pointerup", { pointerId: 2 });
  assert.equal(bus.held().has(64), false);
});

test("a language switch while a key is held keeps the note and the pointer working", () => {
  const { svg, bus, keyboard } = setup();
  fire(keyRect(svg, 64), "pointerdown", { pointerId: 1 });
  keyboard.fit({ width: 500 }); // redraws every key
  assert.equal(bus.held().has(64), true);
  fire(keyRect(svg, 64), "pointerup", { pointerId: 1 });
  assert.equal(bus.held().size, 0, "released through the redrawn key");
});

test("dispose clears pending timers and stops following the bus", () => {
  const { keyboard, bus, queue, svg } = setup();
  keyboard.flashWrong(65);
  keyboard.dispose();
  assert.equal(queue.at(-1), null);
  bus.noteOn(60, { source: "midi" });
  assert.equal(hasClass(keyRect(svg, 60), "lk-pressed"), false);
});
