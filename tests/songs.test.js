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

// ---- Chopin Nocturne Op. 9 No. 2: transcribed from the Mutopia LilyPond source ----
// The tests below hold for every state of the file between the opening (pickup and four bars) and the whole piece: they
// measure `chopin.lengthTicks` instead of assuming a number of bars, and the MIDI fixture always covers the whole piece.
const chopin = read("chopin-nocturne-op9-no2.json");
const chopinNotes = chopin.levels.original.notes;
const onsets = JSON.parse(readFileSync(new URL("./fixtures/mutopia-chopin-op9n2-onsets.json", import.meta.url), "utf8"));
const PICKUP = 240;
const BAR = 2880;
const BARS = (chopin.lengthTicks - PICKUP) / BAR; // bars transcribed, counted the way the app counts them
// The cadenza of printed bar 32 lasts four bars of time in the MIDI, so the app counts bars 32 to 35 for it and the
// printed bars 33 and 34 are bars 36 and 37 here.
const CADENZA = [32, 35];
const printedBar = (bar) => (bar < CADENZA[0] ? bar : bar <= CADENZA[1] ? CADENZA[0] : bar - (CADENZA[1] - CADENZA[0]));
const barStart = (bar) => (bar === 0 ? 0 : PICKUP + (bar - 1) * BAR);
const midiOf = (pitch) => parsePitch(pitch).midi;
/** The part of an onset string of the fixture that lies inside the transcribed length. */
const insideSong = (text) => text.split(" ").filter((x) => Number(x.split(":")[0]) < chopin.lengthTicks).join(" ");
// First event of a hand at the start of a bar: the lowest pitch, or "rest".
const firstOf = (notes, hand, bar) => {
  const at = notes.filter((n) => n.hand === hand && n.tick === barStart(bar));
  return at.length === 0 ? undefined : at[0].rest ? "rest" : at.map((n) => n.pitch).sort((a, b) => midiOf(a) - midiOf(b))[0];
};
const bassOnBeat = (notes, bar, beat) => notes.find((n) => n.hand === "L" && n.role === "bass" && n.tick === barStart(bar) + (beat - 1) * 720)?.pitch;
// Onsets as "tick:midi+midi" strings per hand, ties collapsed (a tied continuation has no onset).
function onsetsOf(notes, hand) {
  const heads = notes.filter((n) => n.hand === hand && !n.rest && !n.grace);
  const continuation = (n) => heads.some((h) => h.tie === true && h.pitch === n.pitch && h.tick + h.dur === n.tick);
  const byTick = new Map();
  for (const n of heads) if (!continuation(n)) (byTick.get(n.tick) ?? byTick.set(n.tick, []).get(n.tick)).push(midiOf(n.pitch));
  return [...byTick].sort((a, b) => a[0] - b[0]).map(([t, m]) => `${t}:${m.sort((a, b) => a - b).join("+")}`).join(" ");
}

test("Chopin validates, is transcribed, and is strict about its bars while it has one voice per hand", () => {
  const r = validateSong(chopin);
  assert.deepEqual(r.errors, []);
  assert.equal(chopin.levels.original.transcribed, true);
  // strictBars asks for every bar of every used voice to be covered: a second voice that exists in only a few bars
  // (the left hand of the cadenza bars and of the last printed bars) cannot satisfy it, so the level turns it off then.
  assert.equal(chopin.levels.original.strictBars, !chopinNotes.some((n) => n.voice === 2));
  assert.equal(chopin.levels.original.notation, "engraved");
  assert.equal(chopin.defaultLevel, "original");
  assert.equal(chopin.contentPolicy, "open");
});

test("Chopin timing: E-flat major, 12/8 counted in dotted quarters at 44 (the printed eighth = 132), a one-eighth pickup and whole bars", () => {
  assert.deepEqual(chopin.key, { tonic: "Eb", mode: "major" });
  assert.deepEqual(chopin.meter, { num: 12, den: 8 });
  assert.equal(chopin.tempo.beatUnit, "dotted-quarter");
  assert.equal(chopin.tempo.bpm * 3, 132);
  assert.equal(chopin.pickupTicks, PICKUP);
  assert.equal(chopin.lengthTicks, PICKUP + BARS * BAR);
  assert.ok(Number.isInteger(BARS) && BARS >= 4 && BARS <= 37, `${BARS} bars`);
});

test("the printed bar numbers map onto the app's bars: the cadenza of bar 32 takes bars 32 to 35, so printed 33 and 34 are 36 and 37", () => {
  assert.deepEqual([1, 31, 32, 35, 36, 37].map(printedBar), [1, 31, 32, 32, 33, 34]);
});

