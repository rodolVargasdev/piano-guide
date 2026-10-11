import { test } from "node:test";
import assert from "node:assert/strict";
import { ROTATIONS, initSession, listenPlan, reduceSession, tempoChoices } from "../../src/practice/session.js";
import { emptyPracticeProgress, recordRun } from "../../src/practice/progress.js";
import { exerciseById } from "../../src/practice/catalog.js";

const act = (s, ...actions) => {
  const effects = [];
  for (const a of actions) {
    const r = reduceSession(s, a);
    s = r.state;
    effects.push(...r.effects);
  }
  return { state: s, effects };
};
const midis = (s) => s.steps[s.run.index]?.keys.map((k) => k.midi);
// Plays the current run to its end with every right key (press and release), returning the final state and effects.
function playAll(s, { wrongAt = null } = {}) {
  const effects = [];
  let guard = 0;
  while (s.phase === "running" && guard++ < 200) {
    if (wrongAt === guard) {
      const r = reduceSession(s, { type: "NOTE_ON", midi: 21 });
      s = reduceSession(r.state, { type: "NOTE_OFF", midi: 21 }).state;
      effects.push(...r.effects);
    }
    for (const m of midis(s)) {
      const r = reduceSession(s, { type: "NOTE_ON", midi: m });
      effects.push(...r.effects);
      s = r.state;
    }
    for (const m of s.run.steps[Math.max(0, s.run.index - 1)].keys.map((k) => k.midi)) s = reduceSession(s, { type: "NOTE_OFF", midi: m }).state;
    for (const k of s.steps.flatMap((x) => x.keys.map((y) => y.midi))) s = reduceSession(s, { type: "NOTE_OFF", midi: k }).state;
  }
  return { state: s, effects };
}
const fresh = (over = {}) => initSession({ exerciseId: "scale-major", seed: 7, ...over });

test("a session starts on the C major scale, right hand, at the first tempo step, waiting for Start, on the circle of fifths", () => {
  const s = fresh();
  assert.equal(s.phase, "ready");
  assert.equal(s.options.key, "C");
  assert.equal(s.options.hand, "R");
  assert.equal(s.steps.length, 8);
  assert.equal(s.bpm, 50);
  assert.equal(s.metronome, false);
  assert.equal(s.rotation.kind, "circle");
  assert.deepEqual(s.rotation.keys.slice(0, 3), ["C", "G", "D"]);
  assert.equal(initSession({ exerciseId: "ear-intervals" }), null, "only runs");
  assert.equal(initSession({ exerciseId: "nope" }), null);
});

test("the tempo starts at the best clean tempo of the exercise in that key when there is one", () => {
  const p = recordRun(emptyPracticeProgress(), { exerciseId: "scale-major", key: "G", bpm: 72, clean: true, date: "2026-10-10" });
  assert.equal(fresh({ progress: p }).bpm, 50, "no record for C");
  assert.equal(fresh({ progress: p, options: { key: "G" } }).bpm, 72);
  assert.equal(fresh({ bpm: 60, progress: p, options: { key: "G" } }).bpm, 60, "an explicit tempo wins");
  const s = fresh({ progress: p });
  assert.equal(reduceSession(s, { type: "SET_OPTION", name: "key", value: "G" }).state.bpm, 72, "choosing the key brings its best tempo");
});

test("Start begins the run at step 1, stops any hearing and says so", () => {
  const { state, effects } = act(fresh(), { type: "START" });
  assert.equal(state.phase, "running");
  assert.equal(state.run.index, 0);
  assert.deepEqual(effects.map((e) => e.type), ["stopListen", "metronome", "announce"]);
  assert.equal(effects[1].on, false, "the metronome is off by default");
});

