import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSong } from "../src/core/schema.js";
import { transposeInterval } from "../src/core/pitch.js";
import { resolveLevel } from "../src/core/timeline.js";
import { initLesson } from "../src/learn/lesson.js";
import { derivePhrases } from "../src/learn/phrases.js";
import { deriveSteps } from "../src/learn/steps.js";
import { createI18n } from "../src/i18n/i18n.js";
import { STRINGS } from "../src/i18n/strings.js";
import { renderInstruction } from "../src/learn/instructions.js";

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const song = readJson("../songs/ode-to-joy.json");
const fixture = readJson("./fixtures/mutopia-ode-to-joy-onsets.json");
const BAR = 1920;
// The recorded transposition: G major down a perfect fifth to C major (four letter names, seven semitones).
const STEPS = -4;
const SEMITONES = -7;
const rightHand = (s) => s.levels.beginner.notes.filter((n) => n.hand === "R");
const leftHand = (s) => s.levels.beginner.notes.filter((n) => n.hand === "L");
const sourceNotes = (f) => f.notes.split(" ").map((x) => {
  const [tick, pitch, dur] = x.split(":");
  return { tick: Number(tick), pitch, dur: Number(dur) };
});
/** What is wrong with a right hand compared to the source notes moved by an interval (empty means it matches). */
const melodyProblems = (right, source, steps = STEPS, semitones = SEMITONES) => {
  if (right.length !== source.length) return [`${right.length} notes, the source has ${source.length}`];
  const problems = [];
  source.forEach((n, i) => {
    const want = transposeInterval(n.pitch, steps, semitones);
    if (right[i].pitch !== want) problems.push(`note ${i + 1}: ${right[i].pitch}, expected ${want}`);
    if (right[i].tick !== n.tick || right[i].dur !== n.dur) problems.push(`note ${i + 1}: rhythm differs`);
  });
  return problems;
};

test("the song validates with no error and no warning", () => {
  const r = validateSong(song);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(song.id, "ode-to-joy");
  assert.equal(song.contentPolicy, "open");
  assert.deepEqual(song.key, { tonic: "C", mode: "major" });
  assert.deepEqual(song.meter, { num: 4, den: 4 });
  assert.equal(song.lengthTicks, 16 * BAR);
  assert.equal(song.defaultLevel, "beginner");
  assert.deepEqual(Object.keys(song.levels), ["beginner"]);
  assert.equal(song.levels.beginner.transcribed, true);
});

