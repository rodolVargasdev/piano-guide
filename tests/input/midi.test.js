import { test } from "node:test";
import assert from "node:assert/strict";
import { createMidiInput, deviceName, parseMidiMessage } from "../../src/input/midi.js";
import { createNoteBus } from "../../src/input/bus.js";

const port = (name, manufacturer = "", extra = {}) => ({ id: name, name, manufacturer, state: "connected", onmidimessage: null, ...extra });
const send = (p, bytes) => p.onmidimessage({ data: Uint8Array.from(bytes) });

/** A fake navigator whose requestMIDIAccess resolves (or rejects) when the test says so. */
function fakeNavigator({ inputs = [], fail = null } = {}) {
  const access = { inputs: new Map(inputs.map((p) => [p.id, p])), onstatechange: null };
  const nav = {
    calls: [],
    access,
    requestMIDIAccess(options) {
      nav.calls.push(options);
      return fail ? Promise.reject(fail) : Promise.resolve(access);
    },
    plug(p) {
      access.inputs.set(p.id, p);
      access.onstatechange?.({ port: p });
    },
    unplug(p) {
      access.inputs.delete(p.id);
      access.onstatechange?.({ port: p });
    },
  };
  return nav;
}
function setup(navOptions, { isSecureContext = true, navigator = fakeNavigator(navOptions) } = {}) {
  const bus = createNoteBus();
  const events = [];
  bus.on("noteOn", (e) => events.push(`on:${e.midi}:${e.source}:${e.velocity.toFixed(2)}`));
  bus.on("noteOff", (e) => events.push(`off:${e.midi}:${e.source}`));
  const states = [];
  const midi = createMidiInput({ navigator, isSecureContext, bus, onState: (s) => states.push(s) });
  return { navigator, bus, events, states, midi };
}

test("parseMidiMessage: note on with velocity scaled to 0..1, note off, and note on with velocity 0 as a release", () => {
  assert.deepEqual(parseMidiMessage([0x90, 60, 127]), { type: "on", midi: 60, velocity: 1 });
  assert.equal(parseMidiMessage([0x90, 60, 64]).velocity.toFixed(3), "0.504");
  assert.deepEqual(parseMidiMessage([0x80, 60, 40]), { type: "off", midi: 60, velocity: 0 });
  assert.deepEqual(parseMidiMessage([0x90, 60, 0]), { type: "off", midi: 60, velocity: 0 });
  assert.deepEqual(parseMidiMessage([0x95, 72, 90]).type, "on", "any channel");
  assert.deepEqual(parseMidiMessage(Uint8Array.from([0x83, 72, 10])).type, "off", "typed arrays like the browser sends");
});

test("parseMidiMessage ignores everything that is not a note: pedal, pitch bend, clock, sensing, short and malformed messages", () => {
  for (const bytes of [[0xb0, 64, 127], [0xe0, 0, 64], [0xf8], [0xfe], [0x90, 60], [0x90], [], [0x90, 200, 64], [0x90, 60, 200], [0xc0, 5, 0]]) {
    assert.equal(parseMidiMessage(bytes), null, JSON.stringify(bytes));
  }
  assert.equal(parseMidiMessage(null), null);
  assert.equal(parseMidiMessage(undefined), null);
});

test("deviceName puts the manufacturer first, without repeating it", () => {
  assert.equal(deviceName(port("CDP-S100", "Casio")), "Casio CDP-S100");
  assert.equal(deviceName(port("Casio CDP-S100", "Casio")), "Casio CDP-S100");
  assert.equal(deviceName(port("CDP-S100", "")), "CDP-S100");
  assert.equal(deviceName(port("", "Casio")), "Casio");
  assert.equal(deviceName({}), "MIDI input");
});

test("initial states: unsupported, insecure and idle, and nothing asks for permission before connect()", () => {
  assert.equal(setup({}, { navigator: {} }).midi.state(), "unsupported");
  assert.equal(setup({}, { navigator: null }).midi.state(), "unsupported");
  const insecure = setup({}, { isSecureContext: false });
  assert.equal(insecure.midi.state(), "insecure");
  const idle = setup();
  assert.equal(idle.midi.state(), "idle");
  assert.equal(idle.navigator.calls.length, 0, "no permission request at load");
  assert.equal(insecure.navigator.calls.length, 0);
});

test("connect() on an unsupported or insecure page does nothing and never asks", async () => {
  const insecure = setup({}, { isSecureContext: false });
  assert.equal(await insecure.midi.connect(), "insecure");
  assert.equal(insecure.navigator.calls.length, 0);
  const unsupported = setup({}, { navigator: {} });
  assert.equal(await unsupported.midi.connect(), "unsupported");
});

