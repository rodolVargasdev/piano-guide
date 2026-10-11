import { test } from "node:test";
import assert from "node:assert/strict";
import { smallestMove, transposeChordSymbol, transposeSong } from "../../src/theory/transpose.js";
import { TONICS, scaleOf } from "../../src/theory/keys.js";
import { mulberry32 } from "../../src/theory/random.js";
import { parsePitch, transpose as keyTranspose, transposeInterval } from "../../src/core/pitch.js";
import { parseChord } from "../../src/core/chords.js";
import { validateSong } from "../../src/core/schema.js";
import { resolveLevel } from "../../src/core/timeline.js";
import { isSilent } from "../../src/core/visibility.js";
import { mutated } from "../fixtures/helpers.js";

const midi = (p) => parsePitch(p).midi;
const names = (notes) => notes.map((n) => n.pitch);
const nameOnly = (p) => p.replace(/-?\d+$/, "");
const rh = (pitches) => pitches.map((pitch, i) => ({ tick: i * 480, dur: 480, pitch, hand: "R" }));

// A song in `tonic` with the given notes and chords (lenient bars: the notes are free-form).
function songIn(tonic, notes, chords = [{ tick: 0, dur: 1920, symbol: tonic }], extra = () => {}) {
  return mutated((s) => {
    s.key = { tonic, mode: "major" };
    s.levels.beginner.strictBars = false;
    s.levels.beginner.notes = notes;
    s.chords = chords;
    s.lesson.beginner.chordsUsed = chords.map((c) => c.symbol);
    extra(s);
  });
}
const levelNotes = (song) => song.levels.beginner.notes;

test("smallestMove: E to C is a major third down, C to E a major third up, a tritone goes down", () => {
  assert.deepEqual(smallestMove("E", "C"), { steps: -2, semitones: -4 });
  assert.deepEqual(smallestMove("C", "E"), { steps: 2, semitones: 4 });
  assert.deepEqual(smallestMove("C", "F#"), { steps: -4, semitones: -6 });
  assert.deepEqual(smallestMove("F#", "C"), { steps: -3, semitones: -6 });
  assert.deepEqual(smallestMove("E", "E"), { steps: 0, semitones: 0 });
  assert.deepEqual(smallestMove("G", "F"), { steps: -1, semitones: -2 });
});

test("smallestMove over all 144 pairs of the twelve tonics: never more than a tritone, and it lands on the target name", () => {
  for (const from of TONICS) {
    for (const to of TONICS) {
      const { steps, semitones } = smallestMove(from, to);
      assert.ok(Math.abs(semitones) <= 6, `${from} to ${to}: ${semitones}`);
      if (Math.abs(semitones) === 6) assert.equal(semitones, -6, "a tritone goes down");
      assert.equal(nameOnly(transposeInterval(`${from}4`, steps, semitones)), to, `${from} moved by ${steps} steps and ${semitones} semitones`);
    }
  }
});

test("smallestMove rejects a name that is not a tonic", () => {
  assert.throws(() => smallestMove("H", "C"), RangeError);
  assert.throws(() => smallestMove("C", "x"), /Not a tonic name/);
});

test("transposeChordSymbol re-spells root and bass and keeps the suffix: C#m moved E to C is Am", () => {
  const move = smallestMove("E", "C");
  assert.equal(transposeChordSymbol("C#m", move), "Am");
  assert.deepEqual(["E", "B", "C#m", "A"].map((s) => transposeChordSymbol(s, move)), ["C", "G", "Am", "F"]);
  assert.equal(transposeChordSymbol("F#/A#", move), "D/F#");
  assert.equal(transposeChordSymbol("B7", move), "G7");
  assert.equal(transposeChordSymbol("D#m7b5", move), "Bm7b5");
  assert.equal(transposeChordSymbol("Eadd9", move), "Cadd9");
  assert.equal(transposeChordSymbol("Esus4/A", move), "Csus4/F");
});

test("transposeChordSymbol returns null for text that is not a chord or a root that cannot be written", () => {
  const move = smallestMove("E", "C");
  assert.equal(transposeChordSymbol("N.C.", move), null);
  assert.equal(transposeChordSymbol(undefined, move), null);
  assert.equal(transposeChordSymbol("", move), null);
  assert.equal(transposeChordSymbol("F#", { steps: 0, semitones: 2 }), null, "F## has no symbol form");
});

test("every chord in a list parses after the move, and the move there and back restores the list", () => {
  const symbols = ["E", "B", "C#m", "A", "F#m7", "G#m", "D#dim", "B7", "Emaj7", "A/C#"];
  for (const target of TONICS) {
    const there = smallestMove("E", target);
    const back = smallestMove(target, "E");
    const moved = symbols.map((s) => transposeChordSymbol(s, there));
    assert.ok(moved.every((s) => s !== null && parseChord(s)), `${target}: ${moved}`);
    assert.deepEqual(moved.map((s) => transposeChordSymbol(s, back)), symbols, `${target} round trip`);
  }
});

