import { test } from "node:test";
import assert from "node:assert/strict";
import { createPractice, formatLoop, QUALITY_CHOICES } from "../../src/ui/practice-controller.js";
import { FULL_RANGE } from "../../src/core/keyboard-layout.js";

const timeline = {
  meter: { num: 4, den: 4 },
  pickupTicks: 0,
  lengthTicks: 3840 * 4,
  tempo: { bpm: 72, beatUnit: "quarter" },
  sections: [
    { id: "intro", name: "Intro", startTick: 0, endTick: 3840 },
    { id: "verse", name: "Verse", startTick: 3840, endTick: 11520 },
  ],
};

function rig(pos = 0) {
  const log = { loops: [], bpms: [], hands: [], ranges: [], quality: [] };
  let bpm = 72;
  let at = pos;
  const p = createPractice({
    timeline,
    position: () => at,
    effects: {
      setLoop: (l) => log.loops.push(l),
      setBpm: (n) => {
        bpm = n;
        log.bpms.push(n);
      },
      getBpm: () => bpm,
      setHands: (m) => log.hands.push(structuredClone(m)),
      setRange: (r) => log.ranges.push(r),
      setQuality: (q) => log.quality.push(q),
    },
  });
  return { p, log, at: (t) => (at = t) };
}
const last = (a) => a[a.length - 1];

test("A and B snap to bars: A down, B up, and the loop turns on", () => {
  const { p, log } = rig();
  p.setA(2500);
  assert.equal(last(log.loops), null, "A alone is not a loop");
  p.setB(5000);
  assert.deepEqual(last(log.loops), { startTick: 1920, endTick: 5760 });
  assert.equal(p.state().loopOn, true);
});

test("Set A after a finished range starts a new one: the old loop stops until B is chosen again", () => {
  const { p, log } = rig();
  p.setA(0);
  p.setB(1920);
  p.setA(5760);
  assert.equal(last(log.loops), null, "the old loop is released so the playhead can move past its end");
  assert.equal(p.state().b, null);
  p.setB(9600);
  assert.deepEqual(last(log.loops), { startTick: 5760, endTick: 9600 });
});

test("an inverted range is swapped and the normalized range is what the state shows", () => {
  const { p, log } = rig();
  p.setA(5760);
  p.setB(1920);
  assert.deepEqual(last(log.loops), { startTick: 1920, endTick: 5760 });
  assert.equal(formatLoop(p.state().loop, timeline), "Bar 2, beat 1 to bar 3, beat 4");
});

test("beat snap keeps beat granularity and setSnap re-applies the range", () => {
  const { p, log } = rig();
  p.setA(500);
  p.setB(1500);
  p.setSnap("beat");
  assert.deepEqual(last(log.loops), { startTick: 480, endTick: 1920 });
  p.setSnap("bar");
  assert.deepEqual(last(log.loops), { startTick: 0, endTick: 1920 });
});

test("a zero-length range reads Loop not set and sends no loop", () => {
  const { p, log } = rig();
  p.setA(0);
  p.setB(0);
  assert.equal(last(log.loops), null);
  assert.equal(p.state().loop, null);
  assert.equal(formatLoop(p.state().loop, timeline), "Loop not set");
  assert.match(p.state().message, /Loop not set/);
});

test("Set A here and Set B here read the current position", () => {
  const { p, log, at } = rig();
  at(1920);
  p.setA();
  at(3840);
  p.setB();
  assert.deepEqual(last(log.loops), { startTick: 1920, endTick: 3840 });
});

test("loop by section uses the section range and turns the loop on", () => {
  const { p, log } = rig();
  p.loopSection("verse");
  assert.deepEqual(last(log.loops), { startTick: 3840, endTick: 11520 });
  assert.equal(p.state().loopOn, true);
  p.loopSection("nope");
  assert.deepEqual(last(log.loops), { startTick: 3840, endTick: 11520 }, "an unknown section changes nothing");
});

test("disabling the loop sends null and keeps the range; enabling again restores it", () => {
  const { p, log } = rig();
  p.loopSection("intro");
  p.setLoopOn(false);
  assert.equal(last(log.loops), null);
  assert.deepEqual(p.state().loop, { startTick: 0, endTick: 3840 });
  p.setLoopOn(true);
  assert.deepEqual(last(log.loops), { startTick: 0, endTick: 3840 });
});

