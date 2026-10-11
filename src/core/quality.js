// Pure quality-tier decision for the 3D scene. No DOM, no clock: the caller samples frame times
// and applies the returned tier. Tiers only ever go down on sustained slowness, and go back up
// at most once per session after sustained headroom, so there is no oscillation.

export const TIERS = Object.freeze(["high", "medium", "low", "minimum"]);

export const WINDOW_FRAMES = 120; // rolling sample the caller keeps
export const MIN_FRAMES = 30; // no decision before this many frames are known
export const SLOW_AVG_MS = 22; // average above this counts as slow
export const SLOW_HOLD_MS = 2000; // slow for this long steps down one tier
export const FAST_AVG_MS = 10; // average below this counts as headroom
export const FAST_HOLD_MS = 20000; // headroom for this long steps up one tier, once
const MAX_FRAME_MS = 100; // a longer frame is a hidden tab or a stall, not sustained load

/** Fresh state for one session; pass the same object to every decideTier call. */
export function createQualityState() {
  return { slowMs: 0, fastMs: 0, settle: 0, steppedUp: false };
}

/**
 * First tier of a session: Medium on small or touch devices, High otherwise.
 * `env` is `{ hardwareConcurrency, coarsePointer }`.
 */
export function initialTier({ hardwareConcurrency, coarsePointer } = {}) {
  const fewCores = Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 4;
  return fewCores || coarsePointer === true ? "medium" : "high";
}

/**
 * Decide the tier after one more frame. Call once per frame: `frameTimesMs` is the rolling
 * sample (up to WINDOW_FRAMES, oldest first) and its LAST item is the newest frame, whose
 * duration advances the sustained-time counters. `state` comes from createQualityState and is
 * updated in place. Returns `{ tier, state }`; `tier` differs from `currentTier` only on a step.
 *
 * - Down: average above 22 ms for 2 consecutive seconds steps down exactly one tier, never below
 *   "minimum". After a step the sample must refill (WINDOW_FRAMES frames) before the next decision.
 * - Up: average below 10 ms for 20 consecutive seconds steps up one tier, at most once per session.
 * - Anything between the two thresholds resets both counters.
 */
export function decideTier(frameTimesMs, currentTier, state) {
  const at = TIERS.indexOf(currentTier);
  const n = frameTimesMs.length;
  if (at < 0 || n < MIN_FRAMES) return { tier: currentTier, state };
  if (state.settle > 0) {
    state.settle -= 1;
    return { tier: currentTier, state };
  }
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += frameTimesMs[i];
  const avg = sum / n;
  const dt = Math.min(MAX_FRAME_MS, Math.max(0, frameTimesMs[n - 1]));

  if (avg > SLOW_AVG_MS) {
    state.slowMs += dt;
    state.fastMs = 0;
  } else if (avg < FAST_AVG_MS) {
    state.fastMs += dt;
    state.slowMs = 0;
  } else {
    state.slowMs = 0;
    state.fastMs = 0;
  }

  if (state.slowMs >= SLOW_HOLD_MS && at < TIERS.length - 1) {
    state.slowMs = 0;
    state.settle = WINDOW_FRAMES;
    return { tier: TIERS[at + 1], state };
  }
  if (state.fastMs >= FAST_HOLD_MS && at > 0 && !state.steppedUp) {
    state.fastMs = 0;
    state.steppedUp = true;
    state.settle = WINDOW_FRAMES;
    return { tier: TIERS[at - 1], state };
  }
  return { tier: currentTier, state };
}

// What each tier turns on. Every tier removes exactly one family from the one before it
// (reflections, then lights, then resolution), and none of them touches falling notes, key
// states or finger markers: those stay on in every tier.
const HIGH = { env: true, shadows: true, rim: true, glow: true, pixelRatioCap: 2, horizonBars: 2 };
export const TIER_SETTINGS = Object.freeze({
  high: Object.freeze(HIGH),
  medium: Object.freeze({ ...HIGH, env: false }), // environment reflections off, the floor goes matte
  low: Object.freeze({ ...HIGH, env: false, shadows: false, rim: false, glow: false }), // lights reduced
  minimum: Object.freeze({ ...HIGH, env: false, shadows: false, rim: false, glow: false, pixelRatioCap: 1, horizonBars: 1 }),
});

/** The settings of a tier; an unknown name gets the High settings. */
export function tierSettings(tier) {
  return TIER_SETTINGS[tier] ?? TIER_SETTINGS.high;
}
