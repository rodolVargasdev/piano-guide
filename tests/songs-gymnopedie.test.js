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

// ---- the shape of the Original, bar by bar ----
const barsOfPass = (from, to) => Array.from({ length: to - from + 1 }, (_, k) => from + k).filter((b) => b <= BARS);
const BUSY = new Set([37, 76]); // three streams of notes in one bar
const FINAL = new Set([38, 39, 77, 78]); // one chord per hand, the whole bar
const regular = (b) => !BUSY.has(b) && !FINAL.has(b);

test("Original left hand: in every regular bar a bass note held for the whole bar (voice 2, role bass) and a chord on beats 2 and 3 (voice 1)", () => {
  for (const b of barsOfPass(1, 78).filter(regular)) {
    const l = left(inBar(original, b));
    const bass = l.filter((n) => n.role === "bass");
    assert.equal(bass.length, 1, `bar ${b} bass`);
    assert.deepEqual([bass[0].tick, bass[0].dur, bass[0].voice], [tickOf(b), BAR, 2], `bar ${b} bass timing`);
    const chord = l.filter((n) => n.role === "accompaniment");
    assert.ok(chord.length >= 2 && chord.length <= 4, `bar ${b} has ${chord.length} chord notes`);
    assert.ok(chord.every((n) => n.tick === tickOf(b, 2) && n.dur === 960 && n.voice === undefined), `bar ${b} chord timing`);
    assert.ok(midiOf(bass[0].pitch) < Math.min(...chord.map((n) => midiOf(n.pitch))), `bar ${b}: the chord is above the bass`);
  }
});

test("the right hand is silent for the four bars of the intro and enters on beat 2 of bar 5; the left hand is alone before that", () => {
  assert.deepEqual(right(original).filter((n) => n.tick < tickOf(5, 2)), []);
  const first = right(original)[0];
  assert.deepEqual([first.tick, first.pitch, first.role], [tickOf(5, 2), "F#5", "melody"]);
  assert.ok(left(original).some((n) => n.tick === 0 && n.pitch === "G2"));
});

test("bars 1 to 16 alternate Gmaj7 and Dmaj7: bass G2 with B3 D4 F#4 in odd bars, bass D2 with A3 C#4 F#4 in even bars", () => {
  for (const b of barsOfPass(1, 16)) {
    const l = left(inBar(original, b));
    const bass = l.find((n) => n.role === "bass").pitch;
    const chord = names(sorted(l.filter((n) => n.role === "accompaniment")));
    if (b % 2 === 1) {
      assert.equal(bass, "G2", `bar ${b}`);
      assert.deepEqual(chord, ["B3", "D4", "F#4"], `bar ${b}`);
    } else {
      assert.equal(bass, "D2", `bar ${b}`);
      assert.deepEqual(chord, ["A3", "C#4", "F#4"], `bar ${b}`);
    }
  }
});

test("between bars 1 and 2 only B falls to A and D falls to C sharp; F sharp stays and the bass leaps a fifth from G to D", () => {
  const chord = (b) => new Set(names(sorted(left(inBar(original, b)).filter((n) => n.role === "accompaniment"))).map((p) => p.replace(/\d/, "")));
  assert.deepEqual([...chord(1)].filter((x) => !chord(2).has(x)).sort(), ["B", "D"]);
  assert.deepEqual([...chord(2)].filter((x) => !chord(1).has(x)).sort(), ["A", "C#"]);
  assert.deepEqual([...chord(1)].filter((x) => chord(2).has(x)), ["F#"]);
  assert.equal(midiOf("G2") - midiOf("D2"), 5);
});

test("the first melody phrase is the nine notes F#5 A5 G5 F#5 C#5 B4 C#5 D5 A4, in bars 5 to 8", () => {
  const phrase = right(original).filter((n) => n.tick >= tickOf(5) && n.tick < tickOf(9) && n.role === "melody");
  assert.deepEqual(names(phrase), ["F#5", "A5", "G5", "F#5", "C#5", "B4", "C#5", "D5", "A4"]);
  assert.equal(phrase.at(-1).dur, BAR, "the last A4 lasts the whole bar");
});

