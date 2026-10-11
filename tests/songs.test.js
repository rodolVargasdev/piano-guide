import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { validateIndex, validateSong } from "../src/core/schema.js";

const read = (rel) => JSON.parse(readFileSync(new URL(`../songs/${rel}`, import.meta.url), "utf8"));
const index = read("index.json");

test("songs/index.json is a valid index", () => {
  const r = validateIndex(index);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test("every indexed song file exists and validates", () => {
  for (const e of index.songs) {
    assert.ok(existsSync(new URL(`../songs/${e.file}`, import.meta.url)), `${e.file} is missing`);
    assert.deepEqual(validateSong(read(e.file)).errors, [], e.id);
  }
});

test("index fields match the song files", () => {
  for (const e of index.songs) {
    const song = read(e.file);
    assert.equal(song.id, e.id);
    assert.equal(song.title, e.title);
    assert.equal(song.composer, e.composer);
    assert.deepEqual(song.key, e.key);
    assert.equal(song.tempo.bpm, e.defaultBpm);
    assert.deepEqual(Object.keys(song.levels).sort(), [...e.levels].sort());
  }
});

test("counter-proof: a duplicated and an incomplete entry make the same index invalid", () => {
  const broken = { songs: [...index.songs, ...index.songs, { id: "x", file: "x.json" }] };
  assert.equal(validateIndex(broken).ok, false);
});
