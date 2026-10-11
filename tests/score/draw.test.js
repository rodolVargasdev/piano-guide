import { test } from "node:test";
import assert from "node:assert/strict";
import { drawScore, yOf, TREBLE_TOP, BASS_TOP, HEIGHT_SP, HEIGHT_ANALYSIS_SP } from "../../src/score/draw.js";
import { layoutScore } from "../../src/score/layout.js";
import { resolveLevel } from "../../src/core/timeline.js";

const U = 10;
const M44 = { num: 4, den: 4 };
const M128 = { num: 12, den: 8 };
const R = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "R", ...extra });
const L = (tick, dur, pitch, extra = {}) => ({ tick, dur, pitch, hand: "L", ...extra });

function draw(notes, { notation = "labelled", key = { tonic: "C", mode: "major" }, meter = M44, lengthTicks = 3840, names = "solfege", handModes, analysis } = {}) {
  const song = { key, meter, pickupTicks: 0, lengthTicks, tempo: { bpm: 72, beatUnit: "quarter" }, levels: { x: { label: "X", notation, strictBars: true, notes, ...(analysis ? { analysis } : {}) } } };
  const tl = resolveLevel(song, "x");
  const layout = layoutScore(tl);
  return { layout, tl, out: drawScore(layout, tl, { unit: U, names, handModes }) };
}
const body = (out) => out.measures.flatMap((m) => m.nodes);
const withClass = (nodes, c) => nodes.filter((n) => (n.attrs.class ?? "").split(" ").includes(c));
const labels = (out) => withClass(body(out), "note-name").map((n) => n.text);

test("Beginner writes the solfege name inside each notehead, Eb as Mib, and a label field wins", () => {
  const { out } = draw([R(0, 960, "C4"), R(960, 960, "E4"), R(1920, 960, "Eb4"), R(2880, 960, "G4", { label: "Home" })], { key: { tonic: "Eb", mode: "major" } });
  assert.deepEqual(labels(out), ["Do", "Mi", "Mib", "Home"]);
});

test("names toggle: letters mode writes C, E and Eb, and the same layout redraws immediately", () => {
  const { layout, tl } = draw([R(0, 960, "C4"), R(960, 960, "E4"), R(1920, 960, "Eb4")]);
  const letters = drawScore(layout, tl, { unit: U, names: "letters" });
  assert.deepEqual(labels(letters), ["C", "E", "Eb"]);
  assert.deepEqual(labels(drawScore(layout, tl, { unit: U })), ["Do", "Mi", "Mib"]);
});

test("Original has empty noteheads and no note names (counter-proof of the Beginner case)", () => {
  const notes = [R(0, 960, "C4"), R(960, 960, "E4"), R(1920, 960, "Eb4")];
  const { out } = draw(notes, { notation: "engraved" });
  assert.deepEqual(labels(out), []);
  assert.equal(withClass(body(out), "head").length, 3);
  assert.equal(draw(notes, { notation: "labelled" }).out.measures.length, out.measures.length, "same layout, only the notation differs");
});

test("noteheads carry the hand in their class and half and whole notes are hollow", () => {
  const { out } = draw([R(0, 1920, "C5"), L(0, 960, "C3"), L(960, 480, "D3"), L(1440, 480, "E3")]);
  const heads = withClass(body(out), "head");
  assert.deepEqual(heads.map((h) => h.attrs.class), ["head head-L hollow", "head head-R hollow", "head head-L", "head head-L"]);
});

test("pitch placement: E4 is on the first treble line and G2 on the first bass line", () => {
  const { out } = draw([R(0, 1920, "E4"), L(0, 1920, "G2")]);
  const r = withClass(body(out), "head-R")[0];
  const l = withClass(body(out), "head-L")[0];
  assert.equal(r.attrs.cy, yOf("treble", 0, U));
  assert.equal(r.attrs.cy, (TREBLE_TOP + 4) * U);
  assert.equal(l.attrs.cy, (BASS_TOP + 4) * U);
  assert.deepEqual(out.staffLines.treble, [80, 90, 100, 110, 120]);
});

test("the header has both clefs, three flats per staff in Eb and the time signature numerals", () => {
  const { out } = draw([R(0, 2880, "Eb5")], { key: { tonic: "Eb", mode: "major" }, meter: M128, lengthTicks: 2880 });
  const paths = out.header.filter((n) => n.tag === "path");
  assert.ok(paths.length >= 2 + 6, "two clefs (the F clef also has a fill) and six flats");
  assert.deepEqual(out.header.filter((n) => n.attrs.class === "time-sig").map((n) => n.text), ["12", "8", "12", "8"]);
  const none = draw([R(0, 1920, "C5")]).out;
  assert.ok(none.headerWidth < out.headerWidth, "contra-case: C major has no signature, so a narrower header");
});

test("ledger lines: middle C has one on the treble staff, notes inside the staff have none", () => {
  const { out } = draw([R(0, 1920, "C4"), R(1920, 1920, "E4")]);
  const ledgers = withClass(body(out), "ledger");
  assert.equal(ledgers.length, 1);
  assert.equal(ledgers[0].attrs.y1, yOf("treble", -2, U));
  assert.ok(body(out).indexOf(ledgers[0]) < body(out).indexOf(withClass(body(out), "head")[0]), "drawn first, so the head covers the line");
});

