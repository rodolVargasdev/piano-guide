import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../styles/app.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const main = readFileSync(new URL("../../src/main.js", import.meta.url), "utf8");
const view = readFileSync(new URL("../../src/ui/learn-view.js", import.meta.url), "utf8");

const NL = "\n";
const LANDSCAPE = "@media (max-height: 480px) and (orientation: landscape) {";
const px = (rem) => Number(rem) * 16;

// The declaration block that starts at `marker` (searching from `from`): its text and where it was found.
const blockAt = (marker, from = 0) => {
  const start = css.indexOf(marker, from);
  return { start, text: start === -1 ? "" : css.slice(start, css.indexOf("}", start)) };
};
const remOf = (block, property) => px(new RegExp(`${property}:\\s*([\\d.]+)rem`).exec(block)?.[1] ?? NaN);
// The last landscape block is the Learn one (older blocks of the player come first).
const learnLandscape = () => css.lastIndexOf(LANDSCAPE);

test("instruction text is 28 px by default, 20 px on a phone and 18 px in landscape (the design table)", () => {
  const base = blockAt(`${NL}.learn-instruction {`);
  assert.equal(remOf(base.text, "font-size"), 28);
  const phone = blockAt("@media (max-width: 40rem) {", base.start).start;
  assert.equal(remOf(blockAt("  .learn-instruction {", phone).text, "font-size"), 20);
  assert.equal(remOf(blockAt("  .learn-instruction {", learnLandscape()).text, "font-size"), 18);
});

test("action buttons are 48 px tall by default and 36 px in landscape", () => {
  assert.equal(remOf(blockAt(`${NL}.learn-action {`).text, "min-height"), 48);
  assert.equal(remOf(blockAt("  .learn-action,", learnLandscape()).text, "min-height"), 36);
});

test("in landscape the site header is hidden while Learn is open, and the view marks the route", () => {
  assert.match(css.slice(learnLandscape()), /body\[data-route="learn"\] header \{\s*display: none;/);
  assert.match(view, /setAttribute\("data-route", "learn"\)/);
  assert.match(view, /removeAttribute\("data-route"\)/, "and unmarks it when leaving");
});

test("the hidden attribute really hides: a hidden chip, hint or button is never shown by a later rule", () => {
  assert.match(blockAt(`${NL}[hidden] {`).text, /display:\s*none !important/);
});

test("main.js mounts the Learn route lazily, so the catalog still does not download the keyboard or the engine", () => {
  assert.match(main, /learn: lazyView\(\(\) => import\("\.\/ui\/learn-view\.js"\)/);
  assert.equal(/^import .*learn-view/m.test(main), false, "no static import of the Learn view");
  assert.equal(/^import .*audio/m.test(main), false);
});

test("counter-proof: the helpers report a missing rule as missing", () => {
  assert.equal(blockAt(`${NL}.learn-nope {`).start, -1);
  assert.ok(Number.isNaN(remOf("", "font-size")));
});
