import { test } from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, ACCIDENTAL_GLYPHS, restGlyph, restHooks, waveLine, bracketPath } from "../../src/score/glyphs.js";
import { layoutScore } from "../../src/score/layout.js";
import { resolveLevel } from "../../src/core/timeline.js";

const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7, Z: 0 };
const TOKEN = /([MLHVCQAZmlhvcqaz])|(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)|(\s+)|(.)/g;

// Returns null for well-formed path data, otherwise a message. Checks the command letters, that
// every command gets a whole number of argument groups and that nothing else is in the string.
function pathProblem(d) {
  if (typeof d !== "string" || d.trim() === "") return "empty";
  if (!/^\s*[Mm]/.test(d)) return "must start with a move";
  let cmd = null;
  let count = 0;
  const close = () => (cmd && ARITY[cmd.toUpperCase()] > 0 && (count === 0 || count % ARITY[cmd.toUpperCase()] !== 0) ? `bad argument count for ${cmd}` : null);
  for (const m of d.matchAll(TOKEN)) {
    if (m[4] !== undefined) return `unexpected character ${m[4]}`;
    if (m[1]) {
      const problem = close();
      if (problem) return problem;
      cmd = m[1];
      count = 0;
    } else if (m[2]) count += 1;
  }
  return close();
}

test("pathProblem accepts good data and rejects malformed data (counter-proof of the checker)", () => {
  assert.equal(pathProblem("M0 0L1 1C1 2 3 4 5 6z"), null);
  assert.match(pathProblem("M0 0L1"), /bad argument count for L/);
  assert.match(pathProblem("M0 0C1 2 3 4 5"), /bad argument count for C/);
  assert.match(pathProblem("M0 0<script>"), /unexpected character/);
  assert.match(pathProblem("L0 0"), /must start with a move/);
  assert.match(pathProblem(""), /empty/);
});

test("every glyph has well-formed stroke and fill data and a positive stroke width when stroked", () => {
  for (const [name, g] of Object.entries(GLYPHS)) {
    assert.ok(g.stroke || g.fill, `${name} draws something`);
    if (g.stroke) {
      assert.equal(pathProblem(g.stroke), null, `${name} stroke`);
      assert.ok(g.w > 0, `${name} has a stroke width`);
    }
    if (g.fill) assert.equal(pathProblem(g.fill), null, `${name} fill`);
  }
});

test("the design's glyph set exists: both clefs, accidentals, rests, flags and the four ornament signs", () => {
  for (const name of ["gClef", "fClef", "flat", "sharp", "natural", "restQuarter", "restEighth", "flagUp", "flagDown", "turn", "mordent", "inverted-mordent"]) {
    assert.ok(name in GLYPHS, name);
  }
});

test("every accidental the layout can produce has a glyph", () => {
  const notes = [["Bbb4", "F##4", "C#4", "Db4", "E4"], ["E4"]].flat().map((pitch, i) => ({ tick: i * 480, dur: 480, pitch, hand: "R" }));
  const song = { key: { tonic: "Eb", mode: "major" }, meter: { num: 4, den: 4 }, pickupTicks: 0, lengthTicks: 2400, tempo: { bpm: 72, beatUnit: "quarter" }, levels: { x: { label: "X", notation: "engraved", strictBars: false, notes } } };
  const seen = new Set(layoutScore(resolveLevel(song, "x")).events.flatMap((e) => e.notes.map((n) => n.accidental)).filter(Boolean));
  assert.ok(seen.size >= 4, "the sample exercises several accidentals");
  for (const a of seen) assert.ok(ACCIDENTAL_GLYPHS.includes(a) && a in GLYPHS, a);
});

test("rest glyphs follow the written value, and short rests stack hooks", () => {
  assert.deepEqual(["whole", "half", "quarter", "eighth", "16th", "32nd"].map(restGlyph), ["restWhole", "restHalf", "restQuarter", "restEighth", "restEighth", "restEighth"]);
  assert.deepEqual(["whole", "quarter", "eighth", "16th", "32nd"].map(restHooks), [0, 0, 1, 2, 3]);
});

test("waveLine grows with the width and always forms valid path data; bracketPath spans its width", () => {
  assert.equal(pathProblem(waveLine(0.1)), null);
  assert.ok(waveLine(6).length > waveLine(2).length, "a longer trill has more cycles");
  assert.equal(pathProblem(bracketPath(4)), null);
  assert.match(bracketPath(4), /H4V/);
});
