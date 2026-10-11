import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../src/ui/state.js";

test("get returns the initial state and single keys", () => {
  const store = createStore({ a: 1, b: 2 });
  assert.deepEqual(store.get(), { a: 1, b: 2 });
  assert.equal(store.get("b"), 2);
  assert.equal(store.get("missing"), undefined);
});

test("subscribe fires once per change, with new and previous state", () => {
  const store = createStore({ n: 0 });
  const calls = [];
  store.subscribe((state, prev) => calls.push([state.n, prev.n]));
  store.set("n", 1);
  store.set({ n: 2 });
  assert.deepEqual(calls, [
    [1, 0],
    [2, 1],
  ]);
});

test("a multi-key patch notifies once, not once per key", () => {
  const store = createStore({ a: 1, b: 1 });
  let count = 0;
  store.subscribe(() => (count += 1));
  store.set({ a: 2, b: 2 });
  assert.equal(count, 1);
});

test("setting an equal value does not notify", () => {
  const store = createStore({ a: 1 });
  let count = 0;
  store.subscribe(() => (count += 1));
  store.set("a", 1);
  assert.equal(count, 0);
});

test("unsubscribe stops notifications (counter-proof: a kept subscriber still fires)", () => {
  const store = createStore({ a: 0 });
  let gone = 0;
  let kept = 0;
  const unsubscribe = store.subscribe(() => (gone += 1));
  store.subscribe(() => (kept += 1));
  store.set("a", 1);
  unsubscribe();
  store.set("a", 2);
  assert.equal(gone, 1);
  assert.equal(kept, 2);
});

test("a subscriber may unsubscribe itself while being notified", () => {
  const store = createStore({ a: 0 });
  let count = 0;
  const unsubscribe = store.subscribe(() => {
    count += 1;
    unsubscribe();
  });
  store.subscribe(() => (count += 10));
  store.set("a", 1);
  store.set("a", 2);
  assert.equal(count, 21);
});
