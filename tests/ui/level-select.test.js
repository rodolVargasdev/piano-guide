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
  assert.equal(updateHash("#/song/cancer", { level: "original" }), "#/song/cancer?level=original");
  assert.equal(updateHash("#/song/cancer?level=beginner&debug=1", { level: "original", names: "letters" }), "#/song/cancer?level=original&debug=1&names=letters");
  assert.equal(updateHash("#/song/cancer?view=both", { view: "score" }), "#/song/cancer?view=score");
  assert.equal(updateHash("#/song/cancer", { names: "a&b=c" }), "#/song/cancer?names=a%26b%3Dc", "a hostile value cannot add a parameter");
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
  assert.equal(readRemembered(s, "cancer"), null);
  assert.equal(remember(s, "cancer", "original"), true);
  assert.equal(s.data[levelKey("cancer")], "original");
  assert.equal(levelKey("cancer"), "piano-guide:level:cancer");
  assert.equal(readRemembered(s, "cancer"), "original");
  assert.equal(readRemembered(s, "chopin-nocturne-op9-no2"), null, "another song is unaffected");
  assert.equal(readRemembered(fakeStorage({}, true), "cancer"), null, "a throwing storage reads as nothing");
  assert.equal(remember(fakeStorage({}, true), "cancer", "original"), false);
  assert.equal(readRemembered(undefined, "cancer"), null);
});
