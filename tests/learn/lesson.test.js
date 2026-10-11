import { test } from "node:test";
import assert from "node:assert/strict";
import { initLesson, phraseNumber, reduce } from "../../src/learn/lesson.js";
import { emptyProgress, withPosition } from "../../src/learn/progress.js";
import { mulberry32 } from "../../src/theory/random.js";
import { BAR, Q, learnSong, note } from "../fixtures/learn-songs.js";

const P = { C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, C3: 48, G2: 43 };
// Three phrases. Right hand: C4 D4 | chord C4 E4 G4 then F4 | E4. Left hand: C3 (phrase 1) and G2 (phrase 3), none in phrase 2.
const NOTES = [
  note(0, Q, "C4"), note(Q, Q, "D4"),
  note(2 * Q, Q, "C4"), note(2 * Q, Q, "E4"), note(2 * Q, Q, "G4"), note(3 * Q, Q, "F4"),
  note(BAR, Q, "E4"),
  note(0, 2 * Q, "C3", "L"), note(BAR, 2 * Q, "G2", "L"),
];
const LEARN = { phrases: [{ id: "a", startTick: 0, endTick: 2 * Q }, { id: "b", startTick: 2 * Q, endTick: BAR }, { id: "c", startTick: BAR, endTick: 2 * BAR }], transposeTo: ["G"] };
const song = (extra = {}) => ({ ...learnSong({ notes: NOTES, bars: 2, learn: LEARN }).song, ...extra });
const lesson = (extra = {}, songExtra = {}) => initLesson({ song: song(songExtra), levelId: "beginner", ...extra });
const privateLesson = (extra = {}) => lesson(extra, { visibility: "private" });
const effectTypes = (r) => r.effects.map((e) => e.type);
const act = (s, ...actions) => {
  const effects = [];
  for (const a of actions) {
    const r = reduce(s, typeof a === "string" ? { type: a } : a);
    s = r.state;
    effects.push(...r.effects);
  }
  return { state: s, effects };
};
const on = (midi) => ({ type: "NOTE_ON", midi });
const off = (midi) => ({ type: "NOTE_OFF", midi });
const press = (midi) => [on(midi), off(midi)];
const started = (extra) => act(lesson(extra), "START", "MY_TURN").state; // public lesson at My turn, step 1 of phrase 1

test("start: a public song goes to the phrase intro and saves the position; a private one goes straight to My turn", () => {
  const pub = act(lesson(), "START");
  assert.equal(pub.state.phase, "phraseIntro");
  assert.equal(pub.state.phraseIndex, 0);
  assert.deepEqual(pub.effects, [{ type: "save", position: { songId: "example-song", levelId: "beginner", tonic: "C", phrase: 0, hand: "R" } }]);
  const priv = act(privateLesson(), "START");
  assert.equal(priv.state.phase, "yourTurn");
  assert.equal(priv.state.silent, true);
  assert.ok(!effectTypes(priv).includes("listen"));
});

test("continue resumes at the saved phrase and hand, and starts at the first phrase without progress", () => {
  const progress = withPosition(emptyProgress(), { songId: "example-song", levelId: "beginner", tonic: "C", phrase: 2, hand: "L", date: "2026-10-11" });
  const resumed = act(lesson({ progress }), "CONTINUE");
  assert.equal(resumed.state.phraseIndex, 2);
  assert.equal(resumed.state.hand, "L");
  assert.equal(resumed.state.phase, "phraseIntro");
  assert.deepEqual(resumed.effects, []);
  assert.equal(act(lesson(), "CONTINUE").state.phraseIndex, 0);
  assert.equal(lesson({ progress }).saved.phrase, 2, "the first screen can offer Continue");
});

test("phrase intro: Listen plays that phrase for the hand, at the default (slow) tempo", () => {
  const r = act(lesson(), "START", "LISTEN");
  assert.equal(r.state.phase, "listening");
  assert.deepEqual(r.effects.at(-1), { type: "listen", phraseId: "a", startTick: 0, endTick: 2 * Q, hand: "R" });
  assert.ok(!("bpm" in r.effects.at(-1)));
});

