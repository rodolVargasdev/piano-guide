import { test } from "node:test";
import assert from "node:assert/strict";
import { assignFingering, stepOf, stepToPitch } from "../../src/theory/fingering.js";
import { mulberry32 } from "../../src/theory/random.js";
import { parsePitch } from "../../src/core/pitch.js";

const note = (pitch, finger) => ({ pitch, midi: parsePitch(pitch).midi, ...(finger === undefined ? {} : { finger }) });
const group = (tick, ...pitches) => ({ tick, notes: pitches.map((p) => (Array.isArray(p) ? note(...p) : note(p))) });
const line = (...pitches) => pitches.map((p, i) => group(i * 480, p));
const fingersOf = (result) => result.map((r) => r.fingers);
const E_MAJOR = { tonic: "E", mode: "major" };

test("stepOf counts letters: a chromatic note takes the step of its letter, and the octave follows the letter", () => {
  assert.equal(stepOf("C4"), 28);
  assert.equal(stepOf("E4"), 30);
  assert.equal(stepOf("F#4"), 31);
  assert.equal(stepOf("Gb4"), 32);
  assert.equal(stepOf("C5"), 35);
  assert.equal(stepOf("Cb5"), 35, "Cb5 is MIDI 71 but its letter is C");
  assert.equal(stepOf("nonsense"), null);
});

test("stepToPitch spells a step by the key: F is F# in E major, natural without a key", () => {
  assert.equal(stepToPitch(31, E_MAJOR), "F#4");
  assert.equal(stepToPitch(31, undefined), "F4");
  assert.equal(stepToPitch(30, E_MAJOR), "E4");
  assert.equal(stepToPitch(35, { tonic: "F", mode: "major" }), "C5");
  assert.equal(stepToPitch(34, { tonic: "F", mode: "major" }), "Bb4");
  assert.equal(stepToPitch(34, { tonic: "E", mode: "minor" }), "B4", "only major keys name accidentals");
});

test("a five-finger melody E F G F E is fingered 1 2 3 2 1 in one position with no shift", () => {
  const r = assignFingering(line("E4", "F4", "G4", "F4", "E4"), { hand: "R", key: { tonic: "C", mode: "major" } });
  assert.deepEqual(fingersOf(r), [[1], [2], [3], [2], [1]]);
  assert.ok(r.every((x) => x.shift === false && x.unplayable === false));
  assert.deepEqual(r[0].position, { anchorStep: 30, thumbPitch: "E4", lowPitch: "E4", highPitch: "B4" });
  assert.deepEqual(new Set(r.map((x) => x.position.anchorStep)).size, 1);
});

test("a leap out of the position starts a new one and flags the shift on that group only", () => {
  const r = assignFingering(line("E4", "F4", "G4", "C5"), { hand: "R" });
  assert.deepEqual(r.map((x) => x.shift), [false, false, false, true]);
  assert.deepEqual(fingersOf(r), [[1], [2], [3], [1]]);
  assert.notEqual(r[3].position.anchorStep, r[0].position.anchorStep);
});

test("the left hand mirrors: fingers fall as pitch rises, C3 gets 5 and E3 gets 3", () => {
  const r = assignFingering(line("C3", "D3", "E3"), { hand: "L" });
  assert.deepEqual(fingersOf(r), [[5], [4], [3]]);
  assert.ok(r.every((x) => x.shift === false));
  assert.equal(r[0].position.thumbPitch, "G3", "the left thumb sits on the highest step of the position");
});

test("triad C4 E4 G4 is fingered 1 3 5 in the right hand and C3 E3 G3 is 5 3 1 in the left", () => {
  assert.deepEqual(fingersOf(assignFingering([group(0, "C4", "E4", "G4")], { hand: "R" })), [[1, 3, 5]]);
  assert.deepEqual(fingersOf(assignFingering([group(0, "C3", "E3", "G3")], { hand: "L" })), [[5, 3, 1]]);
});

