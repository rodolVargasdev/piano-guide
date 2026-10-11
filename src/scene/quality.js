// The frame-time watchdog: keeps a rolling sample of frame times while the music plays, asks the
// pure decideTier (src/core/quality.js) what to do and tells the scene when the tier changes. A
// manual choice from the practice panel turns the watchdog off; "auto" turns it back on. No
// three.js and no DOM here, so it runs under node with a fake clock.
import { TIERS, WINDOW_FRAMES, createQualityState, decideTier } from "../core/quality.js";

// A frame longer than this is a hidden tab, a seek or a stall, not sustained load: it is not
// sampled (a 10 s frame in the average would drop a tier the moment the tab came back).
export const STALL_MS = 250;

/**
 * createWatchdog({ initial, onTier }) returns { frame(nowMs, playing), choose(choice), tier(), auto() }.
 * `initial` is the tier an Auto session starts at (initialTier() in core/quality.js); `onTier(tier)`
 * is called once at every change, including the first apply from `choose`.
 */
export function createWatchdog({ initial = "high", onTier = () => {} } = {}) {
  let tier = initial;
  let manual = null; // a tier name while the user overrides the watchdog
  let state = createQualityState();
  const sample = []; // frame times in ms, oldest first, newest last (decideTier reads it that way)
  let prev = null;

  function set(next) {
    if (next === tier) return;
    tier = next;
    onTier(tier);
  }

  return {
    /** Call once per drawn frame with the frame clock in ms; `playing` false means a redraw of a paused scene. */
    frame(nowMs, playing) {
      if (!playing) {
        prev = null; // the next playing frame has no valid previous frame
        return;
      }
      const dt = prev === null ? null : nowMs - prev;
      prev = nowMs;
      if (dt === null || dt <= 0 || dt > STALL_MS || manual !== null) return;
      sample.push(dt);
      if (sample.length > WINDOW_FRAMES) sample.shift();
      set(decideTier(sample, tier, state).tier);
    },

    /** A tier name overrides the watchdog; anything else ("auto") restarts it from the initial tier. */
    choose(choice) {
      if (TIERS.includes(choice)) {
        manual = choice;
        set(choice);
        return;
      }
      manual = null;
      state = createQualityState();
      sample.length = 0;
      prev = null;
      set(initial);
    },

    tier: () => tier,
    auto: () => manual === null,
  };
}
