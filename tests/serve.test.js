import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The Docker test stage has no tools/ folder: the whole file is skipped there, with its reason.
const SERVE = new URL("../tools/serve.mjs", import.meta.url);
const skip = existsSync(SERVE) ? false : "tools/serve.mjs is absent (Docker test stage copies only src, tests and songs)";
const serve = skip ? null : await import(SERVE);

const root = resolve(tmpdir(), "pg-serve-root");
const at = (...parts) => join(root, ...parts);

test("isHidden: sources is always hidden, the rest of songs-private only with NO_PRIVATE", { skip }, () => {
  assert.equal(serve.isHidden(at("songs-private", "sources", "x.json"), { root }), true);
  assert.equal(serve.isHidden(at("songs-private", "sources"), { root }), true);
  assert.equal(serve.isHidden(at("songs-private", "index.json"), { root }), false);
  assert.equal(serve.isHidden(at("songs-private", "index.json"), { root, noPrivate: true }), true);
  assert.equal(serve.isHidden(at("songs-private"), { root, noPrivate: true }), true);
  assert.equal(serve.isHidden(at("songs", "index.json"), { root, noPrivate: true }), false, "public songs are never hidden");
  assert.equal(serve.isHidden(at("src", "songs-private.js"), { root, noPrivate: true }), false, "only the folder, not a name that contains it");
});

test("isHidden: Windows spellings of the same folder are hidden too (case, trailing dot or space, stream)", { skip }, () => {
  for (const spelled of ["SOURCES", "Sources", "sources.", "sources ", "sources::$DATA"]) {
    assert.equal(serve.isHidden(at("songs-private", spelled, "x.json"), { root }), true, spelled);
  }
  assert.equal(serve.isHidden(at("Songs-Private", "index.json"), { root, noPrivate: true }), true, "the folder name in any case");
  assert.equal(serve.isHidden(at("songs-private", "sourcesX", "x.json"), { root }), false, "counter-proof: a different name is not hidden");
});

function tempSite() {
  const dir = mkdtempSync(join(tmpdir(), "pg-serve-"));
  for (const [path, text] of [["index.html", "<p>home</p>"], ["songs/index.json", "{}"], ["songs-private/index.json", "{}"], ["songs-private/sources/capture.json", '{"raw":true}']]) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

async function withServer(options, fn) {
  const dir = tempSite();
  const server = serve.createDevServer({ root: dir, ...options });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, dir);
  } finally {
    await new Promise((done) => server.close(done));
    rmSync(dir, { recursive: true, force: true });
  }
}
const status = async (base, path) => (await fetch(base + path)).status;

test("the server serves songs-private from the working tree but never its sources folder", { skip }, async () => {
  await withServer({ noPrivate: false }, async (base, dir) => {
    assert.equal(await status(base, "/songs-private/index.json"), 200);
    assert.equal(await status(base, "/songs/index.json"), 200);
    assert.equal(await status(base, "/songs-private/sources/capture.json"), 404);
    assert.equal(await status(base, "/songs-private/SOURCES/capture.json"), 404);
    assert.equal(await status(base, "/songs-private/sources./capture.json"), 404);
    assert.equal(await status(base, "/songs-private/%73ources/capture.json"), 404, "percent-encoded letters decode to the same folder");
    assert.equal(await status(base, "/songs-private/sources/"), 404);
    assert.equal(readFileSync(join(dir, "songs-private", "sources", "capture.json"), "utf8"), '{"raw":true}', "counter-proof: the file exists, only the guard hides it");
  });
});

test("NO_PRIVATE answers 404 for everything under songs-private and still serves the public files", { skip }, async () => {
  await withServer({ noPrivate: true }, async (base) => {
    assert.equal(await status(base, "/songs-private/index.json"), 404);
    assert.equal(await status(base, "/songs-private/"), 404);
    assert.equal(await status(base, "/songs/index.json"), 200);
    assert.equal(await status(base, "/"), 200);
  });
});

test("the server still refuses paths outside the root", { skip }, async () => {
  await withServer({}, async (base) => {
    assert.equal(await status(base, "/..%2f..%2fwindows%2fwin.ini"), 403);
    assert.equal(await status(base, "/%00"), 400);
  });
});

test("an audio file is served as audio/mpeg with a year of immutable cache, and other files are not cached", { skip }, async () => {
  await withServer({}, async (base, dir) => {
    mkdirSync(join(dir, "assets", "audio", "piano"), { recursive: true });
    writeFileSync(join(dir, "assets", "audio", "piano", "A0.mp3"), "ID3");
    writeFileSync(join(dir, "assets", "audio", "piano", "x.m4a"), "m4a");
    const mp3 = await fetch(base + "/assets/audio/piano/A0.mp3");
    assert.equal(mp3.status, 200);
    assert.equal(mp3.headers.get("content-type"), "audio/mpeg");
    assert.equal(mp3.headers.get("cache-control"), "public, max-age=31536000, immutable");
    const m4a = await fetch(base + "/assets/audio/piano/x.m4a");
    assert.equal(m4a.headers.get("content-type"), "audio/mp4");
    const other = await fetch(base + "/songs/index.json");
    assert.equal(other.headers.get("cache-control"), "no-store", "counter-proof: outside the audio folder nothing is cached");
  });
});

test("nginx.conf serves /assets/audio/ with audio types and a year of cache (counter-proof: a config without the block fails)", () => {
  const conf = readFileSync(new URL("../nginx.conf", import.meta.url), "utf8");
  const audioBlock = (text) => /location \^~ \/assets\/audio\/ \{\s*types \{[^}]*audio\/mpeg mp3;[^}]*audio\/mp4 m4a;[^}]*\}\s*expires 1y;\s*\}/.test(text);
  assert.equal(audioBlock(conf), true);
  assert.equal(audioBlock(conf.replace("location ^~ /assets/audio/", "location ^~ /assets/other/")), false);
});
