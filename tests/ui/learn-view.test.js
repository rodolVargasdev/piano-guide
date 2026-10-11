import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { BAR, Q, learnSong, note } from "../fixtures/learn-songs.js";

const doc = fakeDoc();
globalThis.document = {
  createElement: (t) => doc.make(t),
  createElementNS: (ns, t) => doc.make(t),
  createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }),
  body: { setAttribute() {}, removeAttribute() {} },
};
const { learnView, learnableLevels } = await import("../../src/ui/learn-view.js");

// Phrase 1: C4, D4, chord C4 E4 G4. Phrase 2: E4. Left hand: C3 in phrase 1.
const NOTES = [note(0, Q, "C4"), note(Q, Q, "D4"), note(2 * Q, Q, "C4"), note(2 * Q, Q, "E4"), note(2 * Q, Q, "G4"), note(BAR, Q, "E4"), note(0, 2 * Q, "C3", "L")];
const LEARN = { phrases: [{ id: "a", startTick: 0, endTick: BAR }, { id: "b", startTick: BAR, endTick: 2 * BAR }], transposeTo: ["G"] };
const makeSong = (extra = {}) => ({ ...learnSong({ notes: NOTES, bars: 2, learn: LEARN }).song, ...extra });
const privateSong = () => makeSong({ visibility: "private" });

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), data };
};
function fakeWin() {
  const listeners = {};
  return {
    document: globalThis.document,
    innerWidth: 1200,
    innerHeight: 800,
    navigator: { language: "en" },
    isSecureContext: true,
    listeners,
    addEventListener: (t, f) => (listeners[t] ??= []).push(f),
    removeEventListener: (t, f) => void (listeners[t] = (listeners[t] ?? []).filter((x) => x !== f)),
    fire: (t, ev = {}) => (listeners[t] ?? []).forEach((f) => f(ev)),
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  };
}
function fakeEngine() {
  const calls = [];
  let resolveRange = null;
  return {
    calls,
    startNote: (midi) => calls.push(["startNote", midi]),
    releaseNote: (midi) => calls.push(["releaseNote", midi]),
    setTimeline: () => calls.push(["setTimeline"]),
    playRange: (r) => (calls.push(["playRange", r.startTick, r.endTick, r.hand]), new Promise((res) => (resolveRange = res))),
    stopRange: () => calls.push(["stopRange"]),
    position: () => ({ tick: 0 }),
    dispose: () => calls.push(["dispose"]),
    finishRange: (status = "completed") => resolveRange?.({ status }),
  };
}

const textOfNode = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOfNode).join(""));
const hasClass = (n, cls) => (n.attrs.class ?? "").split(" ").includes(cls);
const later = () => new Promise((r) => setTimeout(r, 0));

async function open({ song = makeSong(), lang = "en", storage = memory(), level = null, engine = fakeEngine(), win = fakeWin() } = {}) {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} });
  const root = doc.make("div");
  const entry = { id: song.id, title: song.title };
  const view = learnView({ i18n, load: async () => ({ error: null, entries: [{ entry, status: "ok", song }] }), makeEngine: () => engine, win, storage });
  const handle = view({ songId: song.id, level }, root);
  await later();
  const q = (pred) => all(root, pred);
  const api = {
    root, win, engine, storage, i18n, handle,
    text: (cls) => textOfNode(q((n) => hasClass(n, cls))[0] ?? { tag: "#text", text: "" }),
    action: (id) => q((n) => n.tag === "button" && n.attrs["data-action"] === id)[0],
    actions: () => q((n) => n.tag === "button" && n.attrs["data-action"]).map((n) => n.attrs["data-action"]),
    click: (id) => api.action(id).click(),
    key: (midi) => q((n) => n.tag === "rect" && n.attrs["data-midi"] === String(midi))[0],
    expected: () => q((n) => n.tag === "rect" && hasClass(n, "lk-expected")).map((n) => Number(n.attrs["data-midi"])),
    down: (midi, pointerId = 1) => (api.key(midi).listeners.pointerdown ?? []).forEach((f) => f({ pointerId, button: 0, target: { releasePointerCapture() {} }, preventDefault() {} })),
    up: (midi, pointerId = 1) => (api.key(midi).listeners.pointerup ?? []).forEach((f) => f({ pointerId })),
    press(midi, id = 1) {
      api.down(midi, id);
      api.up(midi, id);
    },
    segment: (cls) => q((n) => n.tag === "div" && hasClass(n, cls))[0],
    buttonsIn: (cls) => (api.segment(cls)?.children ?? []).map(textOfNode),
    phase: () => q((n) => n.attrs["data-phase"])[0]?.attrs["data-phase"],
  };
  return api;
}