test("the Mutopia source entry names the transcribed bars and records URL, ID, license, SHA-256, date and maintainer", () => {
  const s = chopin.sources.find((x) => x.kind === "public-domain-score");
  assert.match(s.what, /pickup/i);
  assert.match(s.what, new RegExp(`bars 1 to ${printedBar(BARS)}\\b`));
  const mid = chopin.sources.find((x) => x.kind === "reference" && /\.mid$/.test(x.url));
  const counts = [insideSong(onsets.upper), insideSong(onsets.lower)].map((t) => t.split(" ").length);
  assert.match(mid.what, new RegExp(`\\(${counts[0]} right-hand and ${counts[1]} left-hand onsets`), "the MIDI entry counts the onsets it pinned");
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

test("every onset of both hands, over the whole transcribed length, equals the onsets of the Mutopia MIDI file", () => {
  assert.equal(onsetsOf(chopinNotes, "R"), insideSong(onsets.upper));
  assert.equal(onsetsOf(chopinNotes, "L"), insideSong(onsets.lower));
  assert.ok(insideSong(onsets.upper).split(" ").length >= 30 && insideSong(onsets.lower).split(" ").length >= 48, "at least the opening is pinned");
});

test("the fixture pins the whole piece: 406 right-hand and 396 left-hand onset groups, and 15 grace notes before 8 main notes", () => {
  assert.equal(onsets.upper.split(" ").length, 406);
  assert.equal(onsets.lower.split(" ").length, 396);
  assert.equal(onsets.upperGraces.split(" ").length, 8);
  assert.equal(onsets.upperGraces.split(" ").flatMap((g) => g.split(":")[1].split(",")).length, 15);
  assert.equal(onsets.lowerGraces, undefined, "the left hand has no grace note");
  assert.ok(Number(onsets.upper.split(" ").at(-1).split(":")[0]) < PICKUP + 37 * BAR, "the last onset is inside the piece (37 bars of the app's count)");
});

// Grace notes: the MIDI gives each one LilyPond's own tiny duration, so only their pitches and the main note they lead to
// are pinned. The data writes each as a 32nd (60 ticks) so that the last one ends exactly where its main note starts.
function gracesOf(notes) {
  const graces = notes.filter((n) => n.hand === "R" && n.grace).sort((a, b) => a.tick - b.tick);
  const groups = [];
  for (const g of graces) {
    const last = groups.at(-1);
    if (last && last.end === g.tick) {
      last.pitches.push(midiOf(g.pitch));
      last.end = g.tick + g.dur;
    } else groups.push({ end: g.tick + g.dur, pitches: [midiOf(g.pitch)] });
  }
  return groups.map((g) => `${g.end}:${g.pitches.join(",")}`).join(" ");
}

test("the grace notes are the ones of the MIDI file, in order, each group ending where its main right-hand note starts", () => {
  const expected = insideSong(onsets.upperGraces ?? "");
  assert.equal(gracesOf(chopinNotes), expected);
  for (const g of expected === "" ? [] : expected.split(" ")) {
    const main = Number(g.split(":")[0]);
    assert.ok(chopinNotes.some((n) => n.hand === "R" && !n.grace && !n.rest && n.tick === main), `a main note follows the grace notes at ${main}`);
  }
  assert.ok(chopinNotes.filter((n) => n.grace).every((n) => n.dur === 60 && n.role === "ornament"));
});

test("counter-proof: a wrong grace pitch, a missing grace note and a grace note moved off its main note each break the grace comparison", () => {
  const grace = chopinNotes.find((n) => n.grace);
  if (grace === undefined) return assert.equal(gracesOf(chopinNotes), "", "the opening has no grace note");
  const wrong = structuredClone(chopinNotes);
  wrong.find((n) => n.grace).pitch = "A4";
  assert.notEqual(gracesOf(wrong), insideSong(onsets.upperGraces));
  assert.notEqual(gracesOf(chopinNotes.filter((n) => n !== grace)), insideSong(onsets.upperGraces));
  const moved = structuredClone(chopinNotes);
  moved.find((n) => n.grace).tick -= 120;
  assert.notEqual(gracesOf(moved), insideSong(onsets.upperGraces));
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

test("every finger of the Original is a source finger from 1 to 5; the left hand has none outside the cadenza, where the source prints them", () => {
  const fingered = chopinNotes.filter((n) => n.finger !== undefined);
  assert.ok(fingered.every((n) => n.fingeringSource === "source" && n.finger >= 1 && n.finger <= 5));
  assert.ok(chopinNotes.filter((n) => !n.rest && n.fingeringSource === undefined).every((n) => n.finger === undefined), "a finger always says where it comes from");
  const inCadenza = (n) => n.tick >= barStart(CADENZA[0]) && n.tick < barStart(CADENZA[1] + 1);
  assert.ok(chopinNotes.filter((n) => n.hand === "L" && n.finger !== undefined).every(inCadenza));
  assert.equal(chopin.confidence.find((c) => c.scope === "fingering").level, "medium");
});

test("the opening has 25 right-hand fingers and, as its signs, the bar 2 turn and the fioritura of the bar 4 run; every ornament is a known kind", () => {
  const opening = chopinNotes.filter((n) => n.tick < barStart(5));
  assert.equal(opening.filter((n) => n.hand === "R" && !n.rest && n.finger !== undefined).length, 25);
  const orn = opening.filter((n) => n.ornament);
  assert.deepEqual(orn.filter((n) => n.ornament !== "fioritura").map((n) => [n.ornament, n.pitch, n.tick]), [["turn", "C5", barStart(2) + 480]]);
  assert.ok(chopinNotes.filter((n) => n.ornament).every((n) => ["turn", "trill", "mordent", "inverted-mordent", "fioritura"].includes(n.ornament)));
  // a fioritura sign covers the small notes that follow it, which are marked as ornament notes
  for (const f of orn.filter((n) => n.ornament === "fioritura")) {
    assert.deepEqual([f.pitch, f.tick], ["Bb5", barStart(4) + 720]);
    const small = opening.filter((n) => n.hand === "R" && !n.rest && n.tick > f.tick && n.tick < barStart(4) + 1440);
    assert.equal(small.length, 5);
    assert.ok(small.every((n) => n.role === "ornament"));
  }
});

test("the pedal follows the source: one range per beat through beat 2 of bar 4, then beats 3 and 4 together with beat 1 of bar 5", () => {
  const pedal = chopin.levels.original.pedal;
  assert.ok(pedal.length >= 15);
  assert.ok(pedal.slice(0, 14).every((p) => p.endTick - p.startTick === 720));
  assert.deepEqual(pedal[14], { startTick: barStart(4) + 1440, endTick: Math.min(chopin.lengthTicks, barStart(5) + 720) });
});

test("every pedal range lies inside the song, follows the one before it and starts on a left-hand note", () => {
  const pedal = chopin.levels.original.pedal;
  pedal.forEach((p, i) => {
    assert.ok(p.startTick >= 0 && p.endTick > p.startTick && p.endTick <= chopin.lengthTicks, `range ${i}`);
    if (i > 0) assert.ok(p.startTick >= pedal[i - 1].endTick, `range ${i} overlaps the one before`);
    assert.ok(chopinNotes.some((n) => n.hand === "L" && !n.rest && n.tick === p.startTick), `a left-hand note starts range ${i} at ${p.startTick}`);
  });
  const bad = { startTick: 241, endTick: 960 };
  assert.ok(!chopinNotes.some((n) => n.hand === "L" && !n.rest && n.tick === bad.startTick), "counter-proof: a range that starts between notes is found");
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
const beatTicks = [...Array(BARS * 4).keys()].map((i) => PICKUP + i * 720);
const beatName = (tick) => `${Math.floor((tick - PICKUP) / BAR) + 1}:${((tick - PICKUP) % BAR) / 720 + 1}`;
// The beats where the Beginner left hand is not "one bass eighth, then the last chord held": bars 12 and 20 (the chromatic
// line of beats 3 and 4), beat 2 of bars 29 and 30 (one chord instead of five), and the cadenza and the end (bars 32 to 37).
const IRREGULAR_BEATS = ["12:3", "12:4", "20:3", "20:4", "29:2", "30:2", ...[32, 33, 34, 35, 36, 37].flatMap((b) => [1, 2, 3, 4].map((k) => `${b}:${k}`))];
// The Beginner right-hand notes that are not at an Original onset: a note moved to the start of a held beat so that no
// note is shorter than an eighth. Pinned so that a changed melody shows up as a difference.
const MOVED_NOTES = ["10080:D5", "12960:G5", "14160:F5", "21600:D5", "27360:Eb5", "44640:Eb5", "49680:Eb5", "50400:Eb5", "66720:D6", "67200:Bb5", "67680:D5", "77040:Eb5", "77760:C6", "78720:Ab5", "78960:G5", "79200:F5", "93360:Bb6", "93840:C7", "94320:A6", "95280:Bb6", "95760:C7", "96240:A6", "97200:Bb6", "97680:C7", "98160:A6", "99360:Bb6", "99600:G6"];
const movedNotes = (notes) => {
  const original = new Set(pairs(chopinNotes, "R"));
  return pairs(notes, "R").filter((p) => !original.has(p) && Number(p.split(":")[0]) < chopin.lengthTicks);
};

test("Chopin Beginner is labelled and strict, keeps E-flat major, and has no ornament, tie, grace or note shorter than an eighth", () => {
  assert.equal(beginner.notation, "labelled");
  assert.equal(beginner.strictBars, true);
  assert.equal(beginner.transcribed, undefined, "it is a simplification, not a transcription");
  assert.equal(beginner.analysis, undefined, "Beginner shows no analysis");
  assert.ok(beginner.notes.every((n) => n.ornament === undefined && n.tie === undefined && n.grace === undefined && n.voice === undefined && n.dur >= 240));
  assert.deepEqual(Object.keys(chopin.levels), ["beginner", "original"]);
  assert.deepEqual(chopin.key, { tonic: "Eb", mode: "major" });
});

test("the Beginner melody keeps the Original melody: every note is at an Original onset with an Original pitch, except the listed moved notes", () => {
  assert.deepEqual(movedNotes(beginner.notes), MOVED_NOTES.filter((p) => Number(p.split(":")[0]) < chopin.lengthTicks));
  const tied = chopinNotes.find((n) => n.tie);
  assert.equal(beginner.notes.find((n) => n.tick === tied.tick && n.pitch === tied.pitch).dur, 960, "the tied G is one note of both lengths");
  // nothing is invented: each Beginner right-hand pitch is played by the Original right hand in the same bar
  for (const n of beginner.notes.filter((x) => x.hand === "R" && !x.rest)) {
    const bar = Math.floor((n.tick - PICKUP) / BAR);
    const played = chopinNotes.some((o) => o.hand === "R" && !o.rest && o.pitch === n.pitch && Math.floor((o.tick - PICKUP) / BAR) === bar);
    assert.ok(played, `${n.tick} ${n.pitch} is not in the Original bar`);
  }
});

test("counter-proof: a changed melody note shows up as an extra pair", () => {
  const bad = structuredClone(beginner.notes);
  bad.find((n) => n.hand === "R" && n.pitch === "C6").pitch = "C5";
  assert.equal(movedNotes(bad).length, movedNotes(beginner.notes).length + 1);
});

// A beat of the Original left hand is regular when it is one bass note, then a chord on the second eighth and another on the third.
const leftOf = (notes) => notes.filter((n) => n.hand === "L" && !n.rest && (n.voice ?? 1) === 1);
const regularBeat = (notes, t) => {
  const left = leftOf(notes);
  return left.filter((n) => n.tick === t).length === 1 && left.some((n) => n.tick === t && n.role === "bass") && left.some((n) => n.tick === t + 240 && n.role === "accompaniment") && left.some((n) => n.tick === t + 480 && n.role === "accompaniment");
};

test("the Beginner left hand is one bass eighth then the beat's last chord held for the rest of the beat, on every regular beat", () => {
  let regular = 0;
  for (const t of beatTicks.filter((x) => !IRREGULAR_BEATS.includes(beatName(x)))) {
    assert.ok(regularBeat(chopinNotes, t), `beat ${beatName(t)} of the Original is bass, chord, chord`);
    const bass = beginner.notes.filter((n) => n.hand === "L" && n.role === "bass" && n.tick === t);
    const chord = beginner.notes.filter((n) => n.hand === "L" && n.role === "accompaniment" && n.tick === t + 240);
    assert.equal(bass.length, 1, `beat ${beatName(t)} bass`);
    assert.equal(bass[0].dur, 240);
    assert.equal(bass[0].pitch, chopinNotes.find((n) => n.hand === "L" && n.role === "bass" && n.tick === t).pitch, `beat ${beatName(t)} bass is the Original bass`);
    assert.ok(chord.length >= 2 && chord.every((n) => n.dur === 480), `beat ${beatName(t)} chord`);
    const last = leftOf(chopinNotes).filter((n) => n.role === "accompaniment" && n.tick === t + 480).map((n) => n.pitch).sort();
    assert.deepEqual(chord.map((n) => n.pitch).sort(), last, `beat ${beatName(t)} chord is the last Original chord of the beat`);
    regular += 1;
  }
  assert.ok(regular >= 16, "at least the opening's 16 beats follow the rule");
});

test("the beats that do not follow the rule are exactly the listed ones, and the listed beats of bars 12 to 30 really differ in the Original", () => {
  for (const name of ["12:3", "12:4", "20:3", "20:4", "29:2", "30:2"]) {
    const t = beatTicks.find((x) => beatName(x) === name);
    if (t !== undefined) assert.equal(regularBeat(chopinNotes, t), false, `beat ${name} of the Original is not bass, chord, chord`);
  }
  assert.equal(regularBeat(chopinNotes, beatTicks[0]), true, "counter-proof: a regular beat is recognized");
  // every beat of the Beginner left hand is covered: its notes and rests fill each bar
  for (let bar = 1; bar <= BARS; bar += 1) {
    const covered = beginner.notes.filter((n) => n.hand === "L" && n.tick >= barStart(bar) && n.tick < barStart(bar + 1));
    const spans = new Map(covered.map((n) => [`${n.tick}:${n.dur}`, n.dur]));
    assert.equal([...spans.values()].reduce((a, d) => a + d, 0), BAR, `bar ${bar} left hand`);
  }
});

test("Beginner fingering: source fingers equal the Original ones; the editorial right-hand fingers are on notes the source does not finger; every left-hand note has one", () => {
  const right = beginner.notes.filter((n) => n.hand === "R" && !n.rest);
  for (const n of right.filter((x) => x.fingeringSource === "source")) {
    assert.equal(chopinNotes.find((o) => o.hand === "R" && o.tick === n.tick && o.pitch === n.pitch).finger, n.finger, `${n.tick} ${n.pitch}`);
  }
  for (const n of right.filter((x) => x.fingeringSource === "editorial")) {
    assert.ok(!chopinNotes.some((o) => o.hand === "R" && o.tick === n.tick && o.pitch === n.pitch && o.finger !== undefined), `${n.tick} ${n.pitch} has a source finger`);
  }
  // the opening keeps the three editorial fingers chosen for it: C5 (bar 2), D5 and Eb5 (bar 4)
  assert.deepEqual(right.filter((n) => n.fingeringSource === "editorial" && n.tick < barStart(5)).map((n) => `${n.tick}:${n.pitch}:${n.finger}`), ["3600:C5:1", "10080:D5:1", "10320:Eb5:2"]);
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

// Spans whose left hand holds notes that are not tones of the chord: the 4-3 suspension of a dominant seventh (an Eb4 over
// the Bb7 on its first beat, in bars 4, 8, 16, 24, 28 and 31) and the chromatic left-hand line of beats 3 and 4 of bars 12 and 20.
const SUSPENSIONS = [4, 8, 16, 24, 28, 31].map((b) => barStart(b));
const CHROMATIC_LINES = [12, 20].map((b) => barStart(b) + 1440);

test("every left-hand note of each chord span is a tone of that chord and the bass is its bass, except the listed suspensions and chromatic lines", () => {
  for (const c of chopinChords) {
    const chord = parseChord(c.symbol);
    const tones = new Set(chord.names.map((x) => pitchClass(`${x}4`)));
    const inside = chopinNotes.filter((n) => n.hand === "L" && !n.rest && n.tick >= c.tick && n.tick < c.tick + c.dur);
    const bass = inside.filter((n) => n.role === "bass");
    for (const n of bass) {
      const expected = pitchClass(`${chord.bass ?? chord.root}4`);
      if (n.tick === c.tick || chord.bass === undefined) assert.equal(pitchClass(n.pitch), expected, `${c.symbol} bass at ${n.tick}`);
    }
    if (SUSPENSIONS.includes(c.tick) || CHROMATIC_LINES.includes(c.tick)) continue; // checked on their own below
    for (const n of inside.filter((x) => x.role === "accompaniment")) assert.ok(tones.has(pitchClass(n.pitch)), `${c.symbol}: ${n.pitch} at ${n.tick}`);
  }
});

test("the exempt spans are what they say: an Eb4 held over a Bb7, and a chromatic line A, D sharp, G sharp under a Bb chord", () => {
  for (const t of SUSPENSIONS.filter((x) => x < chopin.lengthTicks)) {
    assert.equal(chordAtC(t).symbol, "Bb7", `bar of ${t}`);
    assert.ok([t, t + 240, t + 480].flatMap((x) => leftAt(x, "accompaniment")).includes("Eb4"), `the suspended Eb4 sounds at ${t}`);
    assert.ok(!parseChord("Bb7").names.includes("Eb"), "an Eb is not a tone of Bb7");
  }
  for (const t of CHROMATIC_LINES.filter((x) => x < chopin.lengthTicks)) {
    assert.equal(chordAtC(t).symbol, "Bb");
    assert.deepEqual([t + 240, t + 480, t + 720].flatMap((x) => leftAt(x, "accompaniment")).slice(0, 3), ["A3", "D#4", "G#3"]);
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
  const kinds = new Set(chopinAnalysis.map((a) => a.kind));
  for (const k of ["dynamics", "harmony", "ornament", "rubato", "voice-leading"]) assert.ok(kinds.has(k), k);
  assert.ok([...kinds].every((k) => ["dynamics", "form", "harmony", "ornament", "rubato", "voice-leading"].includes(k)));
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
  assert.deepEqual(lessonO.ornaments.slice(0, 2).map((o) => [barOfTick(o.tick), o.name]), [[2, "Chromatic turn"], [4, "Fioritura"]]);
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
  for (const re of [/Mutopia-2014\/12\/18-1590/, /Renato Biolcati Rinaldi/, /CC BY-SA 3\.0/, /1881 G\. Schirmer/, new RegExp(`pickup and bars 1 to ${printedBar(BARS)}\\b`)]) assert.match(lessonO.arrangementNote, re);
  assert.match(lessonO.practicePlan.join(" "), /pedal/i);
  assert.match(lessonO.interpretation.rubato, /espress\. dolce/);
  assert.match(lessonO.interpretation.dynamics, /hairpin of bar 2/);
  assert.match(lessonO.interpretation.dynamics, /marked f/);
});

// ---- Chopin: sections, forms and the claims of the lessons and the analysis, read from the data bar by bar ----
// A test about bar N runs once the file reaches that bar (`has(N)`), so it holds for every state between the opening and the whole piece.
const has = (bar) => BARS >= bar;
const T = (bar, rel = 0) => barStart(bar) + rel;
const rightNotes = (from, to, filter = () => true) => chopinNotes.filter((n) => n.hand === "R" && !n.rest && !n.grace && n.tick >= from && n.tick < to && filter(n));
const names = (notes) => notes.map((n) => n.pitch);
const chordsFromBar = (bar, bars) => chopinChords.filter((c) => c.tick >= T(bar) && c.tick < T(bar + bars)).map((c) => [c.tick - T(bar), c.dur, c.symbol]);

test("the sections tile the song from tick 0 to its end, on bar lines, with distinct ids, and the first two cover the opening and the second phrase", () => {
  const s = chopin.sections;
  assert.equal(s[0].startTick, 0);
  assert.equal(s.at(-1).endTick, chopin.lengthTicks);
  s.forEach((x, i) => {
    if (i > 0) assert.equal(x.startTick, s[i - 1].endTick, `${x.id} starts where ${s[i - 1].id} ends`);
    assert.ok(x.startTick === 0 || (x.startTick - PICKUP) % BAR === 0, `${x.id} starts on a bar line`);
  });
  assert.equal(new Set(s.map((x) => x.id)).size, s.length);
  assert.deepEqual([s[0].id, s[0].endTick], ["opening", T(5)]);
  if (has(8)) assert.deepEqual([s[1].id, s[1].startTick, s[1].endTick], ["second", T(5), T(9)]);
  assert.ok(new Set(s.map((x) => x.name)).size === s.length, "every section has its own name");
});

test("the whole piece has nine sections: A, A second phrase, the B-flat episode, the return, the episode again, the second return, the coda, the cadenza and the close", { skip: !has(37) }, () => {
  assert.deepEqual(chopin.sections.map((x) => x.id), ["opening", "second", "episode", "return", "episode-again", "return-again", "coda", "cadenza", "close"]);
  assert.deepEqual(chopin.sections.map((x) => [x.startTick, x.endTick]).filter((_, i) => [2, 6, 7, 8].includes(i)), [[T(9), T(11)], [T(25), T(32)], [T(32), T(36)], [T(36), T(38)]]);
});

test("the harmony of bars 5 to 8 is the harmony of bars 1 to 4, and bars 13 to 16 and 21 to 24 repeat it, except beat 2 of bars 13 and 21", { skip: !has(8) }, () => {
  assert.deepEqual(chordsFromBar(5, 4), chordsFromBar(1, 4));
  if (has(16)) {
    const first = chordsFromBar(1, 4);
    const second = chordsFromBar(13, 4);
    assert.equal(second.length, first.length);
    const different = second.filter((c, i) => c[2] !== first[i][2]);
    assert.deepEqual(different.map((c) => c[2]), ["Bb7/Eb"], "bar 13 holds a B flat 7 over the E flat bass where bar 1 has the diminished seventh");
  }
  if (has(24)) assert.deepEqual(chordsFromBar(21, 4), chordsFromBar(13, 4));
  assert.notDeepEqual(chordsFromBar(9, 2), chordsFromBar(1, 2), "counter-proof: the episode is not the opening");
});

test("the B-flat major episode of bars 9 and 10 returns as bars 17 and 18 over the same chords, and bars 11 and 12 as bars 19 and 20", { skip: !has(18) }, () => {
  assert.deepEqual(chordsFromBar(17, 2), chordsFromBar(9, 2));
  if (has(20)) assert.deepEqual(chordsFromBar(19, 2).map((c) => c[2]), chordsFromBar(11, 2).map((c) => c[2]), "the chain of chords of bars 11 and 12 is the same, bar 19 beat 3 only adds the A of F7");
});

test("bar 9 is B flat major: a B flat chord over a B flat bass, the melody F, G, F on the fifth and sixth degrees, then F over A", { skip: !has(10) }, () => {
  assert.equal(chordAtC(T(9)).symbol, "Bb");
  assert.deepEqual(leftAt(T(9), "bass"), ["Bb2"]);
  assert.deepEqual([T(9) + 240, T(9) + 480].flatMap((t) => leftAt(t, "accompaniment")).map((p) => p.replace(/\d/, "")).sort(), ["Bb", "D", "D", "F", "F"]);
  assert.deepEqual(names(rightNotes(T(9), T(9) + 1440)), ["F5", "G5", "F5"]);
  assert.equal(chordAtC(T(9, 1440)).symbol, "F/A");
  assert.deepEqual(leftAt(T(9, 1440), "bass"), ["A2"]);
});

test("bar 10: the major IV (Ab, C, Eb) becomes minor (Ab, Cb, Eb) and then the music resolves to E flat; the bass runs Ab2, Ab1, Eb2", { skip: !has(10) }, () => {
  const pcs = (t) => [...new Set([t + 240, t + 480].flatMap((x) => leftAt(x, "accompaniment")).map((p) => pitchClass(p)))].sort((a, b) => a - b);
  assert.deepEqual(pcs(T(10)), [0, 3, 8], "Ab major: C, Eb, Ab");
  assert.deepEqual(pcs(T(10, 720)), [3, 8, 11], "Ab minor: Eb, Ab, B (written Cb)");
  assert.deepEqual([T(10), T(10, 720), T(10, 1440)].map((t) => leftAt(t, "bass")[0]), ["Ab2", "Ab1", "Eb2"]);
  assert.deepEqual([chordAtC(T(10)).symbol, chordAtC(T(10, 720)).symbol, chordAtC(T(10, 1440)).symbol], ["Ab", "Abm", "Eb"]);
});

test("bars 11 and 12 climb by half steps in the bass: E, E, F, G, then C and F, under a melody that starts B flat 5, A5, G5", { skip: !has(12) }, () => {
  assert.deepEqual([T(11), T(11, 720), T(11, 1440), T(11, 2160), T(12), T(12, 720)].map(bassMidi), [40, 40, 41, 43, 36, 41]);
  assert.deepEqual(names(rightNotes(T(11), T(11, 1440))), ["Bb5", "A5", "G5"]);
  assert.deepEqual(rightNotes(T(11, 1440), T(11, 2880)).map((n) => n.pitch).sort(), ["A4", "Bb4", "D5", "F5"]);
  assert.deepEqual([T(11), T(11, 720)].map((t) => chordAtC(t).symbol), ["Edim7", "C7/E"]);
});

test("the inverted mordents of bar 5, the trills of bars 7, 15 and 23 and the trill of bar 21 are signs on the notes the analysis names", { skip: !has(8) }, () => {
  const sign = (tick) => chopinNotes.find((n) => n.hand === "R" && n.tick === tick && n.ornament)?.ornament;
  assert.deepEqual([sign(T(5, 960)), sign(T(5, 2400))], ["inverted-mordent", "inverted-mordent"]);
  assert.equal(chopinNotes.find((n) => n.tick === T(5, 960) && n.hand === "R").pitch, "F5");
  assert.equal(chopinNotes.find((n) => n.tick === T(5, 2400) && n.hand === "R").pitch, "Eb5");
  assert.equal(sign(T(7)), "trill");
  assert.equal(chopinNotes.find((n) => n.tick === T(7) && n.hand === "R").pitch, "F5");
  // the ending of the trill is written out: the small notes E5 and F5 end where the G5 starts
  const graces = chopinNotes.filter((n) => n.hand === "R" && n.grace && n.tick >= T(7) && n.tick < T(8));
  assert.deepEqual(names(graces), ["E5", "F5"]);
  assert.equal(graces.at(-1).tick + graces.at(-1).dur, T(7, 720));
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(7, 720) && !n.grace).pitch, "G5");
  if (has(24)) assert.deepEqual([T(15), T(23)].map(sign), ["trill", "trill"]);
  if (has(22)) assert.deepEqual([sign(T(13, 2400)), sign(T(21, 2400))], ["inverted-mordent", "trill"]);
});

test("the run of bar 6 rises from G5 to D flat 6 in twelve sixteenths, and its accents sit on the Db5, F5 and Ab5 the analysis names", { skip: !has(6) }, () => {
  const run = rightNotes(T(6), T(6, 1440));
  assert.deepEqual(names(run), ["G5", "B4", "C5", "Db5", "C5", "F5", "E5", "Ab5", "G5", "Db6", "C6", "G5"]);
  assert.ok(run.every((n) => n.dur === 120));
  assert.equal(Math.max(...run.map((n) => midiOf(n.pitch))), midiOf("Db6"));
  assert.deepEqual(chopinAnalysis.find((a) => a.tick === T(6)).title, "Rising run");
});

test("the fioritura entries name the notes that are really there: bar 8 (Bb5 Ab5 G5 Ab5 C5 D5), bar 13, bar 16 and the grace notes", { skip: !has(8) }, () => {
  const run = (bar, from, to) => names(rightNotes(T(bar, from), T(bar, to), (n) => n.dur <= 180));
  assert.deepEqual(run(8, 720, 1440), ["Bb5", "Ab5", "G5", "Ab5", "C5", "D5"]);
  const grace8 = chopinNotes.find((n) => n.grace && n.tick >= T(8) && n.tick < T(9));
  assert.deepEqual([grace8.pitch, grace8.finger, grace8.tick + grace8.dur], ["Ab5", 4, T(8, 1200)], "the slashed A flat leads into the C5 with finger 4");
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(8, 1200) && !n.grace).pitch, "C5");
  if (has(13)) {
    assert.deepEqual(run(13, 480, 1440), ["A4", "Bb4", "Cb5", "Bb4", "C#5", "D5", "G5", "F5"]);
    assert.deepEqual(names(chopinNotes.filter((n) => n.grace && n.tick >= T(13) - 200 && n.tick < T(13))), ["G4", "Bb4", "Eb5"]);
  }
  if (has(16)) assert.deepEqual(run(16, 720, 1440), ["C6", "B5", "Bb5", "A5", "Ab5", "F5", "D5", "Cb5", "Bb4", "D5", "G5", "F5", "Eb5"]);
  // a fioritura sign is on the first note and the notes after it are ornament notes
  for (const f of chopinNotes.filter((n) => n.ornament === "fioritura")) {
    assert.equal(f.hand, "R");
    assert.equal(f.role, "ornament");
  }
});

test("bar 16 and bar 24 end a flourish with a triplet G5, F5, E flat 5 (three notes in the space of two)", { skip: !has(16) }, () => {
  for (const bar of [16, 24].filter(has)) {
    const triplet = rightNotes(T(bar, 1320), T(bar, 1440));
    assert.deepEqual(names(triplet), ["G5", "F5", "Eb5"]);
    assert.ok(triplet.every((n) => n.tuplet?.n === 3 && n.tuplet.inSpaceOf === 2 && n.dur === 40));
  }
  assert.deepEqual(names(rightNotes(T(16, 1440), T(17))).slice(0, 1), ["Eb5"]);
});

test("bar 18 squeezes four E flats into the time of three eighths (4 in the space of 3) and bar 29 eight sixteenths into the time of six", { skip: !has(18) }, () => {
  const four = rightNotes(T(18), T(18, 720));
  assert.deepEqual(names(four), ["Eb5", "Eb5", "Eb5", "Eb5"]);
  assert.ok(four.every((n) => n.tuplet?.n === 4 && n.tuplet.inSpaceOf === 3 && n.dur === 180));
  assert.equal(four.reduce((a, n) => a + n.dur, 0), 720);
  if (has(29)) {
    const eight = rightNotes(T(29, 720), T(29, 1440));
    assert.deepEqual(names(eight), ["Eb5", "F5", "Eb5", "F5", "Eb5", "F5", "Eb5", "F5"]);
    assert.ok(eight.every((n) => n.tuplet?.n === 8 && n.tuplet.inSpaceOf === 6 && n.dur === 90));
  }
  assert.equal(chopinNotes.filter((n) => n.tuplet).every((n) => Number.isInteger(n.dur)), true);
});

test("bar 24 climbs by half steps from A4 to D5 before its triplet, and bar 22 has the slashed G5 before the B flat 5", { skip: !has(22) }, () => {
  const g22 = chopinNotes.find((n) => n.grace && n.tick >= T(22, 1300) && n.tick < T(23));
  assert.deepEqual([g22.pitch, g22.tick + g22.dur], ["G5", T(22, 1440)]);
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(22, 1440) && !n.grace).pitch, "Bb5");
  if (has(24)) {
    const climb = rightNotes(T(24, 960), T(24, 1320));
    assert.deepEqual(names(climb), ["A4", "Bb4", "B4", "C5", "C#5", "D5"]);
    assert.deepEqual(climb.slice(1).map((n, i) => midiOf(n.pitch) - midiOf(climb[i].pitch)), [1, 1, 1, 1, 1], "each step is a half step");
    assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(24, 1440)).dur, 1440, "the E flat 5 is held for two beats");
  }
});

test("the cadential bass of bars 4, 8, 16, 24 and 28 goes Bb2 or Bb1 up to Eb2: the suspended E flat steps down to D on beat 2 in each", { skip: !has(8) }, () => {
  for (const bar of [4, 8, 16, 24, 28].filter(has)) {
    const t = T(bar);
    const beat1 = [t, t + 240, t + 480].flatMap((x) => leftAt(x, "accompaniment"));
    const beat2 = [t + 960, t + 1200].flatMap((x) => leftAt(x, "accompaniment"));
    assert.ok(beat1.includes("Eb4") && !beat1.includes("D4"), `bar ${bar} beat 1 holds the Eb`);
    assert.ok(beat2.includes("D4") && !beat2.includes("Eb4"), `bar ${bar} beat 2 has the D`);
    assert.equal(bassMidi(t + 720), 34, `bar ${bar} beat 2 bass is Bb1`);
    assert.equal(bassMidi(t + 1440), 39, `bar ${bar} beat 3 bass is Eb2`);
  }
});

test("the coda: Abm over an E flat bass in bars 25 and 26, B flat 7 over E flat in bar 27, and a descending line in bar 28", { skip: !has(28) }, () => {
  for (const bar of [25, 26]) {
    assert.equal(chordAtC(T(bar)).symbol, "Abm/Eb");
    assert.deepEqual([T(bar), T(bar, 720)].map((t) => leftAt(t, "bass")[0]), ["Eb2", "Eb3"]);
  }
  assert.equal(chordAtC(T(27)).symbol, "Bb7/Eb");
  assert.deepEqual(names(rightNotes(T(25, 720), T(25, 1440))), ["F5", "Eb5", "F5"]);
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(25, 1440)).dur, 1440, "the G5 of the coda is held for two beats");
  const line = names(rightNotes(T(28), T(28, 1440))).filter((p, i, all) => p !== all[i - 1]);
  assert.deepEqual(line, ["Cb6", "Bb5", "Bbb5", "Ab5", "G5", "F5"]);
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(28, 1440)).pitch, "Eb5");
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(26, 1920)).ornament, "turn");
  assert.deepEqual(names(rightNotes(T(26, 1920), T(27))), ["Eb5", "Eb6", "D6", "C6"]);
  const grace27 = chopinNotes.find((n) => n.grace && n.tick >= T(27, 2000) && n.tick < T(28));
  assert.deepEqual([grace27.pitch, grace27.tick + grace27.dur], ["Eb5", T(27, 2160)]);
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(27, 2160) && !n.grace).pitch, "G6");
});

