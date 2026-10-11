import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PPQ,
  ticksPerBar,
  ticksPerBeatUnit,
  ticksPerSecond,
  ticksToSeconds,
  secondsToTicks,
  barBeatOf,
  tickOfBarBeat,
  beatGrid,
} from "../../src/core/timing.js";

const M44 = { num: 4, den: 4 };
const M128 = { num: 12, den: 8 };

test("PPQ is 480 and bar lengths are 1920 (4/4) and 2880 (12/8)", () => {
  assert.equal(PPQ, 480);
  assert.equal(ticksPerBar(M44), 1920);
  assert.equal(ticksPerBar(M128), 2880);
  assert.equal(ticksPerBar({ num: 3, den: 4 }), 1440);
});

test("ticksPerBeatUnit knows every declared unit and rejects the rest", () => {
  assert.equal(ticksPerBeatUnit("quarter"), 480);
  assert.equal(ticksPerBeatUnit("eighth"), 240);
  assert.equal(ticksPerBeatUnit("dotted-quarter"), 720);
  assert.equal(ticksPerBeatUnit("half"), 960);
  assert.throws(() => ticksPerBeatUnit("whole"), RangeError);
});

test("480 ticks at 72 BPM (quarter) take 60/72 seconds", () => {
  const seconds = ticksToSeconds(480, { beatUnit: "quarter" }, 72);
  assert.ok(Math.abs(seconds - 60 / 72) < 1e-12);
});

test("counter-proof: the beat unit changes the speed (dotted quarter is 1.5x a quarter)", () => {
  const q = ticksPerSecond({ beatUnit: "quarter" }, 60);
  const dq = ticksPerSecond({ beatUnit: "dotted-quarter" }, 60);
  assert.equal(q, 480);
  assert.equal(dq, 720);
  assert.notEqual(q, dq);
});

const ROUND_TRIP_BPM = [20, 33, 50, 72, 120, 240, 300];
const ROUND_TRIP_TICKS = [0, 1, 239, 480, 1920, 2881, 12345, 99999];
for (const unit of ["quarter", "eighth", "dotted-quarter", "half"]) {
  for (const bpm of ROUND_TRIP_BPM) {
    test(`seconds round trip within one tick: ${unit} at ${bpm} BPM`, () => {
      const tempo = { beatUnit: unit };
      for (const t of ROUND_TRIP_TICKS) {
        const back = secondsToTicks(ticksToSeconds(t, tempo, bpm), tempo, bpm);
        assert.ok(Math.abs(back - t) < 1, `tick ${t} came back as ${back}`);
      }
    });
  }
}

test("no pickup: bar 1 starts at tick 0 and bars advance every bar length", () => {
  assert.deepEqual(barBeatOf(0, M44, 0, "quarter"), { bar: 1, beat: 1, tickInBeat: 0, tickInBar: 0 });
  assert.deepEqual(barBeatOf(500, M44, 0, "quarter"), { bar: 1, beat: 2, tickInBeat: 20, tickInBar: 500 });
  assert.deepEqual(barBeatOf(1920, M44, 0, "quarter"), { bar: 2, beat: 1, tickInBeat: 0, tickInBar: 0 });
});

test("pickup is bar 0 and counts as the end of a virtual bar", () => {
  const pickup = 480; // one quarter in 4/4
  const first = barBeatOf(0, M44, pickup, "quarter");
  assert.equal(first.bar, 0);
  assert.equal(first.beat, 4);
  const last = barBeatOf(479, M44, pickup, "quarter");
  assert.equal(last.bar, 0);
  assert.equal(last.beat, 4);
  assert.deepEqual(barBeatOf(480, M44, pickup, "quarter"), { bar: 1, beat: 1, tickInBeat: 0, tickInBar: 0 });
  assert.equal(barBeatOf(480 + 1920, M44, pickup, "quarter").bar, 2);
});

