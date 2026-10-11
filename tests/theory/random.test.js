import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32, shuffle } from "../../src/theory/random.js";

const take = (rng, n) => Array.from({ length: n }, () => rng());

test("the same seed gives the same sequence, and a different seed gives a different one", () => {
  assert.deepEqual(take(mulberry32(42), 20), take(mulberry32(42), 20));
  assert.notDeepEqual(take(mulberry32(42), 20), take(mulberry32(43), 20));
});

test("pinned values for seed 42 so the generator cannot drift silently", () => {
  const [a, b, c] = take(mulberry32(42), 3);
  // Measured on 2026-10-11; the first value, 0.6011037519201636, is the well-known mulberry32(42) output.
  assert.equal(a.toFixed(6), "0.601104");
  assert.equal(b.toFixed(6), "0.448291");
  assert.equal(c.toFixed(6), "0.852466");
});

test("values stay in [0, 1) and look uniform", () => {
  const values = take(mulberry32(7), 10000);
  assert.ok(values.every((v) => v >= 0 && v < 1));
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.02, `mean ${mean}`);
  const buckets = Array(10).fill(0);
  for (const v of values) buckets[Math.floor(v * 10)] += 1;
  assert.ok(buckets.every((n) => n > 850 && n < 1150), JSON.stringify(buckets));
});

test("a seed given as a string, a float or a negative number still works and is deterministic", () => {
  assert.deepEqual(take(mulberry32("5"), 5), take(mulberry32(5), 5));
  assert.deepEqual(take(mulberry32(-1), 5), take(mulberry32(-1), 5));
  assert.ok(take(mulberry32(1.5), 3).every((v) => v >= 0 && v < 1));
});

test("shuffle returns a permutation, leaves the input alone, and is reproducible by seed", () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const out = shuffle(list, mulberry32(9));
  assert.deepEqual([...out].sort((a, b) => a - b), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(out, shuffle(list, mulberry32(9)));
  assert.notDeepEqual(out, shuffle(list, mulberry32(10)));
  assert.notDeepEqual(out, list, "this seed really reorders the list");
});

test("shuffle of an empty or one-item list is the same list, and every item can land anywhere", () => {
  assert.deepEqual(shuffle([], mulberry32(1)), []);
  assert.deepEqual(shuffle(["a"], mulberry32(1)), ["a"]);
  const firstSeen = new Set();
  for (let seed = 0; seed < 200; seed += 1) firstSeen.add(shuffle([0, 1, 2, 3], mulberry32(seed))[0]);
  assert.equal(firstSeen.size, 4, "each item appears first for some seed");
});