test("bars 9 to 12 hold one F sharp 4 for four bars, tied; it is the major seventh of Gmaj7 and the third of Dmaj7", () => {
  const held = right(original).filter((n) => n.tick >= tickOf(9) && n.tick < tickOf(13));
  assert.deepEqual(held.map((n) => [n.pitch, n.tick, n.dur, n.tie === true]), [
    ["F#4", tickOf(9), BAR, true], ["F#4", tickOf(10), BAR, true], ["F#4", tickOf(11), BAR, true], ["F#4", tickOf(12), BAR, false],
  ]);
  assert.equal(midiOf("F#4") - midiOf("G3"), 11, "seven above G is F sharp: a major seventh");
  assert.equal(midiOf("F#4") - midiOf("D4"), 4, "over D it is the major third");
  assert.deepEqual([9, 10, 11, 12].map((b) => left(inBar(original, b)).find((n) => n.role === "bass").pitch), ["G2", "D2", "G2", "D2"]);
});

test("the Beginner is built from the Original by its rules, note by note (tick, length, pitch, hand)", () => {
  assert.deepEqual(beginnerOf(original), keyed(heads(beginner)));
});

const keyed = (notes) => notes.map((n) => `${n.hand}|${n.tick}|${n.dur}|${n.pitch}`).sort();
/** The Beginner that the rules make of an Original: the rules are the ones the lesson states. */
function beginnerOf(orig) {
  const out = [];
  const groupsOf = (list) => {
    const m = new Map();
    for (const n of list) (m.get(`${n.tick}|${n.dur}`) ?? m.set(`${n.tick}|${n.dur}`, []).get(`${n.tick}|${n.dur}`)).push(n);
    return [...m.values()];
  };
  const upper = (g) => sorted(g).slice(-3);
  // right hand, voice 1: the melody; a chord keeps its three upper notes
  for (const g of groupsOf(right(orig).filter((n) => n.voice === undefined))) for (const n of upper(g)) out.push({ ...n });
  // right hand, voice 2 (the two chords of bars 37 and 76): they go to the left hand
  for (const n of right(orig).filter((n) => n.voice === 2)) out.push({ ...n, hand: "L" });
  // left hand: the held bass of a bar is a quarter; the little bass line of bars 37 and 76 (voice 1, role bass) is left out
  for (const n of left(orig).filter((n) => n.voice === 2)) out.push({ ...n, dur: 480 });
  const bar = (n) => Math.floor(n.tick / BAR) + 1;
  const upperChords = left(orig).filter((n) => n.voice === undefined && !(n.role === "bass" && BUSY.has(bar(n))));
  for (const g of groupsOf(upperChords)) for (const n of upper(g)) out.push({ ...n });
  return keyed(out);
}

test("counter-proof: the rules notice a Beginner with a four-note chord, a changed bass length or a missing right-hand note", () => {
  const expected = beginnerOf(original);
  const four = [...beginner, { tick: tickOf(24, 2), dur: 960, pitch: "C3", hand: "L" }];
  assert.notDeepEqual(keyed(heads(four)), expected);
  const longBass = structuredClone(beginner);
  longBass.find((n) => n.hand === "L" && n.role === "bass").dur = 960;
  assert.notDeepEqual(keyed(heads(longBass)), expected);
  const fewer = beginner.filter((n) => n !== beginner.find((x) => x.pitch === "A5"));
  assert.notDeepEqual(keyed(heads(fewer)), expected);
});

test("no Beginner chord has more than three notes and the Beginner's left hand is one line of bass quarter then chord, bar by bar", () => {
  for (const b of barsOfPass(1, 78).filter(regular)) {
    const l = left(inBar(beginner, b));
    const bass = l.filter((n) => n.role === "bass");
    assert.deepEqual(bass.map((n) => [n.tick, n.dur]), [[tickOf(b), 480]], `bar ${b}`);
    const chord = l.filter((n) => n.role === "accompaniment");
    assert.ok(chord.length >= 2 && chord.length <= 3, `bar ${b}: ${chord.length} notes`);
    assert.ok(chord.every((n) => n.tick === tickOf(b, 2) && n.dur === 960), `bar ${b}`);
  }
});

test("no event of either level crosses a barline, and the validator notices one that does (Beginner strictBars)", () => {
  for (const [id, notes] of [["original", original], ["beginner", beginner]]) {
    for (const n of notes) assert.equal(Math.floor(n.tick / BAR), Math.floor((n.tick + n.dur - 1) / BAR), `${id}: ${n.pitch ?? "rest"} at ${n.tick}`);
  }
  const bad = structuredClone(song);
  const note = bad.levels.beginner.notes.find((n) => n.hand === "L" && n.role === "accompaniment");
  note.dur += 480;
  assert.ok(validateSong(bad).errors.some((e) => e.rule === "R10" || e.rule === "R9"));
});

