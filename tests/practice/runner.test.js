import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, mergeHands, nextStage, nextTempo, runReduce, startRun, stepInstruction } from "../../src/practice/runner.js";
import { majorScale } from "../../src/theory/scales.js";
import { triad } from "../../src/theory/triads.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { renderInstruction } from "../../src/learn/instructions.js";

const stepsOf = (scale) => scale.notes.map((n) => ({ keys: [n] }));
const tap = (run, midi) => {
  const a = runReduce(run, { type: "on", midi });
  const b = runReduce(a.run, { type: "off", midi });
  return { run: b.run, outcome: a.outcome, finished: a.finished };
};
const play = (run, midis) => midis.reduce((r, m) => tap(r.run, m), { run });

test("a C major scale played in order ends with every step correct, the run done and clean", () => {
  const scale = majorScale("C");
  let run = startRun(stepsOf(scale));
  const outcomes = [];
  for (const n of scale.notes) {
    const r = tap(run, n.midi);
    outcomes.push(r.outcome);
    run = r.run;
  }
  assert.deepEqual(outcomes, Array(8).fill("correct"));
  assert.equal(run.done, true);
  assert.equal(run.clean, true);
  assert.equal(run.wrong, 0);
  assert.equal(run.index, 8);
});

test("the last correct press says finished; the ones before do not", () => {
  const scale = majorScale("G");
  let run = startRun(stepsOf(scale));
  const flags = scale.notes.map((n) => {
    const r = tap(run, n.midi);
    run = r.run;
    return r.finished;
  });
  assert.deepEqual(flags, [...Array(7).fill(false), true]);
});

test("a wrong key makes the run unclean, the step stays and the right key still completes it", () => {
  const scale = majorScale("C");
  let run = startRun(stepsOf(scale));
  run = tap(run, 60).run;
  const wrong = tap(run, 61);
  assert.equal(wrong.outcome, "wrong");
  assert.equal(wrong.run.index, 1, "the step did not move");
  assert.equal(wrong.run.clean, false);
  assert.equal(wrong.run.wrong, 1);
  const right = tap(wrong.run, 62);
  assert.equal(right.outcome, "correct");
  assert.equal(right.run.index, 2);
  assert.equal(right.run.clean, false, "once unclean, always unclean for this run");
});

test("the same note in another octave is reported as octave and also makes the run unclean", () => {
  const run = startRun(stepsOf(majorScale("C")));
  const r = tap(run, 72);
  assert.equal(r.outcome, "octave");
  assert.equal(r.run.clean, false);
});

test("counter-proof: an all-correct run is clean, so the unclean flag really comes from the wrong key", () => {
  const clean = play(startRun(stepsOf(majorScale("C"))), majorScale("C").notes.map((n) => n.midi));
  assert.equal(clean.run.clean, true);
  const dirty = play(startRun(stepsOf(majorScale("C"))), [61]);
  assert.equal(dirty.run.clean, false);
});

test("a chord step needs all its keys in any order, however far apart, and one wrong key clears the accumulation", () => {
  const chord = triad("C", "major", 0, "R");
  const run = startRun([{ keys: chord.notes }, { keys: triad("C", "major", 1, "R").notes }]);
  let r = runReduce(run, { type: "on", midi: 67 });
  assert.equal(r.outcome, "progress");
  r = runReduce(r.run, { type: "on", midi: 61 });
  assert.equal(r.outcome, "wrong");
  r = runReduce(runReduce(runReduce(r.run, { type: "off", midi: 61 }).run, { type: "off", midi: 67 }).run, { type: "on", midi: 60 });
  assert.equal(r.outcome, "progress", "the G was forgotten by the wrong key, the C counted");
  r = runReduce(r.run, { type: "on", midi: 64 });
  assert.equal(r.outcome, "progress");
  r = runReduce(r.run, { type: "on", midi: 67 });
  assert.equal(r.outcome, "correct");
  assert.equal(r.run.index, 1);
});

test("keys held when the run starts, or still down from the previous step, do not count until released", () => {
  const steps = [{ keys: [{ midi: 60 }] }, { keys: [{ midi: 60 }] }];
  let r = runReduce(startRun(steps, { held: [60] }), { type: "on", midi: 60 });
  assert.equal(r.outcome, "ignored", "a key held from before is ignored");
  r = runReduce(r.run, { type: "off", midi: 60 });
  r = runReduce(r.run, { type: "on", midi: 60 });
  assert.equal(r.outcome, "correct");
  // The same key is the next step too: it counts only after being released and pressed again.
  const again = runReduce(r.run, { type: "on", midi: 60 });
  assert.equal(again.outcome, "ignored");
  assert.equal(again.run.index, 1);
});