test("provenance is complete: page, file, Mutopia id, license, SHA-256 of the exact file and the access date", () => {
  const s = song.sources.find((x) => x.kind === "public-domain-score");
  assert.equal(s.url, "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528");
  assert.equal(s.fileUrl, "https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode.ly");
  assert.equal(s.mutopiaId, "Mutopia-2009/08/05-528");
  assert.equal(s.license, "Public Domain");
  assert.match(s.sha256, /^[0-9a-f]{64}$/);
  assert.match(s.accessed, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(s.sha256, fixture.source.sha256, "the song and the fixture name the same file");
  assert.match(s.what, /perfect fifth/);
  assert.match(s.what, /four letter names and seven semitones/);
  assert.match(s.what, /soprano/);
  assert.ok(s.maintainer && s.licenseUrl);
  // The left hand is declared as the editorial arrangement it is, not as part of the transcription.
  const own = song.sources.find((x) => x.kind === "original-arrangement");
  assert.match(own.what, /NOT taken from/);
  assert.equal(song.confidence.find((c) => c.scope === "left hand").level, "low");
});

test("the fixture holds the source: 62 soprano notes in 16 bars and the first eight pitches of the tune", () => {
  const notes = sourceNotes(fixture);
  assert.equal(notes.length, 62);
  assert.equal(fixture.source.bars, 16);
  assert.equal(notes.at(-1).tick + notes.at(-1).dur, 16 * BAR);
  assert.deepEqual(notes.slice(0, 8).map((n) => n.pitch), ["B4", "B4", "C5", "D5", "D5", "C5", "B4", "A4"]);
  assert.equal(fixture.source.voice, "sop");
  assert.equal(fixture.source.key, "G major");
  assert.match(fixture.source.mutopiaId, /^Mutopia-2009\/08\/05-528$/);
  assert.equal(fixture.source.bytes, 2907);
});

test("the right hand equals the fixture moved down a fifth: same rhythm, every pitch", () => {
  assert.deepEqual(melodyProblems(rightHand(song), sourceNotes(fixture)), []);
  assert.deepEqual(rightHand(song).slice(0, 8).map((n) => n.pitch), ["E4", "E4", "F4", "G4", "G4", "F4", "E4", "D4"]);
});

test("counter-proof: one changed note, one moved onset or a wrong interval makes the comparison fail", () => {
  const source = sourceNotes(fixture);
  const oneNote = structuredClone(rightHand(song));
  oneNote[10].pitch = "E4";
  assert.ok(melodyProblems(oneNote, source).some((p) => p.startsWith("note 11")));
  const moved = structuredClone(rightHand(song));
  moved[3].tick += 1;
  assert.ok(melodyProblems(moved, source).some((p) => p.includes("rhythm")));
  assert.notDeepEqual(melodyProblems(rightHand(song), source, -3, -5), [], "a fourth instead of a fifth does not match");
  assert.ok(melodyProblems(rightHand(song).slice(1), source)[0].includes("61 notes"));
});

test("the tune sits on the white keys: C4 to G4 and one low G3 in bar 12", () => {
  const pitches = rightHand(song).map((n) => n.pitch);
  assert.ok(pitches.every((p) => /^[A-G]\d$/.test(p)), "naturals only");
  assert.deepEqual([...new Set(pitches)].sort(), ["C4", "D4", "E4", "F4", "G3", "G4"]);
  const low = rightHand(song).filter((n) => n.pitch === "G3");
  assert.equal(low.length, 1);
  assert.equal(low[0].tick, 11 * BAR + 960, "bar 12, beat 3, the jump down the source writes");
});

test("the left hand is an editorial whole note per bar, C3 or G2, with the chord of that bar", () => {
  const left = leftHand(song);
  assert.equal(left.length, 16);
  left.forEach((n, i) => {
    assert.equal(n.tick, i * BAR);
    assert.equal(n.dur, BAR);
    assert.equal(n.role, "bass");
    assert.ok(["C3", "G2"].includes(n.pitch), n.pitch);
    assert.equal(song.chords[i].symbol, n.pitch === "C3" ? "C" : "G", `bar ${i + 1} chord`);
  });
  assert.ok(rightHand(song).every((n) => n.role === "melody"));
});

test("eight two-bar phrases cover the song, each has a one-sentence hint in English and Spanish and at most nine steps", () => {
  const phrases = song.levels.beginner.learn.phrases;
  assert.equal(phrases.length, 8);
  phrases.forEach((p, i) => {
    assert.equal(p.startTick, i * 2 * BAR);
    assert.equal(p.endTick, (i + 1) * 2 * BAR);
    for (const lang of ["en", "es"]) {
      assert.equal((p.hint[lang].match(/[.!?]/g) ?? []).length, 1, `${p.id} ${lang}: one sentence`);
      assert.ok(p.hint[lang].split(/\s+/).length <= 12, `${p.id} ${lang}: short`);
    }
    const inside = rightHand(song).filter((n) => n.tick >= p.startTick && n.tick < p.endTick);
    assert.ok(inside.length >= 7 && inside.length <= 9, `${p.id}: ${inside.length} notes`);
  });
});

test("no lyric text anywhere in the file", () => {
  const text = JSON.stringify(song);
  assert.doesNotMatch(text, /"lyrics?"/i);
  assert.doesNotMatch(text, /Freude|Götterfunken|Elysium|Tochter aus/i);
  assert.doesNotMatch(JSON.stringify(fixture), /"lyrics?"/i);
});

test("every text of the lesson is available in English and Spanish and uses plain punctuation", () => {
  for (const value of [song.levels.beginner.label, song.levels.beginner.description, song.lesson.beginner.summary, song.lesson.beginner.posture, ...song.levels.beginner.learn.phrases.map((p) => p.hint)]) {
    assert.ok(value.en && value.es);
    assert.doesNotMatch(`${value.en} ${value.es}`, /[–—…“”→·]/);
  }
  const voseo = /\b(podés|tenés|mirá|escribí|dejá|acá|vos)\b/i;
  assert.doesNotMatch(JSON.stringify(song), voseo);
});

test("Learn opens it: the first step is plain, every stage has steps, the low G is a hand move", () => {
  const i18n = createI18n({ table: STRINGS, navigatorLanguage: "en", warn: () => {} });
  const s = initLesson({ song, levelId: "beginner" });
  assert.equal(s.silent, false, "a public song: Listen is offered");
  assert.equal(s.plan.length, 8 * 4 + 1, "four stages for each of the eight phrases and the whole song");
  assert.ok(s.plan.every((u) => u.hand && u.tempo));
  assert.equal(renderInstruction(i18n.t, s.steps[0].instruction, "en"), "Right hand: index finger on E (Mi).");
  assert.deepEqual(s.steps.map((st) => st.keys[0].finger), [2, 2, 3, 4, 4, 3, 2, 1], "the first phrase spans D to G: thumb on D");
  const tl = resolveLevel(song, "beginner");
  const phrases = derivePhrases(tl);
  const steps6 = deriveSteps(tl, phrases[5], "R", { key: tl.key });
  assert.equal(steps6.length, 8);
  const low = steps6.find((st) => st.keys[0].pitch === "G3");
  assert.equal(low.instruction.key, "step.move", "the jump down to G3 moves the hand");
  assert.match(renderInstruction(i18n.t, low.instruction, "en"), /^Move the right hand: thumb on /);
  // Every step of every phrase and hand has fingers 1 to 5 and nothing is left unplayable.
  for (const [i, p] of phrases.entries()) {
    for (const hand of ["R", "L"]) {
      const steps = deriveSteps(tl, p, hand, { key: tl.key });
      assert.ok(steps.length > 0, `phrase ${i + 1} ${hand} has steps`);
      assert.ok(steps.every((st) => st.keys.every((k) => k.finger >= 1 && k.finger <= 5)), `fingers 1 to 5 in phrase ${i + 1} ${hand}`);
    }
  }
});
