import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUND, UNLOCK_AT, initEar, optionsFor, reduceEar } from "../../src/practice/ear.js";
import { INTERVAL_GROWTH, INTERVAL_START } from "../../src/theory/drills.js";
import { earGrown, emptyPracticeProgress, readPracticeProgress, withEarGrown, writePracticeProgress } from "../../src/practice/progress.js";

const step = (s, ...actions) => actions.reduce((acc, a) => {
  const r = reduceEar(acc.state, a);
  return { state: r.state, effects: [...acc.effects, ...r.effects] };
}, { state: s, effects: [] });
const answerOf = (s) => s.question.answer;
const wrongOf = (s) => s.question.options.find((o) => o !== s.question.answer);
// Answers one question right (or wrong twice) and moves on; returns the state after NEXT.
const finish = (s, { right = true } = {}) => {
  let st = s;
  if (right) st = reduceEar(st, { type: "ANSWER", id: answerOf(st) }).state;
  else {
    const others = st.question.options.filter((o) => o !== answerOf(st));
    st = reduceEar(reduceEar(st, { type: "ANSWER", id: others[0] }).state, { type: "ANSWER", id: others[1] ?? others[0] }).state;
  }
  return reduceEar(st, { type: "NEXT" });
};

test("a session starts with the three starting choices, a question ready and not yet played; chords start with major and minor", () => {
  const s = initEar({ kind: "interval", seed: 1 });
  assert.deepEqual(s.question.options, ["M3", "P5", "P8"]);
  assert.equal(s.heard, false);
  assert.equal(s.phase, "asking");
  assert.deepEqual(initEar({ kind: "chord", seed: 1 }).question.options, ["major", "minor"]);
  assert.equal(initEar({ kind: "nope" }), null);
});

test("the same seed gives the same sequence of questions, and another seed another one", () => {
  const run = (seed) => {
    let s = initEar({ kind: "interval", seed });
    const seen = [JSON.stringify(s.question)];
    for (let i = 0; i < 5; i += 1) {
      s = finish(s).state;
      seen.push(JSON.stringify(s.question));
    }
    return seen;
  };
  assert.deepEqual(run(11), run(11));
  assert.notDeepEqual(run(11), run(12));
});

test("Listen is free: any number of times, it plays the notes of the question and changes nothing else", () => {
  const s = initEar({ kind: "interval", seed: 3 });
  let r = step(s, ...Array(5).fill({ type: "LISTEN" }));
  assert.equal(r.effects.filter((e) => e.type === "play").length, 5);
  assert.deepEqual(r.effects[0].notes, s.question.notes);
  assert.deepEqual([r.state.attempts, r.state.round, r.state.phase], [0, { answered: 0, correct: 0 }, "asking"], "no penalty");
  assert.equal(r.state.heard, true);
});

test("the right answer says Correct and counts; the same on the first try only", () => {
  const s = initEar({ kind: "interval", seed: 2 });
  const r = step(s, { type: "ANSWER", id: answerOf(s) });
  assert.deepEqual(r.effects, [{ type: "announce", kind: "correct", firstTry: true }]);
  assert.deepEqual([r.state.phase, r.state.round], ["answered", { answered: 1, correct: 1 }]);
});

test("a first wrong answer says Try again and stays; a second wrong answer shows the right one and counts as not right", () => {
  const s = initEar({ kind: "interval", seed: 2 });
  const others = s.question.options.filter((o) => o !== answerOf(s));
  const first = reduceEar(s, { type: "ANSWER", id: others[0] });
  assert.deepEqual(first.effects, [{ type: "announce", kind: "wrong", id: others[0] }]);
  assert.deepEqual([first.state.phase, first.state.attempts], ["asking", 1]);
  const second = reduceEar(first.state, { type: "ANSWER", id: others[1] });
  assert.deepEqual(second.effects, [{ type: "announce", kind: "reveal", id: answerOf(s) }]);
  assert.deepEqual([second.state.phase, second.state.round], ["revealed", { answered: 1, correct: 0 }]);
});

test("a right answer after one wrong one is right but not counted in the score (first try only)", () => {
  const s = initEar({ kind: "interval", seed: 2 });
  const wrongId = wrongOf(s);
  const r = step(s, { type: "ANSWER", id: wrongId }, { type: "ANSWER", id: answerOf(s) });
  assert.deepEqual(r.effects.at(-1), { type: "announce", kind: "correct", firstTry: false });
  assert.deepEqual(r.state.round, { answered: 1, correct: 0 });
});

