import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guard: the stack document must describe what the Dockerfile and the vendored files really are.
// A checkout on Windows may give the files CRLF line endings (the Docker build copies them as they are).
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const doc = read("docs/STACK_TECNOLOGICO.md");
const dockerfile = read("Dockerfile");
const core = read("assets/vendor/three.core.js");

const images = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((m) => m[1]);

test("every base image of the Dockerfile, with its exact tag and digest, appears in the stack document", () => {
  assert.ok(images.length >= 2, "a test stage and a runtime stage");
  for (const ref of images) {
    assert.match(ref, /@sha256:[0-9a-f]{64}$/, `${ref} is pinned by digest`);
    assert.ok(doc.includes(ref), `the stack document lists ${ref}`);
  }
});

test("counter-proof: a digest that is not in the Dockerfile is not in the document either", () => {
  const stale = images[0].replace(/[0-9a-f]$/, (c) => (c === "0" ? "1" : "0"));
  assert.notEqual(stale, images[0]);
  assert.equal(doc.includes(stale), false);
});

test("the three.js version in the document is the version the vendored file says it is", () => {
  const fromFile = /three@(\d+\.\d+\.\d+)/.exec(core)?.[1];
  assert.ok(fromFile, "the vendored core names its version");
  assert.ok(doc.includes(`| three.js | ${fromFile} `), `the document row says ${fromFile}`);
  assert.ok(doc.includes(`package \`three\`, ecosystem \`npm\`, version \`${fromFile}\``), "the audit query names the same version");
});

test("every audit in the document carries a date, and none claims an unfixed advisory without naming it", () => {
  assert.match(doc, /Final audit[^\n]*\n\nDate: \d{4}-\d{2}-\d{2}/);
  assert.match(doc, /OSV query[\s\S]*run on \d{4}-\d{2}-\d{2}/);
  assert.match(doc, /Unfixed advisories accepted: none/);
});

test("the nginx image in the Dockerfile is the slim variant the document chose", () => {
  const nginx = images.find((r) => r.startsWith("nginx:"));
  assert.match(nginx, /-alpine-slim@/);
});