test("a private song: Start goes straight to My turn, there is no Listen anywhere and the song is never played", async () => {
  const v = await open({ song: privateSong() });
  assert.equal(v.text("learn-instruction").startsWith("Press Start."), true);
  assert.match(v.text("learn-sub"), /The app does not play this song/);
  assert.deepEqual(v.actions(), ["START"]);
  v.click("START");
  assert.equal(v.phase(), "yourTurn");
  assert.equal(v.text("learn-instruction"), "Right hand: thumb on C (Do).");
  assert.deepEqual(v.actions(), ["REPEAT"], "no Listen again");
  assert.deepEqual(v.expected(), [60]);
  assert.equal(v.engine.calls.some(([name]) => name === "playRange"), false);
  assert.equal(v.engine.calls.some(([name]) => name === "setTimeline"), false);
  v.press(60);
  assert.ok(v.engine.calls.some(([n, m]) => n === "startNote" && m === 60), "the learner's own press sounds");
});

test("a public song: Listen plays the phrase range, then My turn starts when it ends; a key during Listen starts My turn", async () => {
  const v = await open();
  v.click("START");
  assert.equal(v.phase(), "phraseIntro");
  assert.deepEqual(v.actions(), ["LISTEN", "MY_TURN"]);
  v.click("LISTEN");
  assert.deepEqual(v.engine.calls.filter(([n]) => n === "playRange"), [["playRange", 0, BAR, "R"]]);
  assert.equal(v.phase(), "listening");
  v.engine.finishRange("completed");
  await later();
  assert.equal(v.phase(), "yourTurn");
  v.click("LISTEN_AGAIN");
  assert.equal(v.phase(), "listening");
  v.press(60);
  assert.equal(v.phase(), "yourTurn", "a key pressed during Listen starts My turn");
  assert.ok(v.engine.calls.some(([n]) => n === "stopRange"));
});

test("the shaded key advances; a wrong key says Try again and the shaded key stays; the right key then says Correct", async () => {
  const v = await open({ song: privateSong() });
  v.click("START");
  v.press(61);
  assert.equal(v.text("learn-chip"), "Try again");
  assert.match(v.text("learn-chip-detail"), /Use the shaded key/);
  assert.deepEqual(v.expected(), [60], "the expected key is still shaded");
  assert.equal(v.text("learn-progress"), "Phrase 1 of 2. Step 1 of 3");
  v.press(60);
  assert.equal(v.text("learn-chip"), "Correct");
  assert.equal(v.text("learn-instruction"), "Right hand: index finger on D (Re).");
  assert.equal(v.text("learn-progress"), "Phrase 1 of 2. Step 2 of 3");
  assert.deepEqual(v.expected(), [62]);
});

test("a chord is completed by single clicks in any order, with the instruction asking for the keys together", async () => {
  const v = await open({ song: privateSong() });
  v.click("START");
  v.press(60);
  v.press(62);
  assert.deepEqual(v.expected(), [60, 64, 67]);
  assert.match(v.text("learn-instruction"), /Press these 3 keys together/);
  v.press(67);
  v.press(60);
  assert.equal(v.phase(), "yourTurn", "two of three is not enough");
  v.press(64);
  assert.equal(v.phase(), "phraseComplete");
  assert.equal(v.text("learn-instruction"), "Correct. Phrase 1 of 2 done.");
  assert.deepEqual(v.actions(), ["NEXT_PHRASE", "REPEAT"]);
});

test("switching the language in the middle of a chord keeps the step and the keys already pressed", async () => {
  const v = await open({ song: privateSong() });
  v.click("START");
  v.press(60);
  v.press(62);
  v.press(60);
  v.i18n.setLang("es");
  assert.match(v.text("learn-instruction"), /^Mano derecha: pulgar en Do \(C\)\. Presione estas 3 teclas a la vez\./);
  assert.equal(v.text("learn-progress"), "Frase 1 de 2. Paso 3 de 3");
  v.press(64);
  v.press(67);
  assert.equal(v.phase(), "phraseComplete", "the key pressed before the switch was not lost");
  assert.equal(v.text("learn-instruction"), "Correcto. Frase 1 de 2 terminada.");
});

test("the key toggle recomputes the names and fingers, keeps the phrase, and is remembered", async () => {
  const v = await open({ song: privateSong() });
  v.click("START");
  v.press(60);
  assert.deepEqual(v.buttonsIn("learn-keys"), ["C major", "G major"]);
  const before = v.text("learn-instruction");
  const toG = v.segment("learn-keys").children[1];
  toG.click();
  assert.notEqual(v.text("learn-instruction"), before);
  assert.match(v.text("learn-progress"), /^Phrase 1 of 2/, "the same phrase");
  assert.equal(v.segment("learn-keys").children[1].attrs["aria-pressed"], "true", "the controls were redrawn with G pressed");
  const saved = JSON.parse(v.storage.data["piano-guide:learn:v1"]);
  assert.equal(saved.transpose[makeSong().id], "G");
  v.segment("learn-keys").children[0].click();
  assert.equal(v.text("learn-instruction"), "Right hand: thumb on C (Do).", "back to the original key: step 1 of the same phrase");
});

test("hand and level selectors appear only when there is a choice", async () => {
  const both = await open({ song: privateSong() });
  assert.deepEqual(both.buttonsIn("learn-hands"), ["Right hand", "Left hand"]);
  assert.equal(both.segment("learn-levels"), undefined, "one level: no level selector");
  const rightOnly = makeSong();
  rightOnly.levels.beginner.notes = NOTES.filter((n) => n.hand === "R");
  assert.equal((await open({ song: rightOnly })).segment("learn-hands"), undefined, "one hand with notes: no hand selector");
  const two = makeSong();
  two.levels.original = { ...two.levels.beginner, label: "Original", notation: "engraved" };
  assert.deepEqual(learnableLevels(two), ["beginner", "original"]);
  assert.equal((await open({ song: two })).buttonsIn("learn-levels").length, 2);
});

