import { test } from "node:test";
import assert from "node:assert/strict";
import { drawScore, TREBLE_TOP, BASS_TOP } from "../../src/score/draw.js";
import { layoutScore } from "../../src/score/layout.js";
import { resolveLevel } from "../../src/core/timeline.js";

const U = 10;
const R = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "R", ...extra });
const L = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "L", ...extra });
const CHORDS = [
  { tick: 0, dur: 1920, symbol: "E", roman: "I", function: "tonic" },
  { tick: 1920, dur: 1920, symbol: "F#/A#", roman: "V6/V", function: "secondary dominant" },
];

function draw(notes, { notation = "labelled", lengthTicks = 3840, songChords = CHORDS, analysis, ...opts } = {}) {
  const song = { key: { tonic: "C", mode: "major" }, meter: { num: 4, den: 4 }, pickupTicks: 0, lengthTicks, tempo: { bpm: 72, beatUnit: "quarter" }, chords: songChords, levels: { x: { label: "X", notation, strictBars: true, notes, ...(analysis ? { analysis } : {}) } } };
  const tl = resolveLevel(song, "x");
  const layout = layoutScore(tl);
  return { layout, out: drawScore(layout, tl, { unit: U, ...opts }) };
}
const body = (out) => out.measures.flatMap((m) => m.nodes);
const withClass = (nodes, c) => nodes.filter((n) => (n.attrs.class ?? "").split(" ").includes(c));

test("fingers: one row above the treble staff and one below the bass staff, lowest note first", () => {
  const { out } = draw([R(0, 1920, "E4", { finger: 1 }), R(0, 1920, "G4", { finger: 3 }), R(0, 1920, "B4", { finger: 5 }), L(0, 1920, "E2", { finger: 5 })]);
  const rows = withClass(body(out), "finger");
  assert.deepEqual(rows.map((r) => [r.text, r.attrs.y]), [["5", (BASS_TOP + 4 + 3.2) * U], ["1 3 5", (TREBLE_TOP - 3.2) * U]]);
});

test("no finger, no number: events without finger draw nothing, a partial chord draws only the fingered notes", () => {
  const { out } = draw([R(0, 1920, "E4"), L(0, 1920, "E2"), R(1920, 1920, "C5", { finger: 2 }), R(1920, 1920, "E5")]);
  assert.deepEqual(withClass(body(out), "finger").map((r) => r.text), ["2"], "contra-case: counting only the fingered note");
});

test("the chord row shows the symbol only, never the roman numeral or the function", () => {
  const { out } = draw([R(0, 1920, "E4")]);
  const row = withClass(body(out), "chord");
  assert.deepEqual(row.map((c) => c.text), ["E", "F#/A#"]);
  const everyText = body(out).filter((n) => n.text !== undefined).map((n) => n.text);
  for (const banned of ["I", "V6/V", "tonic", "secondary dominant"]) assert.ok(!everyText.includes(banned), banned);
  assert.ok(row[1].attrs.x > row[0].attrs.x, "the second chord starts later in the score");
});

test("the chord row is on in Beginner and off in Original unless asked for", () => {
  const notes = [R(0, 1920, "E4")];
  assert.equal(withClass(body(draw(notes).out), "chord").length, 2);
  assert.equal(withClass(body(draw(notes, { notation: "engraved" }).out), "chord").length, 0);
  assert.equal(withClass(body(draw(notes, { notation: "engraved", chords: true }).out), "chord").length, 2);
  assert.equal(withClass(body(draw(notes, { chords: false }).out), "chord").length, 0);
});

test("a tie is an arc between the two heads, above for stem-down notes and below for stem-up notes", () => {
  const { out } = draw([R(0, 960, "C5", { tie: true }), R(960, 960, "C5"), R(1920, 960, "E4", { tie: true }), R(2880, 960, "E4")]);
  const ties = withClass(body(out), "tie");
  assert.equal(ties.length, 2);
  assert.match(ties[0].attrs.d, /^M[\d.]+ [\d.]+Q/);
  const control = (t) => Number(/Q[\d.]+ ([\d.]+)/.exec(t.attrs.d)[1]);
  const start = (t) => Number(/^M[\d.]+ ([\d.]+)/.exec(t.attrs.d)[1]);
  assert.ok(control(ties[0]) < start(ties[0]), "a stem-down note ties above");
  assert.ok(control(ties[1]) > start(ties[1]), "a stem-up note ties below");
});

