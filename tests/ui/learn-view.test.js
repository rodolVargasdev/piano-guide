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
  const api = {
    calls,
    startNote: (midi) => calls.push(["startNote", midi]),
    releaseNote: (midi) => calls.push(["releaseNote", midi]),
    setTimeline: (tl) => (calls.push(["setTimeline"]), (api.lastTimeline = tl)),
    setBpm: (n) => calls.push(["setBpm", n]),
    setMetronome: (cfg) => calls.push(["setMetronome", cfg.enabled]),
    play: () => calls.push(["play"]),
    stop: () => calls.push(["stop"]),
    isRangePlaying: () => false,
    playRange: (r) => (calls.push(["playRange", r.startTick, r.endTick, r.hand]), (api.lastRange = r), new Promise((res) => (resolveRange = res))),
    stopRange: () => calls.push(["stopRange"]),
    position: () => ({ tick: 0 }),
    dispose: () => calls.push(["dispose"]),
    finishRange: (status = "completed") => resolveRange?.({ status }),
  };
  return api;
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
  assert.deepEqual(v.actions(), ["START", "LESSON_ZERO"]);
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
  assert.equal(v.text("learn-progress"), "Phrase 1 of 2. Right hand, slowly. Step 1 of 3");
  v.press(60);
  assert.equal(v.text("learn-chip"), "Correct");
  assert.equal(v.text("learn-instruction"), "Right hand: index finger on D (Re).");
  assert.equal(v.text("learn-progress"), "Phrase 1 of 2. Right hand, slowly. Step 2 of 3");
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
  assert.equal(v.phase(), "stageComplete", "the left hand has notes in phrase 1, so the next stage is offered");
  assert.equal(v.text("learn-instruction"), "Correct. Stage done: Right hand.");
  assert.equal(v.text("learn-sub"), "Now the left hand, slowly.");
  assert.deepEqual(v.actions(), ["NEXT_STAGE", "NEXT_PHRASE", "REPEAT"]);
});

