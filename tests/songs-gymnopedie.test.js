import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSong } from "../src/core/schema.js";
import { parseChord } from "../src/core/chords.js";
import { parsePitch } from "../src/core/pitch.js";

// Satie, Gymnopedie No. 1, transcribed from the Mutopia LilyPond source (Mutopia-2014/12/14-37, Public Domain).
// The tests below hold for every state of the file between the first twelve bars and the whole piece: they measure
// `song.lengthTicks` instead of assuming a number of bars, and the MIDI fixture always covers the whole piece.
const text = readFileSync(new URL("../songs/satie-gymnopedie-1.json", import.meta.url), "utf8");
const song = JSON.parse(text);
const fixture = JSON.parse(readFileSync(new URL("./fixtures/mutopia-satie-gymnopedie1-onsets.json", import.meta.url), "utf8"));
const original = song.levels.original.notes;
const beginner = song.levels.beginner.notes;

const BAR = 1440;
const BARS = song.lengthTicks / BAR; // bars of the unfolded piece in the file (78 for the whole piece)
const has = (bar) => BARS >= bar;
const tickOf = (bar, beat = 1) => (bar - 1) * BAR + (beat - 1) * 480;
const midiOf = (pitch) => parsePitch(pitch).midi;
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const heads = (notes) => notes.filter((n) => !n.rest && !n.grace);
const inBar = (notes, bar) => notes.filter((n) => n.tick >= tickOf(bar) && n.tick < tickOf(bar + 1));
const names = (notes) => notes.map((n) => n.pitch);
const sorted = (notes) => [...notes].sort((a, b) => midiOf(a.pitch) - midiOf(b.pitch));
const right = (notes) => notes.filter((n) => n.hand === "R" && !n.rest);
const left = (notes) => notes.filter((n) => n.hand === "L" && !n.rest);

// ---- the MIDI fixture: what the file says, unfolded the way the song writes the repeat out ----
const BODY = fixture.bodyBars * BAR; // 44640
const ENDING = fixture.endingBars * BAR; // 11520
const parseGroups = (s) => s.split(" ").map((g) => {
  const [t, p] = g.split(":");
  return { tick: Number(t), midis: p.split("+").map(Number) };
});
/** The written MIDI (body, first ending, second ending) as the unfolded piece: body, ending 1, body, ending 2. */
function unfold(groups) {
  const out = [];
  for (const g of groups) {
    if (g.tick < BODY + ENDING) out.push(g);
    if (g.tick < BODY) out.push({ ...g, tick: g.tick + BODY + ENDING });
    if (g.tick >= BODY + ENDING) out.push({ ...g, tick: g.tick + BODY });
  }
  return out;
}
const pairs = (groups) => groups.flatMap((g) => g.midis.map((m) => `${g.tick}:${m}`));
const insideSong = (groups) => groups.filter((g) => g.tick < song.lengthTicks);
const expectedAll = () => pairs(insideSong(unfold([...parseGroups(fixture.treble), ...parseGroups(fixture.bass)]))).sort();
const expectedHand = (hand) => pairs(insideSong(unfold(parseGroups(fixture.hands[hand])))).sort();

/** Onsets of a note list as sorted "tick:midi" pairs; a tied continuation has no onset. */
function onsetPairs(notes, hand) {
  const hs = heads(notes).filter((n) => hand === undefined || n.hand === hand);
  const continuation = (n) => hs.some((h) => h.tie === true && h.hand === n.hand && h.pitch === n.pitch && h.tick + h.dur === n.tick);
  return hs.filter((n) => !continuation(n)).map((n) => `${n.tick}:${midiOf(n.pitch)}`).sort();
}

test("Gymnopedie validates with no error and no warning, is transcribed and engraved, with strict bars on the Beginner only", () => {
  const r = validateSong(song);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(song.levels.original.transcribed, true);
  assert.equal(song.levels.original.notation, "engraved");
  // strictBars asks for every bar of every used voice to be covered; the Original has a second voice in the bass
  // and, in two bars, in the right hand, so it leaves the check off. A test below shows no event crosses a barline.
  assert.equal(song.levels.original.strictBars, false);
  assert.equal(song.levels.beginner.strictBars, true);
  assert.equal(song.levels.beginner.notation, "labelled");
  assert.equal(song.defaultLevel, "original");
  assert.equal(song.contentPolicy, "open");
  assert.equal(song.id, "satie-gymnopedie-1");
});

test("timing: D major written in 3/4, quarter note at 60 (the MIDI default, not a printed tempo), Lent et douloureux, no pickup, whole bars", () => {
  assert.deepEqual(song.key, { tonic: "D", mode: "major" });
  assert.deepEqual(song.meter, { num: 3, den: 4 });
  assert.equal(song.tempo.beatUnit, "quarter");
  assert.equal(song.tempo.bpm, 60);
  assert.equal(song.tempo.marking, "Lent et douloureux");
  assert.equal(song.pickupTicks, 0);
  assert.ok(Number.isInteger(BARS) && BARS >= 12 && BARS <= 78, `${BARS} bars`);
});

