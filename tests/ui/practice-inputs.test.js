import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { createPracticeInputs } = await import("../../src/ui/practice-inputs.js");

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), data };
};
function fakeWin() {
  const listeners = {};
  return {
    document: globalThis.document,
    navigator: { language: "en" },
    isSecureContext: true,
    listeners,
    addEventListener: (t, f) => (listeners[t] ??= []).push(f),
    removeEventListener: (t, f) => void (listeners[t] = (listeners[t] ?? []).filter((x) => x !== f)),
  };
}
const fakeEngine = () => {
  const calls = [];
  return { calls, startNote: (m) => calls.push(["startNote", m]), releaseNote: (m) => calls.push(["releaseNote", m]), dispose: () => calls.push(["dispose"]) };
};
const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => {} });

function setup() {
  const win = fakeWin();
  const engine = fakeEngine();
  const inputs = createPracticeInputs({ i18n, win, storage: memory(), makeEngine: () => engine });
  return { win, engine, inputs };
}
const keydown = (code, extra = {}) => ({ code, ctrlKey: false, altKey: false, metaKey: false, repeat: false, target: {}, preventDefault() {}, ...extra });

test("a note on the bus sounds through the engine first, and its release stops it", () => {
  const { engine, inputs } = setup();
  inputs.bus.noteOn(60, { source: "screen" });
  inputs.bus.noteOff(60, { source: "screen" });
  assert.deepEqual(engine.calls, [["startNote", 60], ["releaseNote", 60]]);
  inputs.dispose();
});

test("the computer keys play the key of the current map, and a new map moves them", () => {
  const { win, engine, inputs } = setup();
  inputs.setKeyMap(new Map([["KeyA", 60]]));
  win.listeners.keydown[0](keydown("KeyA"));
  inputs.setKeyMap(new Map([["KeyA", 67]]));
  win.listeners.keyup[0]({ code: "KeyA" });
  win.listeners.keydown[0](keydown("KeyA"));
  assert.deepEqual(engine.calls, [["startNote", 60], ["releaseNote", 60], ["startNote", 67]], "the key-up releases the note it pressed, not the one of the new map");
  win.listeners.keydown[0](keydown("KeyZ"));
  assert.equal(engine.calls.length, 3, "an unmapped key does nothing");
  inputs.dispose();
});

test("the input panel is there with the computer keys on and the MIDI chip, and MIDI sound is off by default", () => {
  const { inputs } = setup();
  const text = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(text).join(""));
  assert.match(text(inputs.panel.element), /Computer keys: on/);
  assert.match(text(inputs.panel.element), /MIDI:/);
  assert.equal(inputs.panel.midiSound(), false);
  inputs.bus.noteOn(61, { source: "midi" });
  inputs.dispose();
});

test("MIDI notes do not sound from the app unless the learner turned that on (counter-proof of the learner sound rule)", () => {
  const { engine, inputs } = setup();
  inputs.bus.noteOn(62, { source: "midi" });
  assert.deepEqual(engine.calls, [], "MIDI with the setting off calls nothing on the engine");
  inputs.bus.noteOn(64, { source: "screen" });
  assert.deepEqual(engine.calls, [["startNote", 64]]);
  inputs.dispose();
});

test("the printed letters start as the US ones and the page is told when the layout map answers; nothing after dispose", async () => {
  const win = fakeWin();
  win.navigator = { keyboard: { getLayoutMap: async () => new Map([["Semicolon", "ñ"]]) } };
  const inputs = createPracticeInputs({ i18n, win, storage: memory(), makeEngine: fakeEngine });
  assert.equal(inputs.legend().size, 0, "empty until the layout map answers");
  let told = 0;
  inputs.onLegend(() => (told += 1));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(told, 1);
  assert.equal(inputs.legend().get("Semicolon"), "Ñ");
  assert.equal(inputs.legend().get("KeyA"), "A");
  const late = createPracticeInputs({ i18n, win, storage: memory(), makeEngine: fakeEngine });
  let lateTold = 0;
  late.onLegend(() => (lateTold += 1));
  late.dispose();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(lateTold, 0, "a disposed page is not told");
  inputs.dispose();
});

test("dispose removes the key listeners, disposes the engine and releases held notes", () => {
  const { win, engine, inputs } = setup();
  inputs.setKeyMap(new Map([["KeyA", 60]]));
  win.listeners.keydown[0](keydown("KeyA"));
  inputs.dispose();
  assert.ok(engine.calls.some(([n]) => n === "dispose"));
  assert.equal((win.listeners.keydown ?? []).length, 0);
  assert.ok(engine.calls.some(([n, m]) => n === "releaseNote" && m === 60), "the held key was released");
});
