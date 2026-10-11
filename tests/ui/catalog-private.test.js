import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { validSong } from "../fixtures/helpers.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { loadCatalog, fetchJsonOrAbsent, canLearn, renderCatalog, heroModel, isLocalHost } = await import("../../src/ui/catalog.js");

const entry = (over = {}) => ({ id: "example-song", file: "example-song.json", title: "Example Song", composer: "Traditional", key: { tonic: "C", mode: "major" }, defaultBpm: 72, levels: ["beginner"], ...over });
const priv = (over = {}) => ({ ...validSong(), id: "secret-song", visibility: "private", ...over });
const privEntry = (over = {}) => entry({ id: "secret-song", file: "secret-song.json", title: "Secret Song", visibility: "private", ...over });

const publicFetch = (files) => async (url) => {
  if (!(url in files)) throw new Error("HTTP 404");
  return structuredClone(files[url]);
};
// The private fetcher: answers by URL with a ready three-state result.
const privateFetch = (answers) => async (url) => answers[url] ?? { status: "absent" };
const ok = (json) => ({ status: "ok", json });

const PUBLIC = { "songs/index.json": { songs: [entry()] }, "songs/example-song.json": validSong() };
const load = (answers, files = PUBLIC) => loadCatalog(publicFetch(files), { fetchPrivate: privateFetch(answers) });

const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const render = (data, lang = "en") => {
  const mount = doc.make("div");
  renderCatalog(mount, data, createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} }));
  return mount;
};

// ---- the three-state fetch -----------------------------------------------------------------------------
const response = ({ ok: good = true, type = "application/json", body = "{}" } = {}) => ({ ok: good, headers: { get: () => type }, json: async () => JSON.parse(body) });

test("fetchJsonOrAbsent: a 404, a network error and an HTML 200 are all absent", async () => {
  assert.deepEqual(await fetchJsonOrAbsent("u", async () => response({ ok: false })), { status: "absent" });
  assert.deepEqual(await fetchJsonOrAbsent("u", async () => Promise.reject(new TypeError("network"))), { status: "absent" });
  assert.deepEqual(await fetchJsonOrAbsent("u", async () => response({ type: "text/html; charset=utf-8", body: "<html>" })), { status: "absent" });
});

test("fetchJsonOrAbsent: a JSON-typed body that does not parse is invalid, a good one is ok", async () => {
  assert.equal((await fetchJsonOrAbsent("u", async () => response({ body: "{nope" }))).status, "invalid");
  assert.deepEqual(await fetchJsonOrAbsent("u", async () => response({ body: '{"songs":[]}' })), { status: "ok", json: { songs: [] } });
});

// ---- merging the private library ----------------------------------------------------------------------
test("an absent private index gives exactly the public catalog and no notice", async () => {
  const r = await load({});
  assert.deepEqual(Object.keys(r).sort(), ["entries", "error"]);
  assert.equal(r.entries.length, 1);
});

test("an invalid private index shows one notice and keeps the public songs", async () => {
  const r = await load({ "songs-private/index.json": { status: "invalid", reason: "bad" } });
  assert.equal(r.privateNotice, true);
  assert.equal(r.entries.length, 1);
  const wrong = await load({ "songs-private/index.json": ok({ songs: "nope" }) });
  assert.equal(wrong.privateNotice, true, "valid JSON that is not an index is the same notice");
});

test("a valid private entry comes after the public ones, marked private, and is available", async () => {
  const r = await load({ "songs-private/index.json": ok({ songs: [privEntry()] }), "songs-private/secret-song.json": ok(priv()) });
  assert.deepEqual(r.entries.map((e) => [e.entry.id, e.status, e.private === true]), [["example-song", "ok", false], ["secret-song", "ok", true]]);
  assert.equal(r.privateNotice, undefined);
});

test("a private file without visibility private is unavailable, with the reason", async () => {
  const { visibility, ...open } = priv();
  const { visibility: claimed, ...bare } = privEntry();
  const r = await load({ "songs-private/index.json": ok({ songs: [bare] }), "songs-private/secret-song.json": ok(open) });
  const e = r.entries[1];
  assert.equal(e.status, "unavailable");
  assert.equal(e.reasonKey, "catalog.notPrivate");
  assert.equal(canLearn(e.song), false, "an unavailable entry has no song to learn");
});

test("a private id equal to a public id is unavailable; a different id beside it is available (both directions)", async () => {
  const clash = await load({ "songs-private/index.json": ok({ songs: [entry({ visibility: "private" })] }), "songs-private/example-song.json": ok({ ...priv(), id: "example-song" }) });
  assert.equal(clash.entries[0].status, "ok", "the public song is untouched");
  assert.equal(clash.entries[1].status, "unavailable");
  assert.equal(clash.entries[1].reasonKey, "catalog.idUsed");
  const apart = await load({ "songs-private/index.json": ok({ songs: [privEntry({ id: "cancer-private", file: "cancer-private.json" })] }), "songs-private/cancer-private.json": ok(priv({ id: "cancer-private" })) });
  assert.deepEqual(apart.entries.map((e) => e.status), ["ok", "ok"]);
});

test("an index entry and a file that disagree on visibility are unavailable (counter-proof: agreeing is available)", async () => {
  const agree = await load({ "songs-private/index.json": ok({ songs: [privEntry()] }), "songs-private/secret-song.json": ok(priv()) });
  assert.equal(agree.entries[1].status, "ok");
  const claimsPublic = await load({ "songs-private/index.json": ok({ songs: [privEntry({ visibility: "public" })] }), "songs-private/secret-song.json": ok(priv()) });
  assert.equal(claimsPublic.entries[1].status, "unavailable");
  assert.equal(claimsPublic.entries[1].reasonKey, "catalog.visibilityMismatch");
  const publicLies = await load({}, { "songs/index.json": { songs: [entry({ visibility: "public" })] }, "songs/example-song.json": { ...validSong(), visibility: "private" } });
  assert.equal(publicLies.entries[0].status, "unavailable", "a public entry whose file is private is caught too");
});

