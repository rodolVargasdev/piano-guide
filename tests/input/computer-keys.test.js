import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_ROW, UPPER_ROW, attachComputerKeys, keyMapFor, legendFor } from "../../src/input/computer-keys.js";
import { createNoteBus } from "../../src/input/bus.js";

const C4 = 60;
const E4 = 64;
const WIDE = { low: 48, high: 84 }; // C3 to C6
const asPairs = (map) => [...map].map(([code, midi]) => `${code}=${midi}`);

/** A stand-in for window: records listeners and dispatches events to them. */
function fakeTarget(doc = { hidden: false, listeners: {}, addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }, removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter((x) => x !== f); } }) {
  const listeners = {};
  return {
    document: doc,
    listeners,
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    removeEventListener: (type, fn) => void (listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn)),
    dispatch(type, event) {
      for (const fn of [...(listeners[type] ?? [])]) fn(event);
      return event;
    },
  };
}
const keyEvent = (code, extra = {}) => ({ code, repeat: false, ctrlKey: false, altKey: false, metaKey: false, target: { tagName: "BODY" }, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });

function setup(map = keyMapFor(WIDE, C4)) {
  const target = fakeTarget();
  const bus = createNoteBus();
  const events = [];
  bus.on("noteOn", (e) => events.push(`on:${e.midi}:${e.source}`));
  bus.on("noteOff", (e) => events.push(`off:${e.midi}:${e.source}`));
  const state = { map };
  const detach = attachComputerKeys({ target, bus, getMap: () => state.map });
  return { target, bus, events, state, detach, down: (code, extra) => target.dispatch("keydown", keyEvent(code, extra)), up: (code, extra) => target.dispatch("keyup", keyEvent(code, extra)) };
}

test("keyMapFor from C4: eleven white keys on the home row and the black keys between them on the row above", () => {
  const map = keyMapFor(WIDE, C4);
  assert.deepEqual(HOME_ROW.map((c) => map.get(c)), [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77], "C D E F G A B C D E F");
  assert.deepEqual(asPairs(map).filter((p) => UPPER_ROW.includes(p.split("=")[0])), ["KeyW=61", "KeyE=63", "KeyT=66", "KeyY=68", "KeyU=70", "KeyO=73", "KeyP=75"]);
  assert.equal(map.has("KeyR"), false, "no black key between E and F");
  assert.equal(map.has("KeyI"), false, "no black key between B and C");
  assert.equal(map.has("BracketLeft"), false, "no black key between E and F");
});

test("keyMapFor from E4 starts the home row on E and places the black keys accordingly", () => {
  const map = keyMapFor(WIDE, E4);
  assert.deepEqual(HOME_ROW.map((c) => map.get(c)), [64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81]);
  assert.equal(map.has("KeyW"), false, "no black key between E and F");
  assert.deepEqual([map.get("KeyE"), map.get("KeyR"), map.get("KeyT"), map.get("KeyU")], [66, 68, 70, 73]);
});

test("the map stays inside the region: an anchor below it is raised, one near the top is moved down, a small region is mapped whole", () => {
  assert.equal(keyMapFor({ low: 60, high: 84 }, 40).get("KeyA"), 60, "raised to the region");
  const top = keyMapFor({ low: 60, high: 84 }, 83);
  assert.equal(top.size > 0 && [...top.values()].every((m) => m >= 60 && m <= 84), true);
  assert.equal(HOME_ROW.filter((c) => top.has(c)).length, 11, "all eleven white keys still fit by moving down");
  const small = keyMapFor({ low: 57, high: 71 }, 60); // A3 to B4: nine white keys
  assert.deepEqual(HOME_ROW.filter((c) => small.has(c)).length, 9);
  assert.equal(small.get("KeyA"), 57);
  for (const [anchor, region] of [[C4, WIDE], [30, WIDE], [100, WIDE], [62, { low: 60, high: 72 }]]) {
    assert.ok([...keyMapFor(region, anchor).values()].every((m) => m >= region.low && m <= region.high), `anchor ${anchor}`);
  }
});

test("pressing the mapped key plays the note on the bus with the computer source, and releasing it releases the note", () => {
  const { down, up, events } = setup();
  down("KeyD"); // E4 from C4
  up("KeyD");
  assert.deepEqual(events, [`on:${E4}:computer`, `off:${E4}:computer`]);
});

test("a mapped key is prevented from its normal behavior; an unmapped key, or one with a modifier, is left alone", () => {
  const { down, events } = setup();
  assert.equal(down("KeyD").defaultPrevented, true);
  assert.equal(down("KeyZ").defaultPrevented, false, "unmapped");
  assert.equal(down("KeyR", {}).defaultPrevented, false, "mapped to no note from C4 (no black key between E and F)");
  assert.equal(events.length, 1);
});

