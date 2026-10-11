import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { validateIndex, validateSong } from "../src/core/schema.js";
import { parseChord } from "../src/core/chords.js";
import { parsePitch } from "../src/core/pitch.js";

const read = (rel) => JSON.parse(readFileSync(new URL(`../songs/${rel}`, import.meta.url), "utf8"));
const index = read("index.json");

test("songs/index.json is a valid index", () => {
  const r = validateIndex(index);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test("every indexed song file exists and validates", () => {
  for (const e of index.songs) {
    assert.ok(existsSync(new URL(`../songs/${e.file}`, import.meta.url)), `${e.file} is missing`);
    assert.deepEqual(validateSong(read(e.file)).errors, [], e.id);
  }
});

test("index fields match the song files", () => {
  for (const e of index.songs) {
    const song = read(e.file);
    assert.equal(song.id, e.id);
    assert.equal(song.title, e.title);
    assert.equal(song.composer, e.composer);
    assert.deepEqual(song.key, e.key);
    assert.equal(song.tempo.bpm, e.defaultBpm);
    assert.deepEqual(Object.keys(song.levels).sort(), [...e.levels].sort());
  }
});

test("counter-proof: a duplicated and an incomplete entry make the same index invalid", () => {
  const broken = { songs: [...index.songs, ...index.songs, { id: "x", file: "x.json" }] };
  assert.equal(validateIndex(broken).ok, false);
});

const cancer = read("cancer.json");

// Recursive scan helpers, deliberately independent of the validator's own scan.
function keysDeep(node, out = []) {
  if (Array.isArray(node)) node.forEach((x) => keysDeep(x, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      out.push(k, ...(typeof v === "string" ? [`${k}=${v}`] : []));
      keysDeep(v, out);
    }
  }
  return out;
}
const copyrightFindings = (song) =>
  keysDeep(song).filter((k) => k.toLowerCase().startsWith("lyrics") || k === "role=melody");

test("Cancer is chords-only: no lyrics key and no melody role anywhere", () => {
  assert.equal(cancer.contentPolicy, "chords-only");
  assert.deepEqual(copyrightFindings(cancer), []);
});

test("counter-proof: a copy with a lyrics string or a melody role is caught", () => {
  const withLyrics = structuredClone(cancer);
  withLyrics.lesson = { beginner: { lyrics: "some words" } };
  assert.ok(copyrightFindings(withLyrics).length > 0);
  assert.equal(validateSong(withLyrics).ok, false);
  const withMelody = structuredClone(cancer);
  withMelody.levels.beginner.notes[0].role = "melody";
  assert.ok(copyrightFindings(withMelody).length > 0);
  assert.equal(validateSong(withMelody).ok, false);
});

test("Cancer data matches the recorded sources: key, meter, tempo and chord progression", () => {
  assert.deepEqual(cancer.key, { tonic: "E", mode: "major" });
  assert.deepEqual(cancer.meter, { num: 4, den: 4 });
  assert.deepEqual(cancer.tempo, { bpm: 72, beatUnit: "quarter" });
  const bySection = (id) => {
    const s = cancer.sections.find((x) => x.id === id);
    return cancer.chords.filter((c) => c.tick >= s.startTick && c.tick < s.endTick).map((c) => c.roman);
  };
  assert.deepEqual(bySection("intro"), ["I", "V"]);
  assert.deepEqual(bySection("verse"), ["I", "V", "vi", "iv"]);
  assert.deepEqual(bySection("chorus"), ["IV", "V6/V", "vi", "iv", "ii"]);
  assert.deepEqual(cancer.chords.filter((c) => c.roman === "iv").map((c) => c.symbol), ["Am", "Am"]);
});

test("Cancer records its sources with kind, access date and confidence per scope", () => {
  assert.deepEqual(cancer.sources.map((s) => s.kind).sort(), ["reference", "user-submitted"]);
  for (const s of cancer.sources) {
    assert.match(s.url, /^https:\/\//);
    assert.match(s.accessed, /^\d{4}-\d{2}-\d{2}$/);
  }
  const level = (scope) => cancer.confidence.find((c) => c.scope === scope)?.level;
  assert.equal(level("chords:verse"), "medium");
  assert.equal(level("chords:chorus"), "low");
});

test("Cancer Beginner: every bar has one bass note and a right-hand triad, all editorial fingering", () => {
  const notes = cancer.levels.beginner.notes;
  const bars = cancer.lengthTicks / 1920;
  for (let b = 0; b < bars; b += 1) {
    const inBar = notes.filter((n) => n.tick === b * 1920);
    assert.equal(inBar.filter((n) => n.hand === "L").length, 1, `bar ${b + 1} left hand`);
    assert.equal(inBar.filter((n) => n.hand === "R").length, 3, `bar ${b + 1} right hand`);
  }
  assert.ok(notes.every((n) => n.fingeringSource === "editorial" && n.finger >= 1 && n.finger <= 5));
});

// ---- Cancer lesson (Beginner) ----
const lesson = cancer.lesson.beginner;
const playsAt = (level, tick, hand, pitch) => cancer.levels[level].notes.some((n) => n.tick === tick && n.hand === hand && n.pitch === pitch);

test("the Cancer Beginner lesson validates and the level has no missing-lesson warning", () => {
  const r = validateSong(cancer);
  assert.deepEqual(r.errors, []);
  assert.ok(!r.warnings.some((w) => w.path === "lesson.beginner"), "beginner has its lesson");
});

test("the lesson lists exactly the chords of the chord track, and every one is recognized", () => {
  const track = [...new Set(cancer.chords.map((c) => c.symbol))].sort();
  assert.deepEqual([...lesson.chordsUsed].sort(), track);
  for (const s of lesson.chordsUsed) assert.notEqual(parseChord(s), null, s);
});

test("every hand position names a note the level really plays at that tick with that hand", () => {
  assert.ok(lesson.handPositions.length >= 6);
  for (const h of lesson.handPositions) assert.ok(playsAt("beginner", h.tick, h.hand, h.anchor), `${h.hand} ${h.anchor} at ${h.tick}`);
});

test("counter-proof: a hand position pointing at a note the level does not play is caught", () => {
  assert.equal(playsAt("beginner", 0, "R", "F4"), false);
  assert.equal(playsAt("beginner", 0, "L", "E4"), false);
});

test("the lesson teaches posture, finger numbers, hands separate, slow mode and the loop", () => {
  assert.match(lesson.posture, /sit/i);
  assert.match(lesson.handPositions[0].text, /1 is the thumb/);
  const plan = lesson.practicePlan.join(" ");
  for (const word of [/hands separately/i, /Mute right/, /Slow/, /Loop a section/, /Ramp/]) assert.match(plan, word);
});

test("the lesson states the arrangement is a generic chord-based accompaniment, not a transcription", () => {
  assert.match(lesson.arrangementNote, /generic chord-based accompaniment/);
  assert.match(lesson.arrangementNote, /not a transcription/);
  assert.match(lesson.summary, /generic chord-based accompaniment, not a transcription/);
});

// ---- Cancer Original: built only from the chord track ----
const pitchClass = (pitch) => parsePitch(pitch).midi % 12;
const chordAt = (song, tick) => song.chords.find((c) => tick >= c.tick && tick < c.tick + c.dur);
// Notes whose pitch class is not a tone of the chord sounding at their tick: an invented chord shows up here.
const strangers = (song, levelId) =>
  song.levels[levelId].notes.filter((n) => !new Set(parseChord(chordAt(song, n.tick).symbol).pitches.map(pitchClass)).has(pitchClass(n.pitch)));

test("every note of both Cancer levels is a tone of the chord at that tick (no invented chords)", () => {
  assert.deepEqual(strangers(cancer, "beginner"), []);
  assert.deepEqual(strangers(cancer, "original"), []);
});

test("counter-proof: one wrong note in a copy is found", () => {
  const bad = structuredClone(cancer);
  bad.levels.original.notes.find((n) => n.pitch === "C5").pitch = "D5"; // Am has no D
  assert.equal(strangers(bad, "original").length, 1);
  const bad2 = structuredClone(cancer);
  bad2.levels.original.notes.find((n) => n.pitch === "G#4").pitch = "G4"; // E and C#m have G#, not G
  assert.ok(strangers(bad2, "original").length >= 1);
});

test("Cancer Original is engraved with strict bars and uses accompaniment and bass roles only", () => {
  const level = cancer.levels.original;
  assert.equal(level.notation, "engraved");
  assert.equal(level.strictBars, true);
  assert.equal(level.transcribed, undefined, "it is an arrangement, not a transcription");
  assert.deepEqual([...new Set(level.notes.map((n) => n.role))].sort(), ["accompaniment", "bass"]);
  assert.deepEqual(copyrightFindings(cancer), []);
});

test("Cancer Original: each bar has a four-note bass arpeggio and a held four-note chord holding every chord tone", () => {
  const notes = cancer.levels.original.notes;
  cancer.chords.forEach((c, i) => {
    const bar = notes.filter((n) => n.tick >= c.tick && n.tick < c.tick + c.dur);
    const left = bar.filter((n) => n.hand === "L");
    const right = bar.filter((n) => n.hand === "R");
    assert.deepEqual(left.map((n) => n.dur), [480, 480, 480, 480], `bar ${i + 1} bass`);
    assert.equal(right.length, 4, `bar ${i + 1} chord`);
    assert.ok(right.every((n) => n.tick === c.tick && n.dur === c.dur), `bar ${i + 1} chord is held for the bar`);
    const triad = new Set(parseChord(c.symbol).names.map((x) => pitchClass(`${x}4`)));
    assert.deepEqual(new Set(right.map((n) => pitchClass(n.pitch))), triad, `bar ${i + 1} has root, third and fifth`);
  });
});

test("Cancer Original starts every bar on the bass note of the chord, the slash bass included", () => {
  const first = (c) => cancer.levels.original.notes.find((n) => n.hand === "L" && n.tick === c.tick).pitch;
  cancer.chords.forEach((c) => {
    const chord = parseChord(c.symbol);
    assert.equal(first(c).replace(/[0-9]+$/, ""), chord.bass ?? chord.root, c.symbol);
  });
});

// ---- Cancer Original: lesson and analysis ----
const original = cancer.lesson.original;
const analysis = cancer.levels.original.analysis;
const rightVoices = (bar) => cancer.levels.original.notes.filter((n) => n.hand === "R" && n.tick === (bar - 1) * 1920).map((n) => parsePitch(n.pitch).midi).sort((a, b) => a - b);
const bassStart = (bar) => parsePitch(cancer.levels.original.notes.find((n) => n.hand === "L" && n.tick === (bar - 1) * 1920).pitch).midi;
const moves = (from, to) => rightVoices(to).map((m, i) => m - rightVoices(from)[i]);

test("the Cancer Original lesson validates, lists the chord track chords and every hand anchor is a note the level plays", () => {
  assert.deepEqual(validateSong(cancer).warnings, [], "both levels have a lesson");
  assert.deepEqual([...original.chordsUsed].sort(), [...new Set(cancer.chords.map((c) => c.symbol))].sort());
  assert.ok(original.handPositions.length >= 6);
  for (const h of original.handPositions) assert.ok(playsAt("original", h.tick, h.hand, h.anchor), `${h.hand} ${h.anchor} at ${h.tick}`);
});

test("the Original lesson states the arrangement is generic and not a transcription, and mentions the lower-confidence chorus", () => {
  assert.match(original.arrangementNote, /generic chord-based accompaniment/);
  assert.match(original.arrangementNote, /not a transcription/);
  assert.match(original.arrangementNote, /chorus is lower confidence/);
  assert.match(original.summary, /generic chord-based accompaniment, not a transcription/);
});

test("analysis exists on Original only, has harmony and voice-leading entries, and stays inside the song", () => {
  assert.equal(cancer.levels.beginner.analysis, undefined, "Beginner shows no analysis");
  assert.ok(analysis.length >= 6);
  assert.deepEqual([...new Set(analysis.map((a) => a.kind))].sort(), ["harmony", "voice-leading"]);
  for (const a of analysis) {
    assert.ok(a.tick >= 0 && (a.endTick ?? a.tick) <= cancer.lengthTicks, a.title);
    assert.ok(a.title.length <= 18, `${a.title}: callout titles stay short`);
  }
});

test("analysis roman numerals and functions agree with the chord track at their tick", () => {
  for (const a of analysis) {
    const chord = chordAt(cancer, a.tick);
    assert.equal(chord.tick, a.tick, `${a.title} sits on a chord change`);
    assert.equal(a.roman, chord.roman, a.title);
    assert.equal(a.function, chord.function, a.title);
  }
});

test("counter-proof: an analysis entry with the wrong numeral does not match the chord track", () => {
  const wrong = { ...analysis[0], roman: "V" };
  assert.notEqual(wrong.roman, chordAt(cancer, wrong.tick).roman);
});

test("the borrowed iv entry sits on the verse Am and explains modal mixture", () => {
  const borrowed = analysis.find((a) => a.title === "Borrowed iv");
  assert.equal(chordAt(cancer, borrowed.tick).symbol, "Am");
  assert.equal(borrowed.tick, 9600, "the Am of the verse (the first one)");
  assert.match(borrowed.text, /modal mixture/);
  assert.match(borrowed.text, /parallel key, E minor/);
});

test("the voice-leading claims in the analysis are true of the Original voicings", () => {
  assert.deepEqual(moves(5, 6), [0, 1, -1, 0], "C#m to Am: G# up to A, C# down to C, E stays");
  assert.deepEqual(moves(6, 7), [0, 0, 1, 0], "Am to A: only C up to C#");
  assert.equal(bassStart(8) - bassStart(7), 1, "the bass climbs a half step, A to A#");
  assert.deepEqual(moves(10, 11).filter((d) => d === 1), [1], "Am to F#m: C rises to C# (one half-step voice)");
});

test("counter-proof: the voice-leading check fails when a voicing is changed", () => {
  const saved = structuredClone(cancer);
  saved.levels.original.notes.find((n) => n.hand === "R" && n.tick === 9600 && n.pitch === "C5").pitch = "C#5";
  const voices = saved.levels.original.notes.filter((n) => n.hand === "R" && n.tick === 9600).map((n) => parsePitch(n.pitch).midi).sort((a, b) => a - b);
  assert.notEqual(voices.join(), rightVoices(6).join(), "the mutated bar differs from the real one");
});
