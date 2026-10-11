// Camera framing as pure numbers: no three.js import. The scene applies the pose to its camera.
// The camera looks down at the keyboard from the player's side; the wall of falling notes rises
// behind the keys, so the pose has to fit the whole key width and the wall height together.
import { WHITE_LENGTH, LANDING_Y, WALL_HEIGHT } from "./dims.js";

export const PITCH_DEG = 30; // how far the camera looks down
export const FOV_DEG = 38; // vertical field of view
const MARGIN = 1.06; // keep the framed box this much inside the screen edge
const MIN_DISTANCE = 6;

/** Corners of the box the camera must show: keybed front and cheeks, wall top at the back edge. */
export function framedPoints(width) {
  const half = width / 2 + 0.6;
  const pts = [];
  for (const x of [-half, half]) {
    pts.push({ x, y: 0, z: WHITE_LENGTH + 0.8 }); // front of the keybed
    pts.push({ x, y: 0, z: 0 });
    pts.push({ x, y: LANDING_Y + WALL_HEIGHT, z: -0.5 }); // top of the note wall
  }
  return pts;
}

/**
 * Pose that frames a keyboard `width` white keys wide on a viewport of `aspect` (w / h).
 * Returns { position, target, fov } with plain {x, y, z} objects. The camera looks along a fixed
 * pitch; its distance is the smallest one at which every corner of the framed box fits the
 * field of view with a small margin (perspective-correct: nearer corners need more room).
 */
export function framePose(width, aspect, { fov = FOV_DEG, pitch = PITCH_DEG } = {}) {
  const a = Math.max(0.2, aspect || 1);
  const p = (pitch * Math.PI) / 180;
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = tanV * a;
  const f = { y: -Math.sin(p), z: -Math.cos(p) }; // camera forward, in the y-z plane
  const u = { y: Math.cos(p), z: -Math.sin(p) }; // camera up
  const dot = (pt, v) => pt.y * v.y + pt.z * v.z;
  const pts = framedPoints(width);
  let vMin = Infinity;
  let vMax = -Infinity;
  let fSum = 0;
  for (const pt of pts) {
    vMin = Math.min(vMin, dot(pt, u));
    vMax = Math.max(vMax, dot(pt, u));
    fSum += dot(pt, f);
  }
  const vc = (vMin + vMax) / 2;
  const fc = fSum / pts.length;
  let distance = MIN_DISTANCE;
  for (const pt of pts) {
    const depth = dot(pt, f) - fc; // positive: farther from the camera than the target
    distance = Math.max(distance, (Math.abs(dot(pt, u) - vc) * MARGIN) / tanV - depth, (Math.abs(pt.x) * MARGIN) / tanH - depth);
  }
  const target = { x: 0, y: u.y * vc + f.y * fc, z: u.z * vc + f.z * fc };
  const position = { x: 0, y: target.y - f.y * distance, z: target.z - f.z * distance };
  return { position, target, fov };
}