test("every note of both levels has an editorial finger from 1 to 5: the source prints none", () => {
  for (const n of [...heads(original), ...heads(beginner)]) {
    assert.ok(Number.isInteger(n.finger) && n.finger >= 1 && n.finger <= 5, `${n.pitch} at ${n.tick}`);
    assert.equal(n.fingeringSource, "editorial");
  }
});

test("both hands stay in their own range: the left hand up to A4 and the right hand from A3", () => {
  for (const n of left(original)) assert.ok(midiOf(n.pitch) <= midiOf("A4"), `${n.pitch} at ${n.tick}`);
  for (const n of right(original)) assert.ok(midiOf(n.pitch) >= midiOf("A3"), `${n.pitch} at ${n.tick}`);
});

// ---- the chord track and the lessons ----
test("the chord track parses, is sorted, has no gap or overlap and covers the file; both lessons list exactly its symbols", () => {
  let cursor = 0;
  for (const c of song.chords) {
    assert.notEqual(parseChord(c.symbol), null, c.symbol);
    assert.equal(c.tick, cursor, `${c.symbol} starts where the one before ends`);
    cursor = c.tick + c.dur;
  }
  assert.equal(cursor, song.lengthTicks);
  const track = [...new Set(song.chords.map((c) => c.symbol))];
  assert.deepEqual(song.lesson.beginner.chordsUsed, track);
  assert.deepEqual(song.lesson.original.chordsUsed, track);
});

test("every note of a chord span except the melody is a tone of that chord (the slash bass included), in both levels", () => {
  for (const [id, notes] of [["original", original], ["beginner", beginner]]) {
    for (const c of song.chords) {
      const tones = new Set(parseChord(c.symbol).pitches.map((p) => midiOf(p) % 12));
      const inSpan = heads(notes).filter((n) => n.role !== "melody" && n.tick < c.tick + c.dur && n.tick + n.dur > c.tick && n.tick >= c.tick - 0);
      for (const n of inSpan) assert.ok(tones.has(midiOf(n.pitch) % 12), `${id}: ${n.pitch} at ${n.tick} is not in ${c.symbol}`);
    }
  }
});

test("counter-proof: a foreign note in a chord span is found by the same check", () => {
  const chord = song.chords[0];
  const tones = new Set(parseChord(chord.symbol).pitches.map((p) => midiOf(p) % 12));
  assert.equal(tones.has(midiOf("D#4") % 12), false);
  assert.equal(tones.has(midiOf("B3") % 12), true);
});

test("every hand position of both lessons names a note its level plays at that tick with that hand", () => {
  for (const id of ["beginner", "original"]) {
    const notes = song.levels[id].notes;
    assert.ok(song.lesson[id].handPositions.length >= 3, id);
    for (const h of song.lesson[id].handPositions) {
      assert.ok(heads(notes).some((n) => n.tick === h.tick && n.hand === h.hand && n.pitch === h.anchor), `${id}: ${h.hand} ${h.anchor} at ${h.tick}`);
    }
  }
});

test("counter-proof: a hand position pointing at a note the level does not play at that tick is caught", () => {
  assert.equal(heads(original).some((n) => n.tick === 0 && n.hand === "R" && n.pitch === "G2"), false);
  assert.equal(heads(beginner).some((n) => n.tick === tickOf(1, 2) && n.hand === "L" && n.pitch === "G2"), false);
});

