import { test } from "node:test";
import assert from "node:assert/strict";
import { createNoteBus } from "../../src/input/bus.js";

const record = (bus) => {
  const events = [];
  bus.on("noteOn", (e) => events.push(e));
  bus.on("noteOff", (e) => events.push(e));
  return events;
};
const brief = (events) => events.map((e) => `${e.type}:${e.midi}:${e.source}`);

test("the same note from three sources arrives as the same note number, differing only in source", () => {
  const bus = createNoteBus();
  const events = record(bus);
  bus.noteOn(64, { source: "screen" });
  bus.noteOn(64, { source: "computer" });
  bus.noteOn(64, { source: "midi", velocity: 0.4 });
  assert.deepEqual(brief(events), ["noteOn:64:screen", "noteOn:64:computer", "noteOn:64:midi"]);
  assert.equal(events[2].velocity, 0.4);
  assert.equal(events[0].velocity, 0.7, "the default velocity");
  assert.ok(events.every((e) => typeof e.time === "number"));
});

test("a second noteOn of a held (source, midi) is ignored (auto-repeat) and a noteOff of a note that is not held is ignored", () => {
  const bus = createNoteBus();
  const events = record(bus);
  assert.equal(bus.noteOn(60, { source: "computer" }), true);
  assert.equal(bus.noteOn(60, { source: "computer" }), false);
  assert.equal(bus.noteOff(61, { source: "computer" }), false);
  assert.equal(bus.noteOff(60, { source: "midi" }), false, "another source did not press it");
  assert.equal(bus.noteOff(60, { source: "computer" }), true);
  assert.equal(bus.noteOff(60, { source: "computer" }), false);
  assert.deepEqual(brief(events), ["noteOn:60:computer", "noteOff:60:computer"]);
  assert.equal(bus.noteOn(60, { source: "computer" }), true, "after the release it can be pressed again");
});

test("held() is the union over sources and follows presses and releases", () => {
  const bus = createNoteBus();
  bus.noteOn(60, { source: "screen" });
  bus.noteOn(60, { source: "midi" });
  bus.noteOn(64, { source: "computer" });
  assert.deepEqual([...bus.held()].sort(), [60, 64]);
  bus.noteOff(60, { source: "screen" });
  assert.deepEqual([...bus.held()].sort(), [60, 64], "still held by midi");
  bus.noteOff(60, { source: "midi" });
  assert.deepEqual([...bus.held()], [64]);
});

test("releaseAll releases every note, or only those of one source, in press order", () => {
  const bus = createNoteBus();
  bus.noteOn(60, { source: "screen" });
  bus.noteOn(62, { source: "midi" });
  bus.noteOn(64, { source: "screen" });
  const events = record(bus);
  bus.releaseAll("screen");
  assert.deepEqual(brief(events), ["noteOff:60:screen", "noteOff:64:screen"]);
  assert.deepEqual([...bus.held()], [62], "the midi note is untouched");
  bus.releaseAll();
  assert.equal(bus.held().size, 0);
  assert.deepEqual(brief(events).slice(2), ["noteOff:62:midi"]);
});

test("dispose emits noteOff for every held note, then drops the listeners and refuses new notes", () => {
  const bus = createNoteBus();
  bus.noteOn(60, { source: "screen" });
  bus.noteOn(67, { source: "computer" });
  const events = record(bus);
  bus.dispose();
  assert.deepEqual(brief(events), ["noteOff:60:screen", "noteOff:67:computer"]);
  assert.equal(bus.noteOn(72, { source: "screen" }), false, "a disposed bus plays nothing");
  assert.equal(events.length, 2, "and nobody is listening");
});

test("dispatch is synchronous and in subscription order; the held set is already updated when a listener runs", () => {
  const bus = createNoteBus();
  const order = [];
  bus.on("noteOn", () => order.push(["first", [...bus.held()]]));
  bus.on("noteOn", () => order.push(["second", [...bus.held()]]));
  bus.noteOn(60);
  order.push("after");
  assert.deepEqual(order, [["first", [60]], ["second", [60]], "after"]);
});

test("unsubscribe stops delivery, and a throwing listener does not stop the others (its error is rethrown afterwards)", () => {
  const bus = createNoteBus();
  const seen = [];
  const off = bus.on("noteOn", (e) => seen.push(["a", e.midi]));
  bus.on("noteOn", () => {
    throw new Error("listener failed");
  });
  bus.on("noteOn", (e) => seen.push(["c", e.midi]));
  assert.throws(() => bus.noteOn(60), /listener failed/);
  assert.deepEqual(seen, [["a", 60], ["c", 60]], "every listener ran");
  assert.ok(bus.held().has(60), "the note is held even though a listener failed");
  off();
  assert.throws(() => bus.noteOn(61), /listener failed/);
  assert.deepEqual(seen.at(-1), ["c", 61]);
  assert.equal(seen.filter((s) => s[0] === "a").length, 1, "unsubscribed");
  assert.throws(() => bus.on("noteChanged", () => {}), TypeError);
});