test("listening: Listen done or My turn starts step 1 (My turn also stops Listen)", () => {
  const listening = act(lesson(), "START", "LISTEN").state;
  assert.deepEqual(act(listening, "LISTEN_DONE"), { state: act(listening, "LISTEN_DONE").state, effects: [] });
  assert.equal(act(listening, "LISTEN_DONE").state.stepIndex, 0);
  const skipped = act(listening, "MY_TURN");
  assert.equal(skipped.state.phase, "yourTurn");
  assert.deepEqual(effectTypes(skipped), ["stopListen"]);
});

test("listening: a key pressed during Listen starts My turn and counts as held at the start of the step", () => {
  const r = act(lesson(), "START", "LISTEN", on(P.C4));
  assert.equal(r.state.phase, "yourTurn");
  assert.deepEqual(effectTypes(r).slice(-1), ["stopListen"]);
  // C4 is the key of step 1 but it was held at the start: it does not count until released and pressed again.
  assert.equal(act(r.state, on(P.C4)).state.stepIndex, 0, "the held key pressed again without a release is an auto-repeat");
  assert.equal(act(r.state, on(P.D4)).state.feedback.kind, "wrong", "an unexpected key is still wrong");
  const again = act(r.state, off(P.C4), on(P.C4));
  assert.equal(again.state.stepIndex, 1, "released and pressed again it counts");
});

test("my turn: the right key advances with Correct, a wrong key says Try again and keeps the step, then the right key advances", () => {
  const s = started();
  const wrong = act(s, on(P.F4));
  assert.equal(wrong.state.stepIndex, 0);
  assert.deepEqual(wrong.state.feedback, { kind: "wrong", midi: P.F4 });
  assert.deepEqual(wrong.effects, [{ type: "announce", kind: "wrong", midi: P.F4 }]);
  const right = act(wrong.state, off(P.F4), on(P.C4));
  assert.equal(right.state.stepIndex, 1);
  assert.deepEqual(right.state.feedback, { kind: "correct", midi: P.C4 });
  assert.deepEqual(right.effects.at(-1), { type: "announce", kind: "correct", midi: P.C4 });
});

test("my turn: the same pitch class in another octave gets the octave feedback and does not advance", () => {
  const r = act(started(), on(P.C4 + 12));
  assert.equal(r.state.feedback.kind, "octave");
  assert.equal(r.state.stepIndex, 0);
});

test("my turn: a chord is completed by its keys one at a time; a wrong key in the middle clears what was pressed", () => {
  const atChord = act(started(), ...press(P.C4), ...press(P.D4)).state; // phrase 1 done, then NEXT_PHRASE below
  assert.equal(atChord.phase, "phraseComplete");
  const second = act(atChord, "NEXT_PHRASE", "MY_TURN").state;
  assert.equal(second.steps[0].keys.length, 3);
  const cleared = act(second, ...press(P.C4), ...press(P.E4), ...press(P.D4), ...press(P.G4));
  assert.equal(cleared.state.stepIndex, 0, "the wrong key cleared the two earlier presses, so G4 alone is not enough");
  const done = act(second, ...press(P.G4), ...press(P.C4), ...press(P.E4));
  assert.equal(done.state.stepIndex, 1);
});

test("the last step of a phrase gives phraseComplete, announces it and saves the NEXT phrase as the place to resume", () => {
  const r = act(started(), ...press(P.C4), ...press(P.D4));
  assert.equal(r.state.phase, "phraseComplete");
  assert.deepEqual(effectTypes(r).slice(-2), ["announce", "save"]);
  assert.equal(r.effects.at(-2).kind, "phraseDone");
  assert.equal(r.effects.at(-1).position.phrase, 1);
});

test("the last step of the last phrase gives songComplete with its announcement", () => {
  let s = started();
  s = act(s, ...press(P.C4), ...press(P.D4), "NEXT_PHRASE", "MY_TURN", ...press(P.G4), ...press(P.C4), ...press(P.E4), ...press(P.F4), "NEXT_PHRASE", "MY_TURN").state;
  const r = act(s, ...press(P.E4));
  assert.equal(r.state.phase, "songComplete");
  assert.equal(r.effects.find((e) => e.type === "announce").kind, "songDone");
  assert.equal(act(r.state, "START").state.phase, "phraseIntro", "start over from the song end");
});

