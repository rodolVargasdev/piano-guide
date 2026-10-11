import { test } from "node:test";
import assert from "node:assert/strict";
import { createCameraDirector } from "../../src/scene/camera-director.js";
import { TWEEN_MS } from "../../src/scene/camera.js";

const centerX = new Float32Array(128).map((_, m) => m - 65);
const range = { low: 40, high: 90 };
const sections = [
  { id: "intro", startTick: 0, endTick: 3840 },
  { id: "verse", startTick: 3840, endTick: 7680 },
  { id: "chorus", startTick: 7680, endTick: 11520 },
];
const notes = [
  { tick: 0, midi: 48 }, { tick: 960, midi: 60 }, // intro, low
  { tick: 3840, midi: 60 }, { tick: 4800, midi: 64 }, // verse, middle
  { tick: 7680, midi: 78 }, { tick: 9000, midi: 88 }, // chorus, high
];
const input = (over = {}) => ({ timeline: { sections, notes }, range, centerX, width: 50, aspect: 1.8, ...over });

function rig() {
  const calls = [];
  const objects = new Set();
  const director = createCameraDirector({
    apply: (pose) => {
      objects.add(pose);
      calls.push({ x: pose.position.x, tx: pose.target.x });
    },
  });
  return { director, calls, objects, last: () => calls[calls.length - 1] };
}

test("the first call cuts to the framing of the section in force, no tween", () => {
  const { director, calls } = rig();
  director.layout(input(), 0);
  assert.equal(calls.length, 1);
  assert.equal(director.animating(), false);
  assert.ok(calls[0].x < 0, "the intro is low on the keyboard: the camera sits left of center");
});

test("crossing a boundary starts a tween that eases to the next framing over TWEEN_MS", () => {
  const { director, calls, last } = rig();
  director.layout(input(), 0);
  const from = last().x;
  director.at(3840, 1000); // the verse begins
  assert.equal(director.animating(), true);
  director.at(3841, 1000 + TWEEN_MS / 2);
  const mid = last().x;
  director.at(3842, 1000 + TWEEN_MS + 1);
  const to = last().x;
  assert.equal(director.animating(), false, "the move ends");
  assert.ok(from < mid && mid < to, `eases from ${from} through ${mid} to ${to}`);
  assert.ok(Math.abs(mid - (from + to) / 2) < 1e-9, "the half way point of a smoothstep is the middle");
  assert.ok(calls.length >= 3);
});

test("the camera never jumps during a tween: consecutive frames move by small steps", () => {
  const { director, calls } = rig();
  director.layout(input(), 0);
  director.at(7680, 0); // intro to chorus is the longest move (via a seek)
  let prev = calls[calls.length - 1].x;
  let biggest = 0;
  for (let t = 16; t <= TWEEN_MS; t += 16) {
    director.at(7681, t);
    const x = calls[calls.length - 1].x;
    biggest = Math.max(biggest, Math.abs(x - prev));
    prev = x;
  }
  const total = Math.abs(prev - calls[0].x);
  assert.ok(biggest < total * 0.06, `largest step ${biggest.toFixed(3)} of a ${total.toFixed(2)} move`);
});

test("under reduced motion a boundary is a single cut and nothing animates", () => {
  const { director, last } = rig();
  director.layout(input(), 0);
  director.setReducedMotion(true);
  const before = last().x;
  director.at(3840, 500);
  assert.equal(director.animating(), false);
  assert.ok(last().x > before, "already at the verse framing on the very frame of the boundary");
});

test("turning reduced motion on in the middle of a tween finishes it at once", () => {
  const { director, last } = rig();
  director.layout(input(), 0);
  director.at(3840, 0);
  director.at(3841, TWEEN_MS / 4);
  const mid = last().x;
  director.setReducedMotion(true);
  assert.equal(director.animating(), false);
  assert.ok(last().x > mid, "jumped to the target");
});

test("clearing reduced motion resumes tweens at the NEXT boundary, not on the spot", () => {
  const { director, last } = rig();
  director.layout(input(), 0);
  director.setReducedMotion(true);
  director.at(3840, 0); // cut
  director.setReducedMotion(false);
  assert.equal(director.animating(), false, "clearing it starts no move by itself");
  director.at(5000, 100);
  assert.equal(director.animating(), false, "still inside the same section");
  director.at(7680, 200);
  assert.equal(director.animating(), true, "the next boundary tweens again");
  assert.ok(last().x);
});

test("a song with a single section never moves the camera, whatever the tick", () => {
  const { director, calls } = rig();
  director.layout(input({ timeline: { sections: [sections[0]], notes } }), 0);
  for (const t of [0, 5000, 99999]) director.at(t, t);
  assert.equal(director.animating(), false);
  assert.ok(new Set(calls.map((c) => c.x)).size === 1, "one framing only");
  assert.equal(calls[0].x, 0, "centered on the whole keyboard");
});

test("a new layout (a resize or a range change) cuts to the section in force and drops a move in progress", () => {
  const { director } = rig();
  director.layout(input(), 0);
  director.at(3840, 0);
  assert.equal(director.animating(), true);
  director.layout(input({ aspect: 1.2 }), 4000);
  assert.equal(director.animating(), false);
  assert.equal(director.info().section, 1);
});

test("a section without notes frames the whole keyboard", () => {
  const { director, last } = rig();
  director.layout(input({ timeline: { sections, notes: notes.slice(0, 4) } }), 8000); // chorus has no notes
  assert.equal(last().x, 0);
});

test("the director reuses one pose object: the per-frame call does not allocate poses", () => {
  const { director, objects } = rig();
  director.layout(input(), 0);
  director.at(3840, 0);
  for (let t = 0; t < TWEEN_MS; t += 16) director.at(3841, t);
  assert.equal(objects.size, 1);
});
