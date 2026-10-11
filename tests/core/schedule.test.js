import { test } from "node:test";
import assert from "node:assert/strict";
import { makeAnchor, tickAt, timeAt, reanchor, windowEvents, songTickOf } from "../../src/core/schedule.js";

const note = (tick, dur = 480, extra = {}) => ({ tick, dur, pitch: "C4", hand: "R", ...extra });
const ticksOf = (events) => events.map((e) => e.absTick);

test("tickAt and timeAt are inverse for an anchor", () => {
  const a = makeAnchor(10, 960, 1000);
  assert.equal(tickAt(a, 10), 960);
  assert.equal(tickAt(a, 10.5), 1460);
  assert.equal(timeAt(a, 1460), 10.5);
  assert.equal(timeAt(a, tickAt(a, 12.25)), 12.25);
});

test("re-anchoring on a BPM change keeps the current tick", () => {
  const a = makeAnchor(5, 0, 576); // 72 BPM quarter: 576 ticks per second
  const before = tickAt(a, 6.25);
  const b = reanchor(a, 6.25, 720); // 90 BPM
  assert.equal(tickAt(b, 6.25), before);
  assert.equal(tickAt(b, 7.25), before + 720);
});

test("windowEvents without a loop returns each event once over consecutive windows", () => {
  const notes = [note(0), note(480), note(960), note(960, 480, { pitch: "E4" })];
  const seen = [];
  for (let from = 0; from < 1920; from += 100) seen.push(...ticksOf(windowEvents(notes, from, from + 100, null)));
  assert.deepEqual(seen, [0, 480, 960, 960]);
});

test("window is half-open: onset at the window end belongs to the next window", () => {
  const notes = [note(480)];
  assert.deepEqual(ticksOf(windowEvents(notes, 0, 480, null)), []);
  assert.deepEqual(ticksOf(windowEvents(notes, 480, 960, null)), [480]);
});

test("empty and inverted windows return nothing; rests are skipped", () => {
  const notes = [note(0), { tick: 480, dur: 480, rest: true, hand: "R" }];
  assert.deepEqual(windowEvents(notes, 100, 100, null), []);
  assert.deepEqual(windowEvents(notes, 200, 100, null), []);
  assert.deepEqual(ticksOf(windowEvents(notes, 0, 1000, null)), [0]);
});

const LOOP = { startTick: 960, endTick: 1920 };

test("loop: a note straddling the loop end is cut at the loop end", () => {
  const notes = [note(1680, 480)]; // would end at 2160, loop ends at 1920
  const [e] = windowEvents(notes, 0, 3000, LOOP);
  assert.equal(e.absTick, 1680);
  assert.equal(e.absEnd, 1920);
  const second = windowEvents(notes, 1920, 3000, LOOP)[0];
  assert.equal(second.absTick, 1680 + 960);
  assert.equal(second.absEnd, 1920 + 960);
});

test("loop: a note exactly at the loop end is not in the loop, a note at the loop start belongs to the next pass", () => {
  const notes = [note(960), note(1920)];
  assert.deepEqual(ticksOf(windowEvents(notes, 0, 1920, LOOP)), [960]);
  // The boundary at abs 1920 is where pass 2 starts: its first note appears there, not before.
  assert.deepEqual(ticksOf(windowEvents(notes, 1920, 2880, LOOP)), [1920]);
  assert.deepEqual(ticksOf(windowEvents(notes, 1900, 1920, LOOP)), []);
});

test("loop: a window spanning two passes returns both occurrences in order", () => {
  const notes = [note(960), note(1440)];
  const events = windowEvents(notes, 1000, 2800, LOOP);
  assert.deepEqual(ticksOf(events), [1440, 1920, 2400]);
  assert.deepEqual(events.map((e) => e.note.tick), [1440, 960, 1440]);
});

test("loop: notes before the loop play once, notes after the loop end never", () => {
  const notes = [note(0), note(480), note(960), note(2400)];
  assert.deepEqual(ticksOf(windowEvents(notes, 0, 5000, LOOP)).slice(0, 3), [0, 480, 960]);
  assert.ok(!windowEvents(notes, 0, 5000, LOOP).some((e) => e.note.tick === 2400));
});

test("loop: a window crossing from the identity region into the loop returns both parts", () => {
  const notes = [note(480), note(1200)];
  assert.deepEqual(ticksOf(windowEvents(notes, 0, 1500, LOOP)), [480, 1200]);
});

test("a zero-length or inverted loop behaves as no loop", () => {
  const notes = [note(0), note(480)];
  assert.deepEqual(ticksOf(windowEvents(notes, 0, 2000, { startTick: 480, endTick: 480 })), [0, 480]);
  assert.deepEqual(ticksOf(windowEvents(notes, 0, 2000, { startTick: 960, endTick: 480 })), [0, 480]);
});

test("songTickOf maps abs ticks back onto the song, wrapping inside the loop", () => {
  assert.equal(songTickOf(500, null), 500);
  assert.equal(songTickOf(500, LOOP), 500);
  assert.equal(songTickOf(960, LOOP), 960);
  assert.equal(songTickOf(1919, LOOP), 1919);
  assert.equal(songTickOf(1920, LOOP), 960);
  assert.equal(songTickOf(2900, LOOP), 980);
});

// Deterministic pseudo-random generator so the property test is reproducible.
function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test("window split at arbitrary ticks never duplicates or drops an event (loop and no loop)", () => {
  const notes = [];
  for (let t = 0; t < 3840; t += 240) notes.push(note(t, 300));
  for (const loop of [null, LOOP, { startTick: 0, endTick: 480 }]) {
    const whole = windowEvents(notes, 0, 9000, loop).map((e) => `${e.absTick}:${e.note.tick}`);
    const rand = lcg(7);
    for (let trial = 0; trial < 50; trial += 1) {
      const cuts = [0];
      while (cuts[cuts.length - 1] < 9000) cuts.push(cuts[cuts.length - 1] + 1 + Math.floor(rand() * 700));
      cuts[cuts.length - 1] = 9000;
      const pieced = [];
      for (let i = 0; i < cuts.length - 1; i += 1) {
        pieced.push(...windowEvents(notes, cuts[i], cuts[i + 1], loop).map((e) => `${e.absTick}:${e.note.tick}`));
      }
      assert.deepEqual(pieced, whole, `loop ${JSON.stringify(loop)} trial ${trial}`);
    }
  }
});

test("counter-proof: a naive overlapping window does duplicate events (the property test can fail)", () => {
  const notes = [note(480)];
  const naive = [...windowEvents(notes, 0, 600, null), ...windowEvents(notes, 400, 1000, null)];
  assert.equal(naive.length, 2);
});
