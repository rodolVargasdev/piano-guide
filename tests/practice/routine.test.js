import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS, buildRoutine, dayNumber, routineReducer, startRoutine, summaryOfRoutine } from "../../src/practice/routine.js";
import { emptyPracticeProgress, recordRoutine, recordRun } from "../../src/practice/progress.js";
import { generateExercise } from "../../src/practice/catalog.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { TONICS } from "../../src/theory/keys.js";

const keysOf = (r) => Object.fromEntries(r.blocks.map((b) => [b.id, b.key]));
const finished = (routine) => routine.blocks.map(({ id, key }) => ({ id, key, status: "done" }));
const dayAfter = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

test("the first day: a C five-finger warm-up, a C major scale, a chord drill in C, an ear drill, about ten minutes", () => {
  const r = buildRoutine(emptyPracticeProgress(), "2026-10-10");
  assert.deepEqual(r.blocks.map((b) => b.id), ["warmup", "scale", "chords", "ear"]);
  assert.deepEqual(r.blocks.map((b) => b.exercise).slice(0, 2), ["five-finger", "scale-major"]);
  assert.deepEqual(keysOf(r), { warmup: "C", scale: "C", chords: "C", ear: null });
  assert.equal(r.minutes, 10);
  assert.ok(r.minutes >= 9 && r.minutes <= 11);
  assert.equal(r.blocks.reduce((s, b) => s + b.minutes, 0), r.minutes);
  assert.deepEqual(BLOCKS.map((b) => b.minutes), [2, 3, 3, 2]);
});

test("the same progress and the same day give an identical routine, and it does not change the progress", () => {
  const p = recordRun(emptyPracticeProgress(), { exerciseId: "scale-major", key: "G", bpm: 60, clean: true, date: "2026-10-09" });
  const before = JSON.stringify(p);
  assert.deepEqual(buildRoutine(p, "2026-10-10"), buildRoutine(p, "2026-10-10"));
  assert.equal(JSON.stringify(p), before);
});

test("the next day after a finished routine: the scale key is G and the warm-up key is a different one", () => {
  let p = emptyPracticeProgress();
  const day1 = buildRoutine(p, "2026-10-10");
  p = recordRoutine(p, { date: "2026-10-10", blocks: finished(day1) });
  const day2 = buildRoutine(p, "2026-10-11");
  assert.equal(day2.blocks[1].key, "G");
  assert.notEqual(day2.blocks[0].key, day1.blocks[0].key);
  assert.equal(day2.blocks[0].key, "G", "the circle of fifths after C");
  assert.notEqual(day2.blocks[2].exercise, day1.blocks[2].exercise, "a different chord drill");
  assert.notEqual(day2.blocks[3].exercise, day1.blocks[3].exercise, "the other ear drill");
});

test("the scale goes through the order of introduction one key per recorded day, then back to the key practiced longest ago", () => {
  let p = emptyPracticeProgress();
  const seen = [];
  let day = "2026-10-01";
  for (let i = 0; i < 14; i += 1) {
    const r = buildRoutine(p, day);
    seen.push(r.blocks[1].key);
    p = recordRoutine(p, { date: day, blocks: finished(r) });
    day = dayAfter(day);
  }
  assert.deepEqual(seen.slice(0, 12), ["C", "G", "D", "F", "A", "E", "B", "Bb", "Eb", "Ab", "Db", "F#"]);
  assert.deepEqual(seen.slice(12), ["C", "G"], "all twelve done: the one practiced longest ago comes first");
});

