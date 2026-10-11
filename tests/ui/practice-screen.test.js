import { test } from "node:test";
import assert from "node:assert/strict";
import { announcement, choiceModel, screenModel } from "../../src/ui/practice-screen.js";
import { initSession, reduceSession } from "../../src/practice/session.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const i18nIn = (lang) => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });
const run = (s, ...actions) => actions.reduce((st, a) => reduceSession(st, a).state, s);
function finish(s) {
  let st = reduceSession(s, { type: "START" }).state;
  let guard = 0;
  while (st.phase === "running" && guard++ < 100) for (const k of st.run.steps[st.run.index].keys) st = reduceSession(reduceSession(st, { type: "NOTE_ON", midi: k.midi }).state, { type: "NOTE_OFF", midi: k.midi }).state;
  return st;
}
const ids = (m) => m.actions.map((a) => a.id);

test("ready: the goal, how to start, and Start (primary) with Listen", () => {
  const m = screenModel(initSession({ exerciseId: "scale-major" }), { i18n: i18nIn("en") });
  assert.equal(m.heading, "Play the notes of a major scale in order, with the standard fingering.");
  assert.match(m.sub, /^Press Start, then press the shaded key/);
  assert.match(m.sub, /Press Listen to hear it first\.$/);
  assert.deepEqual(m.actions, [{ id: "START", label: "Start", primary: true }, { id: "LISTEN", label: "Listen", primary: false }]);
  assert.equal(m.tempo, "Tempo 50");
});

test("listening: Listen. and only Stop; running: the step, its count and Stop", () => {
  const s = initSession({ exerciseId: "scale-major" });
  assert.equal(screenModel(run(s, { type: "LISTEN" }), { i18n: i18nIn("en") }).heading, "Listen.");
  assert.deepEqual(ids(screenModel(run(s, { type: "LISTEN" }), { i18n: i18nIn("en") })), ["STOP"]);
  const m = screenModel(run(s, { type: "START" }), { i18n: i18nIn("en") });
  assert.equal(m.heading, "Right hand: thumb on C (Do).");
  assert.equal(m.progress, "Step 1 of 8");
  assert.deepEqual(ids(m), ["STOP"]);
});

test("running with feedback: Correct, or Try again with the kind line, or the octave line", () => {
  const st = run(initSession({ exerciseId: "scale-major" }), { type: "START" });
  const t = (feedback) => screenModel(st, { i18n: i18nIn("en"), feedback });
  assert.deepEqual(t({ kind: "correct" }).chip, { kind: "correct", text: "Correct", detail: "" });
  assert.deepEqual(t({ kind: "wrong" }).chip, { kind: "wrong", text: "Try again", detail: "Use the shaded key." });
  assert.equal(t({ kind: "octave" }).chip.detail, "Right note, other octave.");
  assert.equal(t(null).chip, null);
});

test("a chord step shows the chord symbol under the instruction", () => {
  const st = run(initSession({ exerciseId: "cadence-i-iv-v-i" }), { type: "START" });
  assert.equal(screenModel(st, { i18n: i18nIn("en") }).sub, "Chord: C");
});

test("done and clean at a tempo below the top: Faster is the main action, then Again, the next hand, the next key and Listen", () => {
  const m = screenModel(finish(initSession({ exerciseId: "scale-major" })), { i18n: i18nIn("en") });
  assert.equal(m.heading, "Clean run: no wrong key. Well done.");
  assert.equal(m.sub, "Next tempo to try: 60.");
  assert.deepEqual(m.actions.map((a) => [a.id, a.primary]), [["AGAIN", false], ["FASTER", true], ["NEXT_STAGE", false], ["NEXT_KEY", false], ["LISTEN", false]]);
  assert.equal(m.actions[1].label, "Faster: 60");
  assert.equal(m.actions[2].label, "Next: left hand");
});

test("done and clean at the top tempo: it says so, there is no Faster, and the next hand becomes the main action", () => {
  const m = screenModel(finish(initSession({ exerciseId: "scale-major", bpm: 88 })), { i18n: i18nIn("en") });
  assert.equal(m.sub, "Top tempo of this card.");
  assert.deepEqual(ids(m), ["AGAIN", "NEXT_STAGE", "NEXT_KEY", "LISTEN"]);
  assert.equal(m.actions.find((a) => a.id === "NEXT_STAGE").primary, true);
});

test("done with every hand stage finished, at the top tempo: Again is the main action and there is no next hand", () => {
  const m = screenModel(finish(initSession({ exerciseId: "scale-major", bpm: 88, options: { hand: "T" } })), { i18n: i18nIn("en") });
  assert.deepEqual(m.actions.map((a) => [a.id, a.primary]), [["AGAIN", true], ["NEXT_KEY", false], ["LISTEN", false]]);
});