test("hands together: a step expects the keys of both hands, merged lowest first", () => {
  const right = stepsOf(majorScale("C", { hand: "R" }));
  const left = stepsOf(majorScale("C", { hand: "L" }));
  const both = mergeHands(right, left);
  assert.equal(both.length, 8);
  assert.deepEqual(both[0].keys.map((k) => k.midi), [48, 60]);
  let r = runReduce(startRun(both), { type: "on", midi: 60 });
  assert.equal(r.outcome, "progress", "one hand key is not the whole step");
  r = runReduce(r.run, { type: "on", midi: 48 });
  assert.equal(r.outcome, "correct");
  assert.equal(mergeHands([{ keys: [{ midi: 60 }] }], []).length, 1);
});

test("stages go right hand, left hand, then together, and then there is none", () => {
  assert.deepEqual(STAGES, ["R", "L", "T"]);
  assert.equal(nextStage("R"), "L");
  assert.equal(nextStage("L"), "T");
  assert.equal(nextStage("T"), null);
  assert.equal(nextStage("X"), null);
});

test("an empty sequence is a run that is already done, and events after the end are ignored", () => {
  assert.equal(startRun([]).done, true);
  const done = play(startRun([{ keys: [{ midi: 60 }] }]), [60]).run;
  assert.equal(runReduce(done, { type: "on", midi: 61 }).outcome, "ignored");
  assert.equal(done.clean, true, "a key after the end cannot spoil a finished run");
});

test("instructions: one hand names the hand, finger and note; a chord adds the count; two hands say both", () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => assert.fail("missing string") });
  const t = i18n.t;
  const one = renderInstruction(t, stepInstruction({ keys: [{ midi: 60, pitch: "C4", finger: 1, hand: "R" }] }), "en");
  assert.equal(one, "Right hand: thumb on C (Do).");
  const chord = renderInstruction(t, stepInstruction({ keys: triad("C", "major", 0, "R").notes }), "en");
  assert.equal(chord, "Right hand: thumb on C (Do). Press these 3 keys together.");
  const both = renderInstruction(t, stepInstruction({ keys: [{ midi: 48, pitch: "C3", finger: 5, hand: "L" }, { midi: 60, pitch: "C4", finger: 1, hand: "R" }] }), "en");
  assert.equal(both, "Both hands: thumb on C (Do) right, little finger on C (Do) left.");
  i18n.setLang("es");
  assert.equal(renderInstruction(i18n.t, stepInstruction({ keys: [{ midi: 60, pitch: "C4", finger: 1, hand: "R" }] }), "es"), "Mano derecha: pulgar en Do (C).");
});

test("tempo ramp: a clean run at 60 with steps 50 60 72 88 suggests 72", () => {
  assert.deepEqual(nextTempo([50, 60, 72, 88], 60, true), { bpm: 72, top: false });
  assert.deepEqual(nextTempo([50, 60, 72, 88], 50, true), { bpm: 60, top: false });
});

test("the ramp stops at the last step and says it is the top: clean at 88 stays 88", () => {
  assert.deepEqual(nextTempo([50, 60, 72, 88], 88, true), { bpm: 88, top: true });
  assert.deepEqual(nextTempo([50, 60, 72, 88], 100, true), { bpm: 100, top: true });
});

test("an unclean run does not ramp: at 72 it stays 72 and is not the top", () => {
  assert.deepEqual(nextTempo([50, 60, 72, 88], 72, false), { bpm: 72, top: false });
  assert.deepEqual(nextTempo([50, 60, 72, 88], 88, false), { bpm: 88, top: false });
});

test("a tempo between steps goes to the next step above it, and tempos stay inside 20 to 240", () => {
  assert.equal(nextTempo([50, 60, 72, 88], 65, true).bpm, 72);
  assert.equal(nextTempo([50, 60, 72, 88], 5, true).bpm, 50, "below the engine minimum is clamped to 20 first");
  assert.equal(nextTempo([50, 60, 300], 60, true).top, true, "a step beyond 240 is not offered");
  assert.equal(nextTempo([50, 60, 72], 999, false).bpm, 240);
  assert.deepEqual(nextTempo([], 70, true), { bpm: 70, top: false });
});
