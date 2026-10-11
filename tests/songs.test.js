import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { validateIndex, validateSong, visibilityMismatch } from "../src/core/schema.js";
import { parseChord } from "../src/core/chords.js";
import { parsePitch } from "../src/core/pitch.js";
import { barBeatOf } from "../src/core/timing.js";

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

test("every index entry that declares visibility agrees with its song file", () => {
  for (const e of index.songs) assert.equal(visibilityMismatch(e, read(e.file)), null, e.id);
});

test("counter-proof: an entry saying private over a file without visibility is reported, naming the entry", () => {
  const first = index.songs[0];
  const reason = visibilityMismatch({ ...first, visibility: "private" }, read(first.file));
  assert.match(reason, new RegExp(first.id));
  assert.equal(visibilityMismatch({ ...first, visibility: "public" }, read(first.file)), null, "public over a public file agrees");
});

test("counter-proof: a duplicated and an incomplete entry make the same index invalid", () => {
  const broken = { songs: [...index.songs, ...index.songs, { id: "x", file: "x.json" }] };
  assert.equal(validateIndex(broken).ok, false);
});

// A synthetic chords-only song (no real melody, no real song) stands in for every guard that used to read
// the public chords-only Cancer file. The guards are about the shape of a chords-only song, not about one song.
const chordsOnly = JSON.parse(readFileSync(new URL("./fixtures/chords-only-song.json", import.meta.url), "utf8"));

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

test("a chords-only song validates and has no lyrics key and no melody role anywhere", () => {
  assert.deepEqual(validateSong(chordsOnly).errors, []);
  assert.equal(chordsOnly.contentPolicy, "chords-only");
  assert.deepEqual(copyrightFindings(chordsOnly), []);
});

test("counter-proof: a copy with a lyrics string or a melody role is caught", () => {
  const withLyrics = structuredClone(chordsOnly);
  withLyrics.lesson = { beginner: { lyrics: "some words" } };
  assert.ok(copyrightFindings(withLyrics).length > 0);
  assert.equal(validateSong(withLyrics).ok, false);
  const withMelody = structuredClone(chordsOnly);
  withMelody.levels.beginner.notes[0].role = "melody";
  assert.ok(copyrightFindings(withMelody).length > 0);
  assert.equal(validateSong(withMelody).ok, false);
});