test("the same wrong choice twice, an unknown choice, or an answer after the question ended do nothing", () => {
  const s = initEar({ kind: "interval", seed: 2 });
  const wrongId = wrongOf(s);
  const once = reduceEar(s, { type: "ANSWER", id: wrongId }).state;
  assert.deepEqual(reduceEar(once, { type: "ANSWER", id: wrongId }), { state: once, effects: [] });
  assert.deepEqual(reduceEar(s, { type: "ANSWER", id: "m2" }), { state: s, effects: [] }, "m2 is not a choice yet");
  const done = reduceEar(s, { type: "ANSWER", id: answerOf(s) }).state;
  assert.deepEqual(reduceEar(done, { type: "ANSWER", id: wrongId }), { state: done, effects: [] });
});

test("Next moves to another question, plays it, and starts its attempts again; it needs the question to be over", () => {
  const s = initEar({ kind: "interval", seed: 4 });
  assert.deepEqual(reduceEar(s, { type: "NEXT" }), { state: s, effects: [] });
  const r = finish(s);
  assert.equal(r.state.index, 1);
  assert.equal(r.state.phase, "asking");
  assert.equal(r.state.attempts, 0);
  assert.deepEqual(r.effects, [{ type: "play", notes: r.state.question.notes }]);
});

test("play-back of an interval: any two notes at the right distance count, in any octave and either order", () => {
  const s = initEar({ kind: "interval", seed: 5 });
  const size = { M3: 4, P5: 7, P8: 12 }[answerOf(s)];
  const asc = step(s, { type: "NOTE_ON", midi: 60 }, { type: "NOTE_ON", midi: 60 + size });
  assert.equal(asc.state.phase, "answered");
  assert.equal(asc.effects.at(-1).kind, "correct");
  const high = step(s, { type: "NOTE_ON", midi: 84 }, { type: "NOTE_ON", midi: 84 - size });
  assert.equal(high.state.phase, "answered", "descending in another octave");
  const one = step(s, { type: "NOTE_ON", midi: 60 });
  assert.equal(one.state.phase, "asking", "one note is not an answer yet");
  const same = step(s, { type: "NOTE_ON", midi: 60 }, { type: "NOTE_ON", midi: 60 });
  assert.equal(same.state.phase, "asking", "the same note twice is not two notes");
});

test("a played interval of the wrong size is a wrong answer and the notes start over", () => {
  const s = initEar({ kind: "interval", seed: 5 });
  const size = { M3: 4, P5: 7, P8: 12 }[answerOf(s)];
  const r = step(s, { type: "NOTE_ON", midi: 60 }, { type: "NOTE_ON", midi: 60 + (size === 4 ? 5 : 4) });
  assert.equal(r.effects.at(-1).kind, "wrong");
  assert.deepEqual([r.state.attempts, r.state.pressed], [1, []]);
  const again = step(r.state, { type: "NOTE_ON", midi: 62 }, { type: "NOTE_ON", midi: 62 + size });
  assert.equal(again.state.phase, "answered");
});

test("play-back of a chord: its pitch classes in any octave and any order; a minor triad on A is A C E", () => {
  let s = initEar({ kind: "chord", seed: 1 });
  while (answerOf(s) !== "minor") s = finish(s).state;
  const root = s.question.root;
  const r = step(s, { type: "NOTE_ON", midi: root + 12 + 7 }, { type: "NOTE_ON", midi: root - 12 }, { type: "NOTE_ON", midi: root + 3 });
  assert.equal(r.state.phase, "answered");
  assert.equal(r.effects.at(-1).kind, "correct");
  const wrong = step(s, { type: "NOTE_ON", midi: root }, { type: "NOTE_ON", midi: root + 4 }, { type: "NOTE_ON", midi: root + 7 });
  assert.equal(wrong.effects.at(-1).kind, "wrong", "the major chord on the same root is not the minor one");
  const two = step(s, { type: "NOTE_ON", midi: root }, { type: "NOTE_ON", midi: root + 3 });
  assert.equal(two.state.phase, "asking", "two notes are not a chord yet");
});

test("note releases and notes outside a question are ignored", () => {
  const s = initEar({ kind: "interval", seed: 5 });
  assert.deepEqual(reduceEar(s, { type: "NOTE_OFF", midi: 60 }), { state: s, effects: [] });
  const done = reduceEar(s, { type: "ANSWER", id: answerOf(s) }).state;
  assert.deepEqual(reduceEar(done, { type: "NOTE_ON", midi: 60 }), { state: done, effects: [] });
});

test("after ten questions the round ends with the count, and a record of whether it was a good round", () => {
  let r = { state: initEar({ kind: "interval", seed: 8 }), effects: [] };
  for (let i = 0; i < ROUND; i += 1) r = finish(r.state);
  assert.equal(r.state.phase, "roundDone");
  assert.deepEqual(r.state.round, { answered: ROUND, correct: ROUND });
  assert.deepEqual(r.effects.find((e) => e.type === "record"), { type: "record", clean: true, correct: ROUND });
  assert.equal(ROUND, 10);
  assert.equal(UNLOCK_AT, 8);
});

