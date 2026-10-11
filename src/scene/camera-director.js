// Decides where the camera is at each tick: one framing per song section, and a smooth move
// between them when playback crosses a boundary. Under reduced motion the move is a single cut.
// No three.js: the director hands a pose to `apply` (the stage) and keeps one reused pose object,
// so the per-frame call allocates nothing.
import { sectionIndexAt, sectionSpan, focusPose, smoothstep, lerpPose, TWEEN_MS } from "./camera.js";

const MIN_FOCUS = 0.6; // a section never frames less than this share of the keyboard width
const MARGIN_KEYS = 4; // white keys of room around a section's lowest and highest note

const emptyPose = () => ({ position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 0 });

/**
 * createCameraDirector({ apply }) returns { layout, at, setReducedMotion, animating, info }.
 * `layout({ timeline, range, centerX, width, aspect }, tick)` (re)builds the framings (call it when
 * the keyboard, the level or the screen shape changes) and cuts to the one in force at `tick`.
 * `at(tick, nowMs)` is the per-frame call. `centerX[midi]` is the world x of a key, `width` the
 * keyboard width in white keys.
 */
export function createCameraDirector({ apply }) {
  let sections = []; // empty when the song has no section boundary to move across
  let poses = [];
  let index = -2; // -2: nothing shown yet, the next call cuts
  let tween = null;
  let reduced = false;
  const shown = emptyPose();

  function show(pose) {
    lerpPose(pose, pose, 0, shown);
    tween = null;
    apply(shown);
  }

  const director = {
    layout({ timeline, range, centerX, width, aspect }, tick = 0) {
      sections = (timeline.sections ?? []).length > 1 ? timeline.sections : [];
      if (sections.length === 0) poses = [focusPose(0, width, aspect)];
      else {
        poses = sections.map((section) => {
          const span = sectionSpan(timeline.notes, section, range);
          if (!span) return focusPose(0, width, aspect);
          const cx = (centerX[span.low] + centerX[span.high]) / 2;
          const wide = centerX[span.high] - centerX[span.low] + 2 * MARGIN_KEYS;
          return focusPose(cx, Math.min(width, Math.max(width * MIN_FOCUS, wide)), aspect);
        });
      }
      index = -2;
      director.at(tick, 0);
    },

    /** Place the camera for `tick`: cut on the first call and under reduced motion, tween between sections otherwise. */
    at(tick, nowMs) {
      const i = sections.length === 0 ? 0 : sectionIndexAt(sections, tick);
      if (i !== index) {
        const first = index === -2;
        index = i;
        if (first || reduced) show(poses[i]);
        else tween = { from: lerpPose(shown, shown, 0, emptyPose()), to: poses[i], start: nowMs };
      }
      if (tween === null) return;
      const k = (nowMs - tween.start) / TWEEN_MS;
      if (k >= 1) show(tween.to);
      else {
        lerpPose(tween.from, tween.to, smoothstep(k), shown);
        apply(shown);
      }
    },

    /** Turning reduced motion on finishes a move in progress at once; turning it off changes nothing until the next boundary. */
    setReducedMotion(on) {
      reduced = on === true;
      if (reduced && tween !== null) show(tween.to);
    },

    animating: () => tween !== null,
    info: () => ({ section: index, tween: tween !== null }),
  };
  return director;
}
