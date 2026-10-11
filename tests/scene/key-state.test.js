import { test } from "node:test";
import assert from "node:assert/strict";
import { createKeyState, updateKeyState, HAND_L, HAND_R } from "../../src/scene/key-state.js";

const note = (tick, dur, midi, hand) => ({ tick, dur, midi, hand });
const timeline = { notes: [note(0, 480, 60, "R"), note(0, 960, 48, "L"), note(480, 480, 64, "R")] };
const VISIBLE = { L: { muted: false, hidden: false }, R: { muted: false, hidden: false } };
const press = (state, tick, playing = true, modes = VISIBLE) => {
  updateKeyState(state, timeline, tick, playing, modes);
  return state.pressed;
};

test("keys sound with the hand that plays them, start inclusive and end exclusive", () => {
  const s = createKeyState();
  let p = press(s, 0);
  assert.equal(p[60], HAND_R);
  assert.equal(p[48], HAND_L);
  assert.equal(p[64], 0);
  p = press(s, 479);
  assert.equal(p[60], HAND_R);
  p = press(s, 480); // note 60 ends exactly here, note 64 starts
  assert.equal(p[60], 0);
  assert.equal(p[64], HAND_R);
  assert.equal(p[48], HAND_L);
  p = press(s, 960);
  assert.deepEqual([p[48], p[60], p[64]], [0, 0, 0], "everything has ended");
});

test("only the keys that changed are reported, and a repeat call reports nothing", () => {
  const s = createKeyState();
  assert.deepEqual([...updateKeyState(s, timeline, 0, true, VISIBLE)].sort((a, b) => a - b), [48, 60]);
  assert.equal(updateKeyState(s, timeline, 100, true, VISIBLE).length, 0);
  assert.deepEqual([...updateKeyState(s, timeline, 480, true, VISIBLE)].sort((a, b) => a - b), [60, 64]);
});

test("paused: nothing is lit by playback, and playing again lights the keys", () => {
  const s = createKeyState();
  press(s, 0);
  assert.deepEqual([...updateKeyState(s, timeline, 0, false, VISIBLE)].sort((a, b) => a - b), [48, 60], "keys released");
  assert.equal(s.pressed[60], 0);
  assert.equal(s.pressed[48], 0);
  assert.equal(press(s, 0, true)[60], HAND_R);
});

test("a seek leaves no stale key: jumping back and forth always shows the new position", () => {
  const s = createKeyState();
  press(s, 0);
  const p = press(s, 600); // seek into the middle of note 64 and the tail of note 48
  assert.equal(p[60], 0, "the note at the old position is gone");
  assert.equal(p[64], HAND_R);
  assert.equal(p[48], HAND_L);
  const back = press(s, 5000);
  assert.ok([...back].every((v) => v === 0));
});

test("a hidden hand lights nothing, a muted hand still does", () => {
  const s = createKeyState();
  const hiddenRight = { L: { muted: false, hidden: false }, R: { muted: false, hidden: true } };
  let p = press(s, 0, true, hiddenRight);
  assert.equal(p[60], 0);
  assert.equal(p[48], HAND_L);
  const mutedLeft = { L: { muted: true, hidden: false }, R: { muted: false, hidden: false } };
  p = press(s, 0, true, mutedLeft);
  assert.equal(p[48], HAND_L, "muted is audio only");
  assert.equal(p[60], HAND_R);
});

test("both hands on one key set both bits, and rests never light a key", () => {
  const s = createKeyState();
  const tl = { notes: [note(0, 480, 60, "R"), note(0, 480, 60, "L"), { tick: 0, dur: 480, midi: null, hand: "R", rest: true }] };
  updateKeyState(s, tl, 0, true, VISIBLE);
  assert.equal(s.pressed[60], HAND_L | HAND_R);
  assert.ok(s.pressed.every((v, m) => m === 60 || v === 0));
});

test("missing hand modes behave as all visible", () => {
  const s = createKeyState();
  updateKeyState(s, timeline, 0, true, undefined);
  assert.equal(s.pressed[60], HAND_R);
});

test("it agrees with core/timeline.activeAt at every tick of a dense sweep (the rule is duplicated for speed)", async () => {
  const { activeAt } = await import("../../src/core/timeline.js");
  const dense = { notes: [] };
  for (let i = 0; i < 40; i += 1) dense.notes.push(note(i * 120, 100 + (i % 5) * 200, 40 + (i % 12), i % 2 ? "L" : "R"));
  dense.notes.push({ tick: 600, dur: 300, midi: null, hand: "R", rest: true });
  dense.notes.sort((a, b) => a.tick - b.tick);
  const s = createKeyState();
  for (let tick = 0; tick < 6000; tick += 7) {
    updateKeyState(s, dense, tick, true, VISIBLE);
    const expected = new Uint8Array(128);
    for (const n of activeAt(dense, tick)) expected[n.midi] |= n.hand === "L" ? HAND_L : HAND_R;
    assert.deepEqual(s.pressed, expected, `tick ${tick}`);
  }
});
