import { test } from "node:test";
import assert from "node:assert/strict";
import { matchEvent, startStep } from "../../src/learn/matcher.js";

const on = (midi, extra = {}) => ({ type: "on", midi, ...extra });
const off = (midi) => ({ type: "off", midi });
/** Feeds events in order; returns the final matcher and the outcome list. */
function feed(m, events) {
  const outcomes = [];
  for (const e of events) {
    const r = matchEvent(m, e);
    m = r.m;
    outcomes.push(r.outcome);
  }
  return { m, outcomes };
}
const E4 = 64;
const F4 = 65;
const CHORD = [60, 64, 67]; // C4 E4 G4

test("a single expected key satisfies the step", () => {
  assert.deepEqual(feed(startStep([E4], []), [on(E4)]).outcomes, ["satisfied"]);
});

test("a wrong key says wrong, keeps the step open, and the right key then satisfies it", () => {
  const { m, outcomes } = feed(startStep([E4], []), [on(F4), off(F4), on(E4)]);
  assert.deepEqual(outcomes, ["wrong", "ignored", "satisfied"]);
  assert.equal(m.satisfied, true);
});

test("a chord is satisfied by its keys in any order and however far apart: the matcher reads no time", () => {
  const near = feed(startStep(CHORD, []), [on(67, { at: 0 }), on(60, { at: 80 }), on(64, { at: 280 })]);
  assert.deepEqual(near.outcomes, ["progress", "progress", "satisfied"]);
  const minutesApart = feed(startStep(CHORD, []), [on(60, { at: 0 }), on(64, { at: 60_000 }), on(67, { at: 600_000 })]);
  assert.deepEqual(minutesApart.outcomes, ["progress", "progress", "satisfied"], "no limit between keys");
});

test("a chord tapped one key at a time with a single pointer (each released before the next) is satisfied", () => {
  const { outcomes } = feed(startStep(CHORD, []), [on(60), off(60), on(64), off(64), on(67), off(67)]);
  assert.deepEqual(outcomes, ["progress", "ignored", "progress", "ignored", "satisfied", "ignored"]);
});

test("a wrong key among the right ones clears the accumulation: all keys are needed again", () => {
  const { m, outcomes } = feed(startStep(CHORD, []), [on(60), on(64), on(F4), off(60), off(64), off(F4)]);
  assert.deepEqual(outcomes.slice(0, 3), ["progress", "progress", "wrong"]);
  assert.equal(m.pressed.size, 0);
  const again = feed(m, [on(60), on(64)]);
  assert.deepEqual(again.outcomes, ["progress", "progress"], "two keys are not enough after the clear");
  assert.deepEqual(feed(again.m, [on(67)]).outcomes, ["satisfied"]);
});

test("a key held from the previous step neither satisfies nor spoils the step until it is pressed again", () => {
  const m = startStep([E4], [E4]); // E4 still held from before
  assert.deepEqual(feed(m, [on(E4)]).outcomes, ["ignored"], "an expected key that is still held does not count");
  assert.deepEqual(feed(startStep([E4], [F4]), [on(F4)]).outcomes, ["ignored"], "an unexpected held key does not spoil the step either");
  const released = feed(m, [off(E4), on(E4)]);
  assert.deepEqual(released.outcomes, ["ignored", "satisfied"], "released and pressed again it counts as a new press");
  const releasedWrong = feed(startStep([E4], [F4]), [off(F4), on(F4)]);
  assert.deepEqual(releasedWrong.outcomes, ["ignored", "wrong"], "an unexpected held key counts as wrong once pressed again");
});

test("auto-repeat: a repeated note-on of a key that is down is ignored", () => {
  const chord = feed(startStep(CHORD, []), [on(60), on(60), on(60), on(64)]);
  assert.deepEqual(chord.outcomes, ["progress", "ignored", "ignored", "progress"]);
  const wrongRepeat = feed(startStep([E4], []), [on(F4), on(F4), on(F4)]);
  assert.deepEqual(wrongRepeat.outcomes, ["wrong", "ignored", "ignored"], "a held wrong key reports once");
});

test("the same pitch class in another octave is a wrong key reported as 'octave'", () => {
  const { outcomes } = feed(startStep([E4], []), [on(E4 + 12), off(E4 + 12), on(E4 - 12)]);
  assert.deepEqual(outcomes, ["octave", "ignored", "octave"]);
  assert.deepEqual(feed(startStep([E4], []), [on(E4 + 12)]).m.pressed.size, 0, "and it clears the accumulation like any wrong key");
});

test("pitch-class mode: any C satisfies, and other keys are plain wrong (counter-proof: exact mode refuses the other C)", () => {
  assert.deepEqual(feed(startStep([60], [], { match: "pitchClass" }), [on(72)]).outcomes, ["satisfied"]);
  assert.deepEqual(feed(startStep([60], [], { match: "pitchClass" }), [on(62)]).outcomes, ["wrong"]);
  assert.deepEqual(feed(startStep([60], []), [on(72)]).outcomes, ["octave"], "exact mode: the other C is not accepted");
});

test("after the step is satisfied every further event is ignored", () => {
  const { m } = feed(startStep([E4], []), [on(E4)]);
  assert.deepEqual(feed(m, [on(F4), off(E4), on(E4)]).outcomes, ["ignored", "ignored", "ignored"]);
});

test("events never mutate the previous state", () => {
  const m0 = startStep(CHORD, []);
  const snapshot = JSON.stringify([m0.expected, [...m0.pressed], [...m0.down]]);
  matchEvent(m0, on(60));
  assert.equal(JSON.stringify([m0.expected, [...m0.pressed], [...m0.down]]), snapshot);
});