test("playing the scale right ends clean: every key announces Correct, the run is recorded once, and the next tempo is suggested", () => {
  const { state, effects } = act(fresh({ bpm: 60 }), { type: "START" });
  const done = playAll(state);
  assert.equal(done.state.phase, "done");
  assert.deepEqual(done.state.result, { clean: true, wrong: 0, bpm: 60, key: "C", hand: "R" });
  assert.equal(done.effects.filter((e) => e.type === "announce" && e.kind === "correct").length, 8);
  const records = done.effects.filter((e) => e.type === "record");
  assert.deepEqual(records, [{ type: "record", exerciseId: "scale-major", key: "C", hand: "R", bpm: 60, clean: true }]);
  assert.deepEqual(done.state.suggestion, { bpm: 72, top: false });
  assert.ok(done.effects.some((e) => e.type === "announce" && e.kind === "done" && e.clean === true));
  assert.equal(effects.some((e) => e.type === "record"), false);
});

test("a wrong key says so, keeps the step, and the finished run is recorded as not clean with the same tempo suggested", () => {
  const s = act(fresh({ bpm: 72 }), { type: "START" }).state;
  const wrong = reduceSession(s, { type: "NOTE_ON", midi: 21 });
  assert.deepEqual(wrong.effects, [{ type: "announce", kind: "wrong", midi: 21, keys: [60] }]);
  assert.equal(wrong.state.run.index, 0, "the step stays");
  const done = playAll(reduceSession(wrong.state, { type: "NOTE_OFF", midi: 21 }).state);
  assert.equal(done.state.result.clean, false);
  assert.equal(done.state.result.wrong, 1);
  assert.equal(done.effects.find((e) => e.type === "record").clean, false);
  assert.deepEqual(done.state.suggestion, { bpm: 72, top: false });
});

test("the same note in another octave announces octave, and counts as a wrong key", () => {
  const s = act(fresh(), { type: "START" }).state;
  const r = reduceSession(s, { type: "NOTE_ON", midi: 72 });
  assert.equal(r.effects[0].kind, "octave");
  assert.equal(r.state.run.clean, false);
});

test("at the last tempo step a clean run says it is the top and Faster does nothing", () => {
  const done = playAll(act(fresh({ bpm: 88 }), { type: "START" }).state).state;
  assert.deepEqual(done.suggestion, { bpm: 88, top: true });
  assert.deepEqual(reduceSession(done, { type: "FASTER" }), { state: done, effects: [] });
});

test("Again restarts at step 1 with the same key and tempo; Faster applies the suggestion and starts", () => {
  const done = playAll(act(fresh({ bpm: 60 }), { type: "START" }).state).state;
  const again = reduceSession(done, { type: "AGAIN" }).state;
  assert.deepEqual([again.phase, again.run.index, again.options.key, again.bpm], ["running", 0, "C", 60]);
  const faster = reduceSession(done, { type: "FASTER" }).state;
  assert.deepEqual([faster.phase, faster.run.index, faster.bpm, faster.suggestion], ["running", 0, 72, null]);
});

test("Next key goes around the circle of fifths: C then G, announced, with the G scale and its fingering on the keys and the tempo kept", () => {
  const done = playAll(act(fresh({ bpm: 72 }), { type: "START" }).state).state;
  const r = reduceSession(done, { type: "NEXT_KEY" });
  assert.deepEqual(r.effects.at(-1), { type: "announce", kind: "nextKey", key: "G" });
  assert.equal(r.state.options.key, "G");
  assert.equal(r.state.phase, "running");
  assert.equal(r.state.bpm, 72);
  assert.deepEqual(r.state.steps[0].keys[0].pitch, "G4");
  assert.equal(r.state.steps[6].keys[0].pitch, "F#5", "G major has F sharp");
  const d = playAll(r.state).state;
  assert.equal(reduceSession(d, { type: "NEXT_KEY" }).state.options.key, "D");
});

test("circle of fourths goes C F Bb; same key stays and offers no next key; random visits every key once before repeating", () => {
  const fourths = act(fresh({ rotation: "fourths" }), { type: "START" }).state;
  const keys = [];
  let s = fourths;
  for (let i = 0; i < 3; i += 1) {
    s = reduceSession(playAll(s).state, { type: "NEXT_KEY" }).state;
    keys.push(s.options.key);
  }
  assert.deepEqual(keys, ["F", "Bb", "Eb"]);
  const same = playAll(act(fresh({ rotation: "same" }), { type: "START" }).state).state;
  assert.deepEqual(reduceSession(same, { type: "NEXT_KEY" }), { state: same, effects: [] });
  let r = act(fresh({ rotation: "random", seed: 3 }), { type: "START" }).state;
  const seen = ["C"];
  for (let i = 0; i < 11; i += 1) {
    r = reduceSession(playAll(r).state, { type: "NEXT_KEY" }).state;
    seen.push(r.options.key);
  }
  assert.equal(new Set(seen).size, 12, `twelve keys once each: ${seen}`);
});

