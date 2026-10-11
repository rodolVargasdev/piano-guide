import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSong, validateIndex } from "../../src/core/schema.js";
import { validSong, mutated, notesOf } from "../fixtures/helpers.js";

const hasError = (result, path, rule) => result.errors.some((e) => e.path === path && (rule === undefined || e.rule === rule));
const hasWarning = (result, path) => result.warnings.some((w) => w.path === path);
const lenient = (song) => void (song.levels.beginner.strictBars = false);
const N0 = "levels.beginner.notes[0]";

test("the valid fixture passes with no errors and no warnings", () => {
  const r = validateSong(validSong());
  assert.deepEqual(r, { ok: true, errors: [], warnings: [] });
});

// One named malformed fixture per rule. Each case carries its counter-proof (run below):
// with that single rule disabled the same input must pass, so the failure comes from that rule alone.
const MALFORMED = [
  // Rule 1: required fields, types, tempo range
  { name: "R1 missing meter", rule: "R1", path: "meter", mutate: (s) => void delete s.meter },
  { name: "R1 missing title", rule: "R1", path: "title", mutate: (s) => void delete s.title },
  { name: "R1 tempo.bpm is a string", rule: "R1", path: "tempo.bpm", mutate: (s) => void (s.tempo.bpm = "72") },
  { name: "R1 tempo.bpm below 20", rule: "R1", path: "tempo.bpm", mutate: (s) => void (s.tempo.bpm = 19) },
  { name: "R1 tempo.bpm above 300", rule: "R1", path: "tempo.bpm", mutate: (s) => void (s.tempo.bpm = 301) },
  { name: "R1 unknown beat unit", rule: "R1", path: "tempo.beatUnit", mutate: (s) => void (s.tempo.beatUnit = "whole") },
  { name: "R1 bad key tonic", rule: "R1", path: "key.tonic", mutate: (s) => void (s.key.tonic = "H") },
  { name: "R1 length is not whole bars", rule: "R1", path: "lengthTicks", mutate: (s) => void (s.lengthTicks = 3841) },
  { name: "R1 schemaVersion 2", rule: "R1", path: "schemaVersion", mutate: (s) => void (s.schemaVersion = 2) },
  { name: "R1 lesson ornaments is not an array", rule: "R1", path: "lesson.beginner.ornaments", mutate: (s) => void (s.lesson.beginner.ornaments = "turn") },
  { name: "R1 lesson ornament without text", rule: "R1", path: "lesson.beginner.ornaments[0]", mutate: (s) => void (s.lesson.beginner.ornaments = [{ tick: 0, name: "Turn" }]) },
  { name: "R1 lesson ornament with a fractional tick", rule: "R1", path: "lesson.beginner.ornaments[0]", mutate: (s) => void (s.lesson.beginner.ornaments = [{ tick: 1.5, name: "Turn", text: "Quick." }]) },
  // Rule 2: levels
  { name: "R2 levels empty", rule: "R2", path: "levels", mutate: (s) => void (s.levels = {}) },
  { name: "R2 defaultLevel missing from levels", rule: "R2", path: "defaultLevel", mutate: (s) => void (s.defaultLevel = "original") },
  {
    name: "R2 unknown level id",
    rule: "R2",
    path: "levels.expert",
    mutate: (s) => {
      s.levels.expert = s.levels.beginner;
      delete s.levels.beginner;
      s.defaultLevel = "expert";
    },
  },
  // Rule 3: sources
  { name: "R3 sources empty", rule: "R3", path: "sources", mutate: (s) => void (s.sources = []) },
  { name: "R3 source without url", rule: "R3", path: "sources[0].url", mutate: (s) => void delete s.sources[0].url },
  { name: "R3 source with unknown kind", rule: "R3", path: "sources[0].kind", mutate: (s) => void (s.sources[0].kind = "blog") },
  { name: "R3 source without what", rule: "R3", path: "sources[0].what", mutate: (s) => void delete s.sources[0].what },
  { name: "R3 source with a bad date", rule: "R3", path: "sources[0].accessed", mutate: (s) => void (s.sources[0].accessed = "10/10/2026") },
  // Rule 4: confidence
  { name: "R4 confidence empty", rule: "R4", path: "confidence", mutate: (s) => void (s.confidence = []) },
  { name: "R4 confidence level maybe", rule: "R4", path: "confidence[0].level", mutate: (s) => void (s.confidence[0].level = "maybe") },
  // Rule 5: transcribed levels need a public-domain score on an accepted host
  { name: "R5 transcribed without a public-domain source", rule: "R5", path: "levels.beginner.transcribed", mutate: (s) => void (s.levels.beginner.transcribed = true) },
  ...[
    ["host spoof by suffix of a longer name", "https://mutopiaproject.org.evil.example/x"],
    ["host spoof by prefix", "https://evilmutopiaproject.org/x"],
    ["host spoof by userinfo", "https://mutopiaproject.org@evil.example/x"],
    ["unrelated host", "https://example.org/score"],
  ].map(([label, url]) => ({
    name: `R5 ${label}`,
    rule: "R5",
    path: "levels.beginner.transcribed",
    mutate: (s) => {
      s.levels.beginner.transcribed = true;
      s.sources.push({ url, what: "Score", accessed: "2026-10-10", kind: "public-domain-score" });
    },
  })),
  {
    name: "R5 accepted host with the wrong kind",
    rule: "R5",
    path: "levels.beginner.transcribed",
    mutate: (s) => {
      s.levels.beginner.transcribed = true;
      s.sources.push({ url: "https://www.mutopiaproject.org/x", what: "Score", accessed: "2026-10-10", kind: "reference" });
    },
  },
  // Rule 6: chords-only forbids melody and lyrics text anywhere
  { name: "R6 melody role under chords-only", rule: "R6", path: `${N0}.role`, mutate: (s) => void ((s.contentPolicy = "chords-only"), (notesOf(s)[0].role = "melody")) },
  {
    name: "R6 lyrics nested three levels deep",
    rule: "R6",
    path: "lesson.beginner.a.b.lyrics",
    mutate: (s) => void ((s.contentPolicy = "chords-only"), (s.lesson.beginner.a = { b: { lyrics: "some words" } })),
  },
  {
    name: "R6 lyrics inside an array of objects",
    rule: "R6",
    path: "lesson.beginner.items[1].lyrics",
    mutate: (s) => void ((s.contentPolicy = "chords-only"), (s.lesson.beginner.items = [{}, { lyrics: ["line one"] }])),
  },
  // Rule 7: event fields
  { name: "R7 finger 6", rule: "R7", path: `${N0}.finger`, mutate: (s) => void (notesOf(s)[0].finger = 6) },
  { name: "R7 finger is not an integer", rule: "R7", path: `${N0}.finger`, mutate: (s) => void (notesOf(s)[0].finger = 2.5) },
  { name: "R7 pitch above C8", rule: "R7", path: `${N0}.pitch`, mutate: (s) => void (notesOf(s)[0].pitch = "C9") },
  { name: "R7 pitch below A0", rule: "R7", path: `${N0}.pitch`, mutate: (s) => void (notesOf(s)[0].pitch = "G0") },
  { name: "R7 unparsable pitch", rule: "R7", path: `${N0}.pitch`, mutate: (s) => void (notesOf(s)[0].pitch = "H4") },
  { name: "R7 non-rest event without pitch", rule: "R7", path: `${N0}.pitch`, mutate: (s) => void delete notesOf(s)[0].pitch },
  { name: "R7 bad hand", rule: "R7", path: `${N0}.hand`, mutate: (s) => void (lenient(s), (notesOf(s)[0].hand = "X")) },
  { name: "R7 voice 3", rule: "R7", path: `${N0}.voice`, mutate: (s) => void (lenient(s), (notesOf(s)[0].voice = 3)) },
  { name: "R7 unknown ornament", rule: "R7", path: `${N0}.ornament`, mutate: (s) => void (notesOf(s)[0].ornament = "slide") },
  // Rule 8: event bounds (lenient bars so only the bounds rule is in play)
  { name: "R8 negative tick", rule: "R8", path: `${N0}.tick`, mutate: (s) => void (lenient(s), (notesOf(s)[0].tick = -1)) },
  { name: "R8 zero duration", rule: "R8", path: `${N0}.dur`, mutate: (s) => void (lenient(s), (notesOf(s)[0].dur = 0)) },
  { name: "R8 fractional duration", rule: "R8", path: `${N0}.dur`, mutate: (s) => void (lenient(s), (notesOf(s)[0].dur = 480.5)) },
  { name: "R8 event ends after the song", rule: "R8", path: "levels.beginner.notes[4]", mutate: (s) => void (lenient(s), (notesOf(s)[4].dur = 2000)) },
  // Rule 9: overlaps in one hand and voice
  {
    name: "R9 overlapping notes in the same hand and voice",
    rule: "R9",
    path: "levels.beginner.notes[8]",
    mutate: (s) => void (lenient(s), notesOf(s).push({ tick: 480, dur: 480, pitch: "D4", hand: "R" })),
  },
  // Rule 10: strictBars coverage and barline crossing
  { name: "R10 a bar is not covered", rule: "R10", path: "levels.beginner.notes", mutate: (s) => void notesOf(s).splice(4, 1) },
  { name: "R10 an event crosses a barline", rule: "R10", path: "levels.beginner.notes[0]", mutate: (s) => void ((notesOf(s)[0].dur = 2400), notesOf(s).splice(4, 1)) },
  // Rule 11: sections and chords
  { name: "R11 overlapping sections", rule: "R11", path: "sections[1]", mutate: (s) => void (s.sections = [{ id: "a", name: "A", startTick: 0, endTick: 2000 }, { id: "b", name: "B", startTick: 1000, endTick: 3840 }]) },
  { name: "R11 section outside the song", rule: "R11", path: "sections[0]", mutate: (s) => void (s.sections[0].endTick = 4000) },
  { name: "R11 chord outside the song", rule: "R11", path: "chords[1]", mutate: (s) => void (s.chords[1].tick = 3000) },
  { name: "R11 unsorted chords", rule: "R11", path: "chords[1]", mutate: (s) => void s.chords.reverse() },
];

