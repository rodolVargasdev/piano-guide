import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { declaresPrivate, ignoresPrivateFolder, privatePathsIn, privateRefsInIndex, trackedPaths } from "./privacy-guards.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");
const songFiles = readdirSync(join(repoRoot, "songs")).filter((f) => f.endsWith(".json") && f !== "index.json");

test(".gitignore lists the private folder", () => {
  assert.equal(ignoresPrivateFolder(read(".gitignore")), true);
});

test("counter-proof: an ignore file without the entry, or with a look-alike, fails the guard", () => {
  assert.equal(ignoresPrivateFolder(".atl/\nnode_modules/\n"), false);
  assert.equal(ignoresPrivateFolder("songs-private-old/\n# songs-private/\n"), false);
  assert.equal(ignoresPrivateFolder("/songs-private/\r\n"), true, "a leading slash and CRLF still count");
});

test("no file under songs/ declares itself private", () => {
  assert.ok(songFiles.length > 0, "there are public song files to check");
  for (const f of songFiles) assert.equal(declaresPrivate(JSON.parse(read(`songs/${f}`))), false, `${f} declares visibility private`);
});

test("counter-proof: a song file declaring private is detected", () => {
  assert.equal(declaresPrivate({ id: "x", visibility: "private" }), true);
  assert.equal(declaresPrivate({ id: "x", visibility: "public" }), false);
  assert.equal(declaresPrivate({ id: "x" }), false);
});

test("the public index never points into the private folder", () => {
  assert.deepEqual(privateRefsInIndex(JSON.parse(read("songs/index.json"))), []);
});

test("counter-proof: an index entry that names songs-private/ is detected", () => {
  assert.deepEqual(privateRefsInIndex({ songs: [{ file: "a.json" }, { file: "songs-private/cancer-private.json" }, { file: "../songs-private/b.json" }] }), [
    "songs-private/cancer-private.json",
    "../songs-private/b.json",
  ]);
  assert.deepEqual(privateRefsInIndex({}), []);
});

const tracked = trackedPaths(repoRoot);

test("no tracked path starts with songs-private/", { skip: tracked.skipped }, () => {
  assert.ok(tracked.paths.length > 0, "git lists the repository files");
  assert.deepEqual(privatePathsIn(tracked.paths), []);
});

test("counter-proof: a tracked path list containing a private song fails the guard", () => {
  assert.deepEqual(privatePathsIn(["README.md", "songs/index.json", "songs-private/cancer-private.json"]), ["songs-private/cancer-private.json"]);
  assert.deepEqual(privatePathsIn(["./songs-private/index.json", "songs-private\\sources\\x.json"]).length, 2, "dot-slash and backslash forms count");
  assert.deepEqual(privatePathsIn(["songs/cancer.json", "docs/songs-private-notes.md"]), [], "look-alikes outside the folder do not");
});

test("without a .git directory the tracked-path check is skipped with a reason, never passed blindly", () => {
  const dir = mkdtempSync(join(tmpdir(), "piano-guide-nogit-"));
  try {
    const r = trackedPaths(dir);
    assert.equal(r.paths, undefined);
    assert.match(r.skipped, /no \.git/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
