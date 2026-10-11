import { test } from "node:test";
import assert from "node:assert/strict";
import { TONICS, keyOrder, minorTonic } from "../../src/theory/keys.js";

test("circle of fifths from C: 12 keys in order, and the 13th is C again", () => {
  assert.deepEqual(keyOrder({ kind: "circle", count: 12 }), ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"]);
  assert.equal(keyOrder({ kind: "circle", count: 13 })[12], "C");
});

test("circle of fourths is the reverse ring: C F Bb Eb Ab Db F# B E A D G", () => {
  assert.deepEqual(keyOrder({ kind: "circle", direction: "fourths", count: 12 }), ["C", "F", "Bb", "Eb", "Ab", "Db", "F#", "B", "E", "A", "D", "G"]);
});

test("the circle starts anywhere and wraps, and an unknown start falls back to C", () => {
  assert.deepEqual(keyOrder({ kind: "circle", start: "F", count: 3 }), ["F", "C", "G"]);
  assert.deepEqual(keyOrder({ kind: "circle", direction: "fourths", start: "G", count: 3 }), ["G", "C", "F"]);
  assert.deepEqual(keyOrder({ kind: "circle", start: "H", count: 2 }), ["C", "G"]);
});

test("a fixed list is repeated in order: C F G for 5 steps is C F G C F", () => {
  assert.deepEqual(keyOrder({ kind: "fixed", list: ["C", "F", "G"], count: 5 }), ["C", "F", "G", "C", "F"]);
});

test("random: all 12 keys once before any repeats and no key follows itself, for many seeds and lengths", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const order = keyOrder({ kind: "random", seed, count: 36 });
    for (const block of [0, 12, 24]) assert.equal(new Set(order.slice(block, block + 12)).size, 12, `seed ${seed} block ${block}`);
    order.slice(1).forEach((k, i) => assert.notEqual(k, order[i], `seed ${seed}: ${k} follows itself at ${i + 1}`));
  }
});

test("random is reproducible, differs between seeds, and begins with the key being played when start is given", () => {
  assert.deepEqual(keyOrder({ kind: "random", seed: 5, count: 12 }), keyOrder({ kind: "random", seed: 5, count: 12 }));
  assert.notDeepEqual(keyOrder({ kind: "random", seed: 5, count: 12 }), keyOrder({ kind: "random", seed: 6, count: 12 }));
  const order = keyOrder({ kind: "random", seed: 9, start: "Bb", count: 24 });
  assert.equal(order[0], "Bb");
  assert.equal(new Set(order.slice(0, 12)).size, 12);
  order.slice(1).forEach((k, i) => assert.notEqual(k, order[i]));
});

test("random over a short list still never repeats a key early, and a one-key list is allowed to repeat", () => {
  const order = keyOrder({ kind: "random", seed: 3, list: ["C", "G", "D"], count: 9 });
  for (const block of [0, 3, 6]) assert.equal(new Set(order.slice(block, block + 3)).size, 3);
  order.slice(1).forEach((k, i) => assert.notEqual(k, order[i]));
  assert.deepEqual(keyOrder({ kind: "random", seed: 3, list: ["C"], count: 3 }), ["C", "C", "C"]);
});

test("counter-proof: a defective order is detected by the same checks the tests use", () => {
  const dup = ["C", "G", "G", "D"];
  assert.ok(dup.slice(1).some((k, i) => k === dup[i]), "a key following itself is visible");
  assert.notEqual(new Set(["C", "G", "C"]).size, 3, "a repeat inside a block is visible");
});

test("every order returns fresh arrays and a count of 0 is empty", () => {
  assert.deepEqual(keyOrder({ kind: "circle", count: 0 }), []);
  const a = keyOrder({ kind: "circle", count: 12 });
  a.reverse();
  assert.equal(keyOrder({ kind: "circle", count: 12 })[0], "C");
  assert.equal(TONICS[0], "C");
});

test("minor material on Db, Ab and Eb is written with sharps; the other tonics are unchanged", () => {
  assert.equal(minorTonic("Db"), "C#");
  assert.equal(minorTonic("Ab"), "G#");
  assert.equal(minorTonic("Eb"), "D#");
  for (const t of ["C", "G", "D", "A", "E", "B", "F#", "Bb", "F"]) assert.equal(minorTonic(t), t);
});