test("every song of the public index records its sources (https URL, kind, access date) and confidence per scope", () => {
  for (const song of [...index.songs.map((e) => read(e.file)), chordsOnly]) {
    assert.ok(song.sources.length > 0, song.id);
    for (const s of song.sources) {
      assert.match(s.url, /^https:\/\//, song.id);
      assert.match(s.accessed, /^\d{4}-\d{2}-\d{2}$/, song.id);
      assert.ok(["public-domain-score", "user-submitted", "original-arrangement", "reference"].includes(s.kind), `${song.id}: ${s.kind}`);
    }
    assert.ok(song.confidence.length > 0, song.id);
    assert.ok(song.confidence.every((c) => ["high", "medium", "low"].includes(c.level) && c.scope && c.note), song.id);
  }
});

test("a chords-only fixture records chord confidence per section: the later sections are lower confidence", () => {
  const level = (scope) => chordsOnly.confidence.find((c) => c.scope === scope)?.level;
  assert.equal(level("chords:verse"), "medium");
  assert.equal(level("chords:chorus"), "low");
  assert.deepEqual(chordsOnly.sources.map((s) => s.kind).sort(), ["reference", "user-submitted"]);
});

test("chords-only Beginner: every bar has one bass note and a right-hand triad, all editorial fingering", () => {
  const notes = chordsOnly.levels.beginner.notes;
  const bars = chordsOnly.lengthTicks / 1920;
  for (let b = 0; b < bars; b += 1) {
    const inBar = notes.filter((n) => n.tick === b * 1920);
    assert.equal(inBar.filter((n) => n.hand === "L").length, 1, `bar ${b + 1} left hand`);
    assert.equal(inBar.filter((n) => n.hand === "R").length, 3, `bar ${b + 1} right hand`);
  }
  assert.ok(notes.every((n) => n.fingeringSource === "editorial" && n.finger >= 1 && n.finger <= 5));
});

// ---- chords-only lesson (Beginner) ----
const lesson = chordsOnly.lesson.beginner;
const playsAt = (level, tick, hand, pitch) => chordsOnly.levels[level].notes.some((n) => n.tick === tick && n.hand === hand && n.pitch === pitch);

test("the chords-only Beginner lesson validates and the level has no missing-lesson warning", () => {
  const r = validateSong(chordsOnly);
  assert.deepEqual(r.errors, []);
  assert.ok(!r.warnings.some((w) => w.path === "lesson.beginner"), "beginner has its lesson");
});

test("the lesson lists exactly the chords of the chord track, and every one is recognized", () => {
  const track = [...new Set(chordsOnly.chords.map((c) => c.symbol))].sort();
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

test("the lesson of a chords-only song states the arrangement is generic and not a transcription", () => {
  for (const id of ["beginner", "original"]) {
    assert.match(chordsOnly.lesson[id].arrangementNote, /generic chord-based accompaniment/);
    assert.match(chordsOnly.lesson[id].arrangementNote, /not a transcription/);
    assert.match(chordsOnly.lesson[id].summary, /generic chord-based accompaniment, not a transcription/);
  }
});

// ---- chords-only Original: built only from the chord track ----
const pitchClass = (pitch) => parsePitch(pitch).midi % 12;
const chordAt = (song, tick) => song.chords.find((c) => tick >= c.tick && tick < c.tick + c.dur);
// Notes whose pitch class is not a tone of the chord sounding at their tick: an invented chord shows up here.
const strangers = (song, levelId) =>
  song.levels[levelId].notes.filter((n) => !new Set(parseChord(chordAt(song, n.tick).symbol).pitches.map(pitchClass)).has(pitchClass(n.pitch)));

test("every note of both levels is a tone of the chord at that tick (no invented chords)", () => {
  assert.deepEqual(strangers(chordsOnly, "beginner"), []);
  assert.deepEqual(strangers(chordsOnly, "original"), []);
});

test("counter-proof: one wrong note in a copy is found", () => {
  const bad = structuredClone(chordsOnly);
  bad.levels.original.notes.find((n) => n.pitch === "C#5").pitch = "D5"; // the A chord has no D
  assert.equal(strangers(bad, "original").length, 1);
  const bad2 = structuredClone(chordsOnly);
  bad2.levels.original.notes.find((n) => n.pitch === "G#4").pitch = "G4"; // the E chord has G#, not G
  assert.ok(strangers(bad2, "original").length >= 1);
});

test("a chords-only Original is engraved with strict bars and uses accompaniment and bass roles only", () => {
  const level = chordsOnly.levels.original;
  assert.equal(level.notation, "engraved");
  assert.equal(level.strictBars, true);
  assert.equal(level.transcribed, undefined, "it is an arrangement, not a transcription");
  assert.deepEqual([...new Set(level.notes.map((n) => n.role))].sort(), ["accompaniment", "bass"]);
  assert.deepEqual(copyrightFindings(chordsOnly), []);
});

test("chords-only Original: each bar has a four-note bass pattern and a held four-note chord holding every chord tone", () => {
  const notes = chordsOnly.levels.original.notes;
  chordsOnly.chords.forEach((c, i) => {
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

test("a chords-only Original starts every bar on the bass note of the chord, the slash bass included", () => {
  const first = (c) => chordsOnly.levels.original.notes.find((n) => n.hand === "L" && n.tick === c.tick).pitch;
  chordsOnly.chords.forEach((c) => {
    const chord = parseChord(c.symbol);
    assert.equal(first(c).replace(/[0-9]+$/, ""), chord.bass ?? chord.root, c.symbol);
  });
});

// ---- chords-only Original: lesson and analysis ----
const original = chordsOnly.lesson.original;
const analysis = chordsOnly.levels.original.analysis;

test("the Original lesson validates, lists the chord track chords and every hand anchor is a note the level plays", () => {
  assert.deepEqual(validateSong(chordsOnly).warnings, [], "both levels have a lesson");
  assert.deepEqual([...original.chordsUsed].sort(), [...new Set(chordsOnly.chords.map((c) => c.symbol))].sort());
  assert.ok(original.handPositions.length >= 6);
  for (const h of original.handPositions) assert.ok(playsAt("original", h.tick, h.hand, h.anchor), `${h.hand} ${h.anchor} at ${h.tick}`);
});

test("analysis exists on Original only, has harmony and voice-leading entries, and stays inside the song", () => {
  assert.equal(chordsOnly.levels.beginner.analysis, undefined, "Beginner shows no analysis");
  assert.ok(analysis.length >= 6);
  assert.deepEqual([...new Set(analysis.map((a) => a.kind))].sort(), ["harmony", "voice-leading"]);
  for (const a of analysis) {
    assert.ok(a.tick >= 0 && (a.endTick ?? a.tick) <= chordsOnly.lengthTicks, a.title);
    assert.ok(a.title.length <= 18, `${a.title}: callout titles stay short`);
  }
});

test("analysis roman numerals and functions agree with the chord track at their tick", () => {
  for (const a of analysis) {
    const chord = chordAt(chordsOnly, a.tick);
    assert.equal(chord.tick, a.tick, `${a.title} sits on a chord change`);
    assert.equal(a.roman, chord.roman, a.title);
    assert.equal(a.function, chord.function, a.title);
  }
});

test("counter-proof: an analysis entry with the wrong numeral does not match the chord track", () => {
  const wrong = { ...analysis[0], roman: "V" };
  assert.notEqual(wrong.roman, chordAt(chordsOnly, wrong.tick).roman);
});

// ---- Chopin Nocturne Op. 9 No. 2: pickup and bars 1 to 4, transcribed from the Mutopia LilyPond source ----
const chopin = read("chopin-nocturne-op9-no2.json");
const chopinNotes = chopin.levels.original.notes;
const onsets = JSON.parse(readFileSync(new URL("./fixtures/mutopia-chopin-op9n2-onsets.json", import.meta.url), "utf8"));
const PICKUP = 240;
const BAR = 2880;
const barStart = (bar) => (bar === 0 ? 0 : PICKUP + (bar - 1) * BAR);
const midiOf = (pitch) => parsePitch(pitch).midi;
// First event of a hand at the start of a bar: the lowest pitch, or "rest".
const firstOf = (notes, hand, bar) => {
  const at = notes.filter((n) => n.hand === hand && n.tick === barStart(bar));
  return at.length === 0 ? undefined : at[0].rest ? "rest" : at.map((n) => n.pitch).sort((a, b) => midiOf(a) - midiOf(b))[0];
};
const bassOnBeat = (notes, bar, beat) => notes.find((n) => n.hand === "L" && n.role === "bass" && n.tick === barStart(bar) + (beat - 1) * 720)?.pitch;
// Onsets as "tick:midi+midi" strings per hand, ties collapsed (a tied continuation has no onset).
function onsetsOf(notes, hand) {
  const heads = notes.filter((n) => n.hand === hand && !n.rest);
  const continuation = (n) => heads.some((h) => h.tie === true && h.pitch === n.pitch && h.tick + h.dur === n.tick);
  const byTick = new Map();
  for (const n of heads) if (!continuation(n)) (byTick.get(n.tick) ?? byTick.set(n.tick, []).get(n.tick)).push(midiOf(n.pitch));
  return [...byTick].sort((a, b) => a[0] - b[0]).map(([t, m]) => `${t}:${m.sort((a, b) => a - b).join("+")}`).join(" ");
}

test("Chopin validates, is transcribed and strict", () => {
  const r = validateSong(chopin);
  assert.deepEqual(r.errors, []);
  assert.equal(chopin.levels.original.transcribed, true);
  assert.equal(chopin.levels.original.strictBars, true);
  assert.equal(chopin.levels.original.notation, "engraved");
  assert.equal(chopin.defaultLevel, "original");
  assert.equal(chopin.contentPolicy, "open");
});

test("Chopin timing: E-flat major, 12/8 counted in dotted quarters at 44 (the printed eighth = 132), a one-eighth pickup and four bars", () => {
  assert.deepEqual(chopin.key, { tonic: "Eb", mode: "major" });
  assert.deepEqual(chopin.meter, { num: 12, den: 8 });
  assert.equal(chopin.tempo.beatUnit, "dotted-quarter");
  assert.equal(chopin.tempo.bpm * 3, 132);
  assert.equal(chopin.pickupTicks, PICKUP);
  assert.equal(chopin.lengthTicks, PICKUP + 4 * BAR);
});

test("the Mutopia source entry names the transcribed bars and records URL, ID, license, SHA-256, date and maintainer", () => {
  const s = chopin.sources.find((x) => x.kind === "public-domain-score");
  assert.match(s.what, /pickup/i);
  assert.match(s.what, /bars? 1/i);
  assert.match(s.what, /4/);
  assert.equal(new URL(s.url).hostname, "www.mutopiaproject.org");
  assert.equal(new URL(s.fileUrl).hostname, "www.mutopiaproject.org");
  assert.match(s.fileUrl, /chopin_nocturne_op9_n2\.ly$/);
  assert.equal(s.mutopiaId, "Mutopia-2014/12/18-1590");
  assert.match(s.url, /id=1590$/);
  assert.equal(s.license, "CC BY-SA 3.0");
  assert.equal(s.licenseUrl, "https://creativecommons.org/licenses/by-sa/3.0/");
  assert.match(s.sha256, /^[0-9a-f]{64}$/);
  assert.match(s.accessed, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(s.what, /Renato Biolcati Rinaldi/);
  assert.match(s.what, /ShareAlike/);
});

test("counter-proof: without the Mutopia source the transcribed level is rejected", () => {
  const bad = structuredClone(chopin);
  bad.sources = bad.sources.filter((s) => s.kind !== "public-domain-score");
  assert.equal(validateSong(bad).ok, false);
  assert.ok(validateSong(bad).errors.some((e) => e.rule === "R5"));
});

test("each bar's first pitch is the one read from the source (relative octaves resolved bar by bar)", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((b) => firstOf(chopinNotes, "R", b)), ["Bb4", "G5", "G5", "F5", "Bb4"]);
  assert.deepEqual([0, 1, 2, 3, 4].map((b) => firstOf(chopinNotes, "L", b)), ["rest", "Eb2", "C2", "Bb2", "Bb2"]);
});

test("the bass of bar 1 is Eb2, Eb3, Eb2, D2 on the four dotted-quarter beats", () => {
  assert.deepEqual([1, 2, 3, 4].map((beat) => bassOnBeat(chopinNotes, 1, beat)), ["Eb2", "Eb3", "Eb2", "D2"]);
});

test("counter-proof: a mutated first pitch or bass note is caught by the same pins", () => {
  const bad = structuredClone(chopinNotes);
  bad.find((n) => n.hand === "R" && n.tick === barStart(1)).pitch = "G4";
  assert.notEqual(firstOf(bad, "R", 1), "G5");
  bad.find((n) => n.hand === "L" && n.role === "bass" && n.tick === barStart(1)).pitch = "Eb3";
  assert.notEqual(bassOnBeat(bad, 1, 1), "Eb2");
});

test("bar 1 melody descends G, F, Eb, and the pickup is the Bb below", () => {
  const bar1 = chopinNotes.filter((n) => n.hand === "R" && !n.rest && n.tick >= barStart(1) && n.tick < barStart(2));
  const names = [...new Set(bar1.map((n) => n.pitch))];
  assert.deepEqual(names.slice(0, 3), ["G5", "F5", "Eb5"]);
  assert.equal(bar1.find((n) => n.tie).tie, true, "the dotted-quarter G is tied to the eighth G");
  assert.equal(chopinNotes.find((n) => n.tick === 0 && n.hand === "R").pitch, "Bb4");
});

test("every onset of both hands equals the onsets of the Mutopia MIDI file (30 right-hand, 48 left-hand)", () => {
  assert.equal(onsetsOf(chopinNotes, "R"), onsets.upper);
  assert.equal(onsetsOf(chopinNotes, "L"), onsets.lower);
  assert.equal(onsets.upper.split(" ").length, 30);
  assert.equal(onsets.lower.split(" ").length, 48);
});

test("counter-proof: one wrong octave, one wrong tick and one missing note each break the MIDI comparison", () => {
  const octave = structuredClone(chopinNotes);
  octave.find((n) => n.pitch === "D6").pitch = "D5";
  assert.notEqual(onsetsOf(octave, "R"), onsets.upper);
  const tick = structuredClone(chopinNotes);
  tick.find((n) => n.hand === "L" && n.pitch === "Eb2" && n.tick === barStart(1)).tick += 240;
  assert.notEqual(onsetsOf(tick, "L"), onsets.lower);
  const missing = chopinNotes.filter((n) => !(n.hand === "L" && n.pitch === "Ab3" && n.tick === barStart(1) + 960));
  assert.notEqual(onsetsOf(missing, "L"), onsets.lower);
});

test("bar 1 beat 2: an Eb pedal under B, D, F and Ab, with the B written Cb4 in the source", () => {
  const beat2 = barStart(1) + 720;
  const sounding = (hand) => chopinNotes.filter((n) => n.hand === hand && !n.rest && n.tick >= beat2 && n.tick < beat2 + 720);
  const left = sounding("L");
  assert.equal(left.find((n) => n.role === "bass").pitch, "Eb3");
  const classes = new Set([...left.filter((n) => n.role === "accompaniment"), ...sounding("R")].map((n) => midiOf(n.pitch) % 12));
  for (const pc of [11, 2, 5, 8]) assert.ok(classes.has(pc), `pitch class ${pc} sounds on beat 2`);
  assert.ok(left.some((n) => n.pitch === "Cb4"), "the source spells the B as Cb4");
  assert.equal(midiOf("Cb4") % 12, 11, "Cb4 is the pitch class B");
});

test("the right hand carries the source fingering and the left hand none; the one ornament is the bar 2 turn", () => {
  const right = chopinNotes.filter((n) => n.hand === "R" && !n.rest);
  assert.ok(right.filter((n) => n.finger !== undefined).every((n) => n.fingeringSource === "source" && n.finger >= 1 && n.finger <= 5));
  assert.equal(right.filter((n) => n.finger !== undefined).length, 25);
  assert.ok(chopinNotes.filter((n) => n.hand === "L").every((n) => n.finger === undefined));
  const orn = chopinNotes.filter((n) => n.ornament);
  assert.equal(orn.length, 1);
  assert.deepEqual([orn[0].ornament, orn[0].pitch, orn[0].tick], ["turn", "C5", barStart(2) + 480]);
  assert.equal(chopin.confidence.find((c) => c.scope === "fingering").level, "medium");
});

test("the pedal follows the source: one range per beat through beat 2 of bar 4, then beats 3 and 4 together", () => {
  const pedal = chopin.levels.original.pedal;
  assert.equal(pedal.length, 15);
  assert.ok(pedal.slice(0, 14).every((p) => p.endTick - p.startTick === 720));
  assert.deepEqual(pedal[14], { startTick: barStart(4) + 1440, endTick: chopin.lengthTicks });
});

test("the IMSLP entry says it was not read, so it cannot pass as a verification", () => {
  const imslp = chopin.sources.find((s) => new URL(s.url).hostname === "imslp.org");
  assert.equal(imslp.kind, "reference");
  assert.match(imslp.what, /could not be read/);
  assert.equal(chopin.confidence.find((c) => c.scope === "notes").level, "medium");
});

// ---- Chopin Beginner: the same melody, a simpler left hand, labelled notation ----
const beginner = chopin.levels.beginner;
const pairs = (notes, hand) => notes.filter((n) => n.hand === hand && !n.rest).map((n) => `${n.tick}:${n.pitch}`);
const beats = [...Array(16).keys()].map((i) => PICKUP + i * 720);

test("Chopin Beginner is labelled and strict, keeps E-flat major, and has no ornament, tie, grace or note shorter than an eighth", () => {
  assert.equal(beginner.notation, "labelled");
  assert.equal(beginner.strictBars, true);
  assert.equal(beginner.transcribed, undefined, "it is a simplification, not a transcription");
  assert.equal(beginner.analysis, undefined, "Beginner shows no analysis");
  assert.ok(beginner.notes.every((n) => n.ornament === undefined && n.tie === undefined && n.grace === undefined && n.dur >= 240));
  assert.deepEqual(Object.keys(chopin.levels), ["beginner", "original"]);
  assert.deepEqual(chopin.key, { tonic: "Eb", mode: "major" });
});

test("the Beginner melody keeps the Original melody: every note is at the same tick and pitch, except one D5 that stands for the run of bar 4", () => {
  const original = new Set(pairs(chopinNotes, "R"));
  const extra = pairs(beginner.notes, "R").filter((p) => !original.has(p));
  assert.deepEqual(extra, ["10080:D5"]);
  const tied = chopinNotes.find((n) => n.tie);
  assert.equal(beginner.notes.find((n) => n.tick === tied.tick && n.pitch === tied.pitch).dur, 960, "the tied G is one note of both lengths");
});

test("counter-proof: a changed melody note shows up as an extra pair", () => {
  const bad = structuredClone(beginner.notes);
  bad.find((n) => n.hand === "R" && n.pitch === "C6").pitch = "C5";
  const original = new Set(pairs(chopinNotes, "R"));
  assert.equal(pairs(bad, "R").filter((p) => !original.has(p)).length, 2);
});

test("the Beginner left hand is one bass eighth then the beat's last chord held for the rest of the beat, on all 16 beats", () => {
  for (const [i, t] of beats.entries()) {
    const bass = beginner.notes.filter((n) => n.hand === "L" && n.role === "bass" && n.tick === t);
    const chord = beginner.notes.filter((n) => n.hand === "L" && n.role === "accompaniment" && n.tick === t + 240);
    assert.equal(bass.length, 1, `beat ${i + 1} bass`);
    assert.equal(bass[0].dur, 240);
    assert.equal(bass[0].pitch, chopinNotes.find((n) => n.hand === "L" && n.role === "bass" && n.tick === t).pitch, `beat ${i + 1} bass is the Original bass`);
    assert.ok(chord.length >= 2 && chord.every((n) => n.dur === 480), `beat ${i + 1} chord`);
    const last = chopinNotes.filter((n) => n.hand === "L" && n.role === "accompaniment" && n.tick === t + 480).map((n) => n.pitch).sort();
    assert.deepEqual(chord.map((n) => n.pitch).sort(), last, `beat ${i + 1} chord is the last Original chord of the beat`);
  }
});

test("Beginner fingering: source fingers equal the Original ones; the only editorial right-hand fingers are C5 (bar 2), D5 and Eb5 (bar 4); every left-hand note has one", () => {
  const right = beginner.notes.filter((n) => n.hand === "R" && !n.rest);
  for (const n of right.filter((x) => x.fingeringSource === "source")) {
    assert.equal(chopinNotes.find((o) => o.hand === "R" && o.tick === n.tick && o.pitch === n.pitch).finger, n.finger, `${n.tick} ${n.pitch}`);
  }
  assert.deepEqual(right.filter((n) => n.fingeringSource === "editorial").map((n) => `${n.tick}:${n.pitch}:${n.finger}`), ["3600:C5:1", "10080:D5:1", "10320:Eb5:2"]);
  assert.ok(right.every((n) => n.finger >= 1 && n.finger <= 5));
  const left = beginner.notes.filter((n) => n.hand === "L" && !n.rest);
  assert.ok(left.every((n) => n.fingeringSource === "editorial" && n.finger >= 1 && n.finger <= 5));
  assert.ok(left.filter((n) => n.role === "bass").every((n) => n.finger === 5));
});

test("the Beginner pedal is the Original pedal and the confidence entry calls the level an editorial simplification", () => {
  assert.deepEqual(beginner.pedal, chopin.levels.original.pedal);
  const c = chopin.confidence.find((x) => x.scope === "beginner");
  assert.equal(c.level, "low");
  assert.match(c.note, /Editorial simplification/);
});


// ---- Chopin analysis and lessons: every claim is tied to the data ----
const chopinChords = chopin.chords;
const chopinAnalysis = chopin.levels.original.analysis;
const lessonB = chopin.lesson.beginner;
const lessonO = chopin.lesson.original;
const chordAtC = (tick) => chopinChords.find((c) => tick >= c.tick && tick < c.tick + c.dur);
const levelNotes = (id) => chopin.levels[id].notes;
const leftAt = (tick, role) => chopinNotes.filter((n) => n.hand === "L" && !n.rest && n.tick === tick && (role === undefined || n.role === role)).map((n) => n.pitch);
const bassMidi = (tick) => midiOf(leftAt(tick, "bass")[0]);
const playsAtLevel = (id, tick, hand, pitch) => levelNotes(id).some((n) => n.tick === tick && n.hand === hand && n.pitch === pitch);

test("Chopin now has both lessons, so it validates with no warning at all", () => {
  const r = validateSong(chopin);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("the chord track parses, is sorted without overlap, and both lessons list exactly its symbols", () => {
  const symbols = [...new Set(chopinChords.map((c) => c.symbol))].sort();
  for (const s of symbols) assert.notEqual(parseChord(s), null, s);
  assert.deepEqual([...lessonB.chordsUsed].sort(), symbols);
  assert.deepEqual([...lessonO.chordsUsed].sort(), symbols);
  chopinChords.forEach((c, i) => i > 0 && assert.ok(c.tick >= chopinChords[i - 1].tick + chopinChords[i - 1].dur, `chord ${i} overlaps`));
});

test("every left-hand note of each chord span is a tone of that chord and the bass is its bass, except the suspension of bar 4", () => {
  for (const c of chopinChords) {
    const chord = parseChord(c.symbol);
    const tones = new Set(chord.names.map((x) => pitchClass(`${x}4`)));
    const inside = chopinNotes.filter((n) => n.hand === "L" && !n.rest && n.tick >= c.tick && n.tick < c.tick + c.dur);
    const bass = inside.filter((n) => n.role === "bass");
    for (const n of bass) {
      const expected = pitchClass(`${chord.bass ?? chord.root}4`);
      if (n.tick === c.tick || chord.bass === undefined) assert.equal(pitchClass(n.pitch), expected, `${c.symbol} bass at ${n.tick}`);
    }
    if (c.tick === 8880) continue; // the 4-3 suspension is checked on its own below
    for (const n of inside.filter((x) => x.role === "accompaniment")) assert.ok(tones.has(pitchClass(n.pitch)), `${c.symbol}: ${n.pitch} at ${n.tick}`);
  }
});

test("counter-proof: a foreign note in the left hand is found by the same check", () => {
  const chord = parseChord("Fm");
  const tones = new Set(chord.names.map((x) => pitchClass(`${x}4`)));
  assert.equal(tones.has(pitchClass("A4")), false, "A natural is not in F minor");
  assert.equal(tones.has(pitchClass("Ab4")), true);
});

test("analysis exists on Original only, covers harmony, voice-leading, ornament, dynamics and rubato, is sorted and stays inside the song", () => {
  assert.equal(chopin.levels.beginner.analysis, undefined);
  assert.deepEqual([...new Set(chopinAnalysis.map((a) => a.kind))].sort(), ["dynamics", "harmony", "ornament", "rubato", "voice-leading"]);
  chopinAnalysis.forEach((a, i) => {
    assert.ok(a.tick >= 0 && (a.endTick ?? a.tick) <= chopin.lengthTicks, a.title);
    assert.ok(a.title.length <= 11, `${a.title}: callout titles stay short in 12/8`);
    if (i > 0) assert.ok(a.tick > chopinAnalysis[i - 1].tick, `${a.title} is out of order`);
  });
});

test("analysis roman numerals and functions agree with the chord track where an entry sits on a chord", () => {
  const withRoman = chopinAnalysis.filter((a) => a.roman);
  assert.ok(withRoman.length >= 8);
  for (const a of withRoman) {
    const c = chordAtC(a.tick);
    assert.equal(c.tick, a.tick, `${a.title} sits on a chord change`);
    assert.equal(a.roman, c.roman, a.title);
    assert.equal(a.function, c.function, a.title);
  }
  assert.notEqual({ ...withRoman[0], roman: "V" }.roman, chordAtC(withRoman[0].tick).roman, "counter-proof: a wrong numeral differs");
});

test("bar 1 beat 2 is a diminished seventh over the Eb pedal, as the entry says (read from the source data)", () => {
  const entry = chopinAnalysis.find((a) => a.tick === barStart(1) + 720);
  assert.equal(entry.kind, "harmony");
  assert.match(entry.text, /diminished seventh/);
  assert.match(entry.text, /B natural, written C flat/);
  const beat2 = barStart(1) + 720;
  assert.deepEqual(leftAt(beat2, "bass"), ["Eb3"]);
  assert.deepEqual([...new Set(leftAt(beat2 + 240).concat(leftAt(beat2 + 480)))].sort(), ["Ab3", "Ab4", "Cb4", "D4"]);
  const chordPcs = [11, 2, 5, 8]; // B D F Ab
  assert.deepEqual(chordPcs.map((pc, i) => (chordPcs[(i + 1) % 4] - pc + 12) % 12), [3, 3, 3, 3], "every step of B D F Ab is a minor third");
  assert.ok(chopinNotes.some((n) => n.hand === "R" && n.pitch === "F5" && n.tick === beat2 + 240), "the F comes from the melody");
});

test("the voice-leading claims are true of the notes: bass steps, half-step resolutions and the 4-3 suspension", () => {
  assert.deepEqual([barStart(1) + 1440, barStart(1) + 2160, barStart(2)].map(bassMidi), [39, 38, 36], "Eb2 D2 C2");
  assert.equal(bassMidi(barStart(3) + 720 + 720) - bassMidi(barStart(3) + 720), 1, "B2 up to C3 (G7/B to Cm)");
  assert.equal(bassMidi(barStart(4)) - bassMidi(barStart(3) + 2160), 1, "A2 up to Bb2 (the diminished seventh to Bb7)");
  assert.equal(bassMidi(barStart(4) + 720 * 2) - bassMidi(barStart(4) + 720), 5, "Bb1 up to Eb2 is a fourth");
  const beat1 = [barStart(4), barStart(4) + 240, barStart(4) + 480].flatMap((t) => leftAt(t, "accompaniment"));
  const beat2 = [barStart(4) + 720 + 240, barStart(4) + 720 + 480].flatMap((t) => leftAt(t, "accompaniment"));
  assert.ok(beat1.includes("Eb4") && !beat1.includes("D4"), "beat 1 holds the Eb and no D");
  assert.ok(beat2.includes("D4") && !beat2.includes("Eb4"), "beat 2 has the D where the Eb was");
  assert.equal(midiOf("Eb4") - midiOf("D4"), 1);
});

test("the secondary dominant of bar 2 is a C7 with an E natural resolving through to F minor", () => {
  const e = chopinAnalysis.find((a) => a.tick === barStart(2));
  assert.equal(e.roman, "V7/ii");
  assert.ok(leftAt(barStart(2) + 240).includes("E4"));
  assert.equal(chordAtC(barStart(2)).symbol, "C7");
  assert.equal(chordAtC(barStart(2) + 3 * 720).symbol, "Fm", "F minor arrives on beat 4");
});

test("ornament entries sit on the right bar and note: the turn on the C5 of bar 2, the run of sixteenths in bar 4", () => {
  const barOfTick = (t) => barBeatOf(t, chopin.meter, chopin.pickupTicks, chopin.tempo.beatUnit).bar;
  const turn = chopinAnalysis.find((a) => a.title === "Turn");
  assert.equal(barOfTick(turn.tick), 2);
  assert.equal(chopinNotes.find((n) => n.tick === turn.tick && n.hand === "R").ornament, "turn");
  const run = chopinAnalysis.find((a) => a.title === "Fioritura");
  assert.equal(barOfTick(run.tick), 4);
  const small = chopinNotes.filter((n) => n.hand === "R" && !n.rest && n.tick >= run.tick && n.tick < run.endTick && n.dur === 120);
  assert.deepEqual(small.map((n) => n.pitch), ["Bb5", "Ab5", "G5", "Ab5", "C5", "D5"]);
  assert.deepEqual(lessonO.ornaments.map((o) => [barOfTick(o.tick), o.name]), [[2, "Chromatic turn"], [4, "Fioritura"]]);
  assert.equal(lessonB.ornaments, undefined, "Beginner has no ornaments to explain");
});

test("every hand position of both lessons names a note its level really plays at that tick with that hand", () => {
  for (const [id, l] of [["beginner", lessonB], ["original", lessonO]]) {
    assert.ok(l.handPositions.length >= 6, id);
    for (const h of l.handPositions) assert.ok(playsAtLevel(id, h.tick, h.hand, h.anchor), `${id} ${h.hand} ${h.anchor} at ${h.tick}`);
  }
  assert.equal(playsAtLevel("beginner", 240, "R", "G4"), false, "counter-proof: a note the level does not play");
});

test("the Beginner lesson teaches four big beats, explains each simplification and the practice tools", () => {
  assert.match(lessonB.summary, /E-flat major/);
  assert.match(lessonB.summary, /four big beats/);
  assert.match(lessonB.summary, /one, two, three, four/);
  for (const re of [/tied G is one long note/, /turn sign of bar 2 is left out/, /fast run of bar 4 is cut/, /bass note and then the last chord of each beat/, /editorial/]) assert.match(lessonB.arrangementNote, re);
  const plan = lessonB.practicePlan.join(" ");
  for (const re of [/Mute left/, /Mute right/, /Metronome/, /four times per bar/, /Slow/, /Set A here/, /Loop a section/, /Ramp/]) assert.match(plan, re);
  assert.match(lessonB.handPositions.map((h) => h.text).join(" "), /jump/);
  assert.ok(lessonB.interpretation.rubato.length > 20 && lessonB.interpretation.dynamics.length > 20);
});

test("the Original lesson carries the attribution, the pedal and the interpretation guidance", () => {
  for (const re of [/Mutopia-2014\/12\/18-1590/, /Renato Biolcati Rinaldi/, /CC BY-SA 3\.0/, /1881 G\. Schirmer/, /pickup and bars 1 to 4 only/]) assert.match(lessonO.arrangementNote, re);
  assert.match(lessonO.practicePlan.join(" "), /pedal/i);
  assert.match(lessonO.interpretation.rubato, /espress\. dolce/);
  assert.match(lessonO.interpretation.dynamics, /hairpin of bar 2/);
  assert.match(lessonO.interpretation.dynamics, /marked f/);
});