test("bar 30 plays octaves from the E flat on, bar 31 an octave line that falls from C flat 6, and the left hand of bar 31 repeats the cadential chords", { skip: !has(31) }, () => {
  const octave = (tick) => rightNotes(tick, tick + 1).map((n) => n.pitch);
  assert.deepEqual([T(30, 1920), T(30, 2400), T(30, 2640)].map(octave), [["Eb6", "Eb7"], ["D6", "D7"], ["C6", "C7"]]);
  assert.deepEqual([0, 240, 480, 720, 960, 1200, 1440].map((r) => octave(T(31, r))[0]), ["Cb6", "Bb5", "Bbb5", "Ab5", "G5", "D5", "Eb5"]);
  for (const r of [0, 240, 480, 720, 960, 1200, 1440]) {
    const [low, high] = octave(T(31, r));
    assert.equal(midiOf(high) - midiOf(low), 12, `an octave at ${r}`);
  }
  assert.deepEqual([0, 720, 1440, 2160].map((r) => chordAtC(T(31, r)).symbol), ["Bb7", "G7/B", "Cm", "F7/A"]);
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.tick === T(31, 1680) && n.pitch === "Eb6").dur, 720, "the accented long octave");
});

test("the cadenza fills four bars: right-hand octaves, a left-hand B flat 7 arpeggio with the printed fingers, and a figure that repeats", { skip: !has(35) }, () => {
  const cadenzaEnd = T(36);
  const arpeggio = chopinNotes.filter((n) => n.hand === "L" && !n.rest && n.tick >= T(32) && n.tick < T(32, 2880)).sort((a, b) => a.tick - b.tick);
  assert.deepEqual(names(arpeggio), ["Bb1", "Bb2", "F3", "Ab3", "D4", "Bb3", "F4", "Ab4", "D5"]);
  assert.deepEqual(arpeggio.map((n) => n.finger), [undefined, 1, 3, 2, 1, 5, 3, 2, 1], "the printed fingers 1 3 2 1 5 3 2 1");
  assert.ok(arpeggio.every((n) => n.finger === undefined || n.fingeringSource === "source"));
  assert.deepEqual(rightNotes(T(32), T(32, 1)).map((n) => n.pitch), ["Cb6", "Cb7"]);
  assert.equal(chopinNotes.find((n) => n.hand === "R" && n.pitch === "Cb6" && n.tick === T(32)).dur, 1440);
  const figure = rightNotes(T(33, 480), T(35, 720));
  assert.ok(figure.length > 40 && figure.every((n) => n.dur === 120 && n.role === "ornament"));
  const cycle = ["Cb7", "Bb6", "C7", "A6"];
  assert.ok(figure.every((n, i) => n.pitch === cycle[i % 4]), "the figure Cb7 Bb6 C7 A6 repeats without a break");
  assert.deepEqual(figure.slice(0, 4).map((n) => n.finger), [3, 2, 4, 1]);
  const descent = rightNotes(T(35, 720), T(35, 1920));
  assert.deepEqual(names(descent), ["D7", "C7", "Bb6", "A6", "Ab6", "G6", "F6", "D6", "Eb6", "Cb6"]);
  assert.deepEqual(names(rightNotes(T(35, 1920), cadenzaEnd)), ["Bb5", "Ab5", "C5", "D5"]);
  assert.equal(Math.max(...chopinNotes.filter((n) => n.tick < cadenzaEnd && n.hand === "R").map((n) => n.tick + n.dur)), cadenzaEnd, "the cadenza ends exactly where printed bar 33 starts");
});

