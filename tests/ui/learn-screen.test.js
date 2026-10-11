import { test } from "node:test";
import assert from "node:assert/strict";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";
import { initLesson, reduce } from "../../src/learn/lesson.js";
import { screenModel } from "../../src/ui/learn-screen.js";
import { BAR, Q, learnSong, note } from "../fixtures/learn-songs.js";

const NOTES = [note(0, Q, "C4"), note(Q, Q, "D4"), note(2 * Q, Q, "C4"), note(2 * Q, Q, "E4"), note(2 * Q, Q, "G4"), note(BAR, Q, "E4"), note(0, 2 * Q, "C3", "L")];
const LEARN = { phrases: [{ id: "a", startTick: 0, endTick: BAR, hint: { en: "Take it slowly.", es: "Con calma." } }, { id: "b", startTick: BAR, endTick: 2 * BAR }] };
const song = (extra = {}) => ({ ...learnSong({ notes: NOTES, bars: 2, learn: LEARN }).song, ...extra });
const i18nFor = (lang = "en") => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => {} });
const lesson = (extra = {}, songExtra = {}) => initLesson({ song: song(songExtra), levelId: "beginner", ...extra });
const step = (s, ...actions) => actions.reduce((state, a) => reduce(state, typeof a === "string" ? { type: a } : a).state, s);
const ids = (m) => m.actions.map((a) => a.id);
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

test("start: one plain instruction and one action; with saved progress Continue is first and Start over second", () => {
  const m = screenModel(lesson(), { i18n: i18nFor(), lessonZero: "done" });
  assert.equal(m.heading, "Press Start. The screen tells you which finger goes on which key, one step at a time.");
  assert.deepEqual(ids(m), ["START"]);
  assert.equal(m.sub, "", "a public song says nothing about silence");
  const saved = screenModel(lesson(), { i18n: i18nFor(), hasSaved: true, lessonZero: "done" });
  assert.deepEqual(saved.actions.map((a) => [a.id, a.primary]), [["CONTINUE", true], ["START", false]]);
  assert.deepEqual(saved.actions.map((a) => a.label), ["Continue", "Start over"]);
});

test("a private song says at the start that the app does not play it, and is never offered Listen in any phase", () => {
  let s = lesson({}, { visibility: "private" });
  assert.equal(screenModel(s, { i18n: i18nFor(), lessonZero: "done" }).sub, "The app does not play this song. It only tells you what to play.");
  const seen = new Set();
  for (const a of ["START", "NOTE_ON:60", "NOTE_ON:62", "NOTE_ON:60", "NOTE_ON:64", "NOTE_ON:67", "NEXT_PHRASE", "REPEAT"]) {
    s = a.startsWith("NOTE_ON") ? reduce(s, { type: "NOTE_ON", midi: Number(a.split(":")[1]) }).state : step(s, a);
    for (const id of ids(screenModel(s, { i18n: i18nFor() }))) seen.add(id);
  }
  assert.ok(seen.has("REPEAT"), "the walk reached My turn");
  assert.equal(seen.has("LISTEN") || seen.has("LISTEN_AGAIN"), false);
});

test("phrase intro of a public song: Listen first, My turn second, and the authored hint in the language", () => {
  const s = step(lesson(), "START");
  const en = screenModel(s, { i18n: i18nFor("en") });
  assert.equal(en.heading, "Phrase 1 of 2.");
  assert.equal(en.sub, "Right hand, slowly. Take it slowly.", "the stage is named because phrase 1 has a left hand too");
  assert.deepEqual(en.actions.map((a) => [a.id, a.label, a.primary]), [["LISTEN", "Listen", true], ["MY_TURN", "My turn", false]]);
  const es = screenModel(s, { i18n: i18nFor("es") });
  assert.equal(es.heading, "Frase 1 de 2.");
  assert.equal(es.sub, "Mano derecha, despacio. Con calma.");
});

test("My turn: the heading is the one instruction of the step, in English and Spanish, with the progress line", () => {
  const s = step(lesson(), "START", "MY_TURN");
  const en = screenModel(s, { i18n: i18nFor("en") });
  assert.equal(en.heading, "Right hand: thumb on C (Do).");
  assert.equal(en.progress, "Phrase 1 of 2. Right hand, slowly. Step 1 of 3");
  assert.equal(en.sub, "Press the key marked with the finger number.");
  assert.equal(screenModel(s, { i18n: i18nFor("es") }).heading, "Mano derecha: pulgar en Do (C).");
  assert.deepEqual(ids(en), ["LISTEN_AGAIN", "REPEAT"]);
});

test("every instruction of the phrase is at most two sentences and 25 words in both languages (one thing at a time)", () => {
  let s = step(lesson(), "START", "MY_TURN");
  for (let i = 0; i < s.steps.length; i += 1) {
    for (const lang of ["en", "es"]) {
      const h = screenModel({ ...s, stepIndex: i }, { i18n: i18nFor(lang) }).heading;
      assert.ok(sentences(h).length <= 2 && h.split(/\s+/).length <= 25, h);
    }
  }
});