test("choosing a key by hand restarts the rotation from it: after G on the circle comes D", () => {
  const s = reduceSession(fresh(), { type: "SET_OPTION", name: "key", value: "A" }).state;
  assert.deepEqual(s.rotation.keys.slice(0, 2), ["A", "E"]);
  const next = reduceSession(playAll(act(s, { type: "START" }).state).state, { type: "NEXT_KEY" }).state;
  assert.equal(next.options.key, "E");
});

test("hand stages: right, then left, then together; after together there is no next stage", () => {
  let s = playAll(act(fresh(), { type: "START" }).state).state;
  s = reduceSession(s, { type: "NEXT_STAGE" }).state;
  assert.deepEqual([s.options.hand, s.phase, s.steps[0].keys[0].hand], ["L", "running", "L"]);
  s = reduceSession(playAll(s).state, { type: "NEXT_STAGE" }).state;
  assert.deepEqual([s.options.hand, s.steps[0].keys.length], ["T", 2]);
  const t = playAll(s).state;
  assert.deepEqual(reduceSession(t, { type: "NEXT_STAGE" }), { state: t, effects: [] });
});

test("an exercise without hand choices (none today) or a hand it does not offer is not advanced", () => {
  const s = fresh({ options: { hand: "T" } });
  assert.deepEqual(reduceSession(s, { type: "NEXT_STAGE" }), { state: s, effects: [] });
});

test("changing an option generates the exercise again, stops the run and returns to ready", () => {
  const running = act(fresh(), { type: "START" }).state;
  const r = reduceSession(running, { type: "SET_OPTION", name: "octaves", value: 2 });
  assert.equal(r.state.steps.length, 15);
  assert.deepEqual([r.state.phase, r.state.run], ["ready", null]);
  assert.equal(r.effects[0].type, "stopListen");
  assert.deepEqual(reduceSession(r.state, { type: "SET_OPTION", name: "nope", value: 1 }), { state: r.state, effects: [] });
  assert.equal(reduceSession(r.state, { type: "SET_OPTION", name: "octaves", value: 9 }).state.options.octaves, 1, "a value the card does not offer falls back");
});

test("tempo is clamped to 20 to 240, and the metronome effect follows the tempo and the run", () => {
  assert.equal(reduceSession(fresh(), { type: "SET_BPM", bpm: 999 }).state.bpm, 240);
  assert.equal(reduceSession(fresh(), { type: "SET_BPM", bpm: 1 }).state.bpm, 20);
  let { state, effects } = act(fresh(), { type: "SET_METRONOME", on: true });
  assert.deepEqual(effects, [{ type: "metronome", on: false, bpm: 50 }], "on, but nothing is running yet");
  ({ state, effects } = act(state, { type: "START" }));
  assert.deepEqual(effects.find((e) => e.type === "metronome"), { type: "metronome", on: true, bpm: 50 });
  ({ state, effects } = act(state, { type: "SET_BPM", bpm: 72 }));
  assert.deepEqual(effects, [{ type: "metronome", on: true, bpm: 72 }]);
  const done = playAll(state);
  assert.deepEqual(done.effects.find((e) => e.type === "metronome"), { type: "metronome", on: false, bpm: 72 }, "the clicks stop when the run ends");
  assert.deepEqual(act(done.state, { type: "STOP" }).effects.at(-1), { type: "metronome", on: false, bpm: 72 });
});