test("the last two printed bars rock E flat chords softly and end on a held E flat chord; the final pedal is released at the end of the song", { skip: !has(37) }, () => {
  assert.deepEqual(chopinNotes.filter((n) => n.hand === "R" && n.tick === T(36)).map((n) => n.pitch).sort(), ["Eb5", "G4"]);
  assert.ok(chopinNotes.some((n) => n.hand === "R" && n.tick === T(36) && n.pitch === "Eb5" && n.finger === 4), "the printed finger 4 on the E flat");
  const last = chopinNotes.filter((n) => n.tick >= T(37, 1440) && !n.rest).map((n) => `${n.hand}${n.pitch}`).sort();
  assert.deepEqual(last, ["LBb2", "LEb2", "RG3", "REb4"].sort());
  assert.equal(chopin.levels.original.pedal.at(-1).endTick, chopin.lengthTicks);
  assert.equal(chopin.lengthTicks, PICKUP + 37 * BAR, "37 bars of the app's count are the 34 printed bars");
  assert.equal(printedBar(37), 34);
});

test("no event of either level crosses a barline, and the validator would notice one that did (strictBars is off for the Original with a second voice)", () => {
  const barIndex = (tick) => Math.floor((tick - PICKUP) / BAR);
  const crossing = (notes) => notes.filter((n) => !n.grace && barIndex(n.tick) !== barIndex(n.tick + n.dur - 1));
  assert.deepEqual(crossing(chopinNotes), []);
  assert.deepEqual(crossing(chopin.levels.beginner.notes), []);
  const bad = structuredClone(chopin);
  const first = bad.levels.original.notes.find((n) => n.hand === "R" && n.tick === barStart(1));
  first.dur += BAR;
  assert.equal(crossing(bad.levels.original.notes).length, 1);
  bad.levels.original.strictBars = true;
  assert.ok(validateSong(bad).errors.some((e) => e.rule === "R10" || e.rule === "R9"), "with strictBars the validator rejects it too");
});