test("a public file that declares private is unavailable even when the index says nothing", async () => {
  const r = await load({}, { "songs/index.json": { songs: [entry()] }, "songs/example-song.json": { ...validSong(), visibility: "private" } });
  assert.equal(r.entries[0].status, "unavailable");
  assert.equal(r.entries[0].reasonKey, "catalog.publicIsPrivate");
});

test("a missing or broken private song file only marks its own entry", async () => {
  const two = { songs: [privEntry(), privEntry({ id: "second", file: "second.json" })] };
  const r = await load({ "songs-private/index.json": ok(two), "songs-private/second.json": ok(priv({ id: "second" })) });
  assert.equal(r.entries[1].status, "unavailable");
  assert.match(r.entries[1].reason, /not found/);
  assert.equal(r.entries[2].status, "ok");
});

test("the public index is fetched exactly as before when no private fetcher is given", async () => {
  const urls = [];
  const r = await loadCatalog(async (url) => (urls.push(url), PUBLIC[url]));
  assert.deepEqual(urls, ["songs/index.json", "songs/example-song.json"], "no private request without a private fetcher");
  assert.equal(r.entries[0].status, "ok");
});

test("isLocalHost accepts only names that point at this machine", () => {
  for (const h of ["localhost", "LOCALHOST", "app.localhost", "127.0.0.1", "[::1]", "::1"]) assert.equal(isLocalHost(h), true, h);
  for (const h of ["rodolvargasdev.github.io", "example.com", "localhost.example.com", "127.0.0.2", "", undefined]) assert.equal(isLocalHost(h), false, String(h));
});

test("the real page asks for the private library only when it is served locally", async () => {
  const realFetch = globalThis.fetch;
  const realLocation = globalThis.location;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    const body = PUBLIC[url];
    return { ok: body !== undefined, status: body ? 200 : 404, headers: { get: () => "application/json" }, json: async () => structuredClone(body) };
  };
  try {
    globalThis.location = { hostname: "rodolvargasdev.github.io" };
    await loadCatalog();
    assert.equal(urls.some((u) => u.startsWith("songs-private/")), false, "a published host never requests the private index");
    urls.length = 0;
    globalThis.location = { hostname: "localhost" };
    await loadCatalog();
    assert.equal(urls.includes("songs-private/index.json"), true, "counter-proof: served locally, the private index is requested");
  } finally {
    globalThis.fetch = realFetch;
    if (realLocation === undefined) delete globalThis.location;
    else globalThis.location = realLocation;
  }
});

// ---- Learn gating and cards -----------------------------------------------------------------------------
test("canLearn needs a pitched note in some level", () => {
  assert.equal(canLearn(validSong()), true);
  const rests = { levels: { beginner: { notes: [{ tick: 0, dur: 480, hand: "R", rest: true }] } } };
  assert.equal(canLearn(rests), false);
  assert.equal(canLearn({ levels: { beginner: { notes: [] }, original: { notes: [] } } }), false);
  assert.equal(canLearn(null), false, "never throws");
});

const entryOf = (song, extra = {}) => ({ entry: entry({ id: song.id ?? "x" }), status: "ok", song, ...extra });
const links = (mount) => all(mount, (n) => n.tag === "a").map((n) => [textOf(n), n.attrs.href]);

test("a song card offers Learn and Play along; a song without notes offers Play along only", () => {
  const a = links(render({ error: null, entries: [entryOf(validSong())] }));
  assert.ok(a.some(([text, href]) => text === "Learn" && href === `#/learn/${validSong().id}`));
  assert.ok(a.some(([text, href]) => text === "Play along" && href === `#/song/${validSong().id}`));
  const empty = links(render({ error: null, entries: [entryOf({ levels: { beginner: { notes: [] } } })] }));
  assert.equal(empty.some(([text]) => text === "Learn"), false);
  assert.ok(empty.some(([text]) => text === "Play along"));
});

test("a private card has a Private chip, says the app does not play it, and offers Play along (no sound)", () => {
  const mount = render({ error: null, entries: [entryOf(validSong(), { private: true })] });
  const text = textOf(mount);
  assert.match(text, /Private/);
  assert.match(text, /The app does not play this song/);
  assert.ok(links(mount).some(([t]) => t === "Play along (no sound)"));
  assert.equal(links(mount).some(([t]) => t === "Play along"), false);
  assert.equal(/Listen/.test(text), false, "no Listen anywhere on the card");
});

test("the invalid-index notice and the cards switch language at once", () => {
  const data = { error: null, entries: [entryOf(validSong(), { private: true })], privateNotice: true };
  const es = textOf(render(data, "es"));
  assert.match(es, /No se pudo leer la biblioteca privada/);
  assert.match(es, /Aprender/);
  assert.match(es, /Privada/);
  assert.match(textOf(render(data, "en")), /The private library could not be read/);
});

test("the hero speaks the language and its count badge keeps the plural forms", () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "es", warn: () => {} });
  const one = { status: "ok", entry: { id: "a", title: "Alpha", levels: ["beginner"] } };
  assert.equal(heroModel([one], i18n).badge, "1 canción | 1 nivel");
  assert.equal(heroModel([one, one], i18n).badge, "2 canciones | 1 nivel");
  assert.match(heroModel([one]).lead, /Press Learn/, "English by default");
});
