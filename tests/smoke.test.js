import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Pure check so the same rule can be run on the real file and on a broken copy.
export function checkPackageJson(text) {
  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch {
    return { ok: false, reason: "package.json is not valid JSON" };
  }
  if (pkg === null || typeof pkg !== "object") {
    return { ok: false, reason: "package.json is not an object" };
  }
  if (pkg.type !== "module") {
    return { ok: false, reason: 'package.json must declare "type": "module"' };
  }
  return { ok: true };
}

const realText = readFileSync(new URL("../package.json", import.meta.url), "utf8");

test("package.json parses and declares type module", () => {
  assert.deepEqual(checkPackageJson(realText), { ok: true });
});

test("counter-proof: a malformed copy fails the same check", () => {
  assert.equal(checkPackageJson(realText.slice(0, -5)).ok, false);
});

test("counter-proof: a copy without type module fails the same check", () => {
  const broken = JSON.stringify({ ...JSON.parse(realText), type: "commonjs" });
  assert.equal(checkPackageJson(broken).ok, false);
});
