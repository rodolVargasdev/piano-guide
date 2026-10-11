// An ear-drill session as a pure reducer over seeded questions (theory/drills.js): a question is heard, the learner
// answers with a button or by playing it back on the keyboard, a second wrong answer shows the right one, and after ten
// questions the round ends: eight right unlock one more choice. The view runs the effects (playing the notes, saving).
// Listening again is free. Playing back is matched by pitch class for chords and by the distance from the first note
// pressed for intervals, in any octave. No DOM, no audio, no storage.
import { CHORD_GROWTH, CHORD_START, INTERVAL_GROWTH, INTERVAL_START, chordQuestion, chordSemitones, intervalQuestion } from "../theory/drills.js";
import { semitonesOf } from "../theory/intervals.js";

/** Questions in a round, and how many right unlock a new choice. */
export const ROUND = 10;
export const UNLOCK_AT = 8;

const VOCABULARY = Object.freeze({
  interval: { start: INTERVAL_START, growth: INTERVAL_GROWTH, ask: intervalQuestion },
  chord: { start: CHORD_START, growth: CHORD_GROWTH, ask: chordQuestion },
});

const pitchClass = (midi) => ((midi % 12) + 12) % 12;

// The choices of a session: the starting ones plus the first `grown` of the growth order.
export const optionsFor = (kind, grown) => [...VOCABULARY[kind].start, ...VOCABULARY[kind].growth.slice(0, Math.max(0, grown))];

function ask(s, index) {
  const v = VOCABULARY[s.kind];
  const options = optionsFor(s.kind, s.grown);
  // Distinct seeds for distinct questions of one session, and one session per seed.
  return v.ask(s.seed + index * 7919, { options, ...(s.kind === "interval" ? { directions: ["asc"] } : {}) });
}

/**
 * initEar({ kind: "interval" | "chord", seed, grown }) -> state. `grown` is how many extra choices the learner has
 * unlocked before (saved by the view); the first question is ready but not played until LISTEN.
 */
export function initEar({ kind, seed = 1, grown = 0 }) {
  if (!VOCABULARY[kind]) return null;
  const maxGrown = VOCABULARY[kind].growth.length;
  const base = { kind, seed, grown: Math.min(Math.max(0, Math.floor(grown) || 0), maxGrown), index: 0, phase: "asking", heard: false, attempts: 0, picked: [], pressed: [], round: { answered: 0, correct: 0 }, newOption: null, question: null };
  return { ...base, question: ask(base, 0) };
}

// A fresh question: attempts and presses start over.
function next(s, { newRound = false } = {}) {
  const index = s.index + 1;
  const base = { ...s, index, phase: "asking", attempts: 0, picked: [], pressed: [], newOption: null, round: newRound ? { answered: 0, correct: 0 } : s.round };
  return { ...base, question: ask(base, index) };
}

// A pick that was not the answer: the first one says Try again, the second one reveals the answer.
function wrong(s, id) {
  const attempts = s.attempts + 1;
  if (attempts < 2) return { state: { ...s, attempts, picked: [...s.picked, id], pressed: [] }, effects: [{ type: "announce", kind: "wrong", id }] };
  const round = { answered: s.round.answered + 1, correct: s.round.correct };
  return { state: { ...s, attempts, picked: [...s.picked, id], pressed: [], phase: "revealed", round }, effects: [{ type: "announce", kind: "reveal", id: s.question.answer }] };
}

function right(s) {
  const firstTry = s.attempts === 0;
  const round = { answered: s.round.answered + 1, correct: s.round.correct + (firstTry ? 1 : 0) };
  return { state: { ...s, phase: "answered", round, pressed: [] }, effects: [{ type: "announce", kind: "correct", firstTry }] };
}

// Does a played-back set of notes give the answer? null while it is not complete (an interval needs two different notes,
// a chord three different pitch classes), else true or false. Intervals: the distance from the first note pressed, in any
// octave; chords: the pitch classes of the chord, in any octave and any order.
function playedMatches(s, pressed) {
  if (s.kind === "interval") {
    const distinct = [...new Set(pressed)];
    return distinct.length < 2 ? null : Math.abs(distinct[1] - distinct[0]) === semitonesOf(s.question.answer);
  }
  const classes = [...new Set(pressed.map(pitchClass))];
  if (classes.length < 3) return null;
  const want = new Set(chordSemitones(s.question.answer).map((x) => pitchClass(s.question.root + x)));
  return classes.length === want.size && classes.every((c) => want.has(c));
}

/**
 * reduceEar(state, action) -> { state, effects }. Actions: LISTEN (free, any number of times), ANSWER { id },
 * NOTE_ON { midi } (play-back), NOTE_OFF (ignored), NEXT (the next question, or the end of the round), ROUND (a new
 * round after one ended), LEAVE. Effects: play { notes } (generated notes for engine.playNotes), announce { kind },
 * save { grown } (a new choice was unlocked), record { clean, correct } (a round ended).
 */
export function reduceEar(s, action) {
  switch (action.type) {
    case "LISTEN":
      if (s.phase === "roundDone") return { state: s, effects: [] };
      return { state: { ...s, heard: true }, effects: [{ type: "play", notes: s.question.notes }] };
    case "ANSWER": {
      if (s.phase !== "asking" || !s.question.options.includes(action.id) || s.picked.includes(action.id)) return { state: s, effects: [] };
      return action.id === s.question.answer ? right(s) : wrong(s, action.id);
    }
    case "NOTE_ON": {
      if (s.phase !== "asking") return { state: s, effects: [] };
      const pressed = [...s.pressed, action.midi];
      const ok = playedMatches(s, pressed);
      if (ok === null) return { state: { ...s, pressed }, effects: [] };
      return ok ? right(s) : wrong(s, "played");
    }
    case "NEXT": {
      if (s.phase !== "answered" && s.phase !== "revealed") return { state: s, effects: [] };
      if (s.round.answered < ROUND) {
        const n = next(s);
        return { state: { ...n, heard: true }, effects: [{ type: "play", notes: n.question.notes }] };
      }
      const clean = s.round.correct >= UNLOCK_AT;
      const room = s.grown < VOCABULARY[s.kind].growth.length;
      const grown = clean && room ? s.grown + 1 : s.grown;
      const unlocked = clean && room ? VOCABULARY[s.kind].growth[s.grown] : null;
      return {
        state: { ...s, phase: "roundDone", grown, newOption: unlocked },
        effects: [{ type: "record", clean, correct: s.round.correct }, ...(unlocked ? [{ type: "save", grown }] : [])],
      };
    }
    case "ROUND": {
      if (s.phase !== "roundDone") return { state: s, effects: [] };
      const n = next(s, { newRound: true });
      return { state: { ...n, heard: true }, effects: [{ type: "play", notes: n.question.notes }] };
    }
    case "LEAVE":
      return { state: s, effects: [{ type: "releaseAll" }] };
    default:
      return { state: s, effects: [] };
  }
}
