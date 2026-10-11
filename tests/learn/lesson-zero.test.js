import { test } from "node:test";
import assert from "node:assert/strict";
import { FINGER_REGION, FINGER_STEPS, FIND_C_REGION, ZERO_PARTS, blackGroups, initZero, reduceZero, zeroKeyboard } from "../../src/learn/lesson-zero.js";

const on = (midi) => ({ type: "NOTE_ON", midi });
const off = (midi) => ({ type: "NOTE_OFF", midi });
const press = (midi) => [on(midi), off(midi)];
const act = (z, ...actions) => {
  const effects = [];
  for (const a of actions) {
    const r = reduceZero(z, typeof a === "string" ? { type: a } : a);
    z = r.state;
    effects.push(...r.effects);
  }
  return { state: z, effects };
};
const pitchClass = (m) => ((m % 12) + 12) % 12;

test("the four parts are find C, posture, fingers and inputs, in that order", () => {
  assert.deepEqual(ZERO_PARTS.map((p) => p.id), ["findC", "posture", "fingers", "inputs"]);
  assert.deepEqual(ZERO_PARTS.map((p) => p.kind), ["press", "read", "steps", "read"]);
});

test("the groups of black keys: two groups of two and two of three over C3 to B4, and C is the white key left of each group of two", () => {
  const { two, three } = blackGroups(FIND_C_REGION);
  assert.deepEqual(two, [49, 51, 61, 63]);
  assert.deepEqual(three, [54, 56, 58, 66, 68, 70]);
  for (const first of [two[0], two[2]]) assert.equal(pitchClass(first - 1), 0, "the white key just left of the first black key of a group of two is a C");
  // Counter-proof: the first black key of a group of three has an F to its left, not a C.
  assert.equal(pitchClass(three[0] - 1), 5);
});

test("part 1: any C satisfies it, in any octave", () => {
  for (const c of [48, 60]) {
    const r = act(initZero(), ...press(c));
    assert.equal(r.state.part, 1, `C at ${c}`);
    assert.deepEqual(r.state.feedback, { kind: "correct", midi: c });
    assert.deepEqual(r.effects, [{ type: "announce", kind: "correct", midi: c }]);
  }
});

test("part 1: another key says wrong and the part stays; the next C still counts (counter-proof of the C rule)", () => {
  for (const other of [62, 61, 59, 65]) {
    const r = act(initZero(), ...press(other));
    assert.equal(r.state.part, 0, `key ${other} must not advance`);
    assert.deepEqual(r.state.feedback, { kind: "wrong", midi: other });
    assert.deepEqual(r.effects, [{ type: "announce", kind: "wrong", midi: other }]);
  }
  const then = act(initZero(), ...press(62), ...press(48));
  assert.equal(then.state.part, 1);
});

test("a key held when lesson zero opens does not count until it is released and pressed again", () => {
  const z = initZero([60]);
  assert.equal(act(z, on(60)).state.part, 0, "an auto-repeat of the held C is ignored");
  assert.equal(act(z, off(60), on(60)).state.part, 1, "released and pressed anew it counts");
});

test("part 2 (posture) waits for Next and ignores keys; Next leads to the finger steps", () => {
  const posture = act(initZero(), ...press(60)).state;
  assert.equal(posture.part, 1);
  assert.deepEqual(act(posture, ...press(62)).effects, []);
  assert.equal(act(posture, ...press(62)).state.part, 1);
  const fingers = act(posture, "NEXT").state;
  assert.equal(fingers.part, 2);
  assert.equal(fingers.stepIndex, 0);
  // Next does nothing on the parts that wait for a key.
  assert.equal(act(initZero(), "NEXT").state.part, 0);
  assert.equal(act(fingers, "NEXT").state.part, 2);
});

test("part 3: five single-key steps, C D E F G with the fingers 1 to 5, each acknowledged, then part 4", () => {
  assert.deepEqual(FINGER_STEPS.map((s) => [s.pitch, s.finger, s.midi]), [["C4", 1, 60], ["D4", 2, 62], ["E4", 3, 64], ["F4", 4, 65], ["G4", 5, 67]]);
  let z = act(initZero(), ...press(60), "NEXT").state;
  const announced = [];
  FINGER_STEPS.forEach((s, i) => {
    assert.equal(z.part, 2);
    assert.equal(z.stepIndex, i);
    const r = act(z, ...press(s.midi));
    announced.push(...r.effects.filter((e) => e.kind === "correct").map((e) => e.midi));
    z = r.state;
  });
  assert.deepEqual(announced, [60, 62, 64, 65, 67]);
  assert.equal(z.part, 3, "the part completes after G");
});

test("part 3: an out-of-order or other key is wrong and the finger step stays (counter-proof)", () => {
  const z = act(initZero(), ...press(60), "NEXT").state;
  const wrong = act(z, ...press(64)); // E4 before C4 and D4
  assert.equal(wrong.state.stepIndex, 0);
  assert.equal(wrong.state.feedback.kind, "wrong");
  const octave = act(z, ...press(72)); // C5 is the right note in another octave
  assert.equal(octave.state.stepIndex, 0);
  assert.equal(octave.state.feedback.kind, "octave", "exact keys in part 3, unlike part 1");
});

test("part 3: the C that satisfied part 1 and is still held does not satisfy finger 1", () => {
  const z = act(initZero(), on(60), "NEXT").state; // C4 still down
  assert.equal(act(z, on(60)).state.stepIndex, 0);
  assert.equal(act(z, off(60), on(60)).state.stepIndex, 1);
});

test("part 4: Next finishes the lesson with a finish effect", () => {
  let z = act(initZero(), ...press(60), "NEXT").state;
  for (const s of FINGER_STEPS) z = act(z, ...press(s.midi)).state;
  assert.equal(z.part, 3);
  assert.deepEqual(act(z, "NEXT").effects, [{ type: "finish" }]);
  assert.deepEqual(act(z, ...press(60)).effects, [], "keys do nothing on the last reading part");
});

test("zeroKeyboard: groups of two outlined on part 1, the finger key shaded on part 3, names only on the reading parts", () => {
  const first = zeroKeyboard(initZero());
  assert.deepEqual(first.region, FIND_C_REGION);
  assert.deepEqual(first.hints, [49, 51, 61, 63]);
  assert.deepEqual(first.stepKeys, [], "part 1 shades nothing: the learner finds C");
  const posture = zeroKeyboard(act(initZero(), ...press(60)).state);
  assert.deepEqual([posture.hints, posture.stepKeys], [[], []]);
  const third = zeroKeyboard(act(initZero(), ...press(60), "NEXT", ...press(60)).state);
  assert.deepEqual(third.region, FINGER_REGION);
  assert.deepEqual(third.stepKeys, [{ midi: 62, finger: 2, hand: "R" }], "after C comes finger 2 on D");
  assert.deepEqual(third.positionKeys.map((k) => k.midi), [60, 64, 65, 67], "the other four finger keys carry a quiet number");
});

test("an unknown action throws", () => {
  assert.throws(() => reduceZero(initZero(), { type: "NOPE" }), TypeError);
});