test("8 of 10 right unlock the next choice, in the order of the design: perfect fourth first; 7 of 10 do not", () => {
  const play = (wrongCount) => {
    let r = { state: initEar({ kind: "interval", seed: 9 }), effects: [] };
    for (let i = 0; i < ROUND; i += 1) r = finish(r.state, { right: i >= wrongCount });
    return r;
  };
  const good = play(2);
  assert.equal(good.state.round.correct, 8);
  assert.equal(good.state.newOption, "P4");
  assert.equal(good.state.grown, 1);
  assert.deepEqual(good.effects.find((e) => e.type === "save"), { type: "save", grown: 1 });
  const bad = play(3);
  assert.equal(bad.state.round.correct, 7);
  assert.equal(bad.state.newOption, null);
  assert.equal(bad.effects.some((e) => e.type === "save"), false);
  assert.equal(bad.effects.find((e) => e.type === "record").clean, false);
});

test("a new round starts at question 1 with the unlocked choice among the options, the count back at zero", () => {
  let r = { state: initEar({ kind: "interval", seed: 9 }), effects: [] };
  for (let i = 0; i < ROUND; i += 1) r = finish(r.state);
  const again = reduceEar(r.state, { type: "ROUND" });
  assert.deepEqual(again.state.round, { answered: 0, correct: 0 });
  assert.deepEqual(again.state.question.options, ["P4", "M3", "P5", "P8"].sort((a, b) => ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"].indexOf(a) - ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"].indexOf(b)));
  assert.deepEqual(again.effects, [{ type: "play", notes: again.state.question.notes }]);
  assert.deepEqual(reduceEar(initEar({ kind: "interval", seed: 1 }), { type: "ROUND" }).effects, [], "only after a round ended");
});

test("the growth order is P4, m3, M6, M2, m6, m7, M7, TT, m2 for intervals, then dim and aug for chords; at the end nothing more unlocks", () => {
  assert.deepEqual(optionsFor("interval", 0), INTERVAL_START);
  assert.deepEqual(optionsFor("interval", 9), [...INTERVAL_START, ...INTERVAL_GROWTH]);
  assert.deepEqual(optionsFor("chord", 2), ["major", "minor", "dim", "aug"]);
  let r = { state: initEar({ kind: "chord", seed: 3, grown: 2 }), effects: [] };
  assert.deepEqual(r.state.question.options, ["major", "minor", "dim", "aug"]);
  for (let i = 0; i < ROUND; i += 1) r = finish(r.state);
  assert.equal(r.state.newOption, null, "every chord kind is already unlocked");
  assert.equal(r.state.grown, 2);
  assert.equal(initEar({ kind: "interval", seed: 1, grown: 99 }).grown, 9, "grown is capped");
});

test("the saved count of unlocked choices round-trips through the practice progress and refuses bad values", () => {
  let p = withEarGrown(emptyPracticeProgress(), "ear-intervals", 3);
  assert.equal(earGrown(p, "ear-intervals"), 3);
  const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  writePracticeProgress(store, p);
  assert.equal(earGrown(readPracticeProgress(store), "ear-intervals"), 3);
  assert.equal(withEarGrown(p, "Bad Id", 2), p);
  assert.equal(withEarGrown(p, "ear-intervals", -1), p);
  assert.equal(withEarGrown(p, "ear-intervals", 2.5), p);
  assert.equal(earGrown(emptyPracticeProgress(), "ear-chords"), 0);
  store.setItem("piano-guide:practice:v1", JSON.stringify({ v: 1, exercises: {}, ear: { "ear-intervals": "many", "ear-chords": 99 } }));
  assert.deepEqual(readPracticeProgress(store).ear, {}, "hand-edited values are dropped");
});

test("leaving releases every key", () => {
  assert.deepEqual(reduceEar(initEar({ kind: "interval", seed: 1 }), { type: "LEAVE" }).effects, [{ type: "releaseAll" }]);
});

test("between rounds there is nothing to listen to: Listen, answers and notes do nothing until a new round starts", () => {
  let r = { state: initEar({ kind: "interval", seed: 9 }), effects: [] };
  for (let i = 0; i < ROUND; i += 1) r = finish(r.state);
  for (const action of [{ type: "LISTEN" }, { type: "ANSWER", id: "M3" }, { type: "NOTE_ON", midi: 60 }, { type: "NEXT" }]) {
    assert.deepEqual(reduceEar(r.state, action), { state: r.state, effects: [] }, action.type);
  }
});