test("connect() asks once, without sysex, passes through requesting, and lists the device with its manufacturer", async () => {
  const { midi, navigator, states } = setup({ inputs: [port("CDP-S100", "Casio")] });
  assert.equal(await midi.connect(), "connected");
  assert.deepEqual(navigator.calls, [{ sysex: false }]);
  assert.deepEqual(states.map((s) => s.state), ["requesting", "connected"]);
  assert.deepEqual(midi.names(), ["Casio CDP-S100"]);
  assert.deepEqual(states.at(-1).names, ["Casio CDP-S100"]);
});

test("a second connect() while the first is pending does not ask again", async () => {
  const { midi, navigator } = setup({ inputs: [port("A")] });
  const first = midi.connect();
  assert.equal(midi.state(), "requesting");
  const second = midi.connect();
  await Promise.all([first, second]);
  assert.equal(navigator.calls.length, 1);
  assert.equal(midi.state(), "connected");
});

test("permission denied or dismissed gives denied; any other failure gives unavailable; neither throws", async () => {
  for (const name of ["SecurityError", "NotAllowedError"]) {
    const { midi } = setup({ fail: Object.assign(new Error("no"), { name }) });
    assert.equal(await midi.connect(), "denied", name);
  }
  const broken = setup({ fail: new Error("boom") });
  assert.equal(await broken.midi.connect(), "unavailable");
  assert.deepEqual(broken.midi.names(), []);
});

test("granted with no input is no-device (a Casio that exposes only USB audio), and pressing Connect again rescans", async () => {
  const { midi, navigator } = setup();
  assert.equal(await midi.connect(), "no-device");
  navigator.access.inputs.set("X", port("X"));
  assert.equal(await midi.connect(), "connected", "rescan finds the device without asking again");
  assert.equal(navigator.calls.length, 1);
});

test("notes from the device reach the bus with the midi source; velocity 0, pedal and clock behave as specified", async () => {
  const dev = port("CDP-S100", "Casio");
  const { midi, events } = setup({ inputs: [dev] });
  await midi.connect();
  send(dev, [0x90, 64, 100]);
  send(dev, [0xb0, 64, 127]); // sustain pedal: ignored
  send(dev, [0xf8]); // clock: ignored
  send(dev, [0x90, 64, 0]); // velocity 0: a release
  send(dev, [0x90, 67, 50]);
  send(dev, [0x80, 67, 0]);
  assert.deepEqual(events, ["on:64:midi:0.79", "off:64:midi", "on:67:midi:0.39", "off:67:midi"]);
});

test("every input is listened to, including one plugged in after connecting (hot-plug, no reload)", async () => {
  const a = port("A");
  const { midi, navigator, events, states } = setup({ inputs: [a] });
  await midi.connect();
  const b = port("B", "Maker");
  navigator.plug(b);
  assert.deepEqual(midi.names(), ["A", "Maker B"]);
  assert.equal(states.at(-1).state, "connected");
  send(a, [0x90, 60, 64]);
  send(b, [0x90, 62, 64]);
  assert.equal(events.filter((e) => e.startsWith("on:")).length, 2);
});

test("plugging the device in after granting with none: no-device becomes connected", async () => {
  const { midi, navigator } = setup();
  assert.equal(await midi.connect(), "no-device");
  navigator.plug(port("CDP-S100", "Casio"));
  assert.equal(midi.state(), "connected");
  assert.deepEqual(midi.names(), ["Casio CDP-S100"]);
});

test("unplugging mid-lesson releases the held midi notes, shows no-device, and leaves other sources alone", async () => {
  const dev = port("CDP-S100", "Casio");
  const { midi, navigator, bus, events } = setup({ inputs: [dev] });
  await midi.connect();
  send(dev, [0x90, 60, 80]);
  bus.noteOn(72, { source: "computer" });
  navigator.unplug(dev);
  assert.equal(midi.state(), "no-device");
  assert.deepEqual(midi.names(), []);
  assert.deepEqual([...bus.held()], [72], "only the midi note was released");
  assert.ok(events.includes("off:60:midi"));
  assert.equal(dev.onmidimessage, null, "the gone port is no longer listened to");
});

test("a port that reports itself disconnected while still listed counts as gone", async () => {
  const dev = port("A");
  const { midi, navigator } = setup({ inputs: [dev] });
  await midi.connect();
  dev.state = "disconnected";
  navigator.access.onstatechange({ port: dev });
  assert.equal(midi.state(), "no-device");
});

test("dispose stops listening, releases held notes and ignores later changes and a late permission answer", async () => {
  const dev = port("A");
  const { midi, navigator, bus, states } = setup({ inputs: [dev] });
  await midi.connect();
  send(dev, [0x90, 60, 80]);
  midi.dispose();
  assert.equal(bus.held().size, 0);
  assert.equal(dev.onmidimessage, null);
  assert.equal(navigator.access.onstatechange, null);
  const before = states.length;
  navigator.plug(port("B"));
  assert.equal(states.length, before, "no state change after dispose");
  const late = setup({ inputs: [port("C")] });
  const pending = late.midi.connect();
  late.midi.dispose();
  await pending;
  assert.equal(late.states.at(-1).state, "requesting", "the late answer is dropped");
});
