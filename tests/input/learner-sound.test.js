import { test } from "node:test";
import assert from "node:assert/strict";
import { MIDI_SOUND_KEY, createLearnerSound, readMidiSound, writeMidiSound } from "../../src/input/learner-sound.js";
import { createNoteBus } from "../../src/input/bus.js";

function setup({ midiSound = false, throwing = false } = {}) {
  const bus = createNoteBus();
  const calls = [];
  const engine = {
    startNote: (midi, opts) => {
      calls.push(["start", midi, opts?.vel]);
      if (throwing) throw new Error("no Web Audio");
    },
    releaseNote: (midi) => calls.push(["release", midi]),
  };
  const settings = { midiSound: () => midiSound, set: (v) => (midiSound = v) };
  const sound = createLearnerSound({ bus, engine, settings });
  return { bus, calls, settings, sound };
}
const memory = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), data };
};

test("screen and computer keys sound at once and are released with the key", () => {
  const { bus, calls } = setup();
  bus.noteOn(60, { source: "screen" });
  bus.noteOn(64, { source: "computer" });
  bus.noteOff(60, { source: "screen" });
  bus.noteOff(64, { source: "computer" });
  assert.deepEqual(calls, [["start", 60, 0.7], ["start", 64, 0.7], ["release", 60], ["release", 64]]);
});

test("MIDI is silent by default: the Casio already sounds, so the app calls nothing on the engine (counter-proof of the next test)", () => {
  const { bus, calls } = setup({ midiSound: false });
  bus.noteOn(60, { source: "midi", velocity: 0.9 });
  bus.noteOff(60, { source: "midi" });
  assert.deepEqual(calls, []);
});

test("with the MIDI sound setting on, MIDI notes sound with their velocity; the setting is read at every press", () => {
  const { bus, calls, settings } = setup({ midiSound: true });
  bus.noteOn(60, { source: "midi", velocity: 0.9 });
  bus.noteOff(60, { source: "midi" });
  settings.set(false);
  bus.noteOn(62, { source: "midi" });
  bus.noteOff(62, { source: "midi" });
  assert.deepEqual(calls, [["start", 60, 0.9], ["release", 60]]);
});

test("a note started while the setting was on is released even if the setting is switched off before the key-up", () => {
  const { bus, calls, settings } = setup({ midiSound: true });
  bus.noteOn(60, { source: "midi" });
  settings.set(false);
  bus.noteOff(60, { source: "midi" });
  assert.deepEqual(calls.map((c) => c[0]), ["start", "release"], "no stuck note");
});

test("wrong keys sound like any key: the rule never consults a matcher and nothing waits for one", () => {
  const { bus, calls } = setup();
  for (const midi of [21, 60, 61, 108]) bus.noteOn(midi, { source: "computer" });
  assert.equal(calls.length, 4);
});

test("the same note from two sources is released only when the last source lets go", () => {
  const { bus, calls } = setup({ midiSound: true });
  bus.noteOn(60, { source: "screen" });
  bus.noteOn(60, { source: "midi" });
  bus.noteOff(60, { source: "screen" });
  assert.deepEqual(calls.filter((c) => c[0] === "release"), [], "midi still holds it");
  bus.noteOff(60, { source: "midi" });
  assert.deepEqual(calls.filter((c) => c[0] === "release"), [["release", 60]]);
});

test("an engine without Web Audio does not break the press: the bus still delivers to every other consumer", () => {
  const { bus } = setup({ throwing: true });
  const seen = [];
  bus.on("noteOn", (e) => seen.push(e.midi));
  assert.doesNotThrow(() => bus.noteOn(60, { source: "screen" }));
  assert.deepEqual(seen, [60]);
});

test("dispose stops listening and releases what is still sounding", () => {
  const { bus, calls, sound } = setup();
  bus.noteOn(60, { source: "screen" });
  sound.dispose();
  assert.deepEqual(calls.at(-1), ["release", 60]);
  const count = calls.length;
  bus.noteOn(62, { source: "screen" });
  assert.equal(calls.length, count, "no longer subscribed");
});

test("the MIDI sound setting is remembered: default off, on after being written, off for a blocked or odd store", () => {
  const store = memory();
  assert.equal(readMidiSound(store), false);
  assert.equal(writeMidiSound(store, true), true);
  assert.equal(store.data[MIDI_SOUND_KEY], "on");
  assert.equal(readMidiSound(store), true, "still on after a reload");
  writeMidiSound(store, false);
  assert.equal(readMidiSound(store), false);
  assert.equal(readMidiSound(memory({ [MIDI_SOUND_KEY]: "yes" })), false, "only the value we write turns it on");
  const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } };
  assert.equal(readMidiSound(blocked), false);
  assert.equal(writeMidiSound(blocked, true), false);
});