test("Ctrl, Alt and Meta combinations make no note and keep the browser shortcut (Ctrl+R reloads)", () => {
  const { down, events } = setup();
  for (const mod of ["ctrlKey", "altKey", "metaKey"]) {
    const e = down("KeyR", { [mod]: true });
    assert.equal(e.defaultPrevented, false, mod);
    const f = down("KeyA", { [mod]: true });
    assert.equal(f.defaultPrevented, false, mod);
  }
  assert.deepEqual(events, []);
});

test("typing in a text, number, select or contenteditable control makes no note and is not prevented", () => {
  const { down, events } = setup();
  for (const target of [{ tagName: "INPUT" }, { tagName: "TEXTAREA" }, { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }]) {
    assert.equal(down("KeyA", { target }).defaultPrevented, false, JSON.stringify(target));
  }
  assert.deepEqual(events, []);
  down("KeyA", { target: { tagName: "BUTTON" } });
  assert.equal(events.length, 1, "counter-proof: a button is not a text control");
});

test("auto-repeat emits one noteOn until the key is released", () => {
  const { down, up, events } = setup();
  down("KeyA");
  down("KeyA", { repeat: true });
  down("KeyA", { repeat: true });
  assert.deepEqual(events, [`on:${C4}:computer`]);
  up("KeyA");
  down("KeyA");
  assert.equal(events.length, 3, "released and pressed again: a new note");
});

test("the note released is the one pressed, even if the map moved between key-down and key-up", () => {
  const { down, up, events, state } = setup();
  down("KeyA"); // C4
  state.map = keyMapFor(WIDE, E4); // the region moved: KeyA is now E4
  up("KeyA");
  down("KeyA");
  up("KeyA");
  assert.deepEqual(events, [`on:${C4}:computer`, `off:${C4}:computer`, `on:${E4}:computer`, `off:${E4}:computer`]);
});

test("a key-up releases the note even after Ctrl was pressed or focus moved to an input", () => {
  const { down, up, events } = setup();
  down("KeyA");
  up("KeyA", { ctrlKey: true, target: { tagName: "INPUT" } });
  assert.deepEqual(events, [`on:${C4}:computer`, `off:${C4}:computer`]);
});

test("losing focus or hiding the page releases every held computer note, but not notes of other sources", () => {
  const a = setup();
  a.down("KeyA");
  a.down("KeyD");
  a.bus.noteOn(72, { source: "midi" });
  a.target.dispatch("blur", {});
  assert.deepEqual(a.events.slice(3), [`off:${C4}:computer`, `off:${E4}:computer`]);
  assert.deepEqual([...a.bus.held()], [72], "the midi note is not ours to release");
  const b = setup();
  b.down("KeyA");
  b.target.document.hidden = false;
  b.target.document.listeners.visibilitychange.forEach((f) => f());
  assert.equal(b.events.length, 1, "counter-proof: a visibility event while visible releases nothing");
  b.target.document.hidden = true;
  b.target.document.listeners.visibilitychange.forEach((f) => f());
  assert.deepEqual(b.events.slice(1), [`off:${C4}:computer`]);
});

test("detach removes every listener and releases held notes", () => {
  const { down, events, detach, target } = setup();
  down("KeyA");
  detach();
  assert.deepEqual(events, [`on:${C4}:computer`, `off:${C4}:computer`]);
  assert.ok(Object.values(target.listeners).every((l) => l.length === 0));
  assert.equal(target.document.listeners.visibilitychange.length, 0);
  target.dispatch("keydown", keyEvent("KeyA"));
  assert.equal(events.length, 2, "nobody is listening");
});

test("legendFor prints the letter on the learner's keycap (a Spanish layout shows its own letter) and falls back to the US table", async () => {
  const spanish = { keyboard: { getLayoutMap: async () => new Map([["Semicolon", "ñ"], ["KeyA", "a"], ["KeyQ", "dead"]]) } };
  const legend = await legendFor(["KeyA", "Semicolon", "KeyS"], spanish);
  assert.deepEqual([...legend], [["KeyA", "A"], ["Semicolon", "Ñ"], ["KeyS", "S"]], "KeyS is missing from the layout map and uses the US label");
  assert.deepEqual([...(await legendFor(["Semicolon", "BracketLeft"], {}))], [["Semicolon", ";"], ["BracketLeft", "["]], "no layout map");
  const failing = { keyboard: { getLayoutMap: async () => { throw new Error("blocked"); } } };
  assert.equal((await legendFor(["Quote"], failing)).get("Quote"), "'", "a rejected promise never rejects the legend");
});
