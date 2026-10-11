import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "../../src/ui/catalog.js";
import { validSong } from "../fixtures/helpers.js";

// A fake fetcher keyed by URL; a missing URL throws like a 404.
const fakeFetch = (files) => async (url) => {
  if (!(url in files)) throw new Error("HTTP 404");
  return structuredClone(files[url]);
};

const entry = (over = {}) => ({
  id: "example-song",
  file: "example-song.json",
  title: "Example Song",
  composer: "Traditional",
  key: { tonic: "C", mode: "major" },
  defaultBpm: 72,
  levels: ["beginner"],
  ...over,
});

test("an empty index gives an empty, error-free catalog", async () => {
  const r = await loadCatalog(fakeFetch({ "songs/index.json": { songs: [] } }));
  assert.deepEqual(r, { error: null, entries: [] });
});

test("a missing index gives an error and does not throw", async () => {
  const r = await loadCatalog(fakeFetch({}));
  assert.ok(r.error);
  assert.match(r.error.reason, /404/);
  assert.deepEqual(r.entries, []);
});

test("an index that is not valid gives an error with the first reason", async () => {
  const r = await loadCatalog(fakeFetch({ "songs/index.json": { songs: "nope" } }));
  assert.match(r.error.reason, /songs/);
});

test("a fetch that rejects with a non-Error is reported, not thrown", async () => {
  const r = await loadCatalog(async () => Promise.reject("boom"));
  assert.equal(r.error.reason, "boom");
});

test("a valid song is listed as ok", async () => {
  const files = { "songs/index.json": { songs: [entry()] }, "songs/example-song.json": validSong() };
  const r = await loadCatalog(fakeFetch(files));
  assert.equal(r.error, null);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].status, "ok");
});

test("a missing song file only marks its own entry unavailable", async () => {
  const other = entry({ id: "other", file: "other.json", title: "Other" });
  const files = { "songs/index.json": { songs: [entry(), other] }, "songs/other.json": { ...validSong(), id: "other" } };
  const r = await loadCatalog(fakeFetch(files));
  assert.equal(r.entries[0].status, "unavailable");
  assert.match(r.entries[0].reason, /404/);
  assert.equal(r.entries[1].status, "ok");
});

test("an invalid song is unavailable with the first reason and the full list", async () => {
  const bad = validSong();
  delete bad.meter;
  bad.tempo.bpm = 5;
  const files = { "songs/index.json": { songs: [entry()] }, "songs/example-song.json": bad };
  const [e] = (await loadCatalog(fakeFetch(files))).entries;
  assert.equal(e.status, "unavailable");
  assert.match(e.reason, /^meter:/);
  assert.match(e.reasons, /tempo\.bpm/);
  assert.ok(e.reasons.split("\n").length >= 2);
});

test("a song whose id disagrees with the index is unavailable", async () => {
  const files = { "songs/index.json": { songs: [entry()] }, "songs/example-song.json": { ...validSong(), id: "someone-else" } };
  const r = await loadCatalog(fakeFetch(files));
  assert.equal(r.entries[0].status, "unavailable");
  assert.match(r.entries[0].reason, /someone-else/);
});

test("song files are fetched in parallel, not one after another", async () => {
  let inFlight = 0;
  let peak = 0;
  const index = { songs: ["a", "b", "c"].map((id) => entry({ id, file: `${id}.json` })) };
  const fetchJson = async (url) => {
    if (url === "songs/index.json") return index;
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return { ...validSong(), id: url.replace("songs/", "").replace(".json", "") };
  };
  const r = await loadCatalog(fetchJson);
  assert.equal(peak, 3);
  assert.deepEqual(
    r.entries.map((e) => e.status),
    ["ok", "ok", "ok"],
  );
});

test("heroModel counts the usable songs and levels and names the first usable song for the call to action", async () => {
  const { heroModel } = await import("../../src/ui/catalog.js");
  const ok = (id, title, levels) => ({ status: "ok", entry: { id, title, levels } });
  const m = heroModel([ok("a", "Alpha", ["beginner", "original"]), ok("b", "Beta", ["beginner"])]);
  assert.equal(m.badge, "2 songs | 2 levels");
  assert.deepEqual(m.start, { id: "a", title: "Alpha" });
  assert.ok(m.title.length > 0 && m.lead.length > 0);
  assert.equal(heroModel([ok("a", "Alpha", ["beginner"])]).badge, "1 song | 1 level", "singular forms");
});

test("heroModel ignores unavailable songs, and has no call to action when none is usable", async () => {
  const { heroModel } = await import("../../src/ui/catalog.js");
  const broken = { status: "unavailable", entry: { id: "x", title: "Broken", levels: ["original"] } };
  const good = { status: "ok", entry: { id: "g", title: "Good", levels: ["beginner"] } };
  assert.deepEqual(heroModel([broken, good]).start, { id: "g", title: "Good" }, "the first usable one, not the first listed");
  assert.equal(heroModel([broken, good]).badge, "1 song | 1 level", "the broken song's level is not counted");
  const none = heroModel([broken]);
  assert.equal(none.start, null);
  assert.equal(none.badge, "0 songs | 0 levels");
  assert.equal(heroModel([]).start, null);
});