test("the analysis and the lessons use only words their data can back: every entry's ticks sit on a bar of the song and Beginner has none", () => {
  for (const a of chopinAnalysis) assert.ok(a.tick < chopin.lengthTicks, a.title);
  assert.equal(chopin.levels.beginner.analysis, undefined);
  for (const h of [...lessonB.handPositions, ...lessonO.handPositions]) assert.ok(h.tick < chopin.lengthTicks && ["L", "R"].includes(h.hand), h.text);
  const ticks = lessonO.ornaments.map((o) => o.tick);
  assert.deepEqual(ticks, [...ticks].sort((a, b) => a - b), "the ornaments are listed in order");
  const handTicks = lessonO.handPositions.map((h) => h.tick);
  assert.deepEqual(handTicks, [...handTicks].sort((a, b) => a - b), "the hand positions are listed in order");
});

test("the lessons describe the cadenza and the last bars with the app's bar numbers: bar 32 is four bars long and printed bars 33 and 34 are bars 36 and 37", { skip: !has(37) }, () => {
  const texts = [lessonO.arrangementNote, lessonO.summary, ...chopinAnalysis.map((a) => a.text)].join(" ");
  assert.match(texts, /counts it as bars 32 to 35/);
  assert.match(texts, /printed bars 33 and 34 are bars 36 and 37/);
  assert.match(lessonB.summary, /bar counter reaches 37/);
  assert.match(chopin.confidence.find((c) => c.scope === "structure").note, /three lower/);
  assert.equal(chopin.confidence.find((c) => c.scope === "cadenza").level, "low");
});

