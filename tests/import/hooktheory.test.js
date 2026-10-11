import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { convertHooktheory, SECTION_NAMES } from "../../src/import/hooktheory.js";
import { validateSong } from "../../src/core/schema.js";
import { parseChord } from "../../src/core/chords.js";
import { isSilent } from "../../src/core/visibility.js";

const FIXTURE = readFileSync(new URL("../fixtures/hooktheory-synthetic.json", import.meta.url), "utf8");
const fresh = () => JSON.parse(FIXTURE);
const convert = (mutate, opts) => {
  const source = fresh();
  mutate?.(source);
  return convertHooktheory(source, opts);
};
const okSong = (mutate, opts) => {
  const r = convert(mutate, opts);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r;
};
const notesOf = (song) => song.levels.beginner.notes;
const right = (song) => notesOf(song).filter((n) => n.hand === "R");
const left = (song) => notesOf(song).filter((n) => n.hand === "L");
const VERSE = 3840; // the intro is 8 beats, so the verse starts at tick 3840
const CHORUS = VERSE + 3840;
const without = (...names) => (s) => names.forEach((n) => delete s.sections[n]);

test("the synthetic capture converts to a song that passes the validator", () => {
  const { song } = okSong();
  assert.deepEqual(validateSong(song).errors, []);
  assert.equal(song.id, "cancer-private", "the private id never equals the public `cancer`");
  assert.notEqual(song.id, "cancer");
  assert.equal(song.visibility, "private");
  assert.equal(isSilent(song), true);
  assert.deepEqual(song.key, { tonic: "E", mode: "major" });
  assert.deepEqual(song.tempo, { bpm: 75, beatUnit: "quarter" });
  assert.deepEqual(song.meter, { num: 4, den: 4 });
  assert.equal(song.pickupTicks, 0);
  assert.equal(song.defaultLevel, "beginner");
});

test("degrees become spelled pitches in E major: 1 3 5 are E4 G#4 B4, b7 is D5, 7 is D#5, offset -1 is E3", () => {
  const verse = right(okSong().song).filter((n) => n.tick >= VERSE && n.tick < CHORUS);
  assert.deepEqual(verse.map((n) => n.pitch), ["E4", "G#4", "B4", "D5", "D#5", "E3", "B4"]);
});

test("beat arithmetic is 1-based: beat 2.5 of the first section is tick 720 with 240 ticks", () => {
  const { song } = okSong(without("intro"));
  const n = right(song).find((x) => x.pitch === "B4");
  assert.deepEqual([n.tick, n.dur], [720, 240]);
  assert.equal(right(song)[0].tick, 0, "beat 1 is tick 0");
});

test("a rest is a gap: the next note starts one beat after the end of the previous one", () => {
  const { song } = okSong(without("intro"));
  const [, , third, fourth] = right(song);
  assert.equal(fourth.tick, third.tick + third.dur + 480);
  assert.ok(right(song).every((n) => n.tick + n.dur <= third.tick + third.dur || n.tick >= fourth.tick), "no note covers the gap");
  assert.equal(right(song).filter((n) => n.tick < 3840).length, 7, "the rest produced no event (the verse has eight source entries)");
});

test("a note that runs into the next is clipped to the gap and a warning names its position", () => {
  const r = okSong();
  const clipped = right(r.song).find((n) => n.pitch === "D#5");
  assert.equal(clipped.dur, 480, "two beats clipped to the one beat before the next onset");
  assert.ok(r.warnings.some((w) => w.startsWith("sections.verse.notes[5]") && /clipped from 960 to 480/.test(w)), JSON.stringify(r.warnings));
});

test("the length is a whole number of bars, even when sections end in the middle of one", () => {
  const { song } = okSong((s) => {
    without("intro", "chorus")(s);
    s.sections.verse.endBeat = 7;
    s.sections.verse.notes = s.sections.verse.notes.slice(0, 5);
  });
  assert.equal(song.sections[0].endTick, 2880, "six beats");
  assert.equal(song.lengthTicks, 3840, "rounded up to two full bars");
  assert.equal(song.lengthTicks % 1920, 0);
  assert.equal(okSong().song.lengthTicks, 13440, "seven bars when every section is whole bars");
});

test("a pickup section keeps its pickup bar as a full bar and chords start after it", () => {
  const { song } = okSong();
  const chorus = song.sections.find((s) => s.id === "chorus");
  assert.equal(chorus.endTick - chorus.startTick, 5760, "twelve beats, three bars");
  assert.equal(song.pickupTicks, 0);
  const first = song.chords.find((c) => c.tick >= chorus.startTick);
  assert.equal(first.tick, chorus.startTick + 1920, "the first chord is at beat 5");
  assert.equal(right(song).find((n) => n.tick === chorus.startTick).pitch, "B3", "a melody note sits inside the pickup bar");
});