for (const c of MALFORMED) {
  test(`malformed fixture is rejected with its path: ${c.name}`, () => {
    const r = validateSong(mutated(c.mutate));
    assert.equal(r.ok, false);
    assert.ok(hasError(r, c.path, c.rule), `expected ${c.rule} at ${c.path}, got ${JSON.stringify(r.errors)}`);
  });

  test(`counter-proof: the same input passes once ${c.rule} is disabled (${c.name})`, () => {
    const r = validateSong(mutated(c.mutate), { disabledRules: [c.rule] });
    assert.deepEqual(r.errors, []);
  });

  test(`counter-proof: disabling an unrelated rule does not hide it (${c.name})`, () => {
    const other = c.rule === "R1" ? "R2" : "R1";
    assert.equal(validateSong(mutated(c.mutate), { disabledRules: [other] }).ok, false);
  });
}

test("R10 names the bar, hand and voice", () => {
  const r = validateSong(mutated((s) => void notesOf(s).splice(4, 1)));
  assert.match(r.errors.find((e) => e.rule === "R10").message, /bar 2, hand L, voice 1: covers 0 of 1920/);
});

test("R6 reports the key path of nested lyrics", () => {
  const r = validateSong(mutated((s) => void ((s.contentPolicy = "chords-only"), (s.lesson.beginner.a = { b: { lyrics: "words" } }))));
  assert.equal(r.errors.filter((e) => e.rule === "R6").length, 1);
});

