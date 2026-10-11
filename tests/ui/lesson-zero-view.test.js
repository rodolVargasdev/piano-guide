import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { initZero, reduceZero } from "../../src/learn/lesson-zero.js";
import { POSTURE_IMAGE, zeroModel } from "../../src/ui/lesson-zero-view.js";

const i18nFor = (lang = "en") => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} });
const act = (z, ...actions) => actions.reduce((s, a) => reduceZero(s, typeof a === "string" ? { type: a } : a).state, z);
const press = (midi) => [{ type: "NOTE_ON", midi }, { type: "NOTE_OFF", midi }];
const atPart = (n) => {
  let z = initZero();
  if (n >= 1) z = act(z, ...press(60));
  if (n >= 2) z = act(z, "NEXT");
  if (n >= 3) for (const m of [60, 62, 64, 65, 67]) z = act(z, ...press(m));
  return z;
};
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean);
const words = (text) => text.split(/\s+/).filter(Boolean).length;

test("each part says one thing, with the actions that make sense there", () => {
  const i18n = i18nFor();
  const parts = [0, 1, 2, 3].map((n) => zeroModel(atPart(n), { i18n }));
  assert.deepEqual(parts.map((m) => m.phase), ["lessonZero", "lessonZero", "lessonZero", "lessonZero"]);
  assert.deepEqual(parts.map((m) => m.actions.map((a) => a.id)), [["ZERO_SKIP"], ["ZERO_NEXT", "ZERO_SKIP"], ["ZERO_SKIP"], ["ZERO_NEXT"]]);
  assert.deepEqual(parts.map((m) => m.actions.map((a) => a.primary)), [[false], [true, false], [false], [true]]);
  assert.deepEqual(parts.map((m) => m.progress.split(".")[0]), ["Lesson zero, part 1 of 4", "Lesson zero, part 2 of 4", "Lesson zero, part 3 of 4", "Lesson zero, part 4 of 4"]);
  assert.equal(parts[1].image.src, POSTURE_IMAGE);
  assert.match(parts[1].image.alt, /sitting at a piano/);
  assert.deepEqual([parts[0].image, parts[2].image, parts[3].image], [null, null, null], "the drawing belongs to the posture part only");
  assert.equal(parts[3].items.length, 4);
});

test("the fingers part names the hand, the finger and the key, in both languages, for all five fingers", () => {
  const expectEn = ["Right hand: thumb on C (Do).", "Right hand: index finger on D (Re).", "Right hand: middle finger on E (Mi).", "Right hand: ring finger on F (Fa).", "Right hand: little finger on G (Sol)."];
  let z = atPart(2);
  expectEn.forEach((text, i) => {
    assert.equal(zeroModel(z, { i18n: i18nFor() }).heading, text);
    assert.match(zeroModel(z, { i18n: i18nFor("es") }).heading, /^Mano derecha: .+ en .+\.$/);
    z = act(z, ...press([60, 62, 64, 65, 67][i]));
  });
  assert.equal(zeroModel(atPart(2), { i18n: i18nFor("es") }).heading, "Mano derecha: pulgar en Do (C).");
});

test("feedback: a wrong key in part 1 shows the find-C hint, in part 3 the shaded-key line, a correct key shows Correct", () => {
  const i18n = i18nFor();
  const wrong1 = act(initZero(), ...press(62));
  assert.deepEqual(zeroModel(wrong1, { i18n }).chip, { kind: "wrong", text: "Try again", detail: "Look for a group of 2 black keys. C is the white key on its left." });
  const wrong3 = act(atPart(2), ...press(64));
  assert.equal(zeroModel(wrong3, { i18n }).chip.detail, "Use the shaded key.");
  assert.equal(zeroModel(act(atPart(2), ...press(72)), { i18n }).chip.detail, "Right note, other octave.");
  assert.deepEqual(zeroModel(act(initZero(), ...press(48)), { i18n }).chip, { kind: "correct", text: "Correct", detail: "" });
  assert.equal(zeroModel(initZero(), { i18n }).chip, null, "no feedback before any key");
});

test("every heading and line is plain: at most two sentences and 30 words, in English and Spanish, with no long dashes", () => {
  for (const lang of ["en", "es"]) {
    const i18n = i18nFor(lang);
    for (const n of [0, 1, 2, 3]) {
      const m = zeroModel(atPart(n), { i18n });
      for (const text of [m.heading, m.sub, ...m.items]) {
        assert.ok(sentences(text).length <= 2, `${lang} part ${n + 1}: "${text}"`);
        assert.ok(words(text) <= 30, `${lang} part ${n + 1}: "${text}" has ${words(text)} words`);
        assert.doesNotMatch(text, /[–—…“”]/);
      }
    }
  }
  // Counter-proof: the check is real, a rambling line fails it.
  assert.ok(words("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone") > 30);
});

test("the posture drawing exists, is original text-free artwork and carries no script or external link", () => {
  const url = new URL("../../" + POSTURE_IMAGE, import.meta.url);
  assert.ok(existsSync(url), "assets/img/posture.svg exists");
  const svg = readFileSync(url, "utf8");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /<text|<script|<foreignObject|href=|xlink|<image/i, "no text, script or external reference");
  // Counter-proof of the pattern: a drawing with a label would fail.
  assert.match('<svg><text>Sit</text></svg>', /<text/i);
});

test("the stylesheet has the dashed hint outline and a drawing size that fits the short landscape screen", () => {
  const css = readFileSync(new URL("../../styles/app.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(css, /\.lk-hint-outline \{[^}]*stroke-dasharray: 7 4;/);
  assert.match(css, /\.lz-posture \{[^}]*max-height: 9rem;/);
  const landscape = css.slice(css.indexOf("@media (max-height: 480px) and (orientation: landscape)"));
  assert.match(landscape, /\.lz-posture \{\s*max-height: 5rem;/, "the drawing shrinks in landscape so the keys stay in view");
});