test("chords: degree 6 minor is C#m, and its bass is C#2 lasting the whole chord in the left hand", () => {
  const { song } = okSong();
  const chord = song.chords.find((c) => c.tick === VERSE + 1920);
  assert.deepEqual(chord, { tick: VERSE + 1920, dur: 1920, symbol: "C#m", roman: "vi" });
  const bass = left(song).find((n) => n.tick === VERSE + 1920);
  assert.deepEqual(bass, { tick: VERSE + 1920, dur: 1920, pitch: "C#2", hand: "L", role: "bass", voice: 1 });
});

test("an applied V/V with an inversion and a borrowed bVI keep their symbols and numerals", () => {
  const { song } = okSong();
  assert.deepEqual(song.chords.find((c) => c.tick === CHORUS + 1920), { tick: CHORUS + 1920, dur: 1920, symbol: "F#/A#", roman: "V/V" });
  assert.deepEqual(song.chords.find((c) => c.tick === CHORUS + 3840), { tick: CHORUS + 3840, dur: 1920, symbol: "C", roman: "bVI" });
  assert.deepEqual(song.chords.find((c) => c.tick === 1920), { tick: 1920, dur: 1920, symbol: "Aadd9", roman: "IVadd9" });
  assert.ok(song.chords.every((c) => parseChord(c.symbol)), "every symbol is readable by the chord parser");
});

test("an intro with only chords produces left-hand roots and no right-hand events", () => {
  const { song } = okSong();
  assert.ok(left(song).filter((n) => n.tick < VERSE).length === 2);
  assert.equal(right(song).filter((n) => n.tick < VERSE).length, 0);
  assert.ok(left(song).every((n) => n.role === "bass" && n.pitch.endsWith("2")));
});

test("sections are sorted in the fixed order whatever the capture order, inside the song, without overlap", () => {
  const { song } = okSong((s) => {
    const { chorus, verse, intro } = s.sections;
    s.sections = { chorus, intro, verse };
  });
  assert.deepEqual(song.sections.map((x) => x.id), ["intro", "verse", "chorus"]);
  assert.deepEqual(song.sections.map((x) => x.name), ["Intro", "Verse", "Chorus"]);
  song.sections.forEach((x, i) => {
    assert.ok(x.endTick <= song.lengthTicks);
    if (i > 0) assert.equal(x.startTick, song.sections[i - 1].endTick);
  });
  assert.deepEqual(SECTION_NAMES, ["intro", "verse", "pre-chorus", "chorus", "bridge", "outro"]);
  assert.deepEqual(JSON.stringify(song), JSON.stringify(okSong().song), "the capture order does not change the output");
});

test("provenance: one user-submitted source, the learner texts are bilingual, no confidence is high", () => {
  const { song } = okSong();
  assert.equal(song.sources.length, 1);
  assert.equal(song.sources[0].kind, "user-submitted");
  assert.equal(song.sources[0].url, "https://example.org/synthetic-capture");
  assert.equal(song.sources[0].accessed, "2026-10-11");
  assert.ok(song.confidence.length >= 3 && song.confidence.every((c) => c.level !== "high"));
  assert.deepEqual(song.confidence.map((c) => c.scope), ["chords:intro", "notes:verse", "chords:verse", "notes:chorus", "chords:chorus"]);
  assert.ok(song.lesson.beginner.summary.en && song.lesson.beginner.summary.es);
  assert.equal(song.levels.beginner.transcribed, undefined, "never transcribed");
  assert.deepEqual(song.levels.beginner.learn, { transposeTo: ["C"] }, "four sharps offer C major");
});

test("a source URL option wins over the capture, and a key with fewer than 3 accidentals offers no transposition", () => {
  const { song } = okSong((s) => s.sections && Object.values(s.sections).forEach((x) => (x.keys[0].tonic = "G")), { sourceUrl: "https://example.org/other" });
  assert.equal(song.sources[0].url, "https://example.org/other");
  assert.equal(song.levels.beginner.learn, undefined);
});

test("no source URL anywhere fails naming `source`, and the accessed date is required too", () => {
  const r = convert((s) => delete s.source);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === "source"));
  assert.equal(convert((s) => delete s.accessed).ok, false);
  assert.equal(convert((s) => delete s.accessed, { accessed: "2026-10-12" }).ok, true, "the option supplies the date");
});

test("lyrics and other capture fields never reach the output", () => {
  const text = JSON.stringify(okSong().song);
  for (const leak of ["synthetic lyric words", "lyric", "synthetic-verse", "swingFactor", "holds no lyrics", '"hash"', '"api"']) assert.equal(text.includes(leak), false, leak);
  assert.deepEqual(Object.keys(okSong().song), [
    "schemaVersion", "id", "title", "composer", "visibility", "key", "meter", "pickupTicks", "tempo", "lengthTicks",
    "sections", "chords", "levels", "defaultLevel", "lesson", "sources", "confidence",
  ]);
  assert.ok(notesOf(okSong().song).every((n) => Object.keys(n).join() === "tick,dur,pitch,hand,role,voice"));
});

test("counter-proof: a lyric text placed on a chord, a section or the top level is dropped too", () => {
  const { song } = okSong((s) => {
    s.lyrics = "top level words";
    s.sections.verse.lyric = "section words";
    s.sections.verse.chords[0].lyric = "chord words";
  });
  const text = JSON.stringify(song);
  assert.equal(/words/.test(text), false);
});

