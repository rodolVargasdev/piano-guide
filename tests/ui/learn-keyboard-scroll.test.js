import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { createLearnKeyboard } from "../../src/ui/learn-keyboard.js";
import { MIN_WHITE_PX, keyboardMetrics } from "../../src/ui/keyboard-labels.js";

// Polish of the learn keyboard: a region wider than the screen scrolls instead of shrinking the keys, and
// the finger badge is never covered by the computer-key letter box.
function setup({ width = 358, height = 400, portrait = true, region = { low: 36, high: 81 } } = {}) {
  const doc = fakeDoc();
  doc.createElement = (tag) => doc.make(tag);
  const mount = doc.make("div");
  mount.clientWidth = width;
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => assert.fail("a missing key") });
  const keyboard = createLearnKeyboard({ mount, i18n, doc });
  const root = mount.children[0];
  root.clientWidth = width; // the scrolling box is as wide as the room
  keyboard.setRegion(region);
  keyboard.fit({ width, height, portrait });
  const hint = mount.children[1];
  return { keyboard, root, hint, svg: root.children[0] };
}
const text = (hint) => (hint.hidden ? "" : hint.textContent);
const box = (n) => (n.tag === "circle" ? { x: +n.attrs.cx - +n.attrs.r, y: +n.attrs.cy - +n.attrs.r, w: 2 * +n.attrs.r, h: 2 * +n.attrs.r } : { x: +n.attrs.x, y: +n.attrs.y, w: +n.attrs.width, h: +n.attrs.height });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("white keys never get narrower than 36 px: a region too wide for the room keeps its key width and is wider than the room", () => {
  const wide = keyboardMetrics({ whiteCount: 25, width: 358 });
  assert.equal(wide.keyW, MIN_WHITE_PX);
  assert.equal(wide.total, 25 * MIN_WHITE_PX);
  assert.ok(wide.total > 358);
  const fits = keyboardMetrics({ whiteCount: 9, width: 358 });
  assert.ok(fits.total <= 358, "counter-proof: nine keys still fit and are not widened past the room");
});

test("a region wider than the room scrolls: the svg keeps its full width and the box is marked as scrolling", () => {
  const { root, svg } = setup();
  assert.equal(svg.attrs.width, String(27 * MIN_WHITE_PX));
  assert.match(root.attrs.class, /lk-scrolls/);
  const fits = setup({ region: { low: 60, high: 74 } });
  assert.doesNotMatch(fits.root.attrs.class, /lk-scrolls/, "counter-proof: nine keys do not scroll");
});

test("the keyboard centers on the keys to press, and on the lowest one when they do not fit together", () => {
  const near = setup();
  near.keyboard.setStepKeys([{ midi: 60, finger: 1, hand: "R" }]);
  const keyX = Number(all(near.svg, (n) => n.tag === "rect" && n.attrs["data-midi"] === "60")[0].attrs.x);
  assert.ok(Math.abs(near.root.scrollLeft + 358 / 2 - (keyX + MIN_WHITE_PX / 2)) <= 1, "the key to press is in the middle of the box");
  const far = setup();
  far.keyboard.setStepKeys([{ midi: 39, finger: 5, hand: "L" }, { midi: 79, finger: 5, hand: "R" }]);
  const lowX = Number(all(far.svg, (n) => n.tag === "rect" && n.attrs["data-midi"] === "39")[0].attrs.x);
  assert.equal(far.root.scrollLeft, Math.max(0, lowX - 12), "hands too far apart: the lowest key is at the left edge");
  const fits = setup({ region: { low: 60, high: 74 } });
  fits.keyboard.setStepKeys([{ midi: 64, finger: 3, hand: "R" }]);
  assert.equal(fits.root.scrollLeft, 0, "counter-proof: nothing scrolls when everything fits");
});