test("Listen again from My turn returns to the same step afterwards", () => {
  const s = act(started(), ...press(P.C4)).state; // on step 2
  const listening = act(s, "LISTEN_AGAIN");
  assert.equal(listening.state.phase, "listening");
  assert.equal(listening.effects.at(-1).type, "listen");
  assert.equal(act(listening.state, "LISTEN_DONE").state.stepIndex, 1);
  assert.equal(act(listening.state, "MY_TURN").state.stepIndex, 1);
});

test("next phrase, repeat: Next phrase shows the next intro and saves; Repeat restarts the phrase at step 1", () => {
  const complete = act(started(), ...press(P.C4), ...press(P.D4)).state;
  const next = act(complete, "NEXT_PHRASE");
  assert.equal(next.state.phase, "phraseIntro");
  assert.equal(next.state.phraseIndex, 1);
  assert.equal(next.effects[0].position.phrase, 1);
  const repeat = act(complete, "REPEAT");
  assert.equal(repeat.state.phase, "yourTurn");
  assert.equal(repeat.state.stepIndex, 0);
  assert.equal(repeat.state.phraseIndex, 0);
});

test("a language switch changes nothing in the state: keys already pressed in a chord step are kept and one more completes it", () => {
  const second = act(started(), ...press(P.C4), ...press(P.D4), "NEXT_PHRASE", "MY_TURN").state;
  const mid = act(second, on(P.C4), on(P.E4)).state;
  const switched = reduce(mid, { type: "SET_LANG", lang: "es" });
  assert.equal(switched.state, mid, "the very same state object");
  assert.deepEqual(switched.effects, []);
  assert.equal(act(switched.state, on(P.G4)).state.stepIndex, 1);
});

test("transposition keeps the phrase index, restarts at its first step, saves the choice, and returns to the original key", () => {
  const atPhrase2 = act(started(), ...press(P.C4), ...press(P.D4), "NEXT_PHRASE", "MY_TURN", ...press(P.C4)).state;
  assert.equal(atPhrase2.stepIndex, 0, "the chord is still one step, only its keys are pressed");
  const g = act(atPhrase2, { type: "SET_KEY", tonic: "G" });
  assert.equal(g.state.keyTonic, "G");
  assert.equal(g.state.phraseIndex, 1);
  assert.equal(g.state.phase, "phraseIntro");
  assert.equal(g.state.stepIndex, 0);
  assert.notDeepEqual(g.state.steps[0].keys.map((k) => k.midi), atPhrase2.steps[0].keys.map((k) => k.midi), "notes were moved");
  assert.deepEqual(g.effects.at(-1), { type: "save", position: { songId: "example-song", levelId: "beginner", tonic: "G", phrase: 1, hand: "R" }, transpose: "G" });
  const back = act(g.state, { type: "SET_KEY", tonic: "C" });
  assert.equal(back.state.keyTonic, "C");
  assert.equal(back.effects.at(-1).transpose, null);
  assert.deepEqual(back.state.steps.map((s) => s.keys.map((k) => k.midi)), atPhrase2.steps.map((s) => s.keys.map((k) => k.midi)));
});

test("counter-proof: a tonic that is not a transposition target (or the key already in use) changes nothing", () => {
  const s = started();
  assert.equal(reduce(s, { type: "SET_KEY", tonic: "F#" }).state, s);
  assert.equal(reduce(s, { type: "SET_KEY", tonic: "C" }).state, s);
});

test("hand selector: the left hand moves to the next phrase that has left-hand notes; a hand with no notes is refused", () => {
  const atSecond = act(started(), ...press(P.C4), ...press(P.D4), "NEXT_PHRASE").state;
  const left = act(atSecond, { type: "SET_HAND", hand: "L" });
  assert.equal(left.state.hand, "L");
  assert.equal(left.state.phraseIndex, 2, "phrase 2 has no left-hand note, so the lesson moves to phrase 3");
  assert.equal(left.effects.at(-1).position.hand, "L");
  const rightOnly = initLesson({ song: learnSong({ notes: NOTES.filter((n) => n.hand === "R"), bars: 2, learn: LEARN }).song, levelId: "beginner" });
  assert.equal(reduce(rightOnly, { type: "SET_HAND", hand: "L" }).state, rightOnly);
  assert.equal(reduce(rightOnly, { type: "SET_HAND", hand: "X" }).state, rightOnly);
});