test("converting the same capture twice gives byte-identical output", () => {
  const bytes = () => JSON.stringify(okSong().song, null, 2) + "\n";
  assert.equal(bytes(), bytes());
});

test("the summary counts source notes (rests included) and chords per section, not the melody", () => {
  assert.deepEqual(okSong().summary, {
    intro: { notes: 0, pitched: 0, chords: 2 },
    verse: { notes: 8, pitched: 7, chords: 2 },
    chorus: { notes: 3, pitched: 3, chords: 2 },
  });
});

test("options set the id, title and composer", () => {
  const { song } = okSong(null, { id: "my-song", title: "My Song", composer: "Me" });
  assert.deepEqual([song.id, song.title, song.composer], ["my-song", "My Song", "Me"]);
});

const MALFORMED = [
  { name: "degree 9", path: "sections.verse.notes[1].sd", mutate: (s) => void (s.sections.verse.notes[1].sd = "9") },
  { name: "degree 0", path: "sections.verse.notes[1].sd", mutate: (s) => void (s.sections.verse.notes[1].sd = "0") },
  { name: "a note without a degree", path: "sections.verse.notes[1].sd", mutate: (s) => void delete s.sections.verse.notes[1].sd },
  { name: "a note without an octave", path: "sections.verse.notes[1].octave", mutate: (s) => void delete s.sections.verse.notes[1].octave },
  { name: "a note without a beat", path: "sections.verse.notes[1].beat", mutate: (s) => void delete s.sections.verse.notes[1].beat },
  { name: "a note with beat 0", path: "sections.verse.notes[1].beat", mutate: (s) => void (s.sections.verse.notes[1].beat = 0) },
  { name: "a note without a duration", path: "sections.verse.notes[1].duration", mutate: (s) => void delete s.sections.verse.notes[1].duration },
  { name: "a zero duration", path: "sections.verse.notes[1].duration", mutate: (s) => void (s.sections.verse.notes[1].duration = 0) },
  { name: "a negative duration", path: "sections.verse.notes[1].duration", mutate: (s) => void (s.sections.verse.notes[1].duration = -1) },
  { name: "an unknown section name", path: "sections.refrain", mutate: (s) => void (s.sections.refrain = s.sections.verse) },
  { name: "a missing key", path: "sections.verse.keys", mutate: (s) => void delete s.sections.verse.keys },
  { name: "a missing tempo", path: "sections.verse.tempos", mutate: (s) => void delete s.sections.verse.tempos },
  { name: "a missing meter", path: "sections.verse.meters", mutate: (s) => void delete s.sections.verse.meters },
  { name: "a key change", path: "sections.verse.keys[1]", mutate: (s) => void s.sections.verse.keys.push({ beat: 5, scale: "major", tonic: "G" }) },
  { name: "a meter change", path: "sections.chorus.meters[0]", mutate: (s) => void (s.sections.chorus.meters[0].numBeats = 3) },
  { name: "a tempo change", path: "sections.verse.tempos[1]", mutate: (s) => void s.sections.verse.tempos.push({ bpm: 90, beat: 5 }) },
  { name: "a minor key", path: "sections.intro.keys[0].scale", mutate: (s) => Object.values(s.sections).forEach((x) => (x.keys[0].scale = "minor")) },
  { name: "an unsupported chord", path: "sections.verse.chords[0].root", mutate: (s) => void (s.sections.verse.chords[0].root = 9) },
  { name: "a note above C8", path: "sections.verse.notes[0].sd", mutate: (s) => void (s.sections.verse.notes[0].octave = 4) },
  { name: "a note after the end of its section", path: "sections.verse.notes[7].beat", mutate: (s) => void (s.sections.verse.notes[7].beat = 9) },
  { name: "a missing end beat", path: "sections.verse.endBeat", mutate: (s) => void delete s.sections.verse.endBeat },
];

for (const c of MALFORMED) {
  test(`malformed input fails naming the path and produces no song: ${c.name}`, () => {
    const r = convert(c.mutate);
    assert.equal(r.ok, false);
    assert.equal(r.song, undefined, "no partial output");
    assert.ok(r.errors.some((e) => e.path === c.path), `expected ${c.path}, got ${JSON.stringify(r.errors)}`);
  });
}

test("counter-proof: the unmodified capture converts, so each failure above comes from its own mutation", () => {
  assert.equal(convert().ok, true);
});

test("a missing tempo message names the tempo", () => {
  const r = convert((s) => delete s.sections.verse.tempos);
  assert.match(r.errors.find((e) => e.path === "sections.verse.tempos").message, /tempo/);
});

test("input that is not a capture fails cleanly", () => {
  for (const bad of [null, [], "x", {}, { sections: null }, { sections: {} }, { sections: { verse: 1 } }]) {
    assert.equal(convertHooktheory(bad).ok, false, JSON.stringify(bad));
  }
});