test("done with a wrong key: how many, Again as the main action, and no tempo step", () => {
  let st = reduceSession(initSession({ exerciseId: "scale-major", bpm: 60 }), { type: "START" }).state;
  st = reduceSession(st, { type: "NOTE_ON", midi: 21 }).state;
  st = reduceSession(st, { type: "NOTE_OFF", midi: 21 }).state;
  st = finishFrom(st);
  const m = screenModel(st, { i18n: i18nIn("en") });
  assert.equal(m.heading, "Finished, with 1 wrong key. Try again for a clean run.");
  assert.equal(m.chip, null);
  assert.equal(m.sub, "");
  assert.equal(m.actions[0].primary, true);
  assert.equal(ids(m).includes("FASTER"), false);
  st = { ...st, result: { ...st.result, wrong: 3 } };
  assert.equal(screenModel(st, { i18n: i18nIn("en") }).heading, "Finished, with 3 wrong keys. Try again for a clean run.");
});

function finishFrom(s) {
  let st = s;
  let guard = 0;
  while (st.phase === "running" && guard++ < 100) for (const k of st.run.steps[st.run.index].keys) st = reduceSession(reduceSession(st, { type: "NOTE_ON", midi: k.midi }).state, { type: "NOTE_OFF", midi: k.midi }).state;
  return st;
}

test("the same key rotation setting hides Next key: with Same key there is nothing next", () => {
  const m = screenModel(finish(initSession({ exerciseId: "scale-major", rotation: "same" })), { i18n: i18nIn("en") });
  assert.equal(ids(m).includes("NEXT_KEY"), false);
});

test("everything reads in Spanish", () => {
  const m = screenModel(finish(initSession({ exerciseId: "scale-major" })), { i18n: i18nIn("es") });
  assert.equal(m.heading, "Ejecución limpia: ninguna tecla equivocada. Bien hecho.");
  assert.deepEqual(m.actions.map((a) => a.label), ["Otra vez", "Más rápido: 60", "Siguiente: mano izquierda", "Siguiente tonalidad", "Escuchar"]);
  assert.match(screenModel(initSession({ exerciseId: "scale-major" }), { i18n: i18nIn("es") }).heading, /^Tocar las notas de una escala mayor/);
});

test("announcements: the next key and the next hand in one line, Try again with its help, nothing for a plain press", () => {
  const i18n = i18nIn("en");
  assert.equal(announcement({ kind: "nextKey", key: "G" }, { i18n }), "Next key: G major");
  assert.equal(announcement({ kind: "stage", hand: "L" }, { i18n }), "Now: left hand");
  assert.equal(announcement({ kind: "wrong", midi: 61 }, { i18n }), "Try again. Use the shaded key.");
  assert.equal(announcement({ kind: "octave", midi: 72 }, { i18n }), "Try again. Right note, other octave.");
  assert.equal(announcement({ kind: "done", clean: true }, { i18n }), "Clean run: no wrong key. Well done.");
  assert.equal(announcement({ kind: "done", clean: false }, { i18n }), "");
  assert.equal(announcement({ kind: "progress" }, { i18n }), "");
  assert.equal(announcement({ kind: "nextKey", key: "Bb" }, { i18n: i18nIn("es") }), "Siguiente tonalidad: Bb mayor");
});

test("the choices follow the exercise: a scale offers hands, octaves and direction; a progression only hands; labels in the language", () => {
  const scale = choiceModel(initSession({ exerciseId: "scale-major" }), { i18n: i18nIn("en") });
  assert.deepEqual(scale.map((c) => [c.name, c.label, c.current]), [["hand", "Hands", "R"], ["octaves", "Octaves", 1], ["direction", "Direction", "up"]]);
  assert.deepEqual(scale[0].values.map((v) => v.label), ["Right hand", "Left hand", "Both hands"]);
  assert.deepEqual(scale[1].values.map((v) => v.label), ["1 octave", "2 octaves"]);
  assert.deepEqual(scale[2].values.map((v) => v.label), ["Up", "Up and back"]);
  const prog = choiceModel(initSession({ exerciseId: "progression-i-v-vi-iv" }), { i18n: i18nIn("es") });
  assert.deepEqual(prog.map((c) => c.name), ["hand"]);
  assert.deepEqual(prog[0].values.map((v) => v.label), ["Ambas manos", "Mano derecha", "Mano izquierda"]);
  assert.equal(prog[0].current, "T");
  const triads = choiceModel(initSession({ exerciseId: "triads" }), { i18n: i18nIn("en") });
  assert.deepEqual(triads[1].values.map((v) => v.label), ["Major", "Minor"]);
});
