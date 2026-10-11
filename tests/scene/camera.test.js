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
