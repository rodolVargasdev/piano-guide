// The lesson as a pure reducer: reduce(state, action) -> { state, effects }. The view feeds actions and
// runs the returned effects (engine calls, storage writes, live-region text); it never decides what a
// press means. No DOM, no audio, no storage. Milestone A: phases start, phraseIntro, listening,
// yourTurn, phraseComplete and songComplete (lesson zero and stages arrive in Milestone B).
import { resolveLevel } from "../core/timeline.js";
import { transposeSong } from "../theory/transpose.js";
import { matchEvent, startStep } from "./matcher.js";
import { derivePhrases } from "./phrases.js";
import { positionOf } from "./progress.js";
import { deriveSteps } from "./steps.js";

const HANDS = ["R", "L"];
const isPlayable = (n) => n.rest !== true && n.grace !== true && n.midi !== null && n.midi !== undefined;

/** True when the timeline has a pitched note of the hand. */
export const handHasNotes = (timeline, hand) => timeline.notes.some((n) => n.hand === hand && isPlayable(n));

function build(song, levelId, tonic) {
  const source = tonic && tonic !== song.key?.tonic ? transposeSong(song, levelId, tonic) : song;
  const timeline = resolveLevel(source, levelId);
  return { timeline, phrases: derivePhrases(timeline) };
}

const stepsFor = (timeline, phrases, index, hand) => deriveSteps(timeline, phrases[index], hand, { key: timeline.key });

/** First phrase index at or after `from` (or at or before it when `dir` is -1) with a step for the hand, else -1. */
function phraseWithSteps(timeline, phrases, hand, from, dir = 1) {
  for (let i = from; i >= 0 && i < phrases.length; i += dir) if (stepsFor(timeline, phrases, i, hand).length > 0) return i;
  return -1;
}

/**
 * phraseNumber(state) -> { n, total }: the place of the current phrase among the phrases that have steps for
 * the hand, counted from 1. A song whose first phrases belong to the other hand (a left-hand intro) still
 * starts at "Phrase 1 of N" for the hand the learner chose, never at "Phrase 3".
 */
export function phraseNumber(s) {
  const playable = s.phrases.map((_, i) => i).filter((i) => stepsFor(s.timeline, s.phrases, i, s.hand).length > 0);
  return { n: Math.max(0, playable.indexOf(s.phraseIndex)) + 1, total: Math.max(1, playable.length) };
}

const expectedOf = (step) => step.keys.map((k) => k.midi);
const savePosition = (s, phrase, extra = {}) => ({ type: "save", position: { songId: s.song.id, levelId: s.levelId, tonic: s.keyTonic, phrase, hand: s.hand }, ...extra });

/**
 * initLesson({ song, levelId, keyTonic, hand, progress, silent }) -> state (phase "start").
 * `silent` is only ever added to: a timeline that is not explicitly `silent: false` is silent too
 * (fail closed), so a private song or a hand-built timeline never gets a Listen.
 */
export function initLesson({ song, levelId, keyTonic, hand, progress, silent = false }) {
  const tonic = keyTonic ?? song.key?.tonic ?? null;
  const { timeline, phrases } = build(song, levelId, tonic);
  const chosen = hand ?? (handHasNotes(timeline, "R") ? "R" : "L");
  const first = Math.max(0, phraseWithSteps(timeline, phrases, chosen, 0));
  return {
    phase: "start",
    song,
    songId: song.id,
    levelId,
    originalTonic: song.key?.tonic ?? null,
    keyTonic: tonic,
    silent: silent === true || timeline.silent !== false,
    hand: chosen,
    timeline,
    phrases,
    phraseIndex: first,
    steps: stepsFor(timeline, phrases, first, chosen),
    stepIndex: 0,
    matcher: null,
    feedback: null,
    held: new Set(),
    returnStep: null,
    progress: progress ?? null,
    saved: progress ? positionOf(progress, song.id, levelId, tonic) : null,
  };
}