test("an accidental glyph is drawn left of the notehead, once per bar, and none for a note in the key", () => {
  const { out } = draw([R(0, 960, "F#4"), R(960, 960, "F#4"), R(1920, 960, "G4")]);
  const acc = withClass(body(out), "accidental");
  assert.equal(acc.length, 1);
  const head = withClass(body(out), "head")[0];
  assert.match(acc[0].attrs.transform, /^translate\(/);
  assert.ok(Number(/translate\((-?[\d.]+)/.exec(acc[0].attrs.transform)[1]) < head.attrs.cx);
});

test("accidentals of a chord stack in columns left of every head", () => {
  const { out } = draw([R(0, 1920, "C#4"), R(0, 1920, "E#4"), R(0, 1920, "G#4")], { notation: "engraved" });
  const xs = withClass(body(out), "accidental").map((n) => Number(/translate\((-?[\d.]+)/.exec(n.attrs.transform)[1]));
  assert.equal(xs.length, 3);
  assert.equal(new Set(xs).size, 3, "each accidental has its own column");
  const leftHead = Math.min(...withClass(body(out), "head").map((h) => h.attrs.cx));
  assert.ok(xs.every((x) => x < leftHead), "all to the left of the heads");
});

test("stems run from the head to the tip, a lone eighth keeps a flag, a beamed eighth does not", () => {
  const { out } = draw([R(0, 480, "E4"), R(480, 240, "C5"), R(960, 240, "D5"), R(1200, 240, "E5"), R(1440, 480, "G4")], { lengthTicks: 1920 });
  const stems = withClass(body(out), "stem");
  assert.equal(stems.length, 5);
  assert.ok(stems.every((s) => Math.abs(s.attrs.y1 - s.attrs.y2) >= 3 * U));
  assert.equal(withClass(body(out), "beam").length, 1, "one beam over the 960 and 1200 pair");
  const flags = body(out).filter((n) => n.tag === "path" && n.attrs.class?.includes("glyph-fill") && !n.attrs.class.includes("rest"));
  assert.equal(flags.length, 1, "only the lone eighth at tick 480 has a flag");
});

test("rests: a whole rest hangs from the fourth line and a quarter rest is centered on the middle line", () => {
  const { out } = draw([{ tick: 0, dur: 1920, hand: "R", rest: true }, { tick: 1920, dur: 480, hand: "R", rest: true }, { tick: 2400, dur: 1440, hand: "R", rest: true }], {});
  const rests = body(out).filter((n) => (n.attrs.class ?? "").includes("rest"));
  assert.match(rests[0].attrs.transform, new RegExp(`${yOf("treble", 6, U)}\\)`));
  assert.ok(rests.length >= 3);
  assert.equal(withClass(body(out), "dot").length, 1, "the dotted half rest has one dot");
});

test("a dotted note draws its dot beside the head", () => {
  const { out } = draw([R(0, 720, "C5"), R(720, 240, "D5"), R(960, 960, "E5")], { lengthTicks: 1920 });
  assert.equal(withClass(body(out), "dot").length, 1);
});

test("measures partition the drawing: every head lies inside its own measure and barlines separate them", () => {
  const { out } = draw([R(0, 1920, "C5"), R(1920, 1920, "D5")]);
  assert.equal(out.measures.length, 2);
  for (const m of out.measures) for (const h of withClass(m.nodes, "head")) assert.ok(h.attrs.cx >= m.x0 && h.attrs.cx < m.x1, `bar ${m.bar}`);
  assert.equal(withClass(body(out), "barline").length, 3, "one between the bars plus the final double line");
  assert.equal(withClass(out.measures[1].nodes, "bar-number")[0].text, "2");
});

test("a hidden hand draws no notes, rests or beams and keeps staff lines, header and barlines", () => {
  const notes = [R(0, 240, "C5"), R(240, 240, "D5"), L(0, 1920, "C3")];
  const bothHands = draw(notes, { lengthTicks: 1920 }).out;
  const noBass = draw(notes, { lengthTicks: 1920, handModes: { L: { hidden: true }, R: { hidden: false } } }).out;
  assert.equal(withClass(body(bothHands), "head").length, 3);
  assert.deepEqual(withClass(body(noBass), "head").map((h) => h.attrs.class), ["head head-R", "head head-R"]);
  const noTreble = draw(notes, { lengthTicks: 1920, handModes: { L: { hidden: false }, R: { hidden: true } } }).out;
  assert.deepEqual(withClass(body(noTreble), "head").map((h) => h.attrs.class), ["head head-L hollow"]);
  assert.equal(withClass(body(noTreble), "beam").length, 0, "the beam of the hidden hand is gone too");
  assert.equal(noTreble.staffLines.treble.length, 5);
  assert.equal(noTreble.header.length, bothHands.header.length);
});

test("the drawing is taller when the level has analysis entries, so toggling Analysis never rescales", () => {
  const notes = [R(0, 1920, "C5")];
  assert.equal(draw(notes, { lengthTicks: 1920 }).out.height, HEIGHT_SP * U);
  const withAnalysis = draw(notes, { lengthTicks: 1920, analysis: [{ tick: 0, kind: "harmony", title: "t", text: "x" }] });
  assert.equal(withAnalysis.out.height, HEIGHT_ANALYSIS_SP * U);
});

test("hostile text is data only: a label with markup stays a plain text field", () => {
  const { out } = draw([R(0, 1920, "C5", { label: "<img src=x onerror=alert(1)>" })], { lengthTicks: 1920 });
  const t = withClass(body(out), "note-name")[0];
  assert.equal(t.text, "<img src=x onerror=alert(1)>");
  assert.equal(t.tag, "text");
});