test("leaving stops Listen and releases every note, and a key held at the start of a step does not count for it", () => {
  const r = reduce(started(), { type: "LEAVE" });
  assert.deepEqual(effectTypes(r), ["stopListen", "releaseAll"]);
  const holding = act(lesson(), on(P.C4), "START", "MY_TURN").state; // C4 already down when the step begins
  assert.equal(act(holding, on(P.C4)).state.stepIndex, 0);
  assert.equal(act(holding, off(P.C4), on(P.C4)).state.stepIndex, 1);
});

test("actions that do not apply in the current phase change nothing; an unknown action throws", () => {
  const s = started();
  for (const type of ["START", "CONTINUE", "LISTEN", "LISTEN_DONE", "NEXT_PHRASE"]) assert.equal(reduce(s, { type }).state, s, type);
  assert.throws(() => reduce(s, { type: "NOPE" }), TypeError);
});

/** Feeds a seeded random sequence of every action; returns the types of all effects. */
function fuzz(initial, seed, steps = 400) {
  const rand = mulberry32(seed);
  const actions = ["START", "CONTINUE", "LISTEN", "LISTEN_DONE", "MY_TURN", "LISTEN_AGAIN", "NEXT_PHRASE", "REPEAT", "LEAVE", { type: "SET_KEY", tonic: "G" }, { type: "SET_KEY", tonic: "C" }, { type: "SET_HAND", hand: "L" }, { type: "SET_HAND", hand: "R" }];
  let s = initial;
  const seen = [];
  for (let i = 0; i < steps; i += 1) {
    const r = rand();
    const action = r < 0.5 ? (rand() < 0.5 ? on([P.C4, P.D4, P.E4, P.G4, P.F4, P.C3][Math.floor(rand() * 6)]) : off([P.C4, P.D4, P.E4, P.G4, P.F4, P.C3][Math.floor(rand() * 6)])) : actions[Math.floor(rand() * actions.length)];
    const out = reduce(s, typeof action === "string" ? { type: action } : action);
    s = out.state;
    seen.push(...out.effects.map((e) => e.type));
  }
  return seen;
}

test("a silent lesson never emits listen, whatever the sequence of actions; the same sequences do emit it for a public song", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    assert.ok(!fuzz(privateLesson(), seed).includes("listen"), `private, seed ${seed}`);
    assert.ok(!fuzz(lesson({ silent: true }), seed).includes("listen"), `public flagged silent, seed ${seed}`);
  }
  assert.ok([1, 2, 3, 4, 5].some((seed) => fuzz(lesson(), seed).includes("listen")), "counter-proof: a public lesson does listen");
});

test("a silent lesson refuses Listen at the intro and during My turn, with no state change", () => {
  const priv = act(privateLesson(), "START").state;
  assert.equal(reduce(priv, { type: "LISTEN" }).state, priv);
  assert.equal(reduce(priv, { type: "LISTEN_AGAIN" }).state, priv);
  assert.equal(act(priv, "NEXT_PHRASE").state, priv);
});

// ---- a song that opens with a left-hand intro: the beginner starts at the melody ------------------------------
const INTRO_NOTES = [
  note(0, 2 * Q, "C3", "L"), note(BAR, 2 * Q, "G2", "L"), // phrases 1 and 2: left hand only
  note(2 * BAR, Q, "C4"), note(2 * BAR + Q, Q, "D4"), // phrase 3: the melody starts
  note(3 * BAR, Q, "E4"), note(3 * BAR, 2 * Q, "C3", "L"), // phrase 4
];
const introSong = () => learnSong({ notes: INTRO_NOTES, bars: 4, learn: { phrases: [0, 1, 2, 3].map((i) => ({ id: `i${i}`, startTick: i * BAR, endTick: (i + 1) * BAR })) } }).song;

test("the default start is the first phrase with a right-hand melody, numbered 1 of the phrases that hand plays", () => {
  const s = initLesson({ song: introSong(), levelId: "beginner" });
  assert.equal(s.hand, "R");
  assert.equal(s.phraseIndex, 2, "the two left-hand intro phrases are skipped for the right hand");
  assert.deepEqual(phraseNumber(s), { n: 1, total: 2 });
  const next = reduce(reduce(reduce(s, { type: "START" }).state, { type: "MY_TURN" }).state, { type: "REPEAT" }).state;
  assert.deepEqual(phraseNumber(next), { n: 1, total: 2 });
});

