import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeDoc, all } from "../score/fake-dom.js";

const doc = fakeDoc();
globalThis.document = { createElement: (t) => doc.make(t), createTextNode: (text) => ({ tag: "#text", text, attrs: {}, children: [] }) };
const { createLessonCard, barLabel, safeHttpsUrl, confidenceLabel } = await import("../../src/ui/lesson-card.js");

const song = {
  meter: { num: 4, den: 4 },
  pickupTicks: 480,
  tempo: { bpm: 72, beatUnit: "quarter" },
  levels: {
    beginner: { label: "Beginner" },
    original: { label: "Original", analysis: [{ tick: 480, kind: "harmony", title: "Borrowed iv", text: "Minor four from the parallel key.", roman: "iv", function: "borrowed subdominant" }] },
    bare: { label: "Bare" },
  },
  lesson: {
    beginner: {
      summary: "Four chords, one position per hand.",
      chordsUsed: ["E", "F#/A#", "Xyz"],
      handPositions: [{ tick: 480, hand: "R", anchor: "E4", text: "Thumb on E." }, { tick: 0, hand: "L", anchor: "E2", text: "Little finger on E." }],
      posture: "Sit centered, forearms level.",
      practicePlan: ["Hands apart.", "Then together."],
    },
    original: {
      summary: "Richer voicings.",
      chordsUsed: ["E"],
      handPositions: [],
      posture: "Same as before.",
      practicePlan: ["Slowly."],
      arrangementNote: "A generic chord-based accompaniment, not a transcription.",
      interpretation: { rubato: "Breathe at the phrase ends.", dynamics: "Start soft." },
    },
  },
  sources: [
    { url: "https://example.org/a", what: "Chord source.", kind: "reference" },
    { url: "javascript:alert(1)", what: "Hostile source.", kind: "reference" },
  ],
  confidence: [
    { scope: "chords:verse", level: "medium", note: "One source." },
    { scope: "chords:chorus", level: "low", note: "Chorus is a guess." },
  ],
};

const textOf = (n) => (n.tag === "#text" ? n.text : n._text || n.children.map(textOf).join(""));
const heads = (root) => all(root, (n) => n.tag === "h3").map(textOf);
const buttons = (root) => all(root, (n) => n.tag === "button");
function make(extra = {}) {
  const calls = [];
  const card = createLessonCard({ song: { ...song, ...extra }, onHighlight: (m) => calls.push(m) });
  card.setLevel("beginner");
  return { card, root: card.element, calls };
}

test("barLabel counts the pickup as Pickup and then Bar 1, 2, ...", () => {
  assert.equal(barLabel(0, song), "Pickup");
  assert.equal(barLabel(479, song), "Pickup");
  assert.equal(barLabel(480, song), "Bar 1");
  assert.equal(barLabel(480 + 1920, song), "Bar 2");
});

test("safeHttpsUrl accepts https only", () => {
  assert.equal(safeHttpsUrl("https://example.org/a"), "https://example.org/a");
  for (const bad of ["javascript:alert(1)", "http://example.org", "data:text/html,x", "//example.org", "example.org", "", undefined, null, "https:"]) assert.equal(safeHttpsUrl(bad), null, String(bad));
});

test("confidenceLabel marks low and unknown levels as lower confidence", () => {
  assert.equal(confidenceLabel("low"), "Lower confidence");
  assert.equal(confidenceLabel("high"), "High confidence");
  assert.equal(confidenceLabel("weird"), "Lower confidence");
});

test("the Beginner card lists overview, chords, hands, posture, plan, sources and confidence, one-line headings", () => {
  const { root } = make();
  assert.deepEqual(heads(root), ["Overview", "Chords", "Hands", "How to sit", "Practice plan", "Sources", "Confidence"]);
  for (const h of heads(root)) assert.ok(h.length < 30, h);
  const text = textOf(root);
  assert.match(text, /Bar 1, right hand: start on E4\. Thumb on E\./);
  assert.match(text, /Pickup, left hand: start on E2/);
});