test("a tuplet shows its number, with a bracket only when the notes are not beamed", () => {
  const t = { n: 3, inSpaceOf: 2 };
  const beamed = draw([R(0, 160, "C5", { tuplet: t }), R(160, 160, "D5", { tuplet: t }), R(320, 160, "E5", { tuplet: t }), R(480, 1440, "C5")], { lengthTicks: 1920 }).out;
  assert.deepEqual(withClass(body(beamed), "tuplet-number").map((n) => n.text), ["3"]);
  assert.equal(withClass(body(beamed), "tuplet").length, 0, "beamed: the number alone");
  const loose = draw([R(0, 320, "C5", { tuplet: t }), R(320, 320, "D5", { tuplet: t }), R(640, 320, "E5", { tuplet: t }), R(960, 960, "C5")], { lengthTicks: 1920 }).out;
  assert.equal(withClass(body(loose), "tuplet").length, 1, "quarter triplet: a bracket");
});

test("ornament signs: turn and mordent glyphs, trill as tr plus a wavy line, fioritura as a bracket", () => {
  const notes = [R(0, 480, "C5", { ornament: "turn" }), R(480, 480, "D5", { ornament: "mordent" }), R(960, 480, "E5", { ornament: "inverted-mordent" }), R(1440, 480, "F5", { ornament: "trill" }), R(1920, 480, "A4", { ornament: "fioritura" }), R(2400, 1440, "C5")];
  const { out } = draw(notes);
  const ornaments = withClass(body(out), "ornament");
  assert.equal(ornaments.length, 3, "turn, mordent and inverted mordent");
  assert.equal(withClass(body(out), "ornament-text")[0].text, "tr");
  const paths = body(out).filter((n) => n.tag === "path" && n.attrs.d.includes("q0.4"));
  assert.equal(paths.length, 1, "the wavy line after tr");
  assert.equal(body(out).filter((n) => n.tag === "path" && /^M0 0\.5V0H/.test(n.attrs.d)).length, 1, "the fioritura bracket");
});

test("Analysis off draws no romans or callouts; on, romans come from the entries first and from the chord track where an entry has none", () => {
  const entries = [{ tick: 0, endTick: 960, kind: "harmony", title: "Diminished color", text: "A diminished chord over the Eb pedal.", roman: "i" }];
  const song = { key: { tonic: "C", mode: "major" }, meter: { num: 4, den: 4 }, pickupTicks: 0, lengthTicks: 3840, tempo: { bpm: 72, beatUnit: "quarter" }, chords: CHORDS, levels: { x: { label: "X", notation: "engraved", strictBars: true, notes: [R(0, 1920, "E4"), R(1920, 1920, "G4")], analysis: entries } } };
  const tl = resolveLevel(song, "x");
  const layout = layoutScore(tl);
  const off = drawScore(layout, tl, { unit: U, analysis: false });
  assert.equal(withClass(off.measures.flatMap((m) => m.nodes), "roman").length + withClass(off.measures.flatMap((m) => m.nodes), "callout").length, 0);
  const on = drawScore(layout, tl, { unit: U, analysis: true });
  const nodes = on.measures.flatMap((m) => m.nodes);
  assert.deepEqual(withClass(nodes, "roman").map((n) => n.text), ["i", "V6/V"], "the entry wins at tick 0, the chord track fills tick 1920");
  const callout = withClass(nodes, "callout")[0];
  assert.equal(callout.tag, "g");
  assert.equal(callout.children.find((c) => c.tag === "title").text, "Diminished color: A diminished chord over the Eb pedal.");
  assert.equal(callout.children.filter((c) => c.attrs.class === "callout-span").length, 1, "an entry with endTick draws its span");
});

test("analysis text with markup stays a plain string", () => {
  const song = { key: { tonic: "C", mode: "major" }, meter: { num: 4, den: 4 }, pickupTicks: 0, lengthTicks: 1920, tempo: { bpm: 72, beatUnit: "quarter" }, levels: { x: { label: "X", notation: "engraved", strictBars: true, notes: [R(0, 1920, "E4")], analysis: [{ tick: 0, kind: "form", title: "<b>x</b>", text: "<script>alert(1)</script>" }] } } };
  const tl = resolveLevel(song, "x");
  const nodes = drawScore(layoutScore(tl), tl, { unit: U, analysis: true }).measures.flatMap((m) => m.nodes);
  const callout = withClass(nodes, "callout")[0];
  assert.equal(callout.children[1].text, "<b>x</b>");
  assert.equal(callout.children[2].text, "<b>x</b>: <script>alert(1)</script>");
});

test("grace notes draw smaller heads and no name, so they never crowd the main note", () => {
  const { out } = draw([R(480, 60, "D5", { grace: true }), R(480, 960, "C5")], { lengthTicks: 1920 });
  const [grace, main] = withClass(body(out), "head");
  assert.ok(grace.attrs.r < main.attrs.r);
  assert.equal(withClass(body(out), "note-name").length, 1);
});