test("E major to C major: E4 G#4 B4 C#5 become C4 E4 G4 A4 and the chords E, B, C#m, A become C, G, Am, F", () => {
  const song = songIn("E", rh(["E4", "G#4", "B4", "C#5"]), [
    { tick: 0, dur: 480, symbol: "E" },
    { tick: 480, dur: 480, symbol: "B" },
    { tick: 960, dur: 480, symbol: "C#m" },
    { tick: 1440, dur: 480, symbol: "A" },
  ]);
  const out = transposeSong(song, "beginner", "C");
  assert.deepEqual(names(levelNotes(out)), ["C4", "E4", "G4", "A4"]);
  assert.deepEqual(out.chords.map((c) => c.symbol), ["C", "G", "Am", "F"]);
  assert.deepEqual(out.lesson.beginner.chordsUsed, ["C", "G", "Am", "F"]);
  assert.deepEqual(out.key, { tonic: "C", mode: "major" });
  assert.equal(validateSong(out).ok, true, JSON.stringify(validateSong(out).errors));
});

test("a chromatic tone keeps its letter: D5 in E major becomes Bb4 in C, not A#4", () => {
  const out = transposeSong(songIn("E", rh(["E4", "D5", "G#4"])), "beginner", "C");
  assert.deepEqual(names(levelNotes(out)), ["C4", "Bb4", "E4"]);
  assert.equal(nameOnly(keyTranspose("D5", -4, { tonic: "C", mode: "major" })), "A#", "counter-proof: the key-based transpose would say A#");
});

test("every degree of the E major scale lands on the matching degree of every target scale", () => {
  const source = scaleOf("E");
  for (const target of TONICS) {
    const out = transposeSong(songIn("E", rh(source)), "beginner", target);
    assert.deepEqual(names(levelNotes(out)).map(nameOnly), scaleOf(target).map(nameOnly), target);
  }
});

test("intervals are preserved exactly over seeded random melodies and all twelve targets", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const rng = mulberry32(seed);
    const pitches = Array.from({ length: 16 }, () => keyTranspose("C4", Math.floor(rng() * 36) - 6, { tonic: "E", mode: "major" }));
    for (const target of TONICS) {
      const song = songIn("E", rh(pitches));
      const out = transposeSong(song, "beginner", target);
      const before = pitches.map(midi);
      const after = names(levelNotes(out)).map(midi);
      assert.deepEqual(after.slice(1).map((m, i) => m - after[i]), before.slice(1).map((m, i) => m - before[i]), `seed ${seed} to ${target}`);
      assert.ok(after.every((m) => m >= 21 && m <= 108));
    }
  }
});

test("register: a melody above C4 moved down a major third ends no farther from C4 than it began", () => {
  const pitches = ["E5", "G#5", "B5", "C#6", "E5", "B5"];
  const out = transposeSong(songIn("E", rh(pitches)), "beginner", "C");
  const mean = (list) => list.reduce((a, m) => a + m, 0) / list.length;
  assert.ok(Math.abs(mean(names(levelNotes(out)).map(midi)) - 60) <= Math.abs(mean(pitches.map(midi)) - 60));
});

test("range first: the candidate closest to C4 is rejected when it leaves A0 to C8, and the in-range one wins", () => {
  // C major to D (+2): E1 .. Bb7 become F#1 .. C8, a span that fills the keyboard.
  const wide = songIn("C", [{ tick: 0, dur: 480, pitch: "E1", hand: "R" }, { tick: 480, dur: 480, pitch: "Bb7", hand: "R" }]);
  const out = transposeSong(wide, "beginner", "D");
  assert.deepEqual(names(levelNotes(out)), ["F#1", "C8"], "shift 0 is the only in-range candidate");
  // The mean of 69 is 3 semitones from C4 if shifted down an octave, which would put F#0 below A0.
  assert.ok(midi("F#0") < 21);
});

test("counter-proof: when the closer candidate is in range it is chosen", () => {
  const narrow = songIn("C", [{ tick: 0, dur: 480, pitch: "E5", hand: "R" }, { tick: 480, dur: 480, pitch: "G5", hand: "R" }]);
  const out = transposeSong(narrow, "beginner", "D"); // F#5 and A5 are 19.5 semitones from C4 on average; an octave lower is 7.5
  assert.deepEqual(names(levelNotes(out)), ["F#4", "A4"]);
});

test("low-bass protection: a left-hand note that would fall below A0 moves the hand up an octave", () => {
  const bass = songIn("C", [{ tick: 0, dur: 480, pitch: "B0", hand: "L" }, { tick: 480, dur: 480, pitch: "D1", hand: "L" }]);
  const out = transposeSong(bass, "beginner", "A"); // down a minor third: B0 would be G#0, under A0
  assert.ok(names(levelNotes(out)).map(midi).every((m) => m >= 21));
  assert.deepEqual(names(levelNotes(out)), ["G#1", "B1"]);
});