test("triad inversions use the stretch rule: right hand 1-2-5 and 1-3-5, left hand 5-3-1 and 5-2-1", () => {
  const rh = (...p) => assignFingering([group(0, ...p)], { hand: "R" })[0];
  const lh = (...p) => assignFingering([group(0, ...p)], { hand: "L" })[0];
  assert.deepEqual(rh("E4", "G4", "C5").fingers, [1, 2, 5], "first inversion");
  assert.deepEqual(rh("G4", "C5", "E5").fingers, [1, 3, 5], "second inversion");
  assert.deepEqual(lh("E3", "G3", "C4").fingers, [5, 3, 1], "first inversion");
  assert.deepEqual(lh("G3", "C4", "E4").fingers, [5, 2, 1], "second inversion");
  assert.equal(rh("E4", "G4", "C5").unplayable, false);
});

test("two notes use the fingers that match their span: a third 1 and 3, a fifth 1 and 5, a wide sixth 1 and 5", () => {
  const rh = (...p) => assignFingering([group(0, ...p)], { hand: "R" })[0].fingers;
  assert.deepEqual(rh("C4", "E4"), [1, 3]);
  assert.deepEqual(rh("C4", "G4"), [1, 5]);
  assert.deepEqual(rh("C4", "A4"), [1, 5]);
});

test("octave bass: C2 and C3 together are 5 and 1 in the left hand", () => {
  const r = assignFingering([group(0, "C2", "C3")], { hand: "L" })[0];
  assert.deepEqual(r.fingers, [5, 1]);
  assert.equal(r.unplayable, false);
});

test("a group wider than 12 semitones, more than three wide notes or two notes on one step is unplayable with null fingers", () => {
  const wide = assignFingering([group(0, "C3", "G4")], { hand: "R" })[0];
  assert.equal(wide.unplayable, true);
  assert.deepEqual(wide.fingers, [null, null]);
  assert.equal(assignFingering([group(0, "C4", "E4", "G4", "C5")], { hand: "R" })[0].unplayable, true, "four notes wider than five steps");
  assert.equal(assignFingering([group(0, "E4", "Eb4")], { hand: "R" })[0].unplayable, true, "one step, two keys");
});

test("an unplayable group between positional ones forces a shift on the next group", () => {
  const r = assignFingering([group(0, "C4"), group(480, "C3", "G4"), group(960, "D4")], { hand: "R" });
  assert.deepEqual(r.map((x) => [x.unplayable, x.shift]), [[false, false], [true, true], [false, true]]);
});

test("authored fingers win: E4 marked 4 keeps 4, the others adapt monotonically, and G4 starts a new position", () => {
  const groups = [group(0, "C4"), group(480, "D4"), group(960, ["E4", 4]), group(1440, "F4"), group(1920, "G4")];
  const r = assignFingering(groups, { hand: "R" });
  assert.deepEqual(fingersOf(r), [[2], [3], [4], [5], [1]]);
  assert.deepEqual(r.map((x) => x.shift), [false, false, false, false, true]);
});

test("a left-hand authored finger pins the left-hand position the same way", () => {
  const r = assignFingering([group(0, "C3"), group(480, ["D3", 2]), group(960, "E3")], { hand: "L" });
  assert.deepEqual(fingersOf(r), [[3], [2], [1]], "D3 is the second finger, so C3 is third and E3 is the thumb");
});

test("an authored finger that cannot fit its own group is still reported as written", () => {
  const r = assignFingering([group(0, ["C4", 5], "G4")], { hand: "R" })[0];
  assert.equal(r.fingers[0], 5);
});

test("authored fingers that disagree end the run instead of being averaged", () => {
  const r = assignFingering([group(0, ["C4", 1]), group(480, ["D4", 1])], { hand: "R" });
  assert.deepEqual(fingersOf(r), [[1], [1]]);
  assert.deepEqual(r.map((x) => x.shift), [false, true]);
});

test("the thumb avoids a black key when a white-key position exists", () => {
  const r = assignFingering(line("F#4", "G4", "A4", "B4"), { hand: "R" });
  assert.deepEqual(fingersOf(r), [[2], [3], [4], [5]], "the position starts on E, not on F#");
  assert.equal(assignFingering([group(0, "F#4")], { hand: "R" })[0].fingers[0], 2, "even a single black note is not given the thumb");
  assert.equal(assignFingering([group(0, "C4")], { hand: "R" })[0].fingers[0], 1, "counter-proof: a white note takes the thumb");
});

