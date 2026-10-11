import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Guard: the CSP in nginx.conf must allow the inline import map by hash, and index.html
// must not contain anything else the CSP would block (inline scripts or styles).

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const conf = readFileSync(new URL("../nginx.conf", import.meta.url), "utf8");

function importMapHash(page) {
  const m = /<script type="importmap">([\s\S]*?)<\/script>/.exec(page);
  if (!m) return null;
  return `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`;
}

function inlineScripts(page) {
  return [...page.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/\bsrc=/.test(m[1]) && !/type="importmap"/.test(m[1]));
}

const cspLines = conf.split("\n").filter((l) => l.includes("Content-Security-Policy") && !l.trim().startsWith("#"));

test("nginx.conf has exactly one CSP header, at server level", () => {
  assert.equal(cspLines.length, 1);
});

test("the CSP script-src allows the import map by its real hash", () => {
  const hash = importMapHash(html);
  assert.ok(hash, "index.html has no import map");
  assert.ok(cspLines[0].includes(hash), `CSP does not contain ${hash}`);
});

test("counter-proof: a changed import map no longer matches the CSP hash", () => {
  const changed = html.replace("three.module.min.js", "three.module.min.js?v=2");
  assert.notEqual(importMapHash(changed), importMapHash(html));
  assert.equal(cspLines[0].includes(importMapHash(changed)), false);
});

test("the CSP never allows unsafe-inline or unsafe-eval for scripts", () => {
  const scriptSrc = /script-src([^;"]*)/.exec(cspLines[0])[1];
  assert.equal(/unsafe-/.test(scriptSrc), false);
});

test("index.html has no inline script besides the import map", () => {
  assert.equal(inlineScripts(html).length, 0);
});

test("counter-proof: an inline script is detected", () => {
  assert.equal(inlineScripts(`${html}<script>alert(1)</script>`).length, 1);
});

test("index.html has no inline styles (the CSP allows only same-origin stylesheets)", () => {
  assert.equal(/<style\b|\sstyle=/.test(html), false);
});