test("counter-proof: choosing the left hand brings the intro back, numbered from 1 as well", () => {
  const s = initLesson({ song: introSong(), levelId: "beginner", hand: "L" });
  assert.equal(s.phraseIndex, 0);
  assert.deepEqual(phraseNumber(s), { n: 1, total: 3 });
  const moved = reduce(initLesson({ song: introSong(), levelId: "beginner" }), { type: "SET_HAND", hand: "L" }).state;
  assert.equal(moved.hand, "L");
  assert.ok(phraseNumber(moved).total === 3);
});

// ---- lesson zero (pr1b) -----------------------------------------------------------------------------------

const zeroDone = (extra) => act(lesson(extra), "LESSON_ZERO", ...press(P.C4), "ZERO_NEXT", ...press(60), ...press(62), ...press(64), ...press(65), ...press(67), "ZERO_NEXT");

test("lesson zero opens only from the first screen and changes nothing else in the lesson", () => {
  const r = act(lesson(), "LESSON_ZERO");
  assert.equal(r.state.phase, "lessonZero");
  assert.equal(r.state.zero.part, 0);
  assert.equal(r.state.phraseIndex, 0);
  assert.deepEqual(r.effects, []);
  // Counter-proof: from any other phase the action does nothing.
  assert.equal(act(started(), "LESSON_ZERO").state.phase, "yourTurn");
});

test("lesson zero: keys go to its own state and never advance a step of the song", () => {
  const s = act(lesson(), "LESSON_ZERO").state;
  const r = act(s, ...press(P.D4)); // wrong in part 1
  assert.equal(r.state.phase, "lessonZero");
  assert.equal(r.state.zero.feedback.kind, "wrong");
  assert.deepEqual(effectTypes(r), ["announce"]);
  assert.equal(r.state.stepIndex, 0);
  assert.equal(act(s, ...press(P.C4)).state.zero.part, 1, "any C moves on");
});

test("lesson zero: skip returns to the first screen and saves it as skipped, so it stays offered", () => {
  const r = act(lesson(), "LESSON_ZERO", "ZERO_SKIP");
  assert.equal(r.state.phase, "start");
  assert.equal(r.state.zero, null);
  assert.deepEqual(r.effects, [{ type: "lessonZero", value: "skipped" }]);
  assert.equal(r.state.progress, null, "no progress object to update in a lesson started without one");
  const withProgress = act(lesson({ progress: emptyProgress() }), "LESSON_ZERO", "ZERO_SKIP");
  assert.equal(withProgress.state.progress.lessonZero, "skipped");
  assert.equal(act(withProgress.state, "START").state.phase, "phraseIntro", "the song starts normally afterwards");
});

test("lesson zero: finishing every part saves it as done and returns to the first screen", () => {
  const r = zeroDone({ progress: emptyProgress() });
  assert.equal(r.state.phase, "start");
  assert.deepEqual(r.effects.at(-1), { type: "lessonZero", value: "done" });
  assert.equal(r.state.progress.lessonZero, "done");
  // Counter-proof: the lesson is not done after only the first part.
  const partial = act(lesson({ progress: emptyProgress() }), "LESSON_ZERO", ...press(P.C4), "ZERO_NEXT");
  assert.equal(partial.state.phase, "lessonZero");
  assert.ok(!effectTypes(partial).includes("lessonZero"));
});

test("lesson zero ignores the key and hand choices, and ZERO actions outside it do nothing", () => {
  const s = act(lesson(), "LESSON_ZERO").state;
  assert.equal(reduce(s, { type: "SET_KEY", tonic: "G" }).state, s);
  assert.equal(reduce(s, { type: "SET_HAND", hand: "L" }).state, s);
  assert.equal(act(lesson(), "ZERO_NEXT").state.phase, "start");
  assert.equal(act(lesson(), "ZERO_SKIP").state.phase, "start");
});

test("a key held while lesson zero opens does not count for it", () => {
  const down = act(lesson(), on(P.C4), "LESSON_ZERO").state; // C4 pressed on the first screen and still down
  assert.equal(act(down, on(P.C4)).state.zero.part, 0);
  assert.equal(act(down, off(P.C4), on(P.C4)).state.zero.part, 1);
});
