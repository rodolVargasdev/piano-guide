import { test } from "node:test";
import assert from "node:assert/strict";
import { createWatchdog, STALL_MS } from "../../src/scene/quality.js";
import { TIERS } from "../../src/core/quality.js";

// Drive a watchdog with `count` frames of `ms` each, playing; returns the tier changes in order.
function run(wd, count, ms, t0 = 0, playing = true) {
  const changes = [];
  let now = t0;
  for (let i = 0; i < count; i += 1) {
    now += ms;
    const before = wd.tier();
    wd.frame(now, playing);
    if (wd.tier() !== before) changes.push({ to: wd.tier(), atMs: Math.round(now - t0) });
  }
  return { changes, end: now };
}

function watchdog(initial = "high") {
  const log = [];
  const wd = createWatchdog({ initial, onTier: (t) => log.push(t) });
  return { wd, log };
}

test("sustained slow frames step the tiers down in order, one at a time, and stop at minimum", () => {
  const { wd, log } = watchdog();
  run(wd, 1200, 40); // 40 ms a frame, a 6x CPU throttle on a fast machine
  assert.deepEqual(log, ["medium", "low", "minimum"]);
  assert.equal(wd.tier(), "minimum");
  run(wd, 600, 40, 60000);
  assert.deepEqual(log, ["medium", "low", "minimum"], "never below minimum");
});

test("each step waits for the sample to refill: no two steps closer than the window", () => {
  const { wd } = watchdog();
  const { changes } = run(wd, 1500, 40);
  assert.equal(changes.length, 3);
  for (let i = 1; i < changes.length; i += 1) assert.ok(changes[i].atMs - changes[i - 1].atMs >= 120 * 40, "120 frames between steps");
});

test("healthy frames keep the tier", () => {
  const { wd, log } = watchdog();
  run(wd, 3000, 16.7);
  assert.deepEqual(log, []);
  assert.equal(wd.tier(), "high");
});

test("a single long stall (a hidden tab coming back) is not sampled and drops nothing", () => {
  const { wd, log } = watchdog();
  let end = run(wd, 200, 16.7).end;
  wd.frame(end + 10000, true); // ten seconds in one frame
  end += 10000;
  run(wd, 600, 16.7, end);
  assert.deepEqual(log, []);
  assert.ok(STALL_MS >= 100 && STALL_MS <= 500);
});

test("counter-proof: the same load as one stall but spread over many slow frames does drop a tier", () => {
  const { wd, log } = watchdog();
  run(wd, 400, 40);
  assert.deepEqual(log.slice(0, 1), ["medium"]);
});

test("paused redraws are not samples: slow draws while paused never change the tier", () => {
  const { wd, log } = watchdog();
  run(wd, 2000, 80, 0, false);
  assert.deepEqual(log, []);
  assert.equal(wd.tier(), "high");
});

test("pausing in the middle breaks the run: the first frame after has no previous frame", () => {
  const { wd } = watchdog();
  wd.frame(1000, true);
  wd.frame(1016, true);
  wd.frame(5000, false);
  wd.frame(9000, true); // 8 s after the last playing frame: must not count as a 8 s frame (it is dropped as a first frame)
  const { changes } = run(wd, 100, 16.7, 9000);
  assert.deepEqual(changes, []);
});

test("a manual tier overrides the watchdog: it applies at once and slow frames no longer move it", () => {
  const { wd, log } = watchdog();
  wd.choose("low");
  assert.deepEqual(log, ["low"]);
  assert.equal(wd.auto(), false);
  run(wd, 1500, 40);
  assert.equal(wd.tier(), "low", "no automatic step below a manual choice");
  assert.deepEqual(log, ["low"]);
});

test("Auto after a manual choice restarts from the initial tier and the watchdog runs again", () => {
  const { wd, log } = watchdog("medium");
  wd.choose("minimum");
  wd.choose("auto");
  assert.equal(wd.auto(), true);
  assert.equal(wd.tier(), "medium", "back to the initial tier of the device");
  run(wd, 150, 40); // about 80 frames to the first step, then 120 frames of refill
  assert.equal(wd.tier(), "low", "and it degrades again from there");
  assert.deepEqual(log, ["minimum", "medium", "low"]);
});

test("an unknown choice means Auto, and every named tier is accepted", () => {
  for (const t of TIERS) {
    const { wd } = watchdog();
    wd.choose(t);
    assert.equal(wd.tier(), t);
    assert.equal(wd.auto(), false);
  }
  const { wd } = watchdog();
  wd.choose("minimum");
  wd.choose("whatever");
  assert.equal(wd.auto(), true);
});

test("the watchdog starts at the tier it is given", () => {
  assert.equal(watchdog("medium").wd.tier(), "medium");
});
