import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { STRINGS } from "../../src/i18n/strings.js";

// The missing-key guard: every string key written as a literal in a translator call (t("some.key") or
// i18n.t("some.key")) anywhere under src/ must exist in the catalog, as a plain key or as a plural pair
// (key_one and key_other). Keys built at run time (t(`hand.${h}`)) cannot be read from the source; their
// parts are covered by the tests of the module that builds them.
const CALL = /\bt\(\s*(["'])([A-Za-z0-9_.-]+)\1/g;

/** The literal keys of translator calls in a piece of source text. */
export function literalKeys(text) {
  return [...text.matchAll(CALL)].map((m) => m[2]);
}

/** The keys among `keys` that the table does not have (a plural pair counts as having the plain key). */
export function absentKeys(keys, table) {
  return [...new Set(keys)].filter((k) => !(k in table) && !(`${k}_one` in table && `${k}_other` in table));
}

const root = new URL("../../src/", import.meta.url);
const files = readdirSync(root, { recursive: true }).filter((f) => String(f).endsWith(".js"));
const used = files.flatMap((f) => literalKeys(readFileSync(new URL(String(f).replaceAll("\\", "/"), root), "utf8")).map((key) => ({ key, file: String(f) })));

test("every literal key of a translator call in src/ exists in the catalog", () => {
  assert.ok(files.length > 40, "the whole source tree was scanned");
  assert.ok(used.length > 60, `${used.length} literal keys were found`);
  const missing = absentKeys(used.map((u) => u.key), STRINGS);
  assert.deepEqual(missing.map((k) => `${k} (${used.find((u) => u.key === k).file})`), []);
});

test("counter-proof: the scanner finds a key that is not in the table, and reads plural pairs", () => {
  assert.deepEqual(literalKeys('x.textContent = t("no.such.key"); y = i18n.t(\'also.missing\'); z = split("a.b")'), ["no.such.key", "also.missing"]);
  assert.deepEqual(absentKeys(["no.such.key", "common.correct"], STRINGS), ["no.such.key"]);
  assert.deepEqual(absentKeys(["catalog.songs"], STRINGS), [], "a plural pair stands for the plain key");
  assert.deepEqual(absentKeys(["catalog.songs"], { "catalog.songs_one": { en: "a", es: "a" } }), ["catalog.songs"], "half a pair does not");
  assert.deepEqual(literalKeys("t(`hand.${h}`)"), [], "a built key is not a literal");
});
