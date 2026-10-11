import { test } from "node:test";
import assert from "node:assert/strict";
import { earModel } from "../../src/ui/ear-screen.js";
import { ROUND, initEar, reduceEar } from "../../src/practice/ear.js";
import { createI18n } from "../../src/i18n/i18n.js";
import { STRINGS } from "../../src/i18n/strings.js";

const i18nIn = (lang) => createI18n({ table: STRINGS, navigatorLanguage: lang, warn: () => assert.fail("a missing string") });
const wrongOf = (s) => s.question.options.find((o) => o !== s.question.answer);
const right = (s) => reduceEar(s, { type: "ANSWER", id: s.question.answer }).state;
const nextQ = (s) => reduceEar(right(s), { type: "NEXT" }).state;

test("before the first Play: Press Play to hear it, the three starting choices with a plain line each, and only Play", () => {
  const m = earModel(initEar({ kind: "interval", seed: 1 }), { i18n: i18nIn("en") });
  assert.equal(m.heading, "Press Play to hear it.");
  assert.equal(m.progress, "Question 1 of 10");
  assert.deepEqual(m.options.map((o) => [o.label, o.hint]), [
    ["Major third", "Bright and happy (4 semitones)."],
    ["Perfect fifth", "Strong and hollow (7 semitones)."],
    ["Octave", "The same note, higher (12 semitones)."],
  ]);
  assert.deepEqual(m.actions, [{ id: "LISTEN", label: "Play", primary: true }]);
  assert.equal(m.chip, null);
});

test("after hearing it: the question for the kind of drill, how to answer, and Listen again", () => {
  const heard = reduceEar(initEar({ kind: "interval", seed: 1 }), { type: "LISTEN" }).state;
  const m = earModel(heard, { i18n: i18nIn("en") });
  assert.equal(m.heading, "How far apart are the two notes?");
  assert.match(m.sub, /^Pick a name, or play it back on the keyboard\./);
  assert.deepEqual(m.actions, [{ id: "LISTEN", label: "Listen again", primary: false }]);
  const chord = earModel(reduceEar(initEar({ kind: "chord", seed: 1 }), { type: "LISTEN" }).state, { i18n: i18nIn("en") });
  assert.equal(chord.heading, "What kind of chord is it?");
  assert.deepEqual(chord.options.map((o) => o.label), ["Major", "Minor"]);
});

test("a first wrong pick: Try again, the pick struck with its words, nothing else changes", () => {
  const s = reduceEar(reduceEar(initEar({ kind: "interval", seed: 1 }), { type: "LISTEN" }).state, { type: "ANSWER", id: wrongOf(initEar({ kind: "interval", seed: 1 })) }).state;
  const m = earModel(s, { i18n: i18nIn("en") });
  assert.deepEqual(m.chip, { kind: "wrong", text: "Try again", detail: "" });
  assert.equal(m.sub, "Listen again and try another.");
  const struck = m.options.filter((o) => o.status === "wrong");
  assert.equal(struck.length, 1);
  assert.equal(struck[0].tag, "Not this one");
  assert.equal(m.options.filter((o) => o.status === "right").length, 0, "the right one is not shown yet");
});

test("right on the first try: Correct, the name with its plain line, the score and Next question", () => {
  const s = right(initEar({ kind: "interval", seed: 1 }));
  const m = earModel(s, { i18n: i18nIn("en") });
  assert.equal(m.chip.text, "Correct");
  assert.equal(m.heading, "Perfect fifth", "this seed asks the perfect fifth");
  assert.equal(m.sub, "Strong and hollow (7 semitones).");
  assert.equal(m.progress, "Question 1 of 10 | Score 1/1");
  assert.deepEqual(m.actions.map((a) => [a.id, a.primary]), [["NEXT", true], ["LISTEN", false]]);
  assert.deepEqual(m.options.find((o) => o.status === "right"), { id: "P5", label: "Perfect fifth", hint: "Strong and hollow (7 semitones).", status: "right", tag: "Right answer" });
});

