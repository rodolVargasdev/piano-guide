import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePhrases, MAX_PHRASE_STEPS, MIN_REST_TICKS } from "../../src/learn/phrases.js";
import { validateSong } from "../../src/core/schema.js";
import { BAR, Q, learnSong, line, note } from "../fixtures/learn-songs.js";

const CYCLE = ["C4", "D4", "E4", "F4"];
/** Quarter notes for `bars` bars, four per bar, cycling through C D E F. */
const run = (bars, opts) => line(Array.from({ length: bars * 4 }, (_, i) => CYCLE[i % 4]), opts);
const spans = (phrases) => phrases.map((p) => [p.startTick, p.endTick]);

test("the synthetic fixtures are valid songs, so the tests below exercise real data shapes", () => {
  const { song } = learnSong({ notes: run(4) });
  const result = validateSong(song);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("authored learn.phrases win unchanged, with their title and hint", () => {
  const learn = { phrases: [{ id: "a", startTick: 0, endTick: BAR, hint: { en: "Slowly.", es: "Despacio." } }, { id: "b", startTick: BAR, endTick: 4 * BAR, title: "Second" }] };
  const { timeline } = learnSong({ notes: run(4), learn });
  assert.deepEqual(derivePhrases(timeline), [
    { id: "a", startTick: 0, endTick: BAR, hint: { en: "Slowly.", es: "Despacio." } },
    { id: "b", startTick: BAR, endTick: 4 * BAR, title: "Second" },
  ]);
});

test("without authored phrases a song is cut to two bars each", () => {
  const { timeline } = learnSong({ notes: run(8), bars: 8 });
  const phrases = derivePhrases(timeline);
  assert.deepEqual(spans(phrases), [[0, 2 * BAR], [2 * BAR, 4 * BAR], [4 * BAR, 6 * BAR], [6 * BAR, 8 * BAR]]);
  assert.deepEqual(phrases.map((p) => p.id), ["p1", "p2", "p3", "p4"]);
});

/** The run of `bars` bars without the quarter notes that start inside [from, to): a rest in the music. */
const withGap = (bars, from, to) => run(bars).filter((n) => n.tick < from || n.tick >= to);

test("a rest near the end of the second bar ends the phrase there and the next begins after it", () => {
  // The last beat of bar 2 rests; music resumes at bar 3.
  const { timeline } = learnSong({ notes: withGap(4, 2 * BAR - Q, 2 * BAR), bars: 4 });
  assert.deepEqual(spans(derivePhrases(timeline)), [[0, 2 * BAR - Q], [2 * BAR, 4 * BAR]]);
});

test("counter-proofs: a rest far from the two-bar mark, or shorter than an eighth, does not cut the phrase", () => {
  const far = learnSong({ notes: withGap(4, 2 * Q, 4 * Q), bars: 4 });
  assert.deepEqual(spans(derivePhrases(far.timeline)), [[0, 2 * BAR], [2 * BAR, 4 * BAR]], "a two-beat rest in bar 1 is not near the two-bar mark");
  const shortened = run(4).map((n) => (n.tick === 2 * BAR - Q ? { ...n, dur: Q - 120 } : n));
  assert.ok(120 < MIN_REST_TICKS, "the silence under test is below the threshold");
  assert.deepEqual(spans(derivePhrases(learnSong({ notes: shortened, bars: 4 }).timeline)), [[0, 2 * BAR], [2 * BAR, 4 * BAR]]);
});

test("a silence in one hand is not a rest while the other hand still sounds", () => {
  const notes = [...withGap(4, 2 * BAR - Q, 2 * BAR), note(0, 4 * BAR, "C3", "L")];
  assert.deepEqual(spans(derivePhrases(learnSong({ notes, bars: 4 }).timeline)), [[0, 2 * BAR], [2 * BAR, 4 * BAR]]);
});

test("a one-bar song has one phrase, and a song with no notes still has one (never empty)", () => {
  assert.deepEqual(spans(derivePhrases(learnSong({ notes: run(1), bars: 1 }).timeline)), [[0, BAR]]);
  const empty = derivePhrases(learnSong({ notes: [], bars: 2 }).timeline);
  assert.equal(empty.length, 1);
  assert.deepEqual(spans(empty), [[0, 2 * BAR]]);
});

test("a pickup belongs to the first phrase and trailing silence yields no phrase", () => {
  const pickup = learnSong({ notes: line(["G3"], { dur: Q }).concat(run(4, { startTick: Q })), bars: 4, pickupTicks: Q });
  // The pickup note plus eight quarters make nine onsets in the first two bars: cut into 5 and 4 at an onset.
  assert.deepEqual(spans(derivePhrases(pickup.timeline)), [[0, 5 * Q], [5 * Q, Q + 2 * BAR], [Q + 2 * BAR, Q + 4 * BAR]]);
  const trailing = learnSong({ notes: run(4), bars: 6 });
  assert.deepEqual(spans(derivePhrases(trailing.timeline)), [[0, 2 * BAR], [2 * BAR, 4 * BAR]], "the third, silent phrase is dropped");
});

// ---- small phrases for a beginner ------------------------------------------------------------------------
const eighths = (count, opts) => line(Array.from({ length: count }, (_, i) => CYCLE[i % 4]), { dur: Q / 2, ...opts });
const onsetsIn = (timeline, [a, b]) => new Set(timeline.notes.filter((n) => n.tick >= a && n.tick < b).map((n) => n.tick)).size;

test("a phrase of exactly the limit is not split; one more onset splits it into two near-equal parts", () => {
  assert.equal(MAX_PHRASE_STEPS, 8);
  const exact = learnSong({ notes: eighths(8), bars: 2 }).timeline;
  assert.deepEqual(spans(derivePhrases(exact)), [[0, 2 * BAR]]);
  const over = learnSong({ notes: eighths(9), bars: 2 }).timeline;
  const parts = derivePhrases(over);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map((p) => onsetsIn(over, [p.startTick, p.endTick])), [5, 4]);
});

test("a long phrase is cut at onsets into the fewest equal parts, each within the limit, covering the same ticks", () => {
  const { timeline } = learnSong({ notes: eighths(16), bars: 2 });
  const parts = derivePhrases(timeline);
  assert.deepEqual(parts.map((p) => onsetsIn(timeline, [p.startTick, p.endTick])), [8, 8]);
  const big = learnSong({ notes: eighths(20, { dur: Q / 4 }).map((n, i) => ({ ...n, dur: Q / 4, tick: i * (Q / 4) })), bars: 2 }).timeline;
  const three = derivePhrases(big);
  assert.deepEqual(three.map((p) => onsetsIn(big, [p.startTick, p.endTick])), [7, 7, 6]);
  assert.equal(three[0].startTick, 0);
  assert.equal(three.at(-1).endTick, 2 * BAR);
  three.slice(1).forEach((p, i) => assert.equal(p.startTick, three[i].endTick, "contiguous"));
  assert.ok(three.every((p) => big.notes.some((n) => n.tick === p.startTick)), "every part starts on an onset");
  assert.deepEqual(three.map((p) => p.id), ["p1", "p2", "p3"]);
});

test("counter-proof: authored phrases are never split, however many notes they hold", () => {
  const learn = { phrases: [{ id: "all", startTick: 0, endTick: 2 * BAR }] };
  const { timeline } = learnSong({ notes: eighths(16), bars: 2, learn });
  assert.deepEqual(spans(derivePhrases(timeline)), [[0, 2 * BAR]]);
});

test("the onsets of both hands count, so the right hand never gets more steps than the limit", () => {
  const right = eighths(6); // onsets at 0, 240, ...
  const left = line(["C3", "G3", "C3", "G3"], { hand: "L", dur: Q / 4 }).map((n, i) => ({ ...n, tick: i * (Q / 2) + Q / 4 })); // between them
  const { timeline } = learnSong({ notes: [...right, ...left], bars: 2 });
  const parts = derivePhrases(timeline);
  assert.equal(parts.length, 2, "ten onsets in all: split although the right hand has only six");
  assert.ok(parts.every((p) => onsetsIn(timeline, [p.startTick, p.endTick]) <= MAX_PHRASE_STEPS));
});