test("feedback: a wrong key shows Try again with a kind line, the octave variant says so, a correct step shows Correct", () => {
  let s = step(lesson(), "START", "MY_TURN");
  const wrong = reduce(s, { type: "NOTE_ON", midi: 61 }).state;
  assert.deepEqual(screenModel(wrong, { i18n: i18nFor() }).chip, { kind: "wrong", text: "Try again", detail: "Use the shaded key." });
  assert.equal(screenModel(wrong, { i18n: i18nFor("es") }).chip.text, "Intente de nuevo");
  const octave = reduce(s, { type: "NOTE_ON", midi: 72 }).state;
  assert.equal(screenModel(octave, { i18n: i18nFor() }).chip.detail, "Right note, other octave.");
  const right = reduce(s, { type: "NOTE_ON", midi: 60 }).state;
  assert.deepEqual(screenModel(right, { i18n: i18nFor() }).chip, { kind: "correct", text: "Correct", detail: "" });
  assert.equal(screenModel(s, { i18n: i18nFor() }).chip, null, "no feedback before any key");
});

const play = (s, midis) => midis.reduce((state, midi) => reduce(reduce(state, { type: "NOTE_ON", midi }).state, { type: "NOTE_OFF", midi }).state, s);

test("stage complete: names what was done and what comes next in one plain sentence, Next stage is the primary action", () => {
  let s = step(lesson({}, { visibility: "private" }), "START");
  s = play(s, [60, 62, 60, 64, 67]);
  assert.equal(s.phase, "stageComplete", "phrase 1 has a left hand, so the right-hand stage is followed by another stage");
  const m = screenModel(s, { i18n: i18nFor() });
  assert.equal(m.heading, "Correct. Stage done: Right hand.");
  assert.equal(m.sub, "Now the left hand, slowly.");
  assert.deepEqual(m.actions.map((a) => [a.id, a.primary]), [["NEXT_STAGE", true], ["NEXT_PHRASE", false], ["REPEAT", false]]);
  const es = screenModel(s, { i18n: i18nFor("es") });
  assert.equal(es.heading, "Correcto. Terminó esta etapa: Mano derecha.");
  assert.equal(es.sub, "Ahora la mano izquierda, despacio.");
  // The next stage reads "Left hand, slowly" and shows the left-hand instruction.
  const left = step(s, "NEXT_STAGE");
  const lm = screenModel(left, { i18n: i18nFor() });
  assert.equal(lm.heading, "Left hand: little finger on C (Do).");
  assert.equal(lm.progress, "Phrase 1 of 2. Left hand, slowly. Step 1 of 1");
  // After the left hand comes both hands together, slowly, with one step per moment either hand starts.
  const afterLeft = step(play(left, [48]), "NEXT_STAGE");
  assert.equal(screenModel(afterLeft, { i18n: i18nFor() }).progress, "Phrase 1 of 2. Both hands, slowly. Step 1 of 3");
});

test("phrase complete, section and song stages and song complete: one sentence each, the next action is the primary one", () => {
  // A right-hand song with two phrases: one stage per phrase, then the whole song at the song tempo.
  const right = [note(0, Q, "C4"), note(Q, Q, "D4"), note(BAR, Q, "E4")];
  const song2 = learnSong({ notes: right, bars: 2, learn: { phrases: [{ id: "a", startTick: 0, endTick: BAR }, { id: "b", startTick: BAR, endTick: 2 * BAR }] } }).song;
  let s = step(initLesson({ song: { ...song2, visibility: "private" }, levelId: "beginner" }), "START");
  s = play(s, [60, 62]);
  assert.equal(s.phase, "phraseComplete");
  let m = screenModel(s, { i18n: i18nFor() });
  assert.equal(m.heading, "Correct. Phrase 1 of 2 done.");
  assert.deepEqual(m.actions.map((a) => [a.id, a.primary]), [["NEXT_PHRASE", true], ["REPEAT", false]]);
  s = play(step(s, "NEXT_PHRASE"), [64]);
  assert.equal(s.phase, "stageComplete", "after the last phrase the whole song is the next stage");
  m = screenModel(s, { i18n: i18nFor() });
  assert.equal(m.sub, "Now the whole song.");
  assert.deepEqual(ids(m), ["NEXT_STAGE", "REPEAT"], "no Next phrase when there is no later phrase");
  s = step(s, "NEXT_STAGE");
  assert.equal(s.phase, "yourTurn");
  assert.equal(screenModel(s, { i18n: i18nFor() }).progress, "Whole song, right hand. Step 1 of 3");
  s = play(s, [60, 62, 64]);
  assert.equal(s.phase, "songComplete");
  const done = screenModel(s, { i18n: i18nFor() });
  assert.equal(done.heading, "You played the whole song.");
  assert.deepEqual(ids(done), ["START"]);
  assert.equal(done.actions[0].label, "Start over");
});

test("counter-proof: the same private walk on a public song does offer Listen again", () => {
  const s = step(lesson(), "START", "MY_TURN");
  assert.ok(ids(screenModel(s, { i18n: i18nFor() })).includes("LISTEN_AGAIN"));
});
