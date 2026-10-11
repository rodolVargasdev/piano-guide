import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateIndex, validateSong } from "../../src/core/schema.js";

const CLI = fileURLToPath(new URL("../../tools/convert-hooktheory.mjs", import.meta.url));
const FIXTURE = readFileSync(new URL("../fixtures/hooktheory-synthetic.json", import.meta.url), "utf8");
// The Docker test stage has no tools/ folder: the whole file is skipped with its reason there.
const skip = existsSync(CLI) ? false : "tools/convert-hooktheory.mjs is absent (the Docker test stage does not contain tools/)";
const t = (name, fn) => test(name, { skip }, fn);

// A temporary repository root with a songs/ folder (the thing that must never change) and the capture.
function makeRoot(capture = FIXTURE) {
  const root = mkdtempSync(join(tmpdir(), "piano-guide-cli-"));
  mkdirSync(join(root, "songs"));
  writeFileSync(join(root, "songs", "index.json"), '{ "songs": [] }\n');
  mkdirSync(join(root, "songs-private", "sources"), { recursive: true });
  writeFileSync(join(root, "songs-private", "sources", "hooktheory-cancer.json"), capture);
  return root;
}
const run = (root, ...args) => spawnSync(process.execPath, [CLI, "--root", root, ...args], { encoding: "utf8" });
const read = (root, rel) => readFileSync(join(root, rel), "utf8");

// Every file under `dir` with its content, to prove a refused or failed run left the tree unchanged.
function snapshot(dir, prefix = "") {
  const out = {};
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) Object.assign(out, snapshot(p, `${prefix}${name}/`));
    else out[`${prefix}${name}`] = readFileSync(p, "utf8");
  }
  return out;
}
const withRoot = (fn, capture) => {
  const root = makeRoot(capture);
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

t("the owner converts: the song, the index entry and a counts-only summary", () => {
  withRoot((root) => {
    const r = run(root);
    assert.equal(r.status, 0, r.stderr);
    const song = JSON.parse(read(root, "songs-private/cancer-private.json"));
    assert.equal(validateSong(song).ok, true);
    assert.equal(song.id, "cancer-private");
    assert.equal(song.visibility, "private");
    const index = JSON.parse(read(root, "songs-private/index.json"));
    assert.equal(validateIndex(index).ok, true);
    assert.deepEqual(index.songs.map((e) => [e.id, e.file, e.visibility]), [["cancer-private", "cancer-private.json", "private"]]);
    assert.match(r.stdout, /verse: 8 notes, 2 chords/);
    assert.match(r.stdout, /chorus: 3 notes, 2 chords/);
    assert.equal(/[A-G][#b]?\d/.test(r.stdout.replace(/[^\n]*(Wrote|Updated)[^\n]*\n/g, "")), false, "the summary holds counts, not pitches");
  });
});

t("running twice gives identical bytes and one index entry; other index entries are kept", () => {
  withRoot((root) => {
    writeFileSync(join(root, "songs-private", "index.json"), JSON.stringify({ songs: [{ id: "other", file: "other.json", title: "Other", composer: "Me", key: { tonic: "C", mode: "major" }, defaultBpm: 80, levels: ["beginner"] }] }));
    assert.equal(run(root).status, 0);
    const first = read(root, "songs-private/cancer-private.json");
    assert.equal(run(root).status, 0);
    assert.equal(read(root, "songs-private/cancer-private.json"), first);
    assert.deepEqual(JSON.parse(read(root, "songs-private/index.json")).songs.map((e) => e.id), ["other", "cancer-private"]);
  });
});

for (const [name, output] of [
  ["a path under songs/", "songs/x.json"],
  ["a path that climbs out of songs-private/", "songs-private/../songs/x.json"],
  ["a folder that only starts with the same letters", "songs-private-evil/x.json"],
  ["the private folder itself", "songs-private"],
  ["an absolute path elsewhere", join(tmpdir(), "piano-guide-cli-outside.json")],
]) {
  t(`adversarial output is refused with exit code 2 and nothing changes: ${name}`, () => {
    withRoot((root) => {
      const before = snapshot(root);
      const r = run(root, "--output", output);
      assert.equal(r.status, 2, r.stderr);
      assert.match(r.stderr, /songs-private/);
      assert.deepEqual(snapshot(root), before);
      assert.equal(existsSync(join(tmpdir(), "piano-guide-cli-outside.json")), false);
    });
  });
}

t("a songs-private folder that is a link to somewhere else is refused", (ctx) => {
  const outside = mkdtempSync(join(tmpdir(), "piano-guide-cli-link-"));
  const root = mkdtempSync(join(tmpdir(), "piano-guide-cli-root-"));
  try {
    mkdirSync(join(outside, "sources"));
    writeFileSync(join(outside, "sources", "hooktheory-cancer.json"), FIXTURE);
    try {
      symlinkSync(outside, join(root, "songs-private"), "junction");
    } catch (e) {
      return ctx.skip(`cannot create a link here (${e.code})`);
    }
    const before = snapshot(outside);
    const r = run(root);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /link/);
    assert.deepEqual(snapshot(outside), before, "nothing was written through the link");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

t("counter-proof: a custom output inside songs-private/ is accepted, and then the index is left alone", () => {
  withRoot((root) => {
    const r = run(root, "--output", "songs-private/custom.json");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(join(root, "songs-private", "custom.json")), true);
    assert.equal(existsSync(join(root, "songs-private", "index.json")), false);
    assert.match(r.stdout, /Index not updated/);
  });
});

t("a missing input exits non-zero naming the path and writes nothing", () => {
  withRoot((root) => {
    rmSync(join(root, "songs-private", "sources", "hooktheory-cancer.json"));
    const before = snapshot(root);
    const r = run(root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /hooktheory-cancer\.json/);
    assert.deepEqual(snapshot(root), before);
  });
});

t("a capture without a source URL fails explaining it; --source-url supplies one", () => {
  const capture = JSON.stringify({ ...JSON.parse(FIXTURE), source: undefined });
  withRoot((root) => {
    const before = snapshot(root);
    const r = run(root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /source URL/);
    assert.deepEqual(snapshot(root), before);
    const ok = run(root, "--source-url", "https://example.org/own-capture");
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(read(root, "songs-private/cancer-private.json")).sources[0].url, "https://example.org/own-capture");
  }, capture);
});

t("a capture that fails conversion writes nothing", () => {
  const broken = JSON.parse(FIXTURE);
  broken.sections.verse.notes[1].sd = "9";
  withRoot((root) => {
    const before = snapshot(root);
    const r = run(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /sections\.verse\.notes\[1\]\.sd/);
    assert.deepEqual(snapshot(root), before);
  }, JSON.stringify(broken));
});

t("input that is not JSON, an invalid existing index and an unknown flag all fail without writing", () => {
  withRoot((root) => {
    writeFileSync(join(root, "songs-private", "index.json"), "{ not json");
    const before = snapshot(root);
    assert.equal(run(root).status, 1, "invalid index");
    assert.equal(run(root, "--nonsense", "x").status, 1, "unknown flag");
    assert.equal(run(root, "--output").status, 1, "flag without a value");
    assert.deepEqual(snapshot(root), before);
  });
  withRoot((root) => {
    const before = snapshot(root);
    assert.equal(run(root).status, 1, "not JSON");
    assert.deepEqual(snapshot(root), before);
  }, "this is not json");
});
