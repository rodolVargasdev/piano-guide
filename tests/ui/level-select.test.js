import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLevelId, levelChoices, mapPosition, updateHash, readRemembered, remember, levelKey } from "../../src/ui/level-select.js";
import { barBeatOf } from "../../src/core/timing.js";

const song = (levels, defaultLevel = levels[0]) => ({ defaultLevel, levels: Object.fromEntries(levels.map((id) => [id, {}])) });
const both = song(["beginner", "original"], "beginner");

test("order of precedence: the hash level, then the session memory, then the default", () => {
  assert.equal(resolveLevelId(both, "original", "beginner"), "original");
  assert.equal(resolveLevelId(both, null, "original"), "original");
  assert.equal(resolveLevelId(both, null, null), "beginner");
  assert.equal(resolveLevelId(song(["beginner", "original"], "original"), undefined, undefined), "original");
});

test("an unknown level falls back to the next source, never to a broken state", () => {
  assert.equal(resolveLevelId(both, "expert", "original"), "original", "unknown hash level, valid memory");
  assert.equal(resolveLevelId(both, "expert", "master"), "beginner", "both unknown, the default");
  assert.equal(resolveLevelId(both, "toString", "constructor"), "beginner", "inherited names are not levels");
  assert.equal(resolveLevelId(both, 3, {}), "beginner", "non-strings are ignored");
  assert.equal(resolveLevelId(song(["original"]), "beginner", "beginner"), "original", "a level the song does not have");
});

test("the selector lists only the levels present, beginner first; a single level is a static chip", () => {
  assert.deepEqual(levelChoices(song(["original", "beginner"])), { ids: ["beginner", "original"], single: false });
  assert.deepEqual(levelChoices(song(["beginner"])), { ids: ["beginner"], single: true });
  assert.deepEqual(levelChoices(song(["original"])), { ids: ["original"], single: true });
});

const tl = (over = {}) => ({ meter: { num: 12, den: 8 }, pickupTicks: 720, tempo: { bpm: 54, beatUnit: "dotted-quarter" }, lengthTicks: 720 + 2880 * 4, ...over });

test("a level switch keeps the bar and beat, offset inside the beat included", () => {
  const from = tl();
  const to = tl();
  for (const tick of [0, 719, 720, 1500, 3000, 6000]) {
    const there = mapPosition(tick, from, to);
    assert.deepEqual(barBeatOf(there, to.meter, to.pickupTicks, to.tempo.beatUnit), barBeatOf(tick, from.meter, from.pickupTicks, from.tempo.beatUnit), `tick ${tick}`);
  }
});

test("the mapped position is clamped to the new level, and a shorter level never overruns", () => {
  assert.equal(mapPosition(8000, tl(), tl({ lengthTicks: 3600 })), 3600);
  assert.equal(mapPosition(0, tl(), tl({ lengthTicks: 3600 })), 0);
  assert.equal(mapPosition(-50, tl({ pickupTicks: 0 }), tl({ pickupTicks: 0 })), 0, "a count-in position is never negative");
});

test("counter-proof: with a different pickup the same bar and beat is a different tick", () => {
  const from = tl({ pickupTicks: 0 });
  const to = tl({ pickupTicks: 720 });
  assert.equal(mapPosition(2880, from, to), 2880 + 720, "bar 2 beat 1 moves by the pickup, a raw tick copy would not");
});

test("updateHash writes level, names and view, keeps other parameters and encodes values", () => {
  assert.equal(updateHash("#/song/example-song", { level: "original" }), "#/song/example-song?level=original");
  assert.equal(updateHash("#/song/example-song?level=beginner&debug=1", { level: "original", names: "letters" }), "#/song/example-song?level=original&debug=1&names=letters");
  assert.equal(updateHash("#/song/example-song?view=both", { view: "score" }), "#/song/example-song?view=score");
  assert.equal(updateHash("#/song/example-song", { names: "a&b=c" }), "#/song/example-song?names=a%26b%3Dc", "a hostile value cannot add a parameter");
  assert.equal(updateHash("", {}), "#");
});

function fakeStorage(initial = {}, fail = false) {
  const data = { ...initial };
  return {
    data,
    getItem(k) {
      if (fail) throw new Error("blocked");
      return k in data ? data[k] : null;
    },
    setItem(k, v) {
      if (fail) throw new Error("full");
      data[k] = String(v);
    },
  };
}

test("session memory is per song and survives a blocked or missing storage", () => {
  const s = fakeStorage();
  assert.equal(readRemembered(s, "example-song"), null);
  assert.equal(remember(s, "example-song", "original"), true);
  assert.equal(s.data[levelKey("example-song")], "original");
  assert.equal(levelKey("example-song"), "piano-guide:level:example-song");
  assert.equal(readRemembered(s, "example-song"), "original");
  assert.equal(readRemembered(s, "chopin-nocturne-op9-no2"), null, "another song is unaffected");
  assert.equal(readRemembered(fakeStorage({}, true), "example-song"), null, "a throwing storage reads as nothing");
  assert.equal(remember(fakeStorage({}, true), "example-song", "original"), false);
  assert.equal(readRemembered(undefined, "example-song"), null);
});

// ---- the selector controls, run against the small fake DOM ----
const { fakeDoc, all } = await import("../score/fake-dom.js");
const { createLevelSelect, controlsFor } = await import("../../src/ui/level-select.js");