test("each hand gets its own octave shift: right hand toward C4, left hand toward C3", () => {
  const both = songIn("C", [
    { tick: 0, dur: 480, pitch: "C6", hand: "R" },
    { tick: 0, dur: 480, pitch: "C2", hand: "L" },
  ]);
  const out = transposeSong(both, "beginner", "G"); // down a fourth: C6 becomes G5 and C2 becomes G1 before the octave rule
  const byHand = Object.fromEntries(levelNotes(out).map((n) => [n.hand, n.pitch]));
  assert.equal(byHand.R, "G4", "G4 is the closest of G5, G4 and G6 to C4");
  assert.equal(byHand.L, "G2", "G2 is the closest of G1, G2 and G0 to C3, and G0 is below A0 anyway");
});

test("identity: a target equal to the source key returns the notes unchanged, authored fingers included", () => {
  const song = songIn("E", [{ tick: 0, dur: 480, pitch: "E4", hand: "R", finger: 1 }, { tick: 480, dur: 480, pitch: "G#4", hand: "R", finger: 3 }]);
  const out = transposeSong(song, "beginner", "E");
  assert.deepEqual(levelNotes(out), levelNotes(song));
  assert.deepEqual(out.chords, song.chords);
});

test("authored fingers, finger sources and display labels are dropped on a real move", () => {
  const song = songIn("E", [{ tick: 0, dur: 480, pitch: "E4", hand: "R", finger: 1, fingeringSource: "source", label: "Mi" }]);
  const [n] = levelNotes(transposeSong(song, "beginner", "C"));
  assert.equal(n.finger, undefined);
  assert.equal(n.fingeringSource, undefined);
  assert.equal(n.label, undefined);
  assert.equal(n.pitch, "C4");
});

test("rests pass through untouched and other event fields survive", () => {
  const song = songIn("E", [{ tick: 0, dur: 480, pitch: "E4", hand: "R", role: "melody", vel: 0.6, tie: true }, { tick: 480, dur: 480, hand: "R", rest: true }]);
  const out = levelNotes(transposeSong(song, "beginner", "C"));
  assert.deepEqual(out[1], { tick: 480, dur: 480, hand: "R", rest: true });
  assert.deepEqual([out[0].role, out[0].vel, out[0].tie], ["melody", 0.6, true]);
});

test("a transposed private song is still private and silent, and every other top-level field is copied", () => {
  const song = songIn("E", rh(["E4", "G#4"]), undefined, (s) => void (s.visibility = "private"));
  const out = transposeSong(song, "beginner", "C");
  assert.equal(out.visibility, "private");
  assert.equal(isSilent(out), true);
  assert.equal(resolveLevel(out, "beginner").silent, true);
  for (const field of ["id", "title", "composer", "meter", "tempo", "lengthTicks", "sources", "confidence", "sections", "schemaVersion", "pickupTicks"]) {
    assert.deepEqual(out[field], song[field], field);
  }
  assert.equal(isSilent(transposeSong(songIn("E", rh(["E4"])), "beginner", "C")), false, "counter-proof: a public song stays public");
});

test("the result holds only the chosen level, drops transposeTo and the hand-position notes, and keeps the phrases", () => {
  const song = songIn("E", rh(["E4", "G#4"]), undefined, (s) => {
    s.levels.beginner.learn = { phrases: [{ id: "p1", startTick: 0, endTick: 960 }], transposeTo: ["C"] };
    s.levels.original = structuredClone(s.levels.beginner);
  });
  const out = transposeSong(song, "beginner", "C");
  assert.deepEqual(Object.keys(out.levels), ["beginner"]);
  assert.deepEqual(out.levels.beginner.learn, { phrases: [{ id: "p1", startTick: 0, endTick: 960 }] });
  assert.deepEqual(out.lesson.beginner.handPositions, []);
  assert.equal(out.defaultLevel, "beginner");
});

test("the input song is not changed", () => {
  const song = songIn("E", rh(["E4", "G#4"]));
  const before = JSON.stringify(song);
  transposeSong(song, "beginner", "C");
  assert.equal(JSON.stringify(song), before);
});

test("RangeError: unknown level, unknown tonic, and a hand no octave shift can fit, naming the hand", () => {
  const song = songIn("E", rh(["E4"]));
  assert.throws(() => transposeSong(song, "original", "C"), /Unknown level/);
  assert.throws(() => transposeSong(song, "beginner", "H"), RangeError);
  // C1 to C8 moved up a semitone puts C#8 over the top, and the shifts of 12 do not help.
  const full = songIn("C", [{ tick: 0, dur: 480, pitch: "A0", hand: "L" }, { tick: 480, dur: 480, pitch: "C8", hand: "L" }]);
  assert.throws(() => transposeSong(full, "beginner", "Db"), /left hand/);
  const high = songIn("C", [{ tick: 0, dur: 480, pitch: "A0", hand: "R" }, { tick: 480, dur: 480, pitch: "C8", hand: "R" }]);
  assert.throws(() => transposeSong(high, "beginner", "Db"), /right hand/);
});

test("a song with no chords or lesson is transposed too", () => {
  const song = songIn("E", rh(["E4", "G#4"]), [], (s) => void delete s.lesson);
  const out = transposeSong(song, "beginner", "C");
  assert.deepEqual(names(levelNotes(out)), ["C4", "E4"]);
  assert.equal(out.lesson, undefined);
});
