import { test } from "node:test";
import assert from "node:assert/strict";
import { framePose, framedPoints, FOV_DEG } from "../../src/scene/camera.js";

// Project a world point through the pose with the same pinhole model three.js uses.
function project(pose, aspect, pt) {
  const { position: P, target: T, fov } = pose;
  const len = Math.hypot(T.y - P.y, T.z - P.z);
  const f = { y: (T.y - P.y) / len, z: (T.z - P.z) / len };
  const u = { y: -f.z, z: f.y }; // up, perpendicular to forward in the y-z plane
  const rel = { y: pt.y - P.y, z: pt.z - P.z };
  const depth = rel.y * f.y + rel.z * f.z;
  const tanV = Math.tan((fov * Math.PI) / 360);
  return { x: pt.x / (depth * tanV * aspect), y: (rel.y * u.y + rel.z * u.z) / (depth * tanV), depth };
}

const ASPECTS = [0.6, 1, 1.6, 2.2, 3.4];
const WIDTHS = [21, 36, 52];

test("every framed corner lands inside the screen for each width and aspect", () => {
  for (const width of WIDTHS) {
    for (const aspect of ASPECTS) {
      const pose = framePose(width, aspect);
      for (const pt of framedPoints(width)) {
        const s = project(pose, aspect, pt);
        assert.ok(s.depth > 0, "in front of the camera");
        assert.ok(Math.abs(s.x) <= 1 && Math.abs(s.y) <= 1, `w=${width} aspect=${aspect}: (${s.x.toFixed(2)}, ${s.y.toFixed(2)})`);
      }
    }
  }
});

test("the framing is tight: the limiting corner sits close to the screen edge", () => {
  for (const width of WIDTHS) {
    for (const aspect of ASPECTS) {
      const pose = framePose(width, aspect);
      const worst = Math.max(...framedPoints(width).map((pt) => {
        const s = project(pose, aspect, pt);
        return Math.max(Math.abs(s.x), Math.abs(s.y));
      }));
      assert.ok(worst > 0.9 && worst <= 1, `w=${width} aspect=${aspect}: worst ${worst.toFixed(3)}`);
    }
  }
});

test("counter-proof: a pose computed for another aspect clips the keyboard", () => {
  const wide = framePose(36, 3.4);
  const clipped = framedPoints(36).some((pt) => Math.abs(project(wide, 0.6, pt).x) > 1);
  assert.ok(clipped, "a landscape pose shown on a portrait viewport must overflow");
});

test("a wider keyboard or a narrower viewport moves the camera back", () => {
  const dist = (pose) => Math.hypot(pose.position.y - pose.target.y, pose.position.z - pose.target.z);
  assert.ok(dist(framePose(52, 1.6)) > dist(framePose(36, 1.6)));
  assert.ok(dist(framePose(36, 0.8)) > dist(framePose(36, 1.6)));
});

test("the pose is centered on the keyboard, looks down at the player's side and is deterministic", () => {
  const pose = framePose(36, 1.6);
  assert.equal(pose.position.x, 0);
  assert.equal(pose.target.x, 0);
  assert.ok(pose.position.y > pose.target.y, "camera above the target");
  assert.ok(pose.position.z > pose.target.z, "camera on the player side");
  assert.equal(pose.fov, FOV_DEG);
  assert.deepEqual(framePose(36, 1.6), pose);
});

test("a missing or zero aspect falls back to a usable pose", () => {
  for (const a of [0, undefined, Number.NaN]) {
    const pose = framePose(36, a);
    assert.ok(Number.isFinite(pose.position.y) && Number.isFinite(pose.position.z));
  }
});

// ---- section framing and tweens ----
import { sectionIndexAt, sectionSpan, focusPose, smoothstep, lerpPose, TWEEN_MS } from "../../src/scene/camera.js";