test("the lessons mention the Minecraft comparison once, as a comparison that is often made, and name no composer of that music", () => {
  for (const id of ["beginner", "original"]) {
    const s = song.lesson[id].summary;
    assert.equal(s.split("Minecraft").length - 1, 1, id);
    assert.match(s, /often compared to Satie's style/);
    assert.doesNotMatch(s, /C418|inspired|composed/);
  }
});

test("the lessons say where the numbers come from: the repeat is written out, so the piece has 78 bars when whole", () => {
  assert.match(song.lesson.original.arrangementNote, /Mutopia-2014\/12\/14-37/);
  assert.match(song.lesson.original.arrangementNote, /every finger here is editorial/);
  assert.match(song.lesson.beginner.arrangementNote, /The fingering is editorial/);
  if (has(78)) {
    for (const id of ["beginner", "original"]) assert.match(song.lesson[id].summary, /78 bars/);
  }
});

test("sections start on bar lines, follow each other without overlap, have distinct ids and the first one starts at tick 0", () => {
  assert.equal(song.sections[0].startTick, 0);
  const ids = new Set();
  let end = 0;
  for (const s of song.sections) {
    assert.ok(!ids.has(s.id), s.id);
    ids.add(s.id);
    assert.equal(s.startTick % BAR, 0, s.id);
    assert.equal(s.endTick % BAR, 0, s.id);
    assert.equal(s.startTick, end, `${s.id} starts where the one before ends`);
    end = s.endTick;
  }
  assert.ok(end <= song.lengthTicks);
  if (has(78)) assert.equal(end, song.lengthTicks, "the sections tile the whole piece");
});

test("sections look at the music: the intro is the left hand alone, and the loop of Melody enters holds bars 5 to 8", () => {
  const intro = song.sections.find((s) => s.id === "intro");
  assert.deepEqual([intro.startTick, intro.endTick], [0, tickOf(5)]);
  assert.deepEqual(right(original).filter((n) => n.tick >= intro.startTick && n.tick < intro.endTick), []);
  const melody = song.sections.find((s) => s.id === "melody");
  assert.deepEqual([melody.startTick, melody.endTick], [tickOf(5), tickOf(9)]);
});

// ---- the analysis ----
const analysis = song.levels.original.analysis;
const chordAt = (tick) => song.chords.find((c) => tick >= c.tick && tick < c.tick + c.dur);

test("analysis exists on the Original only, covers harmony, voice-leading, form and dynamics, is sorted, stays inside the song and has short titles", () => {
  assert.equal(song.levels.beginner.analysis, undefined);
  assert.ok(analysis.length >= 6);
  if (has(78)) assert.equal(analysis.length, 28);
  assert.ok(["harmony", "voice-leading", "form", "dynamics"].every((k) => analysis.some((a) => a.kind === k)));
  let prev = 0;
  for (const a of analysis) {
    assert.ok(a.tick >= prev, `${a.title} is out of order`);
    prev = a.tick;
    assert.ok((a.endTick ?? a.tick) <= song.lengthTicks, a.title);
    assert.ok(a.title.length <= 18, `${a.title}: callout titles stay short`);
    assert.equal(a.tick % 480, 0, `${a.title} sits on a beat`);
  }
});

test("analysis roman numerals and functions agree with the chord track at their tick", () => {
  for (const a of analysis.filter((x) => x.roman)) {
    const c = chordAt(a.tick);
    assert.equal(a.roman, c.roman, a.title);
    assert.equal(a.function, c.function, a.title);
  }
});

test("counter-proof: an analysis entry with the wrong numeral does not match the chord track", () => {
  const first = analysis.find((a) => a.roman);
  assert.notEqual("V", chordAt(first.tick).roman);
});

test("the intro entries are true of the notes: Gmaj7 is G with B, D and F sharp, Dmaj7 is D with A, C sharp and F sharp", () => {
  assert.equal(parseChord("Gmaj7").names.join(" "), "G B D F#");
  assert.equal(parseChord("Dmaj7").names.join(" "), "D F# A C#");
  assert.equal(chordAt(0).symbol, "Gmaj7");
  assert.equal(chordAt(tickOf(2)).symbol, "Dmaj7");
});

test("the three lines the lesson calls the lead-in: the melody enters at pp on F sharp 5 on beat 2 of bar 5 and the analysis says so", () => {
  const entry = analysis.find((a) => a.title === "Melody enters");
  assert.equal(entry.tick, tickOf(5, 2));
  assert.match(entry.text, /pp/);
  assert.match(entry.text, /F#5 A5 G5 F#5 C#5 B4 C#5 D5 A4/);
});

test("the repeat is written out: every note of bars 40 to 70 is a note of bars 1 to 31 moved by 39 bars, in both levels", { skip: !has(44) }, () => {
  const SHIFT = tickOf(40);
  const last = Math.min(BARS, 70);
  for (const [id, notes] of [["original", original], ["beginner", beginner]]) {
    const first = notes.filter((n) => n.tick < tickOf(last - 39 + 1));
    const again = notes.filter((n) => n.tick >= SHIFT && n.tick < tickOf(last + 1)).map((n) => ({ ...n, tick: n.tick - SHIFT }));
    assert.deepEqual(again, first, id);
  }
});

test("counter-proof: the repeat comparison notices one changed note in the second pass", { skip: !has(44) }, () => {
  const SHIFT = tickOf(40);
  const copy = structuredClone(original);
  const k = copy.findIndex((n) => n.tick >= SHIFT && n.pitch === "A5");
  copy[k].pitch = "G5";
  const first = copy.filter((n) => n.tick < tickOf(5));
  const again = copy.filter((n) => n.tick >= SHIFT && n.tick < SHIFT + tickOf(5)).map((n) => ({ ...n, tick: n.tick - SHIFT }));
  assert.deepEqual(again, first, "the first four bars still agree");
  const all1 = copy.filter((n) => n.tick < tickOf(9));
  const all2 = copy.filter((n) => n.tick >= SHIFT && n.tick < SHIFT + tickOf(9)).map((n) => ({ ...n, tick: n.tick - SHIFT }));
  assert.notDeepEqual(all2, all1);
});

test("the analysis of bars 13 to 16 says the melody repeats bars 5 to 8, and the notes do", { skip: !has(16) }, () => {
  const melody = (from) => right(original).filter((n) => n.tick >= tickOf(from) && n.tick < tickOf(from + 4) && n.role === "melody").map((n) => [n.pitch, n.tick - tickOf(from), n.dur]);
  assert.deepEqual(melody(13), melody(5));
  assert.ok(analysis.some((a) => a.title === "Melody again" && a.tick === tickOf(13)));
});

test("the F sharp minor turn: bass F#2 and chord A3 C#4 F#4 in bar 17, B1 with B3 D4 F#4 in bar 18, the melody climbing a fourth from C#5 to F#5", { skip: !has(21) }, () => {
  assert.equal(left(inBar(original, 17)).find((n) => n.role === "bass").pitch, "F#2");
  assert.deepEqual(names(sorted(left(inBar(original, 17)).filter((n) => n.role === "accompaniment"))), ["A3", "C#4", "F#4"]);
  assert.equal(left(inBar(original, 18)).find((n) => n.role === "bass").pitch, "B1");
  assert.deepEqual(names(sorted(left(inBar(original, 18)).filter((n) => n.role === "accompaniment"))), ["B3", "D4", "F#4"]);
  assert.deepEqual(right(inBar(original, 17)).map((n) => n.pitch), ["C#5"]);
  assert.deepEqual(right(inBar(original, 18)).map((n) => n.pitch), ["F#5"]);
  assert.equal(midiOf("F#5") - midiOf("C#5"), 5, "a fourth");
  assert.equal(midiOf("F#2") - midiOf("B1"), 7, "the bass falls a fifth");
});

test("bars 19 to 21 hold E4 for three bars, tied; bar 19 is E minor, bar 20 adds the seventh D over the same E bass", { skip: !has(21) }, () => {
  const held = right(original).filter((n) => n.tick >= tickOf(19) && n.tick < tickOf(22));
  assert.deepEqual(held.map((n) => [n.pitch, n.tick, n.tie === true]), [["E4", tickOf(19), true], ["E4", tickOf(20), true], ["E4", tickOf(21), false]]);
  assert.deepEqual([19, 20].map((b) => left(inBar(original, b)).find((n) => n.role === "bass").pitch), ["E2", "E2"]);
  assert.deepEqual(names(sorted(left(inBar(original, 19)).filter((n) => n.role === "accompaniment"))), ["G3", "B3"]);
  assert.deepEqual(names(sorted(left(inBar(original, 20)).filter((n) => n.role === "accompaniment"))), ["B3", "D4", "G4"]);
  assert.deepEqual([19, 20].map((b) => chordAt(tickOf(b)).symbol), ["Em", "Em7"]);
});

test("bar 21 is the first F natural of the piece and bar 22 the first C natural: nothing before bar 21 has F natural, nothing before bar 22 has C natural", { skip: !has(22) }, () => {
  const pc = (n) => midiOf(n.pitch) % 12;
  assert.deepEqual(heads(original).filter((n) => n.tick < tickOf(21) && pc(n) === 5), [], "no F natural before bar 21");
  assert.deepEqual(heads(original).filter((n) => n.tick < tickOf(22) && pc(n) === 0), [], "no C natural before bar 22");
  assert.deepEqual(names(heads(original).filter((n) => n.tick >= tickOf(21) && n.tick < tickOf(22) && pc(n) === 5)), ["F3"]);
  assert.ok(heads(original).some((n) => n.tick >= tickOf(22) && n.tick < tickOf(23) && pc(n) === 0));
  assert.equal(chordAt(tickOf(21)).symbol, "Dm");
});

test("the new rising line of bars 22 to 24 has no F sharp: A B C, E D B, D C B", { skip: !has(24) }, () => {
  const line = right(original).filter((n) => n.tick >= tickOf(22) && n.tick < tickOf(25));
  assert.deepEqual(names(line), ["A4", "B4", "C5", "E5", "D5", "B4", "D5", "C5", "B4"]);
  assert.ok(line.every((n) => midiOf(n.pitch) % 12 !== 6));
});

test("the D pedal: the bass is D2 in every bar from 23 to 31, A1 in bar 22 and D2 in bar 21; D7 (bar 26) has C, Dm7 (bar 27) has F natural", { skip: !has(31) }, () => {
  assert.deepEqual([21, 22].map((b) => left(inBar(original, b)).find((n) => n.role === "bass").pitch), ["D2", "A1"]);
  for (const b of barsOfPass(23, 31)) assert.equal(left(inBar(original, b)).find((n) => n.role === "bass").pitch, "D2", `bar ${b}`);
  assert.deepEqual(names(sorted(left(inBar(original, 26)).filter((n) => n.role === "accompaniment"))), ["C3", "F#3", "A3", "D4"]);
  assert.deepEqual(names(sorted(left(inBar(original, 27)).filter((n) => n.role === "accompaniment"))), ["A3", "C4", "F4"]);
  assert.deepEqual([23, 24, 25, 26, 27, 28, 29, 30, 31].map((b) => chordAt(tickOf(b)).symbol), ["Em7/D", "Em7/D", "Am/D", "D7", "Dm7", "Am/D", "Em7/D", "Am/D", "D7"]);
});

test("the climb of bars 27 and 28 reaches A5, the highest note of the melody in the whole file, after E F G", { skip: !has(28) }, () => {
  assert.deepEqual(names(right(original).filter((n) => n.tick >= tickOf(27) && n.tick < tickOf(28))), ["E5", "F5", "G5"]);
  assert.equal(right(inBar(original, 28))[0].pitch, "A5");
  assert.equal(Math.max(...right(original).map((n) => midiOf(n.pitch))), midiOf("A5"));
});

test("the first ending (bars 32 to 39): bass E2 F#2 B1 E2 E2, chords Em F#m Bm A/E F#m7/E, melody G5 F#5 B4 A4 B4 and C#5 D5 E5 twice", { skip: !has(36) }, () => {
  assert.deepEqual([32, 33, 34, 35, 36].map((b) => left(inBar(original, b)).find((n) => n.role === "bass").pitch), ["E2", "F#2", "B1", "E2", "E2"]);
  assert.deepEqual([32, 33, 34, 35, 36].map((b) => chordAt(tickOf(b)).symbol), ["Em", "F#m", "Bm", "A/E", "F#m7/E"]);
  assert.deepEqual(names(right(inBar(original, 32))).concat(names(right(inBar(original, 33)))), ["G5", "F#5"]);
  assert.deepEqual(names(right(inBar(original, 34))), ["B4", "A4", "B4"]);
  assert.deepEqual(names(right(inBar(original, 35))), ["C#5", "D5", "E5"]);
  assert.deepEqual(names(right(inBar(original, 36))), ["C#5", "D5", "E5"]);
});

test("bar 37 is the busy bar: bass E2 held, B2 and E3 above it, two chords for the right hand (A3 D4, then B3 D4 G4) under a held F sharp 4", { skip: !has(37) }, () => {
  const bar = inBar(original, 37);
  const lh = left(bar);
  assert.deepEqual(lh.filter((n) => n.voice === 2).map((n) => [n.pitch, n.tick, n.dur]), [["E2", tickOf(37), BAR]]);
  assert.deepEqual(lh.filter((n) => n.voice === undefined).map((n) => [n.pitch, n.tick - tickOf(37), n.dur]), [["B2", 480, 480], ["E3", 960, 480]]);
  const rh = right(bar);
  assert.deepEqual(rh.filter((n) => n.voice === undefined).map((n) => [n.pitch, n.dur]), [["F#4", BAR]]);
  const chords = rh.filter((n) => n.voice === 2);
  assert.deepEqual(names(sorted(chords.filter((n) => n.tick === tickOf(37, 2)))), ["A3", "D4"]);
  assert.deepEqual(names(sorted(chords.filter((n) => n.tick === tickOf(37, 3)))), ["B3", "D4", "G4"]);
});

test("bars 38 and 39 end the first ending: Am7 (C4 E4 A4 C5 over A2 G3, a minor chord with no C sharp) and a plain D major chord (D4 F#4 A4 D5 over D2 A2 D3)", { skip: !has(39) }, () => {
  assert.deepEqual(names(sorted(right(inBar(original, 38)))), ["C4", "E4", "A4", "C5"]);
  assert.deepEqual(names(sorted(left(inBar(original, 38)))), ["A2", "G3"]);
  assert.deepEqual(names(sorted(right(inBar(original, 39)))), ["D4", "F#4", "A4", "D5"]);
  assert.deepEqual(names(sorted(left(inBar(original, 39)))), ["D2", "A2", "D3"]);
  assert.equal(chordAt(tickOf(38)).symbol, "Am7");
  assert.equal(chordAt(tickOf(39)).symbol, "D");
  assert.ok(right(inBar(original, 38)).every((n) => midiOf(n.pitch) % 12 !== 1), "no C sharp in bar 38");
  assert.ok(right(inBar(original, 38)).every((n) => n.dur === BAR) && left(inBar(original, 38)).every((n) => n.dur === BAR));
});

test("the second ending (bars 71 to 78) has no sharp anywhere: every note is a white key, all inside D Dorian", { skip: !has(78) }, () => {
  const second = heads(original).filter((n) => n.tick >= tickOf(71));
  assert.ok(second.length > 30);
  assert.ok(second.every((n) => !n.pitch.includes("#")), "no sharp");
  const classes = new Set(second.map((n) => midiOf(n.pitch) % 12));
  assert.deepEqual([...classes].sort((a, b) => a - b), [0, 2, 4, 5, 7, 9, 11]);
});

test("bar 76 repeats the bass line and chords of bar 37 with F natural 4 instead of F sharp 4, and bar 78 ends the piece on D minor (F natural) where bar 39 closed on D major", { skip: !has(78) }, () => {
  const shape = (bar, first) => {
    const b = inBar(original, bar);
    return {
      lh: left(b).map((n) => [n.pitch, n.tick - tickOf(first), n.dur, n.voice ?? 1]),
      chords: right(b).filter((n) => n.voice === 2).map((n) => [n.pitch, n.tick - tickOf(first), n.dur]),
      melody: right(b).filter((n) => n.voice === undefined).map((n) => n.pitch),
    };
  };
  const a = shape(37, 37), c = shape(76, 76);
  assert.deepEqual(c.lh, a.lh);
  assert.deepEqual(c.chords, a.chords);
  assert.deepEqual([a.melody, c.melody], [["F#4"], ["F4"]]);
  assert.deepEqual(names(sorted(right(inBar(original, 78)))), ["D4", "F4", "A4", "D5"]);
  assert.deepEqual(names(sorted(left(inBar(original, 78)))), ["D2", "A2", "D3"]);
  assert.equal(chordAt(tickOf(78)).symbol, "Dm");
  assert.equal(chordAt(tickOf(76)).symbol, "Bm7b5/E");
  assert.equal(song.lengthTicks, tickOf(79));
});

test("the song file holds none of the typographic marks that betray machine-written text: no long dashes, middle dots, curly quotes, arrows, one-character ellipsis or hard spaces", () => {
  const banned = /[\u2012-\u2015\u00b7\u2022\u2018\u2019\u201c\u201d\u2026\u2190-\u21ff\u00a0]/;
  assert.equal(banned.test(text), false);
  assert.equal(banned.test("a \u2014 b"), true, "the guard sees a long dash");
  assert.equal(banned.test("it\u2019s"), true, "and a curly quote");
});