test("the source entry records the piece page, the file, the ID, the license, the SHA-256, the date and the maintainer; the MIDI entry its hash and count", () => {
  const s = song.sources.find((x) => x.kind === "public-domain-score");
  assert.equal(new URL(s.url).hostname, "www.mutopiaproject.org");
  assert.match(s.url, /piece-info\.cgi\?id=37$/);
  assert.equal(s.fileUrl, "https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1.ly");
  assert.equal(s.mutopiaId, "Mutopia-2014/12/14-37");
  assert.equal(s.license, "Public Domain");
  assert.equal(s.maintainer, "Evin Robertson");
  assert.equal(s.sha256, "420a52244e9fbe106dd33ba2cac84414fd66e0d01c6d472205bad39678d4ce04");
  assert.match(s.accessed, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(s.what, /Dover edition/);
  assert.match(s.what, /unfolds the repeat/);
  assert.match(s.what, /no fingering, no pedal and no tempo number/);
  const mid = song.sources.find((x) => x.kind === "reference" && /\.mid$/.test(x.url));
  assert.equal(mid.sha256, "09ce7337b4bf42ba12e1aa64b4c7dc7fcfa6455f1070cb12f8880a755df97384");
  assert.match(mid.url, /gymnopedie_1\.mid$/);
  const total = [...parseGroups(fixture.treble), ...parseGroups(fixture.bass)].reduce((a, g) => a + g.midis.length, 0);
  assert.match(mid.what, new RegExp(`\\(${total} note onsets,`), "the MIDI entry counts the onsets it pinned");
  assert.equal(total, 282);
});

test("a public-domain song needs no license file: the source says Public Domain, not a ShareAlike license", () => {
  const s = song.sources.find((x) => x.kind === "public-domain-score");
  assert.doesNotMatch(s.license, /BY|SA/);
});

test("counter-proof: without the Mutopia source the transcribed level is rejected", () => {
  const bad = structuredClone(song);
  bad.sources = bad.sources.filter((s) => s.kind !== "public-domain-score");
  assert.equal(validateSong(bad).ok, false);
  assert.ok(validateSong(bad).errors.some((e) => e.rule === "R5"));
});

test("every onset of the Original equals an onset of the Mutopia MIDI (repeat unfolded): same tick, same pitch, none missing, none extra", () => {
  const want = expectedAll();
  const got = onsetPairs(original);
  assert.ok(want.length >= 50, `${want.length} onsets pinned inside the file`);
  if (has(78)) assert.equal(want.length, 455, "the whole piece pins 455 onsets");
  assert.deepEqual(got, want);
});

test("counter-proof: one wrong octave, one shifted onset, one missing note and one extra note each break the MIDI comparison", () => {
  const want = expectedAll();
  const octave = structuredClone(original);
  const i = octave.findIndex((n) => n.hand === "R" && n.pitch === "F#5");
  octave[i].pitch = "F#4";
  assert.notDeepEqual(onsetPairs(octave), want);
  const moved = structuredClone(original);
  moved[moved.findIndex((n) => n.hand === "L" && n.role === "bass")].tick += 120;
  assert.notDeepEqual(onsetPairs(moved), want);
  const missing = original.filter((_, j) => j !== original.findIndex((n) => n.pitch === "A5"));
  assert.notDeepEqual(onsetPairs(missing), want);
  const extra = [...original, { tick: 0, dur: 480, pitch: "C4", hand: "R" }];
  assert.notDeepEqual(onsetPairs(extra), want);
});

test("the hands are what the fixture pins: the right hand has the melody (and two chords in the final bars), the left hand the rest", () => {
  assert.deepEqual(onsetPairs(original, "R"), expectedHand("R"));
  assert.deepEqual(onsetPairs(original, "L"), expectedHand("L"));
});

test("counter-proof: the two hands are told apart by the fixture (swapping a note of hand changes the comparison)", () => {
  const swapped = structuredClone(original);
  const k = swapped.findIndex((n) => n.hand === "L" && n.role === "accompaniment");
  swapped[k].hand = "R";
  assert.notDeepEqual(onsetPairs(swapped, "L"), expectedHand("L"));
  assert.notDeepEqual(onsetPairs(swapped, "R"), expectedHand("R"));
});

test("the song uses only C, C#, D, E, F, F#, G, A and B: no D sharp, G sharp or A sharp (and no flat) anywhere", () => {
  const classes = [...new Set(heads(original).map((n) => midiOf(n.pitch) % 12))].sort((a, b) => a - b);
  const allowed = [0, 1, 2, 4, 5, 6, 7, 9, 11];
  assert.ok(classes.every((c) => allowed.includes(c)), classes.join(","));
  if (has(78)) assert.deepEqual(classes, allowed);
  assert.ok(heads([...original, ...beginner]).every((n) => !n.pitch.includes("b") || n.pitch === "B1" || /^Bd/.test(n.pitch)), "no flat spelling");
});

test("the song file holds none of the typographic marks that betray machine-written text: no long dashes, middle dots, curly quotes, arrows, one-character ellipsis or hard spaces", () => {
  const banned = /[\u2012-\u2015\u00b7\u2022\u2018\u2019\u201c\u201d\u2026\u2190-\u21ff\u00a0]/;
  assert.equal(banned.test(text), false);
  assert.equal(banned.test("a \u2014 b"), true, "the guard sees a long dash");
  assert.equal(banned.test("it\u2019s"), true, "and a curly quote");
});