test("a known chord chip lights its keys, shows its notes, and a second click clears it", () => {
  const { root, calls } = make();
  const chip = buttons(root).find((b) => textOf(b) === "E");
  chip.click();
  assert.deepEqual(calls.at(-1), [52, 56, 59]);
  assert.equal(chip.attrs["aria-pressed"], "true");
  assert.match(textOf(all(root, (n) => n.attrs.class === "meta chord-detail")[0]), /^E: E G# B$/);
  chip.click();
  assert.deepEqual(calls.at(-1), []);
  assert.equal(chip.attrs["aria-pressed"], "false");
});

test("a slash chord names its bass and picking another chip moves the selection", () => {
  const { root, calls } = make();
  const [e, slash] = ["E", "F#/A#"].map((s) => buttons(root).find((b) => textOf(b) === s));
  e.click();
  slash.click();
  assert.equal(e.attrs["aria-pressed"], "false");
  assert.equal(slash.attrs["aria-pressed"], "true");
  assert.deepEqual(calls.at(-1), [46, 54, 58, 61]);
  assert.match(textOf(all(root, (n) => n.attrs.class === "meta chord-detail")[0]), /bass A#/);
});

test("an unknown chord symbol is plain text: no button, no error", () => {
  const { root, calls } = make();
  assert.equal(buttons(root).some((b) => textOf(b) === "Xyz"), false);
  const chips = all(root, (n) => n.attrs.class === "chip");
  assert.deepEqual(chips.map(textOf), ["Xyz"]);
  assert.equal(calls.length, 0);
});

test("the lower-confidence chord note is shown in the Chords section", () => {
  const { root } = make();
  assert.match(textOf(root), /Lower confidence: Chorus is a guess\./);
  assert.match(textOf(root), /Medium confidence, chords:verse: One source\./);
});

test("sources: an https source is a link, a javascript: source is plain text (counter-proof)", () => {
  const { root } = make();
  const links = all(root, (n) => n.tag === "a");
  assert.equal(links.length, 1);
  assert.equal(links[0].attrs.href, "https://example.org/a");
  assert.equal(links[0].attrs.rel, "noopener noreferrer");
  assert.match(textOf(root), /javascript:alert\(1\) Hostile source\./);
  assert.ok(!links.some((a) => /javascript/.test(a.attrs.href)));
});

test("hostile song text stays text: no element is created from it", () => {
  const evil = "<img src=x onerror=alert(1)>";
  const { root } = make({ lesson: { beginner: { ...song.lesson.beginner, summary: evil, posture: evil } } });
  assert.equal(all(root, (n) => n.tag === "img").length, 0);
  assert.ok(textOf(root).includes(evil));
});

test("a level without lesson shows the short notice and nothing else", () => {
  const { card, root } = make();
  card.setLevel("bare");
  assert.equal(textOf(root), "No lesson for this level yet");
  assert.equal(all(root, (n) => n.tag === "h3").length, 0);
});

test("switching level swaps the content; Original adds arrangement and interpretation", () => {
  const { card, root } = make();
  card.setLevel("original");
  assert.deepEqual(heads(root), ["Overview", "Chords", "Hands", "How to sit", "Practice plan", "Arrangement", "Interpretation", "Sources", "Confidence"]);
  assert.match(textOf(root), /generic chord-based accompaniment, not a transcription/);
  assert.match(textOf(root), /Rubato: Breathe at the phrase ends\./);
  assert.match(textOf(root), /Dynamics: Start soft\./);
});

test("the Analysis section appears only when Analysis is on and the level has entries", () => {
  const { card, root } = make();
  card.setLevel("original", { analysis: false });
  assert.ok(!heads(root).includes("Analysis"));
  card.setLevel("original", { analysis: true });
  assert.ok(heads(root).includes("Analysis"));
  assert.match(textOf(root), /Bar 1, Borrowed iv \(iv, borrowed subdominant\): Minor four from the parallel key\./);
  card.setLevel("beginner", { analysis: true });
  assert.ok(!heads(root).includes("Analysis"), "Beginner has no analysis entries");
});

test("changing level or disposing clears an active chord outline", () => {
  const { card, root, calls } = make();
  buttons(root).find((b) => textOf(b) === "E").click();
  card.setLevel("original");
  assert.deepEqual(calls.at(-1), [], "level switch clears the outline");
  buttons(root).find((b) => textOf(b) === "E").click();
  card.dispose();
  assert.deepEqual(calls.at(-1), []);
});