// ---- the public set after the catalog swap -------------------------------------------------------------------

const EXPECTED_PUBLIC = ["chopin-nocturne-op9-no2", "ode-to-joy", "satie-gymnopedie-1"];
/** What is wrong with a list of public song ids (empty means it is exactly the expected public set). */
const publicSetProblems = (ids) => {
  const problems = [];
  for (const id of EXPECTED_PUBLIC) if (!ids.includes(id)) problems.push(`missing ${id}`);
  for (const id of ids) if (!EXPECTED_PUBLIC.includes(id)) problems.push(`unexpected ${id}`);
  return problems;
};

test("the public catalog is exactly Ode to Joy, the Chopin Nocturne and the Satie Gymnopedie, none of them private, and the chords-only Cancer file is gone", () => {
  assert.deepEqual(publicSetProblems(index.songs.map((e) => e.id)), []);
  assert.equal(index.songs[0].id, "ode-to-joy", "the easiest song comes first: the hero opens it");
  assert.ok(index.songs.every((e) => e.visibility !== "private"));
  assert.equal(existsSync(new URL("../songs/cancer.json", import.meta.url)), false);
  assert.deepEqual(index.songs.find((e) => e.id === "ode-to-joy").levels, ["beginner"]);
  for (const e of index.songs) assert.equal(visibilityMismatch(e, read(e.file)), null, e.id);
});

test("counter-proof: the exact-set check notices the removed song coming back, a fourth song and a missing song", () => {
  assert.deepEqual(publicSetProblems(["ode-to-joy", "chopin-nocturne-op9-no2", "satie-gymnopedie-1", "cancer"]), ["unexpected cancer"]);
  assert.deepEqual(publicSetProblems(["ode-to-joy", "chopin-nocturne-op9-no2"]), ["missing satie-gymnopedie-1"]);
  assert.deepEqual(publicSetProblems([]), ["missing chopin-nocturne-op9-no2", "missing ode-to-joy", "missing satie-gymnopedie-1"]);
});
