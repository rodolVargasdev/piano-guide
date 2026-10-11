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

export const TWEEN_MS = 1400; // a section move takes this long (never under reduced motion)

/** Index of the section holding `tick` (the last one past the end, the first before the start); -1 without sections. */
export function sectionIndexAt(sections, tick) {
  if (!sections || sections.length === 0) return -1;
  let found = 0;
  for (let i = 0; i < sections.length; i += 1) if (tick >= sections[i].startTick) found = i;
  return found;
}

/**
 * The lowest and highest MIDI key to keep in view for a section: the pitched notes that start inside it,
 * padded by `pad` semitones and clamped to `range` ({ low, high }). Null when the section has no notes.
 */
export function sectionSpan(notes, section, range, pad = 3) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) {
    if (n.tick < section.startTick) continue;
    if (n.tick >= section.endTick) break; // notes are sorted by tick
    if (n.midi === null || !Number.isFinite(n.midi)) continue;
    if (n.midi < lo) lo = n.midi;
    if (n.midi > hi) hi = n.midi;
  }
  if (lo === Infinity) return null;
  return { low: Math.max(range.low, lo - pad), high: Math.min(range.high, hi + pad) };
}

/** Pose that frames `width` white keys centered at world x `cx`: framePose, slid sideways. */
export function focusPose(cx, width, aspect) {
  const p = framePose(width, aspect);
  p.position.x += cx;
  p.target.x += cx;
  return p;
}

/** 0 to 1 with zero slope at both ends: a move that eases in and out. */
export function smoothstep(k) {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/** Write the pose between `a` and `b` at `k` (0 to 1, already eased) into `out` and return it; allocates nothing. */
export function lerpPose(a, b, k, out) {
  for (const part of ["position", "target"]) {
    out[part].x = a[part].x + (b[part].x - a[part].x) * k;
    out[part].y = a[part].y + (b[part].y - a[part].y) * k;
    out[part].z = a[part].z + (b[part].z - a[part].z) * k;
  }
  out.fov = a.fov + (b.fov - a.fov) * k;
  return out;
}