test("progress is saved and the next visit offers Continue at that phrase, with Start over and Reset beside it", async () => {
  const storage = memory();
  const first = await open({ song: privateSong(), storage });
  first.click("START");
  for (const midi of [60, 62, 60, 64, 67]) first.press(midi);
  first.click("NEXT_PHRASE");
  first.handle.dispose();
  const second = await open({ song: privateSong(), storage });
  assert.deepEqual(second.actions(), ["CONTINUE", "START", "RESET"]);
  second.click("CONTINUE");
  assert.equal(second.text("learn-progress"), "Phrase 2 of 2. Step 1 of 1");
  second.handle.dispose();
  const third = await open({ song: privateSong(), storage });
  third.click("RESET");
  assert.deepEqual(third.actions(), ["START"], "after Reset progress it is a fresh start");
});

test("typing in a text box plays nothing; a Ctrl combination plays nothing; a mapped key plays and a blur releases it", async () => {
  const v = await open({ song: privateSong() });
  v.click("START");
  const starts = () => v.engine.calls.filter(([n]) => n === "startNote").length;
  const keydown = (extra) => v.win.fire("keydown", { code: "KeyA", key: "a", repeat: false, preventDefault() {}, ctrlKey: false, altKey: false, metaKey: false, target: { tagName: "BODY" }, ...extra });
  keydown({ target: { tagName: "INPUT" } });
  keydown({ ctrlKey: true });
  assert.equal(starts(), 0);
  keydown({});
  assert.equal(starts(), 1, "A plays");
  v.win.fire("blur");
  assert.ok(v.engine.calls.some(([n]) => n === "releaseNote"), "a window blur releases the held note");
});

test("MIDI: the panel asks for permission only from its button, and a note from the device advances the lesson", async () => {
  const input = { name: "CDP-S100", manufacturer: "Casio", state: "connected", onmidimessage: null };
  const win = fakeWin();
  let requests = 0;
  win.navigator = { language: "en", requestMIDIAccess: async () => ((requests += 1), { inputs: new Map([["1", input]]), onstatechange: null }) };
  const v = await open({ song: privateSong(), win });
  assert.equal(requests, 0);
  v.click("START");
  all(v.root, (n) => n.tag === "button" && hasClass(n, "input-connect"))[0].click();
  await later();
  assert.equal(requests, 1);
  input.onmidimessage({ data: [0x90, 60, 90] });
  assert.equal(v.text("learn-progress"), "Phrase 1 of 2. Step 2 of 3");
  assert.equal(v.engine.calls.some(([n]) => n === "startNote"), false, "MIDI does not sound by default");
});

test("leaving releases every held note, stops Listen and removes the listeners; nothing plays afterwards", async () => {
  const v = await open({ song: privateSong() });
  v.click("START");
  v.down(60);
  v.handle.dispose();
  assert.ok(v.engine.calls.some(([n, m]) => n === "releaseNote" && m === 60));
  assert.ok(v.engine.calls.some(([n]) => n === "dispose"));
  assert.equal((v.win.listeners.keydown ?? []).length, 0);
  assert.equal((v.win.listeners.resize ?? []).length, 0);
});

test("a song that cannot be found, is unavailable or has no notes shows one plain message and a way back", async () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => {} });
  const show = async (entries, error = null) => {
    const root = doc.make("div");
    learnView({ i18n, load: async () => ({ error, entries }), makeEngine: fakeEngine, win: fakeWin(), storage: memory() })({ songId: "x" }, root);
    await later();
    return textOfNode(root);
  };
  assert.match(await show([]), /Song not found.*Catalog/);
  assert.match(await show([{ entry: { id: "x" }, status: "unavailable", reason: "broken" }]), /Unavailable.*broken/);
  const empty = makeSong();
  empty.levels.beginner.notes = [];
  empty.id = "x";
  assert.match(await show([{ entry: { id: "x" }, status: "ok", song: empty }]), /no notes to learn/);
  assert.match(await show([], { reason: "offline" }), /could not be loaded.*offline/);
});

test("static guard: the Learn view and screen never call playNotes, and only the listen effect calls playRange", () => {
  const read = (f) => readFileSync(new URL(`../../src/ui/${f}`, import.meta.url), "utf8");
  const uses = (text, name) => text.split(name + "(").length - 1;
  assert.equal(uses(read("learn-view.js"), "playNotes"), 0);
  assert.equal(uses(read("learn-screen.js"), "playRange") + uses(read("learn-screen.js"), "playNotes"), 0);
  assert.equal(uses(read("learn-view.js"), "playRange"), 1, "one call site: the listen effect");
  assert.equal(uses("engine.playNotes(x)", "playNotes"), 1, "counter-proof: the scan sees a call");
});