// Shows a phrase: a public song starts at its intro, a silent one goes straight to the first step.
function enterPhrase(s, index, steps = stepsFor(s.timeline, s.phrases, index, s.hand)) {
  const next = { ...s, phraseIndex: index, steps, stepIndex: 0, feedback: null, matcher: null, returnStep: null };
  return s.silent ? beginStep(next, 0) : { ...next, phase: "phraseIntro" };
}

// Starts a step with the keys held right now excluded from it.
function beginStep(s, stepIndex) {
  return { ...s, phase: "yourTurn", stepIndex, feedback: null, returnStep: null, matcher: startStep(expectedOf(s.steps[stepIndex]), [...s.held]) };
}

const stay = (s) => ({ state: s, effects: [] });
const listenEffect = (s) => ({ type: "listen", phraseId: s.phrases[s.phraseIndex].id, startTick: s.phrases[s.phraseIndex].startTick, endTick: s.phrases[s.phraseIndex].endTick, hand: s.hand });

function onNote(s, action) {
  const held = new Set(s.held);
  if (action.type === "NOTE_ON") held.add(action.midi);
  else held.delete(action.midi);
  const base = { ...s, held };
  if (base.phase === "listening" && action.type === "NOTE_ON") {
    // A key pressed during Listen starts My turn and counts as held at the start of the step.
    return { state: beginStep(base, base.returnStep ?? 0), effects: [{ type: "stopListen" }] };
  }
  if (base.phase !== "yourTurn") return stay(base);
  const { m, outcome } = matchEvent(base.matcher, { type: action.type === "NOTE_ON" ? "on" : "off", midi: action.midi });
  const matched = { ...base, matcher: m };
  if (outcome === "ignored") return stay(matched);
  if (outcome === "progress") return stay({ ...matched, feedback: null });
  if (outcome === "wrong" || outcome === "octave") return { state: { ...matched, feedback: { kind: outcome, midi: action.midi } }, effects: [{ type: "announce", kind: outcome, midi: action.midi }] };
  // satisfied
  if (base.stepIndex + 1 < base.steps.length) {
    const next = beginStep(matched, base.stepIndex + 1);
    return { state: { ...next, feedback: { kind: "correct", midi: action.midi } }, effects: [{ type: "announce", kind: "correct", midi: action.midi }] };
  }
  const after = phraseWithSteps(base.timeline, base.phrases, base.hand, base.phraseIndex + 1);
  const done = { ...matched, feedback: { kind: "correct", midi: action.midi }, matcher: null };
  if (after === -1) return { state: { ...done, phase: "songComplete" }, effects: [{ type: "announce", kind: "songDone" }, savePosition(base, base.phraseIndex)] };
  return { state: { ...done, phase: "phraseComplete" }, effects: [{ type: "announce", kind: "phraseDone" }, savePosition(base, after)] };
}

// The same phrase index (or the next one with steps for the hand) after the key or the hand changed.
function refit(s, { phrases, timeline }, hand, effects) {
  const start = Math.min(s.phraseIndex, phrases.length - 1);
  let index = phraseWithSteps(timeline, phrases, hand, start);
  if (index === -1) index = phraseWithSteps(timeline, phrases, hand, start, -1);
  if (index === -1) return null;
  const moved = { ...s, timeline, phrases, hand, held: s.held, silent: s.silent || timeline.silent !== false, saved: s.progress ? positionOf(s.progress, s.songId, s.levelId, s.keyTonic) : null };
  const steps = stepsFor(timeline, phrases, index, hand);
  if (s.phase === "start") return { state: { ...moved, phraseIndex: index, steps, stepIndex: 0, matcher: null, feedback: null }, effects };
  return { state: enterPhrase(moved, index, steps), effects };
}

/**
 * reduce(state, action) -> { state, effects }. Actions: START, CONTINUE, LISTEN, LISTEN_DONE, MY_TURN,
 * NOTE_ON { midi }, NOTE_OFF { midi }, LISTEN_AGAIN, NEXT_PHRASE, REPEAT, SET_LANG { lang },
 * SET_KEY { tonic }, SET_HAND { hand }, LEAVE. Effects: listen, stopListen, save, announce, releaseAll.
 * An action that does not apply in the current phase changes nothing. An unknown action throws.
 */
