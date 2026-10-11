import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICE_KEY,
  clearPracticeProgress,
  daysBetween,
  emptyPracticeProgress,
  entryOf,
  localIsoDate,
  readPracticeProgress,
  recordRoutine,
  recordRun,
  summaryOf,
  writePracticeProgress,
} from "../../src/practice/progress.js";

const memory = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k], data };
};
const run = (p, o) => recordRun(p, { exerciseId: "scale-major", key: "G", bpm: 60, clean: true, date: "2026-10-10", ...o });

test("two clean runs at 60 then one at 72 on the G scale: streak 3, best tempo 72, three clean runs, and it is all still there tomorrow", () => {
  let p = emptyPracticeProgress();
  p = run(p, {});
  p = run(p, {});
  p = run(p, { bpm: 72 });
  const e = entryOf(p, "scale-major", "G");
  assert.deepEqual(e, { cleanStreak: 3, bestTempo: 72, cleanRuns: 3, lastPracticed: "2026-10-10" });
  const store = memory();
  writePracticeProgress(store, p);
  assert.deepEqual(entryOf(readPracticeProgress(store), "scale-major", "G"), e, "read back the next day");
});

test("an unclean run resets the streak to 0 and leaves the best tempo and the clean run count", () => {
  let p = run(run(run(emptyPracticeProgress(), {}), {}), { bpm: 72 });
  p = run(p, { clean: false, bpm: 88, date: "2026-10-11" });
  assert.deepEqual(entryOf(p, "scale-major", "G"), { cleanStreak: 0, bestTempo: 72, cleanRuns: 3, lastPracticed: "2026-10-11" });
  p = run(p, { date: "2026-10-11" });
  assert.equal(entryOf(p, "scale-major", "G").cleanStreak, 1, "the streak starts again");
});

test("a slower clean run does not lower the best tempo, and keys and exercises are kept apart", () => {
  let p = run(emptyPracticeProgress(), { bpm: 88 });
  p = run(p, { bpm: 50 });
  assert.equal(entryOf(p, "scale-major", "G").bestTempo, 88);
  p = run(p, { key: "D" });
  p = run(p, { exerciseId: "triads" });
  assert.equal(entryOf(p, "scale-major", "D").cleanRuns, 1);
  assert.equal(entryOf(p, "triads", "G").cleanRuns, 1);
  assert.equal(entryOf(p, "scale-major", "G").cleanRuns, 2);
});

test("recordRun is pure: the old progress is not changed, and bad input returns the same progress", () => {
  const before = emptyPracticeProgress();
  const after = run(before, {});
  assert.deepEqual(before, emptyPracticeProgress());
  assert.notEqual(after, before);
  assert.equal(run(before, { exerciseId: "Bad Id" }), before);
  assert.equal(run(before, { key: "H" }), before);
  assert.equal(run(before, { date: "yesterday" }), before);
  assert.equal(run(before, { bpm: "fast" }), before);
});

test("corrupt JSON, a wrong version or a hand-edited store reads as empty with no error", () => {
  const store = memory();
  store.setItem(PRACTICE_KEY, "{not json");
  assert.deepEqual(readPracticeProgress(store), emptyPracticeProgress());
  store.setItem(PRACTICE_KEY, JSON.stringify({ v: 2, exercises: { x: {} } }));
  assert.deepEqual(readPracticeProgress(store), emptyPracticeProgress());
  store.setItem(PRACTICE_KEY, JSON.stringify({ v: 1, exercises: { "scale-major": { G: { cleanStreak: "many", bestTempo: 60, cleanRuns: 1, lastPracticed: "2026-10-10" }, Bb: { cleanStreak: 1, bestTempo: 60, cleanRuns: 1, lastPracticed: "2026-10-10" }, "C#4": { cleanStreak: 1, bestTempo: 60, cleanRuns: 1, lastPracticed: "2026-10-10" } } }, routine: { lastDate: "never", dayStreak: -3 } }));
  const p = readPracticeProgress(store);
  assert.equal(entryOf(p, "scale-major", "G"), null, "a malformed entry is dropped");
  assert.equal(entryOf(p, "scale-major", "C#4"), null, "a pitch is not a key name");
  assert.equal(entryOf(p, "scale-major", "Bb").cleanRuns, 1, "a good entry beside a bad one stays");
  assert.deepEqual(p.routine, emptyPracticeProgress().routine);
  assert.deepEqual(readPracticeProgress(undefined), emptyPracticeProgress());
});

test("blocked storage never throws: reads are empty, writes and resets report false", () => {
  const blocked = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    },
  };
  assert.deepEqual(readPracticeProgress(blocked), emptyPracticeProgress());
  assert.equal(writePracticeProgress(blocked, run(emptyPracticeProgress(), {})), false);
  assert.equal(clearPracticeProgress(blocked), false);
  assert.equal(writePracticeProgress(memory(), emptyPracticeProgress()), true);
});

test("reset empties the summary: the saved value is gone and the exercise summary reads as nothing", () => {
  const store = memory();
  writePracticeProgress(store, run(emptyPracticeProgress(), {}));
  assert.equal(summaryOf(readPracticeProgress(store), "scale-major").cleanRuns, 1);
  assert.equal(clearPracticeProgress(store), true);
  assert.equal(store.getItem(PRACTICE_KEY), null);
  assert.deepEqual(summaryOf(readPracticeProgress(store), "scale-major"), { keys: 0, cleanStreak: 0, bestTempo: 0, cleanRuns: 0, lastPracticed: null });
  const noRemove = { ...memory() };
  delete noRemove.removeItem;
  writePracticeProgress(noRemove, run(emptyPracticeProgress(), {}));
  assert.equal(clearPracticeProgress(noRemove), true, "a store without removeItem is emptied instead");
  assert.deepEqual(readPracticeProgress(noRemove), emptyPracticeProgress());
});