test("one hint line: a phone held upright is told to turn it; a key to press off screen says to drag", () => {
  const upright = setup();
  upright.keyboard.setStepKeys([{ midi: 60, finger: 1, hand: "R" }]);
  assert.equal(text(upright.hint), "Turn your phone sideways for a wider keyboard.");
  const sideways = setup({ portrait: false });
  sideways.keyboard.setStepKeys([{ midi: 60, finger: 1, hand: "R" }]);
  assert.equal(text(sideways.hint), "", "counter-proof: sideways there is nothing to turn");
  const far = setup();
  far.keyboard.setStepKeys([{ midi: 39, finger: 5, hand: "L" }, { midi: 79, finger: 5, hand: "R" }]);
  assert.equal(text(far.hint), "A key to press is off screen. Drag the keyboard sideways.");
  const roomy = setup({ width: 1000, region: { low: 60, high: 74 }, portrait: false });
  roomy.keyboard.setStepKeys([{ midi: 64, finger: 3, hand: "R" }]);
  assert.equal(text(roomy.hint), "", "a keyboard that fits shows no hint");
});

test("the hint comes in Spanish with the language", () => {
  const e = setup();
  e.keyboard.setStepKeys([{ midi: 60, finger: 1, hand: "R" }]);
  assert.match(STRINGS["keyboard.turnPhone"].es, /Gire el teléfono/);
  assert.match(STRINGS["keyboard.scrollHint"].es, /Arrastre el teclado/);
});

test("the finger badge is never covered by the computer-key letter box, in any room and for any step", () => {
  const letters = new Map([[48, "A"], [50, "S"], [52, "D"], [55, "K"], [64, "J"], [67, "L"], [69, "Ñ"]]);
  const steps = [
    [{ midi: 64, finger: 2, hand: "R" }, { midi: 48, finger: 5, hand: "L" }],
    [{ midi: 52, finger: 1, hand: "R" }],
    [{ midi: 67, finger: 3, hand: "R" }, { midi: 69, finger: 5, hand: "R" }, { midi: 55, finger: 1, hand: "L" }],
  ];
  let checked = 0;
  for (const [width, height] of [[1168, 600], [805, 150], [805, 120], [992, 140], [358, 400], [358, 200], [700, 130]]) {
    for (const keys of steps) {
      const { keyboard, svg } = setup({ width, height, portrait: width < 500, region: { low: 48, high: 72 } });
      keyboard.setLetters(letters);
      keyboard.setStepKeys(keys);
      const badges = all(svg, (n) => /lk-badge/.test(n.attrs.class ?? "")).map(box);
      const boxes = all(svg, (n) => n.attrs.class === "lk-letter-box").map(box);
      assert.equal(badges.length, keys.length, "every key to press keeps its badge");
      for (const b of badges) for (const l of boxes) {
        assert.equal(overlap(b, l), false, `badge ${JSON.stringify(b)} and letter box ${JSON.stringify(l)} overlap at ${width}x${height}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 50, "many pairs were compared");
});

test("counter-proof: the overlap check does see two boxes that cross", () => {
  assert.equal(overlap({ x: 0, y: 0, w: 30, h: 30 }, { x: 20, y: 20, w: 20, h: 20 }), true);
  assert.equal(overlap({ x: 0, y: 0, w: 30, h: 30 }, { x: 31, y: 0, w: 20, h: 20 }), false);
});

test("a letter box still shows on the key to press when there is room (stacked under the badge)", () => {
  const { keyboard, svg } = setup({ width: 1168, height: 600, portrait: false, region: { low: 48, high: 72 } });
  keyboard.setLetters(new Map([[52, "D"]]));
  keyboard.setStepKeys([{ midi: 52, finger: 3, hand: "R" }]);
  assert.equal(all(svg, (n) => n.attrs.class === "lk-letter-box").length, 1);
});

const css = readFileSync(new URL("../../styles/app.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const ruleOf = (selector) => {
  const start = css.indexOf(`\n${selector} {`);
  return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
};

test("the stylesheet lets the keyboard scroll sideways and does not shrink the svg", () => {
  assert.match(ruleOf(".learn-keyboard"), /overflow-x:\s*auto/);
  assert.match(ruleOf(".lk-svg"), /max-width:\s*none/);
  assert.match(ruleOf(".lk-scrolls .lk-svg"), /touch-action:\s*pan-x/);
  assert.equal(ruleOf(".lk-nope"), "", "counter-proof: a missing rule reads as empty");
});
