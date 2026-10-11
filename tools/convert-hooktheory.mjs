#!/usr/bin/env node
// Thin command around src/import/hooktheory.js: reads a Hooktheory capture, converts it, validates the
// whole result in memory, and only then writes songs-private/<id>.json and upserts songs-private/index.json.
// It never writes outside songs-private/ (exit code 2) and writes nothing when conversion fails (exit code 1).
//
//   node tools/convert-hooktheory.mjs [--input <file>] [--output <file>] [--source-url <url>] [--root <dir>]
//
// Defaults: input songs-private/sources/hooktheory-cancer.json, output songs-private/cancer-private.json.
// `--root` replaces the repository root (the tests use a temporary one). Paths are resolved against it.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { convertHooktheory } from "../src/import/hooktheory.js";
import { validateIndex } from "../src/core/schema.js";

const FAILED = 1;
const REFUSED = 2;
const FLAGS = new Set(["--input", "--output", "--source-url", "--root"]);

function die(code, message) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!FLAGS.has(argv[i]) || argv[i + 1] === undefined) die(FAILED, `Usage: convert-hooktheory.mjs [--input <file>] [--output <file>] [--source-url <url>] [--root <dir>] (problem near "${argv[i]}")`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? fileURLToPath(new URL("..", import.meta.url)));
const privDir = resolve(root, "songs-private");
const input = resolve(root, args.input ?? "songs-private/sources/hooktheory-cancer.json");
const output = resolve(root, args.output ?? "songs-private/cancer-private.json");

// Write boundary: lexically under songs-private/, and not through a link that leaves it.
if (!output.startsWith(privDir + sep)) die(REFUSED, `Refused: the output must be under songs-private/ (got ${output}).`);
if (existsSync(privDir) && realpathSync(privDir) !== resolve(realpathSync(root), "songs-private")) {
  die(REFUSED, "Refused: songs-private/ is a link that leaves the repository.");
}
let nearest = output;
while (!existsSync(nearest)) nearest = dirname(nearest);
if (existsSync(privDir)) {
  const real = realpathSync(privDir);
  const there = realpathSync(nearest);
  if (there !== real && !there.startsWith(real + sep)) die(REFUSED, "Refused: the output path leaves songs-private/ through a link.");
}

if (!existsSync(input)) die(FAILED, `Input not found: ${input}`);
let source;
try {
  source = JSON.parse(readFileSync(input, "utf8"));
} catch (e) {
  die(FAILED, `Input is not valid JSON: ${input} (${e.message})`);
}

const result = convertHooktheory(source, { sourceUrl: args["source-url"] });
if (!result.ok) die(FAILED, `Conversion failed, nothing written:\n${result.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n")}`);
const { song } = result;

// The index entry is built and validated before any write, so a bad index also writes nothing.
const indexPath = join(privDir, "index.json");
const upsert = dirname(output) === privDir && basename(output) === `${song.id}.json`;
let indexText = null;
if (upsert) {
  let index = { songs: [] };
  if (existsSync(indexPath)) {
    try {
      index = JSON.parse(readFileSync(indexPath, "utf8"));
    } catch (e) {
      die(FAILED, `The existing index is not valid JSON, nothing written: ${indexPath} (${e.message})`);
    }
  }
  const entry = { id: song.id, file: `${song.id}.json`, title: song.title, composer: song.composer, key: song.key, defaultBpm: song.tempo.bpm, levels: ["beginner"], visibility: "private" };
  const songs = Array.isArray(index.songs) ? index.songs.filter((e) => e?.id !== song.id) : [];
  const next = { ...index, songs: [...songs, entry] };
  const checked = validateIndex(next);
  if (!checked.ok) die(FAILED, `The index would be invalid, nothing written:\n${checked.errors.map((e) => `  ${e.path}: ${e.message}`).join("\n")}`);
  indexText = `${JSON.stringify(next, null, 2)}\n`;
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(song, null, 2)}\n`);
if (indexText !== null) writeFileSync(indexPath, indexText);

console.log(`Wrote ${output}`);
console.log(indexText !== null ? `Updated ${indexPath}` : "Index not updated (the output is not songs-private/<id>.json).");
for (const [name, c] of Object.entries(result.summary)) console.log(`${name}: ${c.notes} notes, ${c.chords} chords`);
if (result.warnings.length) console.log(`${result.warnings.length} warning(s):\n${result.warnings.map((w) => `  ${w}`).join("\n")}`);