export function reduce(s, action) {
  const stopping = s.phase === "listening" ? [{ type: "stopListen" }] : [];
  switch (action.type) {
    case "NOTE_ON":
    case "NOTE_OFF":
      return onNote(s, action);
    case "START": {
      if (s.phase !== "start" && s.phase !== "songComplete") return stay(s);
      const first = phraseWithSteps(s.timeline, s.phrases, s.hand, 0);
      return first === -1 ? stay(s) : { state: enterPhrase(s, first), effects: [savePosition(s, first)] };
    }
    case "CONTINUE": {
      if (s.phase !== "start") return stay(s);
      const hand = HANDS.includes(s.saved?.hand) && handHasNotes(s.timeline, s.saved.hand) ? s.saved.hand : s.hand;
      const from = Math.min(s.saved?.phrase ?? 0, s.phrases.length - 1);
      let index = phraseWithSteps(s.timeline, s.phrases, hand, from);
      if (index === -1) index = phraseWithSteps(s.timeline, s.phrases, hand, 0);
      return index === -1 ? stay(s) : { state: enterPhrase({ ...s, hand }, index), effects: [] };
    }
    case "LISTEN":
      return s.phase === "phraseIntro" && !s.silent ? { state: { ...s, phase: "listening", returnStep: null }, effects: [listenEffect(s)] } : stay(s);
    case "LISTEN_AGAIN":
      return s.phase === "yourTurn" && !s.silent ? { state: { ...s, phase: "listening", returnStep: s.stepIndex, matcher: null }, effects: [listenEffect(s)] } : stay(s);
    case "LISTEN_DONE":
      return s.phase === "listening" ? { state: beginStep(s, s.returnStep ?? 0), effects: [] } : stay(s);
    case "MY_TURN":
      return s.phase === "phraseIntro" || s.phase === "listening" ? { state: beginStep(s, s.phase === "listening" ? (s.returnStep ?? 0) : 0), effects: stopping } : stay(s);
    case "NEXT_PHRASE": {
      if (s.phase !== "phraseComplete") return stay(s);
      const index = phraseWithSteps(s.timeline, s.phrases, s.hand, s.phraseIndex + 1);
      return index === -1 ? { state: { ...s, phase: "songComplete" }, effects: [] } : { state: enterPhrase(s, index), effects: [savePosition(s, index)] };
    }
    case "REPEAT":
      return s.phase === "phraseComplete" || s.phase === "yourTurn" ? { state: beginStep(s, 0), effects: [] } : stay(s);
    case "SET_LANG":
      return stay(s);
    case "SET_KEY": {
      const allowed = action.tonic === s.originalTonic || s.timeline.learn?.transposeTo?.includes(action.tonic);
      if (!allowed || action.tonic === s.keyTonic) return stay(s);
      let built;
      try {
        built = build(s.song, s.levelId, action.tonic);
      } catch {
        return stay(s); // no valid transposition: the lesson keeps its key
      }
      const next = refit({ ...s, keyTonic: action.tonic }, built, s.hand, [...stopping]);
      if (!next) return stay(s);
      next.effects.push(savePosition(next.state, next.state.phraseIndex, { transpose: action.tonic === s.originalTonic ? null : action.tonic }));
      return next;
    }
    case "SET_HAND": {
      if (!HANDS.includes(action.hand) || action.hand === s.hand || !handHasNotes(s.timeline, action.hand)) return stay(s);
      const next = refit(s, { phrases: s.phrases, timeline: s.timeline }, action.hand, [...stopping]);
      if (!next) return stay(s);
      next.effects.push(savePosition(next.state, next.state.phraseIndex));
      return next;
    }
    case "LEAVE":
      return { state: s, effects: [{ type: "stopListen" }, { type: "releaseAll" }] };
    default:
      throw new TypeError(`Unknown lesson action: ${action?.type}`);
  }
}
