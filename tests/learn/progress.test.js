import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRESS_KEY, clearSong, emptyProgress, positionOf, readProgress, withLessonZero, withPosition, withTranspose, writeProgress } from "../../src/learn/progress.js";

const memory = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), data };
};
const blocked = () => ({
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
});
/** A spelled pitch such as E4, Bb3 or F#5: what progress must never contain. */
const SPELLED_PITCH = /\b[A-G](?:##|bb|#|b)?-?\d\b/;

const lesson = () => {
  let p = emptyProgress();
  p = withPosition(p, { songId: "ode-to-joy", levelId: "beginner", tonic: "C", phrase: 2, stage: 1, hand: "R", date: "2026-10-11" });
  p = withPosition(p, { songId: "ode-to-joy", levelId: "beginner", tonic: "E", phrase: 0, date: "2026-10-10" });
  p = withTranspose(p, "ode-to-joy", "C");
  return withLessonZero(p, "done");
};

test("nothing saved reads as an empty progress", () => {
  assert.deepEqual(readProgress(memory()), emptyProgress());
  assert.deepEqual(readProgress(undefined), emptyProgress());
});

test("a written progress reads back, and positions are kept per song, level and tonic", () => {
  const store = memory();
  assert.equal(writeProgress(store, lesson()), true);
  const back = readProgress(store);
  assert.deepEqual(positionOf(back, "ode-to-joy", "beginner", "C"), { phrase: 2, stage: 1, hand: "R", updated: "2026-10-11" });
  assert.deepEqual(positionOf(back, "ode-to-joy", "beginner", "E"), { phrase: 0, updated: "2026-10-10" });
  assert.equal(positionOf(back, "ode-to-joy", "beginner", "G"), null);
  assert.equal(back.lessonZero, "done");
  assert.equal(back.transpose["ode-to-joy"], "C");
  assert.ok(PROGRESS_KEY in store.data);
});

test("corrupt JSON, a wrong version or a wrong shape read as empty without throwing", () => {
  for (const text of ["{not json", "null", "[]", '"text"', '{"v":2,"songs":{}}', "42"]) {
    assert.deepEqual(readProgress(memory({ [PROGRESS_KEY]: text })), emptyProgress(), text);
  }
});

test("a hand-edited store keeps its good entries and drops the malformed ones", () => {
  const raw = { v: 1, lessonZero: "maybe", songs: { s: { beginner: { C: { phrase: 3, hand: "R", updated: "2026-10-11" }, E: { phrase: -1, updated: "x" }, G: { phrase: 1 }, A: "text" }, easy: 7 } }, transpose: { s: "C", t: 5 } };
  const back = readProgress(memory({ [PROGRESS_KEY]: JSON.stringify(raw) }));
  assert.equal(back.lessonZero, null);
  assert.deepEqual(Object.keys(back.songs.s.beginner), ["C"]);
  assert.deepEqual(back.transpose, { s: "C" });
});

test("blocked storage reads as empty and a write is swallowed, reporting false", () => {
  assert.deepEqual(readProgress(blocked()), emptyProgress());
  assert.equal(writeProgress(blocked(), lesson()), false);
  assert.equal(clearSong(blocked(), "ode-to-joy"), false);
});

test("clearSong removes the song and its transposition choice, and leaves other songs and lesson zero", () => {
  const store = memory();
  writeProgress(store, withPosition(lesson(), { songId: "other", levelId: "beginner", tonic: "C", phrase: 1, date: "2026-10-11" }));
  assert.equal(clearSong(store, "ode-to-joy"), true);
  const back = readProgress(store);
  assert.equal(back.songs["ode-to-joy"], undefined);
  assert.equal(back.transpose["ode-to-joy"], undefined);
  assert.equal(positionOf(back, "other", "beginner", "C").phrase, 1);
  assert.equal(back.lessonZero, "done", "lesson zero is not per song");
});

test("withPosition and withTranspose do not mutate their input, and a malformed position is refused", () => {
  const base = emptyProgress();
  const next = withPosition(base, { songId: "s", levelId: "beginner", tonic: "C", phrase: 1, date: "2026-10-11" });
  assert.deepEqual(base, emptyProgress());
  assert.equal(withPosition(base, { songId: "s", levelId: "beginner", tonic: "C", phrase: -2, date: "2026-10-11" }), base);
  assert.equal(withLessonZero(base, "later"), base);
  assert.equal(withTranspose(next, "s", null).transpose.s, null);
});

test("privacy: the serialized progress of a synthetic lesson holds ids, indexes, tonics and dates, never a spelled pitch", () => {
  const text = JSON.stringify(lesson());
  assert.doesNotMatch(text, SPELLED_PITCH);
  assert.match(text, /"C"/, "the tonic name is stored, and it is not a spelled pitch");
});

test("privacy counter-proof: the pattern does flag a stored pitch", () => {
  for (const leak of ['{"note":"E4"}', '{"n":"Bb3"}', '{"n":"F#5"}']) assert.match(leak, SPELLED_PITCH);
  const leaky = withPosition(emptyProgress(), { songId: "s", levelId: "beginner", tonic: "E4", phrase: 1, date: "2026-10-11" });
  assert.match(JSON.stringify(leaky), SPELLED_PITCH, "a pitch smuggled in as a tonic would be caught");
});