test("R5 accepts Mutopia and IMSLP hosts and their subdomains", () => {
  for (const url of ["https://www.mutopiaproject.org/cgibin/x", "https://mutopiaproject.org/x", "https://imslp.org/wiki/x", "https://petrucci.imslp.org/x"]) {
    const r = validateSong(
      mutated((s) => {
        s.levels.beginner.transcribed = true;
        s.sources.push({ url, what: "Score", accessed: "2026-10-10", kind: "public-domain-score" });
      }),
    );
    assert.equal(r.ok, true, url);
  }
});

test("R6 allows empty lyrics text and any lyrics under the open policy", () => {
  assert.equal(validateSong(mutated((s) => void ((s.contentPolicy = "chords-only"), (s.lesson.beginner.x = { lyrics: "  " })))).ok, true);
  assert.equal(validateSong(mutated((s) => void (s.lesson.beginner.x = { lyrics: "words" }))).ok, true);
});

test("R9 allows a chord (same tick and dur), a second voice and grace notes", () => {
  const r = validateSong(
    mutated((s) => {
      lenient(s);
      notesOf(s).push({ tick: 0, dur: 1920, pitch: "D5", hand: "R" }); // chord member
      notesOf(s).push({ tick: 480, dur: 480, pitch: "D5", hand: "R", voice: 2 });
      notesOf(s).push({ tick: 480, dur: 60, pitch: "D5", hand: "R", grace: true });
    }),
  );
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("R10 ignores grace notes and counts chords once", () => {
  const r = validateSong(mutated((s) => void notesOf(s).push({ tick: 960, dur: 60, pitch: "C5", hand: "R", grace: true })));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("R10 12/8 with a pickup: valid bars pass, a short 12/8 bar fails (2880 ticks)", () => {
  const song128 = (barDur) =>
    mutated((s) => {
      s.meter = { num: 12, den: 8 };
      s.tempo = { bpm: 60, beatUnit: "dotted-quarter" };
      s.pickupTicks = 240;
      s.lengthTicks = 240 + 2880;
      s.sections = [];
      s.chords = [];
      s.levels.beginner.notes = [
        { tick: 0, dur: 240, pitch: "Bb4", hand: "R" },
        { tick: 240, dur: barDur, pitch: "Eb5", hand: "R" },
        { tick: 0, dur: 240, hand: "L", rest: true },
        { tick: 240, dur: 2880, pitch: "Eb3", hand: "L" },
      ];
    });
  assert.equal(validateSong(song128(2880)).ok, true);
  const bad = validateSong(song128(2640));
  assert.ok(bad.errors.some((e) => e.rule === "R10" && /bar 1, hand R, voice 1: covers 2640 of 2880/.test(e.message)));
});

test("R10 flags a pickup bar that is not covered", () => {
  const r = validateSong(
    mutated((s) => {
      s.pickupTicks = 480;
      s.lengthTicks = 480 + 1920;
      s.sections = [];
      s.chords = [];
      s.levels.beginner.notes = [{ tick: 480, dur: 1920, pitch: "C4", hand: "R" }];
    }),
  );
  assert.ok(r.errors.some((e) => e.rule === "R10" && /bar 0, hand R, voice 1: covers 0 of 480/.test(e.message)));
});

test("warning: duration outside the notation subset (and counter-cases that stay silent)", () => {
  const withDur = (dur, extra = {}) =>
    validateSong(mutated((s) => void (lenient(s), notesOf(s).push({ tick: 0, dur, pitch: "C5", hand: "R", voice: 2, ...extra }))));
  const odd = withDur(100);
  assert.equal(odd.ok, true);
  assert.ok(hasWarning(odd, "levels.beginner.notes[8].dur"));
  assert.equal(withDur(480).warnings.length, 0);
  assert.equal(withDur(720).warnings.length, 0); // dotted quarter
  assert.equal(withDur(160, { tuplet: { n: 3, inSpaceOf: 2 } }).warnings.length, 0); // triplet eighth
  assert.equal(withDur(100, { grace: true }).warnings.length, 1); // grace notes are still checked
});

test("warning: key signature beyond 4 accidentals (4 stays silent)", () => {
  const key = (tonic) => validateSong(mutated((s) => void (s.key = { tonic, mode: "major" })));
  assert.ok(hasWarning(key("F#"), "key"));
  assert.equal(key("F#").ok, true);
  assert.equal(key("E").warnings.length, 0);
  assert.equal(key("Ab").warnings.length, 0);
  assert.ok(hasWarning(key("Db"), "key")); // 5 flats
});

test("a well-formed lesson ornaments list passes, and so does a lesson without one", () => {
  assert.equal(validateSong(mutated((s) => void (s.lesson.beginner.ornaments = [{ tick: 480, name: "Turn", text: "Four quick notes around the main one." }]))).ok, true);
  assert.equal(validateSong(mutated(() => {})).ok, true);
});

test("warning: a level without a lesson", () => {
  const r = validateSong(mutated((s) => void delete s.lesson.beginner));
  assert.equal(r.ok, true);
  assert.ok(hasWarning(r, "lesson.beginner"));
});

test("the validator never throws on garbage and always reports not ok", () => {
  const garbage = [
    null,
    undefined,
    42,
    "song",
    [],
    mutated((s) => void (s.levels = null)),
    mutated((s) => void (s.levels.beginner = 5)),
    mutated((s) => void (s.levels.beginner.notes = "x")),
    mutated((s) => void (s.levels.beginner.notes = [null, 5, "x", []])),
    mutated((s) => void (s.sources = "none")),
    mutated((s) => void (s.sources = [null, 3])),
    mutated((s) => void (s.confidence = {})),
    mutated((s) => void (s.sections = [null])),
    mutated((s) => void (s.lesson = [])),
    mutated((s) => void (s.key = "C")),
    mutated((s) => void (s.meter = { num: "4", den: 3 })),
  ];
  for (const g of garbage) {
    let r;
    assert.doesNotThrow(() => void (r = validateSong(g)));
    assert.equal(r.ok, false);
  }
});

// ---- validateIndex ----

const entry = () => ({
  id: "example-song",
  file: "example-song.json",
  title: "Example Song",
  composer: "Traditional",
  key: { tonic: "C", mode: "major" },
  defaultBpm: 72,
  levels: ["beginner"],
});

test("validateIndex accepts an empty list and a valid entry", () => {
  assert.equal(validateIndex({ songs: [] }).ok, true);
  assert.deepEqual(validateIndex({ songs: [entry()] }), { ok: true, errors: [], warnings: [] });
});

for (const field of ["id", "file", "title", "composer", "key", "defaultBpm", "levels"]) {
  test(`validateIndex rejects an entry missing ${field}, and passes with I1 disabled`, () => {
    const e = entry();
    delete e[field];
    const r = validateIndex({ songs: [e] });
    assert.ok(hasError(r, `songs[0].${field}`, "I1"), JSON.stringify(r.errors));
    assert.deepEqual(validateIndex({ songs: [e] }, { disabledRules: ["I1"] }).errors, []);
  });
}

test("validateIndex rejects duplicate ids naming the id, and passes with I2 disabled", () => {
  const second = { ...entry(), file: "example-song.json" };
  const r = validateIndex({ songs: [entry(), second] });
  assert.ok(hasError(r, "songs[1].id", "I2"));
  assert.match(r.errors.find((e) => e.rule === "I2").message, /example-song/);
  assert.deepEqual(validateIndex({ songs: [entry(), second] }, { disabledRules: ["I2"] }).errors, []);
});

test("validateIndex rejects a file that is not <id>.json or has a path", () => {
  for (const file of ["other.json", "../example-song.json", "example-song.js", "sub/example-song.json"]) {
    const r = validateIndex({ songs: [{ ...entry(), file }] });
    assert.ok(hasError(r, "songs[0].file", "I1"), file);
  }
});

test("validateIndex rejects a non-index document", () => {
  for (const doc of [null, [], {}, { songs: "x" }, { songs: [null] }]) {
    assert.equal(validateIndex(doc).ok, false, JSON.stringify(doc));
  }
});