test("the left thumb avoids black keys too", () => {
  const r = assignFingering(line("Bb2", "C3", "D3"), { hand: "L" });
  const thumbNotes = r.flatMap((x, i) => (x.fingers[0] === 1 ? [i] : []));
  assert.ok(!thumbNotes.includes(0), "Bb2 is not played by the left thumb");
});

test("repeated notes keep their finger", () => {
  const r = assignFingering(line("E4", "E4", "E4", "G4", "E4"), { hand: "R" });
  assert.deepEqual(fingersOf(r), [[1], [1], [1], [3], [1]]);
});

test("a scale is covered by the fewest positions: C to G, then A to C, with one shift", () => {
  const r = assignFingering(line("C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"), { hand: "R" });
  assert.deepEqual(r.map((x) => x.shift), [false, false, false, false, false, true, false, false]);
  assert.deepEqual(fingersOf(r), [[1], [2], [3], [4], [5], [1], [2], [3]]);
});

test("positions are named in the key: an E major melody that starts on E gets spelled low and high keys", () => {
  const r = assignFingering(line("E4", "F#4", "G#4"), { hand: "R", key: E_MAJOR });
  assert.deepEqual(r[0].position, { anchorStep: 30, thumbPitch: "E4", lowPitch: "E4", highPitch: "B4" });
  const lh = assignFingering(line("E3", "F#3", "G#3"), { hand: "L", key: E_MAJOR });
  assert.equal(lh[0].position.thumbPitch, "B3");
  assert.equal(lh[0].position.lowPitch, "E3");
});

test("fingers stay 1 to 5 and the position count equals the optimum on 300 seeded random lines, for both hands", () => {
  const pitchOf = (step) => `${"CDEFGAB"[step % 7]}${Math.floor(step / 7)}`;
  for (let seed = 1; seed <= 150; seed += 1) {
    const rng = mulberry32(seed);
    const steps = Array.from({ length: 12 }, () => 21 + Math.floor(rng() * 13)); // C3 to A4
    for (const hand of ["R", "L"]) {
      const r = assignFingering(line(...steps.map(pitchOf)), { hand });
      assert.ok(r.every((x) => x.fingers.every((f) => f >= 1 && f <= 5)), `seed ${seed} ${hand}`);
      const positions = 1 + r.filter((x) => x.shift).length;
      assert.equal(positions, minimalWindows(steps), `seed ${seed} ${hand}: greedy is optimal`);
      // Inside a position, a higher step never gets the finger a lower step has (monotonic fingers).
      for (let k = 1; k < r.length; k += 1) {
        if (r[k].shift) continue;
        const dStep = steps[k] - steps[k - 1];
        const dFinger = r[k].fingers[0] - r[k - 1].fingers[0];
        assert.equal(Math.sign(dFinger), (hand === "R" ? 1 : -1) * Math.sign(dStep) + 0, `seed ${seed} ${hand} at ${k}`);
      }
    }
  }
});

// Reference: the fewest five-step windows that cover the steps in order, by dynamic programming.
function minimalWindows(steps) {
  let count = 0;
  let i = 0;
  while (i < steps.length) {
    let lo = steps[i] - 4;
    let hi = steps[i];
    let j = i + 1;
    while (j < steps.length && Math.max(lo, steps[j] - 4) <= Math.min(hi, steps[j])) {
      lo = Math.max(lo, steps[j] - 4);
      hi = Math.min(hi, steps[j]);
      j += 1;
    }
    count += 1;
    i = j;
  }
  return count;
}

test("counter-proof: the reference counter itself sees a leap as two windows and a five-step line as one", () => {
  assert.equal(minimalWindows([30, 31, 32, 35]), 2);
  assert.equal(minimalWindows([30, 31, 32, 33, 34]), 1);
});

test("an empty list gives an empty result", () => {
  assert.deepEqual(assignFingering([], { hand: "R" }), []);
});

test("fingers follow the order of the notes given, not their pitch", () => {
  const r = assignFingering([group(0, "G4", "C4", "E4")], { hand: "R" })[0];
  assert.deepEqual(r.fingers, [5, 1, 3]);
});
