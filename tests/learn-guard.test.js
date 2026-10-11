import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// The Learn modules guide the learner and never play a song or a generated sequence: the engine's
// playNotes / stopNotes are for ear drills only. A static text scan keeps it that way.
const LEARN_DIR = new URL("../src/learn/", import.meta.url);
const FORBIDDEN = /\b(?:playNotes|stopNotes)\b/;

/** Names of the sources (path, text) that mention a forbidden engine entry point. */
export function offenders(sources) {
  return sources.filter(([, text]) => FORBIDDEN.test(text)).map(([path]) => path);
}

const learnSources = () =>
  readdirSync(LEARN_DIR, { recursive: true })
    .filter((f) => String(f).endsWith(".js"))
    .map((f) => [join("src/learn", String(f)), readFileSync(new URL(String(f), LEARN_DIR), "utf8")]);

test("no module under src/learn mentions playNotes or stopNotes", () => {
  const sources = learnSources();
  assert.ok(sources.length >= 6, "the scan really read the learn modules");
  assert.deepEqual(offenders(sources), []);
});

test("counter-proof: the scan flags a module that imports or calls them", () => {
  assert.deepEqual(offenders([["a.js", "const play = engine.playNotes([]);"]]), ["a.js"]);
  assert.deepEqual(offenders([["b.js", "import { stopNotes } from '../audio/engine.js';"]]), ["b.js"]);
  assert.deepEqual(offenders([["c.js", "const startNote = engine.startNote;"], ["d.js", "// plays notes of the learner"]]), [], "other engine calls and plain words are fine");
});
