import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIERS,
  WINDOW_FRAMES,
  createQualityState,
  initialTier,
  decideTier,
} from "../../src/core/quality.js";

/**
 * Feed `frames` (a function from frame index to duration in ms) through decideTier the way the
 * scene does: a rolling window of the last WINDOW_FRAMES durations, one call per frame.
 * Returns the sequence of tiers reached, the elapsed milliseconds at each step and the final state.
 */
function run(frames, { tier = "high", state = createQualityState(), totalMs }) {
  const window = [];
  const steps = [];
  let elapsed = 0;
  for (let i = 0; elapsed < totalMs; i += 1) {
    const dt = frames(i);
    window.push(dt);
    if (window.length > WINDOW_FRAMES) window.shift();
    elapsed += dt;
    const res = decideTier(window, tier, state);
    if (res.tier !== tier) steps.push({ from: tier, to: res.tier, atMs: elapsed });
    tier = res.tier;
  }
  return { tier, steps, state };
}

test("TIERS are ordered high, medium, low, minimum", () => {
  assert.deepEqual([...TIERS], ["high", "medium", "low", "minimum"]);
});

test("sustained 30 ms frames step down one tier at a time, in order, never below minimum", () => {
  const { steps, tier } = run(() => 30, { totalMs: 60000 });
  assert.deepEqual(
    steps.map((s) => s.to),
    ["medium", "low", "minimum"],
  );
  assert.equal(tier, "minimum");
  // Each step needs the sample to refill and 2 s of slowness again, so steps are well separated.
  assert.ok(steps[1].atMs - steps[0].atMs >= 2000);
  assert.ok(steps[2].atMs - steps[1].atMs >= 2000);
});

test("the first step down comes after 2 seconds of slowness, not before", () => {
  const { steps } = run(() => 30, { totalMs: 10000 });
  assert.ok(steps[0].atMs >= 2000, `first step at ${steps[0].atMs} ms`);
  assert.ok(steps[0].atMs < 3500, `first step at ${steps[0].atMs} ms`);
  const early = run(() => 30, { totalMs: 1900 });
  assert.equal(early.steps.length, 0);
});

test("counter-proof: a trace hovering at 22 ms for 1 s (and for much longer) never steps down", () => {
  assert.equal(run(() => 22, { totalMs: 1000 }).steps.length, 0);
  // The threshold is strictly greater than 22 ms, so an average of exactly 22 never counts.
  assert.equal(run(() => 22, { totalMs: 30000 }).steps.length, 0);
  // Just above the threshold for the full 2 s does step down.
  assert.equal(run(() => 22.5, { totalMs: 4000 }).steps.length, 1);
});

test("a short spike inside an otherwise healthy trace does not step down", () => {
  const trace = (i) => (i >= 60 && i < 65 ? 120 : 14); // five 120 ms frames, then back to 14 ms
  assert.equal(run(trace, { totalMs: 20000 }).steps.length, 0);
});

test("no oscillation over a synthetic noisy trace averaging about 19 ms", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const noisy = () => 8 + rand() * 22; // 8 to 30 ms, mean 19
  const { steps } = run(noisy, { totalMs: 120000 });
  assert.equal(steps.length, 0);
});

test("a trace alternating 8 ms and 30 ms (average 19) stays on its tier", () => {
  assert.equal(run((i) => (i % 2 ? 30 : 8), { totalMs: 60000, tier: "medium" }).steps.length, 0);
});

test("steps up only after 20 s under 10 ms, and at most once per session", () => {
  const first = run(() => 5, { tier: "low", totalMs: 19000 });
  assert.equal(first.steps.length, 0, "no step before 20 s");
  const longer = run(() => 5, { tier: "low", totalMs: 120000 });
  assert.equal(longer.steps.length, 1);
  assert.equal(longer.steps[0].to, "medium");
  assert.ok(longer.steps[0].atMs >= 20000);
  assert.equal(longer.state.steppedUp, true);
});

test("counter-proof: after the single step up, headroom never steps up again, but slowness still steps down", () => {
  const state = createQualityState();
  const up = run(() => 5, { tier: "minimum", state, totalMs: 60000 });
  assert.equal(up.tier, "low");
  const more = run(() => 5, { tier: up.tier, state, totalMs: 120000 });
  assert.equal(more.tier, "low");
  const down = run(() => 40, { tier: more.tier, state, totalMs: 20000 });
  assert.equal(down.tier, "minimum");
});

test("an average between 10 ms and 22 ms resets both counters", () => {
  const state = createQualityState();
  // 19 s of headroom, a 12 ms stretch, then 19 s of headroom again: no step up.
  const window = [];
  let tier = "low";
  const feed = (dt, ms) => {
    for (let t = 0; t < ms; t += dt) {
      window.push(dt);
      if (window.length > WINDOW_FRAMES) window.shift();
      tier = decideTier(window, tier, state).tier;
    }
  };
  feed(5, 19000);
  feed(12, 5000);
  feed(5, 19000);
  assert.equal(tier, "low");
});

test("never steps up from high, and an unknown tier or a short sample changes nothing", () => {
  assert.equal(run(() => 5, { tier: "high", totalMs: 60000 }).steps.length, 0);
  assert.equal(decideTier([40, 40], "high", createQualityState()).tier, "high", "fewer than 30 frames");
  assert.equal(decideTier(new Array(120).fill(40), "ultra", createQualityState()).tier, "ultra");
});

test("a stalled frame (hidden tab) counts as at most 100 ms of slowness", () => {
  const state = createQualityState();
  const window = new Array(WINDOW_FRAMES).fill(10);
  window[WINDOW_FRAMES - 1] = 60000; // one frame after the tab was hidden for a minute
  // The average is far above 22 ms, but the single frame adds only 100 ms to the 2 s counter.
  const res = decideTier(window, "high", state);
  assert.equal(res.tier, "high");
  assert.equal(state.slowMs, 100);
});

test("after a step the sample must refill before the next decision", () => {
  const state = createQualityState();
  const window = new Array(WINDOW_FRAMES).fill(30);
  state.slowMs = 1990;
  assert.equal(decideTier(window, "high", state).tier, "medium");
  state.slowMs = 1990; // even if slowness were already counted, the settle period blocks a cascade
  assert.equal(decideTier(window, "medium", state).tier, "medium");
  assert.equal(state.settle, WINDOW_FRAMES - 1);
});

test("initialTier is High on desktop and Medium with 4 or fewer cores or a coarse pointer", () => {
  assert.equal(initialTier({ hardwareConcurrency: 8, coarsePointer: false }), "high");
  assert.equal(initialTier({ hardwareConcurrency: 4, coarsePointer: false }), "medium");
  assert.equal(initialTier({ hardwareConcurrency: 2 }), "medium");
  assert.equal(initialTier({ hardwareConcurrency: 16, coarsePointer: true }), "medium");
  assert.equal(initialTier({}), "high");
  assert.equal(initialTier(), "high");
});