test("hearing the exercise first: the plan has one beat per step, every key at its time, and the page returns to ready", () => {
  const s = fresh({ bpm: 60 });
  const { state, effects } = act(s, { type: "LISTEN" });
  assert.equal(state.phase, "listening");
  const plan = effects.find((e) => e.type === "listen").plan;
  assert.equal(plan.beat, 1);
  assert.equal(plan.total, 8);
  assert.deepEqual(plan.notes.slice(0, 2).map((n) => [n.midi, n.at]), [[60, 0], [62, 1]]);
  assert.ok(plan.notes.every((n) => n.dur > 0 && n.dur < plan.beat));
  assert.equal(reduceSession(state, { type: "LISTEN_DONE" }).state.phase, "ready");
  assert.equal(reduceSession(s, { type: "LISTEN_DONE" }).state, s, "nothing to finish when not listening");
  assert.equal(reduceSession(act(s, { type: "START" }).state, { type: "LISTEN" }).state.phase, "running", "no Listen in the middle of a run");
});

test("chords sound together in the plan: a triad step has three notes at the same time", () => {
  const plan = listenPlan(initSession({ exerciseId: "triads" }).steps.slice(0, 2), 60);
  assert.equal(plan.notes.length, 6);
  assert.deepEqual(plan.notes.slice(0, 3).map((n) => n.at), [0, 0, 0]);
  assert.deepEqual(plan.notes.slice(3).map((n) => n.at), [1, 1, 1]);
});

test("after hearing a finished run, the page goes back to done with its buttons", () => {
  const done = playAll(act(fresh(), { type: "START" }).state).state;
  const heard = reduceSession(reduceSession(done, { type: "LISTEN" }).state, { type: "LISTEN_DONE" }).state;
  assert.equal(heard.phase, "done");
});

test("keys held when the run starts are not counted until released; presses outside a run do nothing", () => {
  const s = fresh();
  assert.deepEqual(reduceSession(s, { type: "NOTE_ON", midi: 60 }), { state: s, effects: [] }, "ready: ignored");
  const running = reduceSession(s, { type: "START", held: [60] }).state;
  const r = reduceSession(running, { type: "NOTE_ON", midi: 60 });
  assert.deepEqual(r.effects, []);
  assert.equal(r.state.run.index, 0);
});

test("a chord exercise: every chord needs all its keys, and the run completes", () => {
  let s = act(initSession({ exerciseId: "triads", seed: 2 }), { type: "START" }).state;
  assert.equal(s.steps[0].keys.length, 3);
  const first = reduceSession(s, { type: "NOTE_ON", midi: 60 });
  assert.equal(first.effects[0].kind, "progress");
  assert.equal(playAll(s).state.phase, "done");
});

test("the language is not part of the session: a SET_LANG action changes nothing, mid-run included", () => {
  const s = reduceSession(act(fresh({ options: { key: "G" } }), { type: "START" }).state, { type: "NOTE_ON", midi: 67 }).state;
  const r = reduceSession(s, { type: "SET_LANG", lang: "es" });
  assert.deepEqual(r, { state: s, effects: [] });
  assert.equal(r.state.run.index, 1);
  assert.equal(r.state.options.key, "G");
});

test("leaving stops hearing and the clicks and releases every key", () => {
  const r = reduceSession(act(fresh(), { type: "SET_METRONOME", on: true }, { type: "START" }).state, { type: "LEAVE" });
  assert.deepEqual(r.effects.map((e) => e.type), ["stopListen", "metronome", "releaseAll"]);
  assert.equal(r.effects[1].on, false);
  assert.equal(r.state.phase, "ready");
});

test("tempo choices are the card steps, plus a tempo that is none of them (so the current one is always on a button)", () => {
  const e = exerciseById("scale-major");
  assert.deepEqual(tempoChoices(e, 60), [50, 60, 72, 88]);
  assert.deepEqual(tempoChoices(e, 65), [50, 60, 65, 72, 88]);
  assert.deepEqual(ROTATIONS, ["circle", "fourths", "random", "same"]);
});

test("Next key keeps the tempo of the run even when the next key has a faster record of its own", () => {
  const p = recordRun(emptyPracticeProgress(), { exerciseId: "scale-major", key: "G", bpm: 88, clean: true, date: "2026-10-10" });
  const done = playAll(act(fresh({ bpm: 60, progress: p }), { type: "START" }).state).state;
  assert.equal(reduceSession(done, { type: "NEXT_KEY" }).state.bpm, 60);
});
