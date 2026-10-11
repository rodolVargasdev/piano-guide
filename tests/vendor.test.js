import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Guard: the vendored three.js files are byte-identical to the audited copy, and the stack
// document records the same hashes. Changing a vendored byte or a documented hash fails here.

const PINNED = {
  "three.module.min.js": "3bc833fceb6577bd1a380388f832ae61cd6e2f78ad02b0bf0d5adf5a4a9334fe",
  "three.core.js": "3b346151f65ffdfca3e4c002bd58966b78c423087fb48a873f83200de1bffc48",
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const vendored = (name) => readFileSync(new URL(`../assets/vendor/${name}`, import.meta.url));
const stackDoc = readFileSync(new URL("../docs/STACK_TECNOLOGICO.md", import.meta.url), "utf8");

for (const [name, hash] of Object.entries(PINNED)) {
  test(`assets/vendor/${name} matches its pinned SHA-256`, () => {
    assert.equal(sha256(vendored(name)), hash);
  });
}

test("counter-proof: a single changed byte no longer matches the pin", () => {
  const bytes = Buffer.from(vendored("three.core.js"));
  bytes[bytes.length - 1] ^= 0x01;
  assert.notEqual(sha256(bytes), PINNED["three.core.js"]);
});

test("the pinned hashes are 64 hex characters and appear in docs/STACK_TECNOLOGICO.md", () => {
  for (const hash of Object.values(PINNED)) {
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.ok(stackDoc.includes(hash), `stack doc lacks ${hash}`);
  }
});

test("the vendored files declare version 0.186.1 and the stack document names it", () => {
  assert.match(vendored("three.core.js").toString("utf8", 0, 400), /three@0\.186\.1/);
  assert.match(vendored("three.module.min.js").toString("utf8", 0, 400), /three@0\.186\.1/);
  assert.ok(stackDoc.includes("0.186.1"));
});
