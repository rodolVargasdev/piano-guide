import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

// Guard: no audio file may exist under assets/ without an entry in the stack document, and the entry must carry
// the file's real SHA-256. The manifest beside the samples must agree with the bytes on disk. (The Docker test
// stage copies the whole assets/ tree and the stack document, so the same guard runs in the image build.)
const AUDIO = /\.(mp3|m4a|ogg|opus|wav|flac|aac|webm)$/i;
const assets = new URL("../assets/", import.meta.url);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const doc = read("docs/STACK_TECNOLOGICO.md");
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/** Audio files (paths relative to assets/, forward slashes) found under a folder. */
export function audioFilesUnder(folder) {
  return readdirSync(folder, { recursive: true })
    .map((f) => String(f).replaceAll("\\", "/"))
    .filter((f) => AUDIO.test(f) && statSync(new URL(f, folder)).isFile());
}

/** The audio files whose name and SHA-256 are not both in the document text. */
export function unlistedAudio(files, hashOf, text) {
  return files.filter((f) => !text.includes(f.split("/").at(-1)) || !text.includes(hashOf(f)));
}

const files = audioFilesUnder(assets);

test("every audio file under assets/ has its name and SHA-256 in docs/STACK_TECNOLOGICO.md", () => {
  assert.ok(files.length >= 1, "the piano samples are found by the scan");
  assert.deepEqual(unlistedAudio(files, (f) => sha256(new URL(f, assets)), doc), []);
});

test("counter-proof: an audio file that is not in the document is reported, and so is a wrong hash", () => {
  const fixture = ["piano/NotListed.mp3"];
  assert.deepEqual(unlistedAudio(fixture, () => "0".repeat(64), doc), fixture, "unknown name and hash");
  const real = files[0];
  assert.deepEqual(unlistedAudio([real], () => "f".repeat(64), doc), [real], "a listed name with the wrong hash");
});

test("the manifest lists exactly the audio files on disk, with their real size and SHA-256", () => {
  const manifest = JSON.parse(read("assets/audio/piano/manifest.json"));
  const onDisk = files.filter((f) => f.startsWith("audio/piano/")).map((f) => f.split("/").at(-1)).sort();
  assert.deepEqual(manifest.samples.map((s) => s.file).sort(), onDisk);
  for (const s of manifest.samples) {
    const path = new URL(`audio/piano/${s.file}`, assets);
    assert.equal(statSync(path).size, s.bytes, `${s.file} size`);
    assert.equal(sha256(path), s.sha256, `${s.file} sha256`);
  }
});

test("a license file with the author and the license sits beside the samples", () => {
  assert.ok(existsSync(new URL("audio/piano/LICENSE.txt", assets)));
  const text = read("assets/audio/piano/LICENSE.txt");
  assert.match(text, /Alexander Holm/);
  assert.match(text, /CC BY 3\.0/);
  assert.match(text, /creativecommons\.org\/licenses\/by\/3\.0/);
});