test("the summary of an exercise spans its keys: longest streak, best tempo, total clean runs, latest date", () => {
  let p = run(run(emptyPracticeProgress(), { bpm: 60 }), { bpm: 72 });
  p = run(p, { key: "D", bpm: 88, date: "2026-10-12" });
  assert.deepEqual(summaryOf(p, "scale-major"), { keys: 2, cleanStreak: 2, bestTempo: 88, cleanRuns: 3, lastPracticed: "2026-10-12" });
});

test("only ids, tonic names, counts, tempos and dates are stored: no spelled pitch can appear", () => {
  let p = run(emptyPracticeProgress(), { key: "Bb" });
  p = recordRoutine(p, { date: "2026-10-10", blocks: [{ id: "warmup", key: "F#", status: "done" }, { id: "scale", key: "Eb", status: "done" }] });
  const text = JSON.stringify(p);
  assert.equal(/[A-G](#|b)?-?\d/.test(text.replace(/\d{4}-\d{2}-\d{2}/g, "")), false, text);
});

test("day helpers: local ISO date, whole days between, NaN for non dates", () => {
  assert.equal(localIsoDate(new Date(2026, 9, 11, 23, 59)), "2026-10-11");
  assert.equal(localIsoDate(new Date(2026, 0, 5, 0, 1)), "2026-01-05");
  assert.equal(daysBetween("2026-10-10", "2026-10-11"), 1);
  assert.equal(daysBetween("2026-10-10", "2026-10-10"), 0);
  assert.equal(daysBetween("2026-10-12", "2026-10-10"), -2);
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1, "month boundary");
  assert.ok(Number.isNaN(daysBetween("x", "2026-10-10")));
});

const blocks = (statuses) => ["warmup", "scale", "chords", "ear"].map((id, i) => ({ id, key: id === "ear" || id === "chords" ? "-" : "G", status: statuses[i] }));

test("a routine with a block done records the day: the first day is 1, the next day 2, the same day does not add, a gap restarts at 1", () => {
  let p = emptyPracticeProgress();
  p = recordRoutine(p, { date: "2026-10-10", blocks: blocks(["done", "done", "done", "done"]) });
  assert.deepEqual([p.routine.lastDate, p.routine.dayStreak], ["2026-10-10", 1]);
  p = recordRoutine(p, { date: "2026-10-10", blocks: blocks(["done", "skipped", "skipped", "skipped"]) });
  assert.equal(p.routine.dayStreak, 1, "the same day again changes nothing");
  p = recordRoutine(p, { date: "2026-10-11", blocks: blocks(["done", "done", "done", "done"]) });
  assert.deepEqual([p.routine.lastDate, p.routine.dayStreak], ["2026-10-11", 2]);
  p = recordRoutine(p, { date: "2026-10-14", blocks: blocks(["done", "done", "done", "done"]) });
  assert.equal(p.routine.dayStreak, 1, "a missed day starts the streak again");
});

test("skipping the last block after three done still records the day", () => {
  const p = recordRoutine(emptyPracticeProgress(), { date: "2026-10-10", blocks: blocks(["done", "done", "done", "skipped"]) });
  assert.equal(p.routine.dayStreak, 1);
});

test("everything skipped records nothing: the same progress comes back and the day streak is unchanged", () => {
  const before = recordRoutine(emptyPracticeProgress(), { date: "2026-10-10", blocks: blocks(["done", "done", "done", "done"]) });
  const after = recordRoutine(before, { date: "2026-10-11", blocks: blocks(["skipped", "skipped", "skipped", "skipped"]) });
  assert.equal(after, before);
  assert.equal(after.routine.dayStreak, 1);
  assert.equal(recordRoutine(emptyPracticeProgress(), { date: "2026-10-10", blocks: [] }).routine.lastDate, null);
});

test("the warm-up key and the scale dates change only for blocks that were done", () => {
  const start = recordRoutine(emptyPracticeProgress(), { date: "2026-10-10", blocks: blocks(["done", "done", "done", "done"]) });
  assert.equal(start.routine.lastWarmupKey, "G");
  assert.equal(start.routine.scaleLastPracticed.G, "2026-10-10");
  const next = recordRoutine(start, { date: "2026-10-11", blocks: [{ id: "warmup", key: "D", status: "skipped" }, { id: "scale", key: "D", status: "skipped" }, { id: "chords", key: "-", status: "done" }] });
  assert.equal(next.routine.lastWarmupKey, "G", "a skipped warm-up does not move the circle");
  assert.equal(next.routine.scaleLastPracticed.D, undefined);
  assert.equal(next.routine.dayStreak, 2, "but the chord block done still records the day");
});

test("a clock that went backwards never lowers the recorded day or the streak", () => {
  const p = recordRoutine(emptyPracticeProgress(), { date: "2026-10-10", blocks: blocks(["done", "done", "done", "done"]) });
  const back = recordRoutine(p, { date: "2026-10-08", blocks: blocks(["done", "done", "done", "done"]) });
  assert.deepEqual([back.routine.lastDate, back.routine.dayStreak], ["2026-10-10", 1]);
});

test("a block key that is not a tonic name (a pitch, text) is never stored", () => {
  const p = recordRoutine(emptyPracticeProgress(), { date: "2026-10-10", blocks: [{ id: "warmup", key: "C#4", status: "done" }, { id: "scale", key: "<b>", status: "done" }] });
  assert.equal(p.routine.lastWarmupKey, null);
  assert.deepEqual(p.routine.scaleLastPracticed, {});
  assert.equal(p.routine.dayStreak, 1, "the day itself is still recorded");
});
