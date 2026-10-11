import { test } from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "../../src/ui/router.js";
import { createStore } from "../../src/ui/state.js";

// A fake window and mount: enough to drive the dispatcher without a DOM.
function harness(views) {
  const listeners = new Set();
  const win = {
    location: { hash: "" },
    addEventListener: (type, fn) => type === "hashchange" && listeners.add(fn),
    removeEventListener: (type, fn) => type === "hashchange" && listeners.delete(fn),
  };
  const mount = { cleared: 0, replaceChildren() { this.cleared += 1; } };
  const store = createStore({ route: null });
  const router = createRouter({ mount, views, store, win });
  const go = (hash) => {
    win.location.hash = hash;
    for (const fn of [...listeners]) fn();
  };
  return { router, go, listeners, mount, store };
}

function recordingViews(log) {
  const make = (name) => (route) => {
    log.push(`mount ${name}${route.songId ? `:${route.songId}` : ""}`);
    return { dispose: () => log.push(`dispose ${name}`) };
  };
  return { catalog: make("catalog"), song: make("song"), unknown: make("unknown") };
}

test("start mounts the view for the current hash", () => {
  const log = [];
  const h = harness(recordingViews(log));
  h.router.start();
  assert.deepEqual(log, ["mount catalog"]);
  assert.equal(h.store.get("route").route, "catalog");
});

test("the previous view is disposed BEFORE the next one is mounted", () => {
  const log = [];
  const h = harness(recordingViews(log));
  h.router.start();
  h.go("#/song/cancer");
  assert.deepEqual(log, ["mount catalog", "dispose catalog", "mount song:cancer"]);
});

test("going back (a hash change to the catalog) disposes the player first", () => {
  const log = [];
  const h = harness(recordingViews(log));
  h.router.start();
  h.go("#/song/cancer");
  log.length = 0;
  h.go("#/");
  assert.deepEqual(log, ["dispose song", "mount catalog"]);
});

test("unknown routes use the unknown view", () => {
  const log = [];
  const h = harness(recordingViews(log));
  h.router.start();
  h.go("#/nope");
  assert.deepEqual(log.slice(-1), ["mount unknown"]);
});

test("stop disposes the current view and removes the listener (counter-proof: no more mounts)", () => {
  const log = [];
  const h = harness(recordingViews(log));
  h.router.start();
  h.router.stop();
  assert.deepEqual(log, ["mount catalog", "dispose catalog"]);
  assert.equal(h.listeners.size, 0);
  h.go("#/song/cancer");
  assert.equal(log.length, 2);
});

test("a view that returns nothing does not break later navigation", () => {
  const h = harness({ catalog: () => undefined, song: () => undefined, unknown: () => undefined });
  h.router.start();
  assert.doesNotThrow(() => h.go("#/song/x"));
});