function install() {
  const doc = fakeDoc();
  globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
}
const textOf = (n) => (n.tag === "#text" ? n.text : n.children.map(textOf).join(""));
const button = (root, label) => all(root, (n) => n.tag === "button" && textOf(n) === label)[0];
const pressed = (root, label) => button(root, label).attrs["aria-pressed"];

const levels = {
  beginner: { label: "Beginner", notation: "labelled", description: "Names in the heads." },
  original: { label: "Original", notation: "engraved", analysis: [{ tick: 0, kind: "harmony", title: "t", text: "x" }] },
};
const twoLevels = { defaultLevel: "beginner", levels };
function make(overrides = {}, state = {}) {
  install();
  const calls = [];
  const sel = createLevelSelect({
    song: twoLevels,
    state: { levelId: "beginner", names: "solfege", view: "both", analysis: false, ...state },
    onLevel: (v) => calls.push(["level", v]),
    onNames: (v) => calls.push(["names", v]),
    onAnalysis: (v) => calls.push(["analysis", v]),
    onView: (v) => calls.push(["view", v]),
    ...overrides,
  });
  return { sel, calls, root: sel.element };
}

test("controlsFor: names only on the labelled notation, Analysis only with entries", () => {
  assert.deepEqual(controlsFor(twoLevels, "beginner"), { names: true, analysis: false });
  assert.deepEqual(controlsFor(twoLevels, "original"), { names: false, analysis: true });
  assert.deepEqual(controlsFor({ levels: { x: { notation: "engraved", analysis: [] } } }, "x"), { names: false, analysis: false }, "an empty list is no analysis");
  assert.deepEqual(controlsFor(twoLevels, "missing"), { names: false, analysis: false });
});

test("two levels: a button each, the active one pressed; clicking switches, reports once and redraws", () => {
  const { root, calls } = make();
  assert.equal(pressed(root, "Beginner"), "true");
  assert.equal(pressed(root, "Original"), "false");
  button(root, "Original").click();
  assert.deepEqual(calls, [["level", "original"]]);
  assert.equal(pressed(root, "Original"), "true");
  assert.equal(pressed(root, "Beginner"), "false");
});

test("a single-level song shows a static chip and no level buttons", () => {
  const { root } = make({ song: { defaultLevel: "beginner", levels: { beginner: levels.beginner } } });
  assert.equal(all(root, (n) => n.attrs.class === "chip").map(textOf)[0], "Beginner");
  assert.equal(button(root, "Beginner"), undefined);
  assert.equal(button(root, "Original"), undefined);
});

test("the names toggle is immediate and exists only on the labelled level", () => {
  const { root, calls } = make();
  assert.equal(pressed(root, "Do Re Mi"), "true");
  button(root, "C D E").click();
  assert.deepEqual(calls, [["names", "letters"]]);
  assert.equal(pressed(root, "C D E"), "true");
  assert.equal(pressed(root, "Do Re Mi"), "false");
  button(root, "Original").click();
  assert.equal(button(root, "C D E"), undefined, "no note names on the engraved level");
});

test("Analysis appears only when the active level has entries and toggles on then off", () => {
  const { root, calls } = make();
  assert.equal(button(root, "Analysis"), undefined, "Beginner has no analysis");
  button(root, "Original").click();
  assert.equal(pressed(root, "Analysis"), "false");
  button(root, "Analysis").click();
  button(root, "Analysis").click();
  assert.deepEqual(calls.filter((c) => c[0] === "analysis"), [["analysis", true], ["analysis", false]], "a second click turns it off");
  assert.equal(pressed(root, "Analysis"), "false");
});

test("the view control reports both, keyboard and score, and update() redraws from outside", () => {
  const { root, calls, sel } = make();
  assert.equal(pressed(root, "Both"), "true");
  button(root, "Score").click();
  button(root, "Keyboard").click();
  assert.deepEqual(calls, [["view", "score"], ["view", "scene"]]);
  sel.update({ view: "both", levelId: "original" });
  assert.equal(pressed(root, "Both"), "true");
  assert.equal(pressed(root, "Original"), "true");
});

test("song text in labels is inserted as text, never as markup", () => {
  const hostile = { defaultLevel: "beginner", levels: { beginner: { ...levels.beginner, label: "<img src=x onerror=alert(1)>" }, original: levels.original } };
  const { root } = make({ song: hostile });
  assert.ok(button(root, "<img src=x onerror=alert(1)>"), "shown literally");
  assert.equal(all(root, (n) => n.tag === "img").length, 0);
});

test("a level label that is LocalizedText shows in the chosen language, never as [object Object]", () => {
  const song = { defaultLevel: "beginner", levels: { beginner: { label: { en: "Beginner", es: "Principiante" }, notation: "labelled" }, original: { label: { en: "Original", es: "Original" }, notation: "engraved" } } };
  const es = make({ song, lang: "es" }).root;
  assert.equal(pressed(es, "Principiante"), "true");
  const en = make({ song }).root;
  assert.equal(pressed(en, "Beginner"), "true", "English by default");
  const one = make({ song: { defaultLevel: "beginner", levels: { beginner: song.levels.beginner } }, lang: "es" }).root;
  assert.ok(one.children.some((c) => (c._text || c.children.map((k) => k.text ?? k._text).join("")) === "Principiante"), "the single-level chip too");
});