test("switching the language in the middle of a chord keeps the step and the keys already pressed", async () => {
  const v = await open({ song: privateSong() });
  v.click("START");
  v.press(60);
  v.press(62);
  v.press(60);
  v.i18n.setLang("es");
  assert.match(v.text("learn-instruction"), /^Mano derecha: pulgar en Do \(C\)\. Presione estas 3 teclas a la vez\./);
  assert.equal(v.text("learn-progress"), "Frase 1 de 2. Mano derecha, despacio. Paso 3 de 3");
  v.press(64);
  v.press(67);
  assert.equal(v.phase(), "stageComplete", "the key pressed before the switch was not lost");
  assert.equal(v.text("learn-instruction"), "Correcto. Terminó esta etapa: Mano derecha.");
  assert.equal(v.text("learn-sub"), "Ahora la mano izquierda, despacio.");
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

test("Learn opens the beginner level even when the song opens on another by default, and honors an explicit level", async () => {
  const song = makeSong();
  song.levels.original = { ...song.levels.beginner, label: "Original", notation: "engraved" };
  song.defaultLevel = "original";
  const pressed = (v) => v.segment("learn-levels").children.filter((b) => b.attrs["aria-pressed"] === "true").map(textOfNode);
  assert.deepEqual(pressed(await open({ song })), ["Beginner"]);
  assert.deepEqual(pressed(await open({ song, level: "original" })), ["Original"], "counter-proof: the route level wins");
});

test("progress is saved and the next visit offers Continue at that phrase, with Start over and Reset beside it", async () => {
  const storage = memory();
  const first = await open({ song: privateSong(), storage });
  first.click("START");
  for (const midi of [60, 62, 60, 64, 67]) first.press(midi);
  first.click("NEXT_PHRASE");
  first.handle.dispose();
  const second = await open({ song: privateSong(), storage });
  assert.deepEqual(second.actions(), ["CONTINUE", "START", "LESSON_ZERO", "RESET"]);
  second.click("CONTINUE");
  assert.equal(second.text("learn-progress"), "Phrase 2 of 2. Step 1 of 1");
  second.handle.dispose();
  const third = await open({ song: privateSong(), storage });
  third.click("RESET");
  assert.deepEqual(third.actions(), ["START", "LESSON_ZERO"], "after Reset progress it is a fresh start");
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
  assert.equal(v.text("learn-progress"), "Phrase 1 of 2. Right hand, slowly. Step 2 of 3");
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

// ---- lesson zero in the view (pr1b2) ------------------------------------------------------------------------

const hintedKeys = (v) => v.root && all(v.root, (n) => n.tag === "rect" && hasClass(n, "lk-hint")).map((n) => Number(n.attrs["data-midi"]));
const imageSrc = (v) => all(v.root, (n) => n.tag === "img").map((n) => n.attrs.src);
const listLines = (v) => all(v.root, (n) => n.tag === "li").map(textOfNode);

test("lesson zero: find any C by the black keys, posture, five fingers, inputs, then it is saved as done and the first screen no longer offers it", async () => {
  const storage = memory();
  const v = await open({ storage });
  assert.deepEqual(v.actions(), ["START", "LESSON_ZERO"]);
  assert.match(v.text("learn-sub"), /New to the piano\? Try lesson zero first/);
  v.click("LESSON_ZERO");
  assert.equal(v.phase(), "lessonZero");
  assert.equal(v.text("learn-instruction"), "Find a C: it is the white key just left of the two black keys.");
  assert.deepEqual(v.actions(), ["ZERO_SKIP"]);
  assert.deepEqual(hintedKeys(v), [49, 51, 61, 63], "the groups of two black keys are outlined");
  assert.deepEqual(v.expected(), [], "nothing is shaded: the learner finds the C");
  assert.equal(v.text("learn-progress"), "Lesson zero, part 1 of 4");
  v.press(62); // D4 is not a C
  assert.equal(v.text("learn-chip"), "Try again");
  assert.match(v.text("learn-chip-detail"), /Look for a group of 2 black keys/);
  v.press(48); // a different C than the one nearest the middle still counts
  assert.equal(v.text("learn-chip"), "Correct");
  assert.equal(v.text("learn-instruction"), "Sit tall and curve your fingers.");
  assert.deepEqual(imageSrc(v), ["assets/img/posture.svg"]);
  assert.deepEqual(v.actions(), ["ZERO_NEXT", "ZERO_SKIP"]);
  v.click("ZERO_NEXT");
  assert.deepEqual(imageSrc(v), [], "the drawing is only on the posture part");
  assert.equal(v.text("learn-instruction"), "Right hand: thumb on C (Do).");
  assert.deepEqual(v.expected(), [60]);
  assert.equal(v.text("learn-progress"), "Lesson zero, part 3 of 4. Finger 1 of 5");
  for (const midi of [60, 62, 64, 65, 67]) v.press(midi);
  assert.equal(v.text("learn-instruction"), "You can play in three ways.");
  assert.equal(listLines(v).length, 4);
  assert.match(listLines(v)[2], /USB TO HOST/);
  assert.deepEqual(v.actions(), ["ZERO_NEXT"], "the last part has no skip, only Done");
  v.click("ZERO_NEXT");
  assert.equal(v.phase(), "start");
  assert.deepEqual(v.actions(), ["START"], "done: the first screen no longer offers it");
  assert.equal(JSON.parse(storage.data["piano-guide:learn:v1"]).lessonZero, "done");
  v.handle.dispose();
  assert.deepEqual((await open({ storage })).actions(), ["START"], "and it does not come back after a reload");
});

test("lesson zero: the five finger steps wait for the right key and say Try again for another one (counter-proof)", async () => {
  const v = await open();
  v.click("LESSON_ZERO");
  v.press(60);
  v.click("ZERO_NEXT");
  v.press(64); // E4 before C4
  assert.equal(v.text("learn-chip"), "Try again");
  assert.match(v.text("learn-chip-detail"), /Use the shaded key/);
  assert.deepEqual(v.expected(), [60], "the finger 1 key stays shaded");
  assert.equal(v.text("learn-progress"), "Lesson zero, part 3 of 4. Finger 1 of 5");
});

test("lesson zero: Skip saves it as skipped, goes back to the first screen and keeps offering it without the long offer text", async () => {
  const storage = memory();
  const v = await open({ storage });
  v.click("LESSON_ZERO");
  v.click("ZERO_SKIP");
  assert.equal(v.phase(), "start");
  assert.equal(JSON.parse(storage.data["piano-guide:learn:v1"]).lessonZero, "skipped");
  assert.deepEqual(v.actions(), ["START", "LESSON_ZERO"]);
  assert.equal(v.text("learn-sub"), "", "the offer sentence is only for someone who never opened it");
  v.click("START");
  assert.equal(v.phase(), "phraseIntro", "the song starts normally after a skip");
});

test("lesson zero: Spanish text, and no hand, key or level selector while it is open", async () => {
  const v = await open({ lang: "es" });
  v.click("LESSON_ZERO");
  assert.equal(v.text("learn-instruction"), "Busque un Do: es la tecla blanca justo a la izquierda de las dos teclas negras.");
  assert.equal(v.text("learn-progress"), "Lección cero, parte 1 de 4");
  assert.equal(v.segment("learn-hands"), undefined);
  assert.equal(v.segment("learn-keys"), undefined);
  v.press(60);
  v.click("ZERO_NEXT");
  assert.equal(v.text("learn-instruction"), "Mano derecha: pulgar en Do (C).");
});

test("lesson zero: a language switch in the middle keeps the part", async () => {
  const v = await open();
  v.click("LESSON_ZERO");
  v.press(60);
  v.i18n.setLang("es");
  await later();
  assert.equal(v.text("learn-instruction"), "Siéntese derecho y curve los dedos.");
  assert.equal(v.phase(), "lessonZero");
});

// ---- stages in the view (pr2b2) -------------------------------------------------------------------------------

test("stages: after the right hand the screen says plainly what comes next; each stage Listens with its hand and tempo; reload offers Continue at that stage", async () => {
  const storage = memory();
  const song = makeSong();
  const v = await open({ song, storage });
  v.click("START");
  v.click("MY_TURN");
  for (const midi of [60, 62, 60, 64, 67]) v.press(midi);
  assert.equal(v.phase(), "stageComplete");
  assert.equal(v.text("learn-instruction"), "Correct. Stage done: Right hand.");
  assert.equal(v.text("learn-sub"), "Now the left hand, slowly.");
  assert.deepEqual(v.actions(), ["NEXT_STAGE", "NEXT_PHRASE", "REPEAT"]);
  assert.ok(hasClass(v.action("NEXT_STAGE"), "learn-primary"), "Next stage is the primary action");
  assert.equal(hasClass(v.action("NEXT_PHRASE"), "learn-primary"), false);
  v.click("NEXT_STAGE");
  assert.equal(v.text("learn-instruction"), "Phrase 1 of 2.");
  assert.equal(v.text("learn-sub"), "Left hand, slowly.");
  v.click("LISTEN");
  assert.equal(v.engine.lastRange.hand, "L");
  assert.equal("bpm" in v.engine.lastRange, false, "a slow stage passes no BPM");
  v.engine.finishRange("completed");
  await later();
  v.press(48);
  assert.equal(v.phase(), "stageComplete");
  assert.equal(v.text("learn-sub"), "Now both hands together, slowly.");
  v.handle.dispose();
  // Reload: Continue resumes at that exact stage.
  const again = await open({ song, storage });
  assert.deepEqual(again.actions(), ["CONTINUE", "START", "LESSON_ZERO", "RESET"]);
  again.click("CONTINUE");
  assert.equal(again.text("learn-instruction"), "Phrase 1 of 2.");
  assert.equal(again.text("learn-sub"), "Both hands, slowly.");
  again.click("MY_TURN");
  assert.deepEqual(again.expected(), [48, 60], "both hands: the left C3 and the right C4 are shaded together");
  assert.equal(again.text("learn-progress"), "Phrase 1 of 2. Both hands, slowly. Step 1 of 3");
  assert.match(again.text("learn-instruction"), /^Both hands: /);
  again.press(48);
  assert.equal(again.text("learn-progress"), "Phrase 1 of 2. Both hands, slowly. Step 1 of 3", "one hand alone does not finish the step");
  again.press(60);
  assert.equal(again.text("learn-instruction"), "Right hand: index finger on D (Re).", "on the next beat only the right hand plays");
  for (const midi of [62, 60, 64, 67]) again.press(midi);
  assert.equal(again.phase(), "stageComplete");
  assert.equal(again.text("learn-sub"), "Now both hands together at the song speed.");
  again.click("NEXT_STAGE");
  assert.equal(again.text("learn-sub"), "Both hands, song speed.");
  again.click("LISTEN");
  assert.equal(again.engine.lastRange.hand, null, "both hands");
  assert.equal(again.engine.lastRange.bpm, song.tempo.bpm, "the song tempo, explicitly");
});

test("stages: the hand selector marks no hand while both hands are being practiced, and Reset progress clears the stage", async () => {
  const storage = memory();
  const v = await open({ song: privateSong(), storage });
  v.click("START");
  for (const midi of [60, 62, 60, 64, 67]) v.press(midi);
  v.click("NEXT_STAGE");
  v.press(48);
  v.click("NEXT_STAGE");
  assert.equal(v.text("learn-progress"), "Phrase 1 of 2. Both hands, slowly. Step 1 of 3");
  const pressed = all(v.root, (n) => n.tag === "button" && n.attrs["aria-pressed"] === "true" && ["Right hand", "Left hand"].includes(textOfNode(n))).length;
  assert.equal(pressed, 0, "neither hand button is marked in a both-hands stage");
  assert.equal(JSON.parse(storage.data["piano-guide:learn:v1"]).songs["example-song"].beginner.C.hand, "T");
  v.handle.dispose();
  const second = await open({ song: privateSong(), storage });
  second.click("RESET");
  assert.equal(JSON.parse(storage.data["piano-guide:learn:v1"]).songs["example-song"], undefined);
});

// ---- metronome (pr2b3) ---------------------------------------------------------------------------------------------

const names = (v) => v.engine.calls.map(([n]) => n);
const toggle = (v) => all(v.root, (n) => n.tag === "button" && n.attrs["data-toggle"] === "metronome")[0];

test("metronome: off by default and nothing starts; turned on, My turn runs a click at the slow tempo over a timeline with no notes", async () => {
  const song = makeSong();
  const v = await open({ song });
  assert.equal(toggle(v).attrs["aria-pressed"], "false");
  v.click("START");
  v.click("MY_TURN");
  assert.deepEqual(names(v).filter((n) => ["play", "setMetronome", "setBpm"].includes(n)), [], "no clock without the toggle");
  toggle(v).click();
  assert.equal(toggle(v).attrs["aria-pressed"], "true");
  assert.deepEqual(v.engine.calls.filter(([n]) => ["setBpm", "setMetronome", "play"].includes(n)), [["setBpm", song.tempo.bpm / 2], ["setMetronome", true], ["play"]]);
  assert.deepEqual(v.engine.lastTimeline.notes, [], "the clock never carries the song's notes");
  assert.equal(v.engine.calls.some(([n]) => n === "playRange"), false);
});

test("metronome: the tempo follows the stage (slow, then the song tempo) and the click stops when My turn ends", async () => {
  const song = makeSong();
  const v = await open({ song });
  toggle(v).click();
  v.click("START");
  v.click("MY_TURN");
  for (const midi of [60, 62, 60, 64, 67]) v.press(midi); // right hand slow done
  assert.equal(v.phase(), "stageComplete");
  assert.equal(names(v).filter((n) => n === "stop").length, 1, "My turn ended: the click stops");
  v.click("NEXT_STAGE");
  v.click("MY_TURN");
  v.press(48); // left hand slow done
  v.click("NEXT_STAGE");
  v.click("MY_TURN");
  for (const midi of [48, 60, 62, 60, 64, 67]) v.press(midi); // together slow done
  v.click("NEXT_STAGE");
  v.click("MY_TURN");
  const bpms = v.engine.calls.filter(([n]) => n === "setBpm").map(([, bpm]) => bpm);
  assert.deepEqual(bpms, [song.tempo.bpm / 2, song.tempo.bpm / 2, song.tempo.bpm / 2, song.tempo.bpm], "slow for three stages, the song tempo for the full-tempo stage");
});

test("metronome: Listen again takes the clock over without stopping the phrase, and the click comes back after it", async () => {
  const v = await open();
  toggle(v).click();
  v.click("START");
  v.click("MY_TURN");
  const plays = () => names(v).filter((n) => n === "play").length;
  assert.equal(plays(), 1);
  v.click("LISTEN_AGAIN");
  assert.equal(v.phase(), "listening");
  assert.equal(names(v).includes("stop"), false, "stopping would cancel the phrase that is about to play");
  v.engine.finishRange("completed");
  await later();
  assert.equal(v.phase(), "yourTurn");
  assert.equal(plays(), 2, "the click restarts when My turn comes back");
});

test("metronome: turning it off stops the click; a private song may click but never plays the song", async () => {
  const v = await open({ song: privateSong() });
  v.click("START");
  assert.equal(names(v).includes("play"), false, "a private song with the metronome off starts nothing");
  toggle(v).click();
  assert.equal(names(v).includes("play"), true, "the user asked for the click");
  assert.deepEqual(v.engine.lastTimeline.notes, []);
  assert.equal(names(v).includes("playRange"), false);
  toggle(v).click();
  assert.equal(names(v).filter((n) => n === "stop").length, 1);
  assert.equal(toggle(v).attrs["aria-pressed"], "false");
});

test("metronome: the toggle is in the top bar with its label in both languages and not among the lesson actions", async () => {
  const v = await open({ lang: "es" });
  assert.equal(textOfNode(toggle(v)), "Metrónomo");
  assert.deepEqual(v.actions(), ["START", "LESSON_ZERO"], "the toggle is not a lesson action");
  assert.match(toggle(v).attrs.title, /clic/);
});