test("12/8 pickup of one eighth sits on the last beat unit of bar 0", () => {
  const pos = barBeatOf(0, M128, 240, "dotted-quarter");
  assert.equal(pos.bar, 0);
  assert.equal(pos.beat, 4);
});

test("12/8 with dotted-quarter beats: 4 beats per bar", () => {
  assert.equal(barBeatOf(2160, M128, 0, "dotted-quarter").beat, 4); // 3 * 720
  assert.equal(barBeatOf(2880, M128, 0, "dotted-quarter").bar, 2);
});

test("tickOfBarBeat is the inverse of barBeatOf, with and without pickup", () => {
  const cases = [
    [M44, 0, "quarter"],
    [M44, 480, "quarter"],
    [M128, 0, "dotted-quarter"],
    [M128, 240, "dotted-quarter"],
    [M128, 240, "eighth"],
  ];
  for (const [meter, pickup, unit] of cases) {
    for (let tick = 0; tick < 3 * ticksPerBar(meter); tick += 37) {
      const pos = barBeatOf(tick, meter, pickup, unit);
      assert.equal(tickOfBarBeat(pos, meter, pickup, unit), tick, `tick ${tick} ${unit} pickup ${pickup}`);
    }
  }
});

test("tickOfBarBeat without tickInBeat returns the beat start (floors to the beat)", () => {
  assert.equal(tickOfBarBeat({ bar: 2, beat: 3 }, M44, 0, "quarter"), 1920 + 960);
  assert.equal(tickOfBarBeat({ bar: 1, beat: 1 }, M44, 480, "quarter"), 480);
});

test("beatGrid 4/4 quarter: 4 clicks per bar, accent only on beat 1", () => {
  const grid = beatGrid(M44, 0, "quarter", 0, 1920);
  assert.deepEqual(grid, [
    { tick: 0, accent: true },
    { tick: 480, accent: false },
    { tick: 960, accent: false },
    { tick: 1440, accent: false },
  ]);
});

test("beatGrid 12/8 dotted-quarter: 4 clicks per bar, accent on beat 1", () => {
  const grid = beatGrid(M128, 0, "dotted-quarter", 0, 2880);
  assert.deepEqual(
    grid.map((g) => g.tick),
    [0, 720, 1440, 2160],
  );
  assert.deepEqual(
    grid.map((g) => g.accent),
    [true, false, false, false],
  );
});

test("contra-case: beatGrid 12/8 with eighth gives 12 clicks per bar", () => {
  const grid = beatGrid(M128, 0, "eighth", 0, 2880);
  assert.equal(grid.length, 12);
  assert.equal(grid.filter((g) => g.accent).length, 1);
});

test("beatGrid accents the first beat of every bar across several bars", () => {
  const grid = beatGrid(M44, 0, "quarter", 0, 3 * 1920);
  const accents = grid.filter((g) => g.accent).map((g) => g.tick);
  assert.deepEqual(accents, [0, 1920, 3840]);
});

test("beatGrid with a pickup: the pickup beat has no accent and bar 1 is accented", () => {
  const grid = beatGrid(M44, 480, "quarter", 0, 480 + 1920);
  assert.deepEqual(grid[0], { tick: 0, accent: false });
  assert.deepEqual(grid[1], { tick: 480, accent: true });
  assert.equal(grid.length, 1 + 4);
});

test("beatGrid window is half-open and windows do not duplicate or drop clicks", () => {
  const whole = beatGrid(M44, 0, "quarter", 0, 4000);
  const split = [...beatGrid(M44, 0, "quarter", 0, 777), ...beatGrid(M44, 0, "quarter", 777, 4000)];
  assert.deepEqual(split, whole);
  assert.deepEqual(beatGrid(M44, 0, "quarter", 480, 481), [{ tick: 480, accent: false }]);
  assert.deepEqual(beatGrid(M44, 0, "quarter", 481, 960), []);
});

test("beatGrid never returns negative ticks", () => {
  assert.ok(beatGrid(M44, 480, "quarter", -5000, 2000).every((g) => g.tick >= 0));
});