test("enabling a loop that was never set refuses with a message", () => {
  const { p, log } = rig();
  p.setLoopOn(true);
  assert.equal(p.state().loopOn, false);
  assert.equal(log.loops.length, 0);
  assert.match(p.state().message, /Loop not set/);
});

test("ramp steps per pass: 50, 55, 60, 65, then 70 and holds the target", () => {
  const { p, log } = rig();
  p.loopSection("intro");
  p.setRamp({ start: 50, step: 5, target: 70 });
  p.setRampOn(true);
  assert.deepEqual(log.bpms, [50], "enabling sets the user BPM to start");
  for (let i = 0; i < 5; i += 1) p.onPass();
  assert.deepEqual(log.bpms, [50, 55, 60, 65, 70, 70]);
});

test("a step larger than the gap lands on the target: 68 to 70, not 73", () => {
  const { p, log } = rig();
  p.loopSection("intro");
  p.setRamp({ start: 68, step: 5, target: 70 });
  p.setRampOn(true);
  p.onPass();
  assert.equal(last(log.bpms), 70);
});

test("ramp without a loop says Needs a loop and does nothing", () => {
  const { p, log } = rig();
  p.setRampOn(true);
  assert.equal(p.state().rampOn, false);
  assert.equal(p.state().message, "Needs a loop");
  p.onPass();
  assert.deepEqual(log.bpms, []);
});

test("Hold freezes the tempo and releasing it resumes the steps", () => {
  const { p, log } = rig();
  p.loopSection("intro");
  p.setRamp({ start: 50, step: 5, target: 70 });
  p.setRampOn(true);
  p.setHold(true);
  p.onPass();
  p.onPass();
  assert.deepEqual(log.bpms, [50]);
  p.setHold(false);
  p.onPass();
  assert.deepEqual(log.bpms, [50, 55]);
});

test("counter-proof: disabling the loop stops the ramp, and a later pass changes nothing", () => {
  const { p, log } = rig();
  p.loopSection("intro");
  p.setRampOn(true);
  p.setLoopOn(false);
  assert.equal(p.state().rampOn, false);
  const before = log.bpms.length;
  p.onPass();
  assert.equal(log.bpms.length, before);
});

test("an inverted ramp is swapped and a zero step becomes 1", () => {
  const { p } = rig();
  p.setRamp({ start: 90, target: 60, step: 0 });
  assert.deepEqual(p.state().ramp, { start: 60, step: 1, target: 90 });
});

test("hands: mute and hide are independent flags per hand", () => {
  const { p, log } = rig();
  p.toggleHand("L", "muted");
  p.toggleHand("R", "hidden");
  assert.deepEqual(last(log.hands), { L: { muted: true, hidden: false }, R: { muted: false, hidden: true } });
  p.toggleHand("L", "muted");
  assert.equal(last(log.hands).L.muted, false);
  assert.equal(last(log.hands).R.hidden, true, "the other hand is untouched");
});

test("hand flags survive a loop change and a level change", () => {
  const { p } = rig();
  p.toggleHand("R", "muted");
  p.loopSection("verse");
  p.setSnap("beat");
  p.setTimeline({ ...timeline });
  assert.equal(p.state().hands.R.muted, true);
});

test("Full 88 sends the full range and turning it off sends null", () => {
  const { p, log } = rig();
  p.setFull(true);
  assert.deepEqual(last(log.ranges), FULL_RANGE);
  p.setFull(false);
  assert.equal(last(log.ranges), null);
});

test("quality accepts only known tiers", () => {
  const { p, log } = rig();
  assert.deepEqual(QUALITY_CHOICES, ["auto", "high", "medium", "low", "minimum"]);
  p.setQuality("low");
  assert.equal(last(log.quality), "low");
  p.setQuality("ultra");
  assert.equal(last(log.quality), "auto");
});

test("subscribers hear each change and stop after unsubscribing", () => {
  const { p } = rig();
  let n = 0;
  const off = p.subscribe(() => (n += 1));
  p.setSnap("beat");
  p.toggleHand("L", "muted");
  assert.equal(n, 2);
  off();
  p.setSnap("bar");
  assert.equal(n, 2);
});

test("formatLoop names the pickup bar as pickup", () => {
  const tl = { ...timeline, pickupTicks: 480 };
  assert.equal(formatLoop({ startTick: 0, endTick: 480 }, tl), "Pickup, beat 4 to pickup, beat 4");
});