test("the warm-up goes around the circle of fifths, one key per recorded day, and wraps", () => {
  let p = emptyPracticeProgress();
  const seen = [];
  let day = "2026-10-01";
  for (let i = 0; i < 13; i += 1) {
    const r = buildRoutine(p, day);
    seen.push(r.blocks[0].key);
    p = recordRoutine(p, { date: day, blocks: finished(r) });
    day = dayAfter(day);
  }
  assert.deepEqual(seen, ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F", "C"]);
});

test("a scale practiced on its own page counts: the routine does not repeat the key the learner did yesterday", () => {
  const p = recordRun(emptyPracticeProgress(), { exerciseId: "scale-major", key: "C", bpm: 60, clean: true, date: "2026-10-10" });
  assert.equal(buildRoutine(p, "2026-10-11").blocks[1].key, "G");
});

test("skipped blocks do not move the keys: only done blocks update the warm-up key and the scale dates", () => {
  let p = emptyPracticeProgress();
  const r = buildRoutine(p, "2026-10-10");
  p = recordRoutine(p, { date: "2026-10-10", blocks: r.blocks.map((b) => ({ id: b.id, key: b.key, status: b.id === "chords" ? "done" : "skipped" })) });
  const next = buildRoutine(p, "2026-10-11");
  assert.equal(next.blocks[0].key, "C", "the warm-up was skipped, so it is C again");
  assert.equal(next.blocks[1].key, "C", "and so is the scale");
});

test("every day of a year gives a valid routine: real keys, exercises that exist, and the chord and ear drills rotate", () => {
  const chords = new Set();
  const ears = new Set();
  let day = "2026-01-01";
  let p = emptyPracticeProgress();
  for (let i = 0; i < 365; i += 1) {
    const r = buildRoutine(p, day);
    for (const b of r.blocks.slice(0, 3)) assert.ok(TONICS.includes(b.key), `${day} ${b.id} ${b.key}`);
    for (const b of r.blocks.slice(0, 3)) assert.ok(generateExercise(b.exercise, b.options), `${day} ${b.exercise} in ${b.key} generates`);
    chords.add(r.blocks[2].exercise);
    ears.add(r.blocks[3].exercise);
    assert.equal(r.minutes, 10);
    if (i % 3 === 0) p = recordRoutine(p, { date: day, blocks: finished(r) });
    day = dayAfter(day);
  }
  assert.deepEqual([...chords].sort(), ["cadence-i-iv-v-i", "progression-i-v-vi-iv", "triads"]);
  assert.deepEqual([...ears].sort(), ["ear-chords", "ear-intervals"]);
});

test("a date that is not a day gives no routine", () => {
  assert.equal(buildRoutine(emptyPracticeProgress(), "today"), null);
  assert.equal(buildRoutine(emptyPracticeProgress(), undefined), null);
  assert.ok(Number.isNaN(dayNumber("2026-13-45")) || dayNumber("2026-13-45") !== dayNumber("2026-12-15"));
  assert.equal(dayNumber("1970-01-02"), 1);
});

test("the session starts with every block pending and the first one current", () => {
  const s = startRoutine(buildRoutine(emptyPracticeProgress(), "2026-10-10"));
  assert.deepEqual(s.blocks.map((b) => b.status), ["pending", "pending", "pending", "pending"]);
  assert.deepEqual([s.current, s.ended], [0, false]);
});

test("finishing blocks moves to the next one; finishing the last ends the routine with everything done", () => {
  let s = startRoutine(buildRoutine(emptyPracticeProgress(), "2026-10-10"));
  for (let i = 0; i < 3; i += 1) {
    s = routineReducer(s, { type: "DONE_BLOCK" });
    assert.equal(s.ended, false);
    assert.equal(s.current, i + 1);
  }
  s = routineReducer(s, { type: "DONE_BLOCK" });
  assert.equal(s.ended, true);
  assert.deepEqual(summaryOfRoutine(s).blocks.map((b) => b.status), ["done", "done", "done", "done"]);
});

test("skipping the ear drill after three done blocks ends the routine and the day is recorded", () => {
  let s = startRoutine(buildRoutine(emptyPracticeProgress(), "2026-10-10"));
  for (const type of ["DONE_BLOCK", "DONE_BLOCK", "DONE_BLOCK", "SKIP_BLOCK"]) s = routineReducer(s, { type });
  assert.equal(s.ended, true);
  const sum = summaryOfRoutine(s);
  assert.deepEqual(sum.blocks.map((b) => b.status), ["done", "done", "done", "skipped"]);
  assert.equal(sum.counts, true);
  const p = recordRoutine(emptyPracticeProgress(), { date: "2026-10-10", blocks: sum.blocks });
  assert.equal(p.routine.dayStreak, 1);
});

test("skipping all four blocks records nothing: the summary says four skipped and the day streak is unchanged", () => {
  const before = recordRoutine(emptyPracticeProgress(), { date: "2026-10-09", blocks: [{ id: "warmup", key: "C", status: "done" }] });
  let s = startRoutine(buildRoutine(before, "2026-10-10"));
  for (let i = 0; i < 4; i += 1) s = routineReducer(s, { type: "SKIP_BLOCK" });
  const sum = summaryOfRoutine(s);
  assert.equal(sum.skipped, 4);
  assert.equal(sum.counts, false);
  const after = recordRoutine(before, { date: "2026-10-10", blocks: sum.blocks });
  assert.equal(after, before, "the same progress comes back");
  assert.equal(after.routine.dayStreak, 1);
});

test("END skips whatever is still pending and keeps what was done; nothing changes after the end", () => {
  let s = startRoutine(buildRoutine(emptyPracticeProgress(), "2026-10-10"));
  s = routineReducer(s, { type: "DONE_BLOCK" });
  s = routineReducer(s, { type: "END" });
  assert.deepEqual(summaryOfRoutine(s).blocks.map((b) => b.status), ["done", "skipped", "skipped", "skipped"]);
  assert.equal(routineReducer(s, { type: "DONE_BLOCK" }), s);
  assert.equal(routineReducer(startRoutine(buildRoutine(emptyPracticeProgress(), "2026-10-10")), { type: "NOPE" }).current, 0);
});

test("finish end to end: four done blocks give 1 day in a row, and the next day 2 days in a row, in both languages", () => {
  const en = createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => assert.fail("missing") });
  const es = createI18n({ table: STRINGS, navigatorLanguage: "es", warn: () => assert.fail("missing") });
  let p = emptyPracticeProgress();
  p = recordRoutine(p, { date: "2026-10-10", blocks: finished(buildRoutine(p, "2026-10-10")) });
  assert.equal(en.t("routine.daysInRow", { count: p.routine.dayStreak }), "1 day in a row");
  assert.equal(es.t("routine.daysInRow", { count: p.routine.dayStreak }), "1 día seguido");
  p = recordRoutine(p, { date: "2026-10-11", blocks: finished(buildRoutine(p, "2026-10-11")) });
  assert.equal(en.t("routine.daysInRow", { count: p.routine.dayStreak }), "2 days in a row");
  assert.equal(es.t("routine.daysInRow", { count: p.routine.dayStreak }), "2 días seguidos");
});

test("counter-proof: a routine for a learner who skipped everything yesterday is the same as for a new one", () => {
  const skipped = recordRoutine(emptyPracticeProgress(), { date: "2026-10-10", blocks: buildRoutine(emptyPracticeProgress(), "2026-10-10").blocks.map((b) => ({ id: b.id, key: b.key, status: "skipped" })) });
  assert.deepEqual(buildRoutine(skipped, "2026-10-11").blocks.map((b) => b.key), buildRoutine(emptyPracticeProgress(), "2026-10-11").blocks.map((b) => b.key));
});