const SECTIONS = [
  { id: "intro", startTick: 0, endTick: 3840 },
  { id: "verse", startTick: 3840, endTick: 11520 },
  { id: "chorus", startTick: 11520, endTick: 21120 },
];

test("sectionIndexAt finds the section of a tick, with the end and the start clamped, and -1 without sections", () => {
  assert.equal(sectionIndexAt(SECTIONS, 0), 0);
  assert.equal(sectionIndexAt(SECTIONS, 3839), 0);
  assert.equal(sectionIndexAt(SECTIONS, 3840), 1, "the start tick belongs to the new section");
  assert.equal(sectionIndexAt(SECTIONS, 21120), 2, "the end of the song stays in the last section");
  assert.equal(sectionIndexAt(SECTIONS, -5), 0);
  assert.equal(sectionIndexAt([], 100), -1);
  assert.equal(sectionIndexAt(undefined, 100), -1);
});

test("sectionSpan keeps the section's pitched notes, pads them and clamps to the keyboard range", () => {
  const notes = [{ tick: 0, midi: 60 }, { tick: 480, midi: 72 }, { tick: 960, midi: null }, { tick: 4000, midi: 40 }, { tick: 5000, midi: 90 }];
  assert.deepEqual(sectionSpan(notes, SECTIONS[0], { low: 48, high: 83 }), { low: 57, high: 75 });
  assert.deepEqual(sectionSpan(notes, SECTIONS[1], { low: 48, high: 83 }), { low: 48, high: 83 }, "clamped to the range of the keyboard");
  assert.equal(sectionSpan(notes, SECTIONS[2], { low: 48, high: 83 }), null, "a section without notes");
  assert.deepEqual(sectionSpan(notes, { startTick: 0, endTick: 1 }, { low: 0, high: 127 }, 0), { low: 60, high: 60 });
});

test("focusPose is framePose slid sideways: the same distance and height, centered on the focus", () => {
  const base = framePose(24, 1.8);
  const moved = focusPose(7.5, 24, 1.8);
  assert.equal(moved.position.x, base.position.x + 7.5);
  assert.equal(moved.target.x, base.target.x + 7.5);
  assert.equal(moved.position.y, base.position.y);
  assert.equal(moved.position.z, base.position.z);
  assert.ok(framePose(24, 1.8).position.x === 0, "counter-proof: framePose itself still returns a centered pose");
});

test("a narrower focus never moves the camera away, and brings it closer where the width is what limits the frame", () => {
  const dist = (p) => Math.hypot(p.position.y - p.target.y, p.position.z - p.target.z);
  for (const aspect of ASPECTS) assert.ok(dist(focusPose(0, 20, aspect)) <= dist(focusPose(0, 36, aspect)) + 1e-9, `aspect ${aspect}`);
  assert.ok(dist(focusPose(0, 20, 0.6)) < dist(focusPose(0, 36, 0.6)), "a portrait screen is limited by width");
});

test("smoothstep eases in and out and stays inside 0 to 1", () => {
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.equal(smoothstep(0.5), 0.5);
  assert.ok(smoothstep(0.1) < 0.1 && smoothstep(0.9) > 0.9, "slow at the ends");
  assert.equal(smoothstep(-3), 0);
  assert.equal(smoothstep(9), 1);
});

test("lerpPose moves from one pose to the other, fills the given object and allocates nothing new", () => {
  const a = framePose(36, 1.8);
  const b = focusPose(9, 20, 1.8);
  const out = framePose(36, 1.8);
  const same = lerpPose(a, b, 0.5, out);
  assert.equal(same, out, "returns the object it was given");
  assert.ok(Math.abs(out.position.x - (a.position.x + b.position.x) / 2) < 1e-12);
  assert.equal(lerpPose(a, b, 0, out).position.x, a.position.x);
  assert.equal(lerpPose(a, b, 1, out).target.x, b.target.x);
  assert.ok(TWEEN_MS >= 800 && TWEEN_MS <= 2500, "a visible but short move");
});
