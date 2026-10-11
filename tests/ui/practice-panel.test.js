import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createPractice } from "../../src/ui/practice-controller.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { createPracticePanel } = await import("../../src/ui/practice-panel.js");

const timeline = {
  meter: { num: 4, den: 4 },
  pickupTicks: 0,
  lengthTicks: 7680,
  tempo: { bpm: 72, beatUnit: "quarter" },
  sections: [{ id: "intro", name: "Intro", startTick: 0, endTick: 3840 }],
};
const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const button = (root, label) => all(root, (n) => n.tag === "button" && textOf(n) === label)[0];
const pressed = (root, label) => button(root, label).attrs["aria-pressed"];

function make() {
  let at = 0;
  const calls = { loops: [], hands: [], bpms: [] };
  let bpm = 72;
  const practice = createPractice({
    timeline,
    position: () => at,
    effects: {
      setLoop: (l) => calls.loops.push(l),
      setBpm: (n) => calls.bpms.push((bpm = n)),
      getBpm: () => bpm,
      setHands: (m) => calls.hands.push(structuredClone(m)),
      setRange() {},
      setQuality() {},
    },
  });
  const panel = createPracticePanel({ practice, timeline });
  return { panel, root: panel.element, calls, at: (t) => (at = t) };
}
const output = (root, cls) => textOf(all(root, (n) => n.attrs.class === cls)[0]);

test("the panel starts with Loop not set and nothing pressed", () => {
  const { root } = make();
  assert.equal(output(root, "meta loop-text"), "Loop not set");
  for (const label of ["Loop", "Ramp", "Mute left", "Hide right", "Full 88"]) assert.equal(pressed(root, label), "false", label);
  assert.equal(pressed(root, "Bar"), "true");
});

test("Set A here and Set B here show the normalized range and turn the loop on", () => {
  const { root, at, calls } = make();
  at(1920);
  button(root, "Set A here").click();
  at(3840);
  button(root, "Set B here").click();
  assert.equal(output(root, "meta loop-text"), "Bar 2, beat 1 to bar 2, beat 4");
  assert.equal(pressed(root, "Loop"), "true");
  assert.deepEqual(calls.loops.at(-1), { startTick: 1920, endTick: 3840 });
});

test("Ramp without a loop shows Needs a loop and stays off", () => {
  const { root } = make();
  button(root, "Ramp").click();
  assert.equal(pressed(root, "Ramp"), "false");
  const note = all(root, (n) => n.tag === "p")[0];
  assert.equal(textOf(note), "Needs a loop");
  assert.equal(note.hidden, false);
});

test("counter-proof: with a loop the ramp turns on, the message clears and Hold becomes usable", () => {
  const { root, calls } = make();
  const hold = button(root, "Hold");
  assert.equal(hold.disabled, true, "Hold needs a running ramp");
  button(root, "Set B here").click();
  button(root, "Set A here").click();
  assert.equal(pressed(root, "Loop"), "false", "A and B at the same point make no loop");
  const select = all(root, (n) => n.tag === "select")[0];
  select.value = "intro";
  select.listeners.change[0]();
  button(root, "Ramp").click();
  assert.equal(pressed(root, "Ramp"), "true");
  assert.equal(all(root, (n) => n.tag === "p")[0].hidden, true);
  assert.equal(hold.disabled, false);
  assert.equal(calls.bpms.at(-1), 43, "enabling sets the BPM to start (60 percent of 72)");
  assert.equal(select.value, "", "the section picker returns to its prompt");
});

test("Mute left and Hide right press their own button only and report the hands", () => {
  const { root, calls } = make();
  button(root, "Mute left").click();
  button(root, "Hide right").click();
  assert.equal(pressed(root, "Mute left"), "true");
  assert.equal(pressed(root, "Hide right"), "true");
  assert.equal(pressed(root, "Mute right"), "false");
  assert.deepEqual(calls.hands.at(-1), { L: { muted: true, hidden: false }, R: { muted: false, hidden: true } });
});