test("the second wrong pick reveals the answer by name and by the Right answer tag", () => {
  let s = reduceEar(initEar({ kind: "interval", seed: 1 }), { type: "LISTEN" }).state;
  const wrongs = s.question.options.filter((o) => o !== s.question.answer);
  s = reduceEar(reduceEar(s, { type: "ANSWER", id: wrongs[0] }).state, { type: "ANSWER", id: wrongs[1] }).state;
  const m = earModel(s, { i18n: i18nIn("en") });
  assert.equal(m.heading, "It was: Perfect fifth.");
  assert.equal(m.chip, null);
  assert.deepEqual(m.options.map((o) => o.status).sort(), ["right", "wrong", "wrong"]);
  assert.equal(m.progress, "Question 1 of 10 | Score 0/1");
});

test("the question number counts up and the last Next says See the result; the round ends with the count and what unlocked", () => {
  let s = initEar({ kind: "interval", seed: 2 });
  for (let i = 0; i < ROUND - 1; i += 1) s = nextQ(s);
  assert.equal(earModel(s, { i18n: i18nIn("en") }).progress, "Question 10 of 10 | Score 9/9");
  const last = right(s);
  assert.equal(earModel(last, { i18n: i18nIn("en") }).actions[0].label, "See the result");
  const done = reduceEar(last, { type: "NEXT" }).state;
  const m = earModel(done, { i18n: i18nIn("en") });
  assert.equal(m.heading, "Round finished: 10/10.");
  assert.equal(m.sub, "New choice unlocked: Perfect fourth.");
  assert.equal(m.chip.text, "Correct");
  assert.deepEqual(m.actions, [{ id: "ROUND", label: "Another round", primary: true }]);
  assert.deepEqual(m.options, []);
});

test("a weak round says how to unlock, and a finished vocabulary says every choice is unlocked", () => {
  let s = initEar({ kind: "interval", seed: 2 });
  const others = (st) => st.question.options.filter((o) => o !== st.question.answer);
  for (let i = 0; i < ROUND; i += 1) {
    s = reduceEar(reduceEar(reduceEar(s, { type: "ANSWER", id: others(s)[0] }).state, { type: "ANSWER", id: others(s).find((o) => !s.picked.includes(o) && o !== others(s)[0]) ?? others(s)[1] }).state, { type: "NEXT" }).state;
  }
  assert.equal(s.phase, "roundDone");
  const m = earModel(s, { i18n: i18nIn("en") });
  assert.equal(m.heading, "Round finished: 0/10.");
  assert.equal(m.sub, "Get 8 of 10 right to unlock a new choice.");
  assert.equal(m.chip, null);
  let c = initEar({ kind: "chord", seed: 2, grown: 2 });
  for (let i = 0; i < ROUND; i += 1) c = nextQ(c);
  assert.equal(earModel(c, { i18n: i18nIn("en") }).sub, "Every choice is unlocked.");
});

test("everything reads in Spanish: the question, the choices and their lines, the tags, the score", () => {
  const es = i18nIn("es");
  const s = reduceEar(initEar({ kind: "interval", seed: 1 }), { type: "LISTEN" }).state;
  const m = earModel(s, { i18n: es });
  assert.equal(m.heading, "¿Qué tan separadas están las dos notas?");
  assert.deepEqual(m.options.map((o) => o.label), ["Tercera mayor", "Quinta justa", "Octava"]);
  assert.equal(m.options[0].hint, "Brillante y alegre (4 semitonos).");
  assert.equal(m.actions[0].label, "Escuchar de nuevo");
  const done = earModel(right(s), { i18n: es });
  assert.equal(done.progress, "Pregunta 1 de 10 | Puntaje 1/1");
  assert.equal(done.options.find((o) => o.status === "right").tag, "Respuesta correcta");
  assert.equal(earModel(initEar({ kind: "chord", seed: 1 }), { i18n: es }).options[1].label, "Menor");
});

test("counter-proof: a model for a question never names the answer before it is answered", () => {
  const s = reduceEar(initEar({ kind: "interval", seed: 1 }), { type: "LISTEN" }).state;
  const m = earModel(s, { i18n: i18nIn("en") });
  assert.equal(m.options.every((o) => o.status === "idle" && o.tag === ""), true);
  assert.equal(JSON.stringify([m.heading, m.sub, m.progress]).includes(s.question.answer), false);
});
