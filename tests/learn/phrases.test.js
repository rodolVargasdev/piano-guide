import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePhrases, MIN_REST_TICKS } from "../../src/learn/phrases.js";
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
  assert.deepEqual(spans(derivePhrases(pickup.timeline)), [[0, Q + 2 * BAR], [Q + 2 * BAR, Q + 4 * BAR]]);
  const trailing = learnSong({ notes: run(4), bars: 6 });
  assert.deepEqual(spans(derivePhrases(trailing.timeline)), [[0, 2 * BAR], [2 * BAR, 4 * BAR]], "the third, silent phrase is dropped");
});
