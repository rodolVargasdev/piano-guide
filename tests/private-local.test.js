// Local-only checks against the owner's private capture. Skipped, never failed, when songs-private/ is
// absent (a clean clone, CI, the Docker test stage). Reports counts only: no melody, chord or lyric
// content is printed or asserted by value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convertHooktheory } from "../src/import/hooktheory.js";
import { validateSong } from "../src/core/schema.js";

const root = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const SOURCE = root("songs-private/sources/hooktheory-cancer.json");
const OUTPUT = root("songs-private/cancer-private.json");
const skip = existsSync(SOURCE) ? false : "songs-private/sources/hooktheory-cancer.json is absent (the private library is local only)";

const strings = (node, out = []) => {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((v) => strings(v, out));
  else if (node && typeof node === "object") Object.values(node).forEach((v) => strings(v, out));
  return out;
};
const keys = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((v) => keys(v, out));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) (out.push(k), keys(v, out));
  return out;
};

test("the real capture converts and its section counts are verse 52 / 14, chorus 34 / 11, bridge 39 / 13", { skip }, (t) => {
  const source = JSON.parse(readFileSync(SOURCE, "utf8"));
  const r = convertHooktheory(source);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const counts = Object.fromEntries(Object.entries(r.summary).map(([name, c]) => [name, `${c.notes}/${c.chords}`]));
  assert.equal(counts.verse, "52/14");
  assert.equal(counts.chorus, "34/11");
  assert.equal(counts.bridge, "39/13");
  t.diagnostic(`section notes/chords: ${JSON.stringify(counts)}; warnings: ${r.warnings.length}`);
});

test("no lyric text can reach the generated song: no lyric key, and no string of the capture is copied across", { skip }, () => {
  const source = JSON.parse(readFileSync(SOURCE, "utf8"));
  assert.equal(keys(source).some((k) => /lyric/i.test(k)), false, "the capture carries no lyric field");
  const song = convertHooktheory(source).song;
  assert.equal(keys(song).some((k) => /lyric/i.test(k)), false);
  const text = JSON.stringify(song);
  // The URL and the `kind` constant ("user-submitted") are provenance the song is meant to keep.
  const copied = strings(source).filter((s) => s.length >= 12 && s !== source.source && s !== source.kind && text.includes(s));
  assert.equal(copied.length, 0, `${copied.length} capture strings were copied into the song`);
});

test("the generated private file, when present, validates, is private and matches a fresh conversion byte for byte", { skip: skip || (existsSync(OUTPUT) ? false : "songs-private/cancer-private.json has not been generated yet") }, () => {
  const written = readFileSync(OUTPUT, "utf8");
  const song = JSON.parse(written);
  assert.deepEqual(validateSong(song).errors, []);
  assert.equal(song.visibility, "private");
  assert.equal(song.id, "cancer-private");
  const fresh = convertHooktheory(JSON.parse(readFileSync(SOURCE, "utf8"))).song;
  assert.equal(written, `${JSON.stringify(fresh, null, 2)}\n`);
});
