import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GLYPHS } from "../../src/score/glyphs.js";
import { drawScore, TREBLE_TOP } from "../../src/score/draw.js";
import { layoutScore } from "../../src/score/layout.js";
import { resolveLevel } from "../../src/core/timeline.js";

const U = 10;

// Signed area of each closed polygon of a path made only of M, L and z (positive is clockwise on
// screen, where y points down).
function areas(d) {
  return d
    .split("M")
    .filter(Boolean)
    .map((part) => {
      const pts = part.replace(/z$/, "").split("L").map((p) => p.trim().split(/\s+/).map(Number));
      return pts.reduce((sum, [x, y], i) => {
        const [nx, ny] = pts[(i + 1) % pts.length];
        return sum + (x * ny - nx * y) / 2;
      }, 0);
    });
}

test("the area helper tells a clockwise polygon from a counter-clockwise one (counter-proof)", () => {
  assert.ok(areas("M0 0L1 0L1 1L0 1z")[0] > 0, "top-left, top-right, bottom-right, bottom-left is clockwise");
  assert.ok(areas("M0 0L0 1L1 1L1 0z")[0] < 0);
});

test("the straight-edged accidentals are wound one way, so their overlapping parts merge", () => {
  for (const name of ["sharp", "natural", "double-sharp"]) {
    const found = areas(GLYPHS[name].fill);
    assert.ok(found.length >= 4, `${name} has its parts`);
    assert.ok(found.every((a) => a > 0), `${name} is all clockwise`);
  }
});

test("a flat is one outline plus a counter, so the bowl is open", () => {
  const closed = GLYPHS.flat.fill.match(/z/g);
  assert.equal(closed.length, 2, "outline and counter");
  assert.equal(GLYPHS["double-flat"].fill.match(/z/g).length, 4);
});

const song = JSON.parse(readFileSync(new URL("../../songs/chopin-nocturne-op9-no2.json", import.meta.url), "utf8"));

function drawn(level) {
  const tl = resolveLevel(song, level);
  return drawScore(layoutScore(tl), tl, { unit: U });
}

test("the header gives each part room: clef, then the three flats, then the time signature", () => {
  const out = drawn("original");
  const flats = out.header.filter((n) => n.tag === "path" && n.attrs.class.includes("glyph-fill") && /scale/.test(n.attrs.transform));
  const xs = flats.map((n) => Number(/translate\(([\d.]+) /.exec(n.attrs.transform)[1]) / U);
  const clefX = Math.min(...xs);
  assert.ok(clefX > 0, "the clefs are in the header");
  const sig = out.header.filter((n) => (n.attrs.class ?? "").includes("glyph-fill") && n.attrs.d === GLYPHS.flat.fill);
  assert.equal(sig.length, 6, "three flats on each staff");
  const sigXs = sig.slice(0, 3).map((n) => Number(/translate\(([\d.]+) /.exec(n.attrs.transform)[1]) / U);
  for (let i = 1; i < 3; i += 1) assert.ok(sigXs[i] - sigXs[i - 1] >= 1.25, "adjacent flats do not touch (a flat is 1.3 wide)");
  assert.ok(sigXs[0] - 0.46 > 2.1 + 1.7, "the first flat starts clear of the clef's right edge");
  const timeX = Number(out.header.find((n) => n.tag === "text").attrs.x) / U;
  assert.ok(timeX - 0.7 > sigXs[2] + 0.85, "the time signature starts clear of the last flat");
});

test("ornament signs sit between the staff and the finger row, never on a finger number", () => {
  const out = drawn("original");
  const nodes = out.measures.flatMap((m) => m.nodes);
  const ornaments = nodes.filter((n) => (n.attrs.class ?? "").includes("ornament") && n.attrs.transform);
  assert.ok(ornaments.length >= 1, "the Nocturne has a turn sign");
  const fingerBaseline = (TREBLE_TOP - 3.2) * U;
  const fingers = nodes.filter((n) => (n.attrs.class ?? "").includes("finger"));
  assert.ok(fingers.length > 5);
  for (const f of fingers.filter((n) => n.attrs.y < TREBLE_TOP * U)) assert.equal(f.attrs.y, fingerBaseline);
  for (const o of ornaments) {
    const y = Number(/translate\([\d.]+ ([\d.]+)\)/.exec(o.attrs.transform)[1]);
    // The tallest sign (the mordent with its bar) reaches 1.3 spaces above its center.
    assert.ok(y - 1.3 * U > fingerBaseline + 0.5 * U, `ornament at y ${y} clears the finger row at ${fingerBaseline}`);
    assert.ok(y < TREBLE_TOP * U, "and stays above the top staff line");
  }
});

// Accidental glyphs of one event against the heads of every other event on the same staff.
// A glyph is 1.3 wide, centered one space plus its column left of the leftmost head.
function accidentalOverlaps(layout) {
  const half = layout.metrics.headW / 2;
  const found = [];
  for (const e of layout.events) {
    if (e.kind !== "note") continue;
    const count = e.notes.filter((n) => n.accidental).length;
    if (count === 0) continue;
    const left = e.x + Math.min(...e.notes.map((n) => n.dx)) - half;
    const span = [left - (1 + (count - 1) * 1.4) - 0.65, left - 1 + 0.65];
    for (const o of layout.events) {
      if (o === e || o.kind !== "note" || o.staff !== e.staff) continue;
      const heads = [o.x + Math.min(...o.notes.map((n) => n.dx)) - half, o.x + Math.max(...o.notes.map((n) => n.dx)) + half];
      if (heads[0] < span[1] && span[0] < heads[1]) found.push(`${e.tick} over ${o.tick}`);
    }
  }
  return found;
}

test("no accidental prints over the heads of its neighbours, on either song and level", () => {
  for (const [file, levels] of [["chopin-nocturne-op9-no2.json", ["original", "beginner"]], ["cancer.json", ["original", "beginner"]]]) {
    const data = JSON.parse(readFileSync(new URL(`../../songs/${file}`, import.meta.url), "utf8"));
    for (const level of levels) {
      const layout = layoutScore(resolveLevel(data, level));
      assert.ok(layout.events.some((e) => e.notes?.some((n) => n.accidental)), `${file} ${level} has accidentals`);
      assert.deepEqual(accidentalOverlaps(layout), [], `${file} ${level}`);
    }
  }
});

test("counter-proof: the overlap check does see an accidental pushed onto its neighbour", () => {
  const layout = layoutScore(resolveLevel(song, "original"));
  const withAccidental = layout.events.find((e) => e.kind === "note" && e.notes.some((n) => n.accidental) && e.staff === "bass");
  const previous = layout.events.filter((e) => e.kind === "note" && e.staff === "bass" && e.tick < withAccidental.tick).at(-1);
  previous.x = withAccidental.x - 2.5; // squeeze the previous chord against it (the leftmost head sits 1.2 left)
  assert.ok(accidentalOverlaps(layout).length >= 1);
});
