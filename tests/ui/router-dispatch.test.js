import { test } from "node:test";
import assert from "node:assert/strict";
import { createRouter, lazyView } from "../../src/ui/router.js";
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

// ---- lazy views ----
const tick = () => new Promise((r) => setTimeout(r, 0));

test("lazyView shows loading, loads once the view is opened, then mounts the real view with the same route and mount", async () => {
  const log = [];
  const root = { id: "root" };
  const view = lazyView(async () => (route, mount) => {
    log.push(`mount ${route.songId} ${mount === root}`);
    return { dispose: () => log.push("dispose") };
  }, { show: (r, kind) => log.push(kind) });
  const handle = view({ songId: "cancer" }, root);
  assert.deepEqual(log, ["loading"], "nothing is loaded before the view is opened, and the message shows at once");
  await tick();
  assert.deepEqual(log, ["loading", "mount cancer true"]);
  handle.dispose();
  assert.deepEqual(log, ["loading", "mount cancer true", "dispose"]);
});

test("lazyView: leaving before the module arrives mounts nothing", async () => {
  const log = [];
  let arrive;
  const slow = new Promise((r) => (arrive = r));
  const view = lazyView(() => slow, { show: (r, kind) => log.push(kind) });
  const handle = view({}, {});
  handle.dispose();
  arrive((route) => {
    log.push("mounted");
    return { dispose() {} };
  });
  await tick();
  assert.deepEqual(log, ["loading"], "the late module did not mount over the next page");
});

test("lazyView: a module that fails to load shows the failure instead of a blank page, and a late failure after leaving shows nothing", async () => {
  const log = [];
  const failing = lazyView(async () => {
    throw new Error("offline");
  }, { show: (r, kind) => log.push(kind) });
  failing({}, {});
  await tick();
  assert.deepEqual(log, ["loading", "failed"]);
  const after = [];
  const left = lazyView(() => Promise.reject(new Error("offline")), { show: (r, kind) => after.push(kind) });
  left({}, {}).dispose();
  await tick();
  assert.deepEqual(after, ["loading"], "no message over a page the user already left");
});

test("lazyView wired in the router: the previous view is disposed before the lazy one mounts", async () => {
  const log = [];
  const views = recordingViews(log);
  views.song = lazyView(async () => (route) => {
    log.push(`mount lazy:${route.songId}`);
    return { dispose: () => log.push("dispose lazy") };
  }, { show: () => {} });
  const h = harness(views);
  h.router.start();
  h.go("#/song/cancer");
  await tick();
  h.go("#/");
  assert.deepEqual(log, ["mount catalog", "dispose catalog", "mount lazy:cancer", "dispose lazy", "mount catalog"]);
});

test("the learn route reaches its own view with the raw id, and a route with no view falls to unknown", () => {
  const log = [];
  const views = { ...recordingViews(log), learn: (route) => (log.push(`mount learn:${route.songId}`), { dispose: () => log.push("dispose learn") }) };
  const h = harness(views);
  h.router.start();
  h.go("#/learn/cancer-private");
  assert.deepEqual(log, ["mount catalog", "dispose catalog", "mount learn:cancer-private"]);
  log.length = 0;
  h.go("#/practice"); // no practice view yet: unknown, and Learn is disposed first
  assert.deepEqual(log, ["dispose learn", "mount unknown"]);
});
