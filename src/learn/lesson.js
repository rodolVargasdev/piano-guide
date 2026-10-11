// The lesson as a pure reducer: reduce(state, action) -> { state, effects }. The view feeds actions and
// runs the returned effects (engine calls, storage writes, live-region text); it never decides what a
// press means. No DOM, no audio, no storage. Phases: start, lessonZero, phraseIntro, listening, yourTurn,
// phraseComplete (the last stage of a phrase is done), stageComplete (a stage is done and another follows)
// and songComplete. The order of the stages comes from learn/stages.js; the lesson only walks it.
import { resolveLevel } from "../core/timeline.js";
import { transposeSong } from "../theory/transpose.js";
import { initZero, reduceZero } from "./lesson-zero.js";
import { matchEvent, startStep } from "./matcher.js";
import { derivePhrases } from "./phrases.js";
import { positionOf, withLessonZero } from "./progress.js";
import { buildPlan, findStage, stageBpm } from "./stages.js";
import { deriveSteps } from "./steps.js";

const HANDS = ["R", "L"];
const isPlayable = (n) => n.rest !== true && n.grace !== true && n.midi !== null && n.midi !== undefined;

/** True when the timeline has a pitched note of the hand. */
export const handHasNotes = (timeline, hand) => timeline.notes.some((n) => n.hand === hand && isPlayable(n));

function build(song, levelId, tonic) {
  const source = tonic && tonic !== song.key?.tonic ? transposeSong(song, levelId, tonic) : song;
  const timeline = resolveLevel(source, levelId);
  const phrases = derivePhrases(timeline);
  return { timeline, phrases, plan: buildPlan(timeline, phrases) };
}

/** The stage the lesson is at (an entry of `state.plan`), or null when the song has nothing to play. */
export const currentStage = (s) => s.plan[s.stage] ?? null;

// The slice of the song a stage covers, shaped like a phrase so the step derivation can use it.
const rangeOf = (phrases, stage) => (stage.scope === "phrase" ? phrases[stage.phraseIndex] : { id: stage.id, startTick: stage.startTick, endTick: stage.endTick });
const stepsOfStage = (timeline, phrases, stage) => (stage ? deriveSteps(timeline, rangeOf(phrases, stage), stage.hand, { key: timeline.key }) : []);

// Last slow phrase stage of the hand at or before the phrase (the search backwards after a key or hand change).
function lastStage(plan, hand, from) {
  for (let i = plan.length - 1; i >= 0; i -= 1) if (plan[i].scope === "phrase" && plan[i].hand === hand && plan[i].tempo === "slow" && plan[i].phraseIndex <= from) return i;
  return -1;
}

// First stage of a LATER phrase for the hand the learner follows (phrases without that hand are skipped).
const nextPhraseStage = (s) => findStage(s.plan, { hand: s.focus, fromPhrase: s.phraseIndex + 1 });

/** True when "Next phrase" leads somewhere: the stage is a phrase stage and a later phrase has a stage for the followed hand. */
export const hasNextPhrase = (s) => currentStage(s)?.scope === "phrase" && nextPhraseStage(s) !== -1;

/** How many stages the current phrase has in the plan (1 means there is nothing to name: a single-hand phrase). */
export const stagesInPhrase = (s) => (currentStage(s)?.scope === "phrase" ? s.plan.filter((u) => u.scope === "phrase" && u.phraseIndex === s.phraseIndex).length : 1);
// First stage after the phrases: a section or the whole song.
const firstWide = (plan, after) => plan.findIndex((u, i) => i > after && u.scope !== "phrase");

/**
 * phraseNumber(state) -> { n, total }: the place of the current phrase among the phrases the followed hand
 * plays, counted from 1. A song whose first phrases belong to the other hand (a left-hand intro) still starts
 * at "Phrase 1 of N" for the hand the learner chose, never at "Phrase 3".
 */
export function phraseNumber(s) {
  const own = [...new Set(s.plan.filter((u) => u.scope === "phrase" && u.hand === s.focus).map((u) => u.phraseIndex))];
  const all = [...new Set(s.plan.filter((u) => u.scope === "phrase").map((u) => u.phraseIndex))];
  const list = own.includes(s.phraseIndex) ? own : all;
  return { n: Math.max(0, list.indexOf(s.phraseIndex)) + 1, total: Math.max(1, list.length) };
}

const expectedOf = (step) => step.keys.map((k) => k.midi);
// Where to resume: the stage (with its phrase and hand). `stage` is an index into the plan of this song, level and key.
const savePosition = (s, stage, extra = {}) => {
  const u = s.plan[stage] ?? { phraseIndex: s.phraseIndex, hand: s.hand };
  return { type: "save", position: { songId: s.song.id, levelId: s.levelId, tonic: s.keyTonic, phrase: u.phraseIndex, stage, hand: u.hand }, ...extra };
};

/**
 * initLesson({ song, levelId, keyTonic, hand, progress, silent }) -> state (phase "start").
 * `silent` is only ever added to: a timeline that is not explicitly `silent: false` is silent too
 * (fail closed), so a private song or a hand-built timeline never gets a Listen.
 */
export function initLesson({ song, levelId, keyTonic, hand, progress, silent = false }) {
  const tonic = keyTonic ?? song.key?.tonic ?? null;
  const { timeline, phrases, plan } = build(song, levelId, tonic);
  const chosen = hand ?? (handHasNotes(timeline, "R") ? "R" : "L");
  const first = Math.max(0, findStage(plan, { hand: chosen }));
  const stage = plan[first] ?? null;
  return {
    phase: "start",
    song,
    songId: song.id,
    levelId,
    originalTonic: song.key?.tonic ?? null,
    keyTonic: tonic,
    silent: silent === true || timeline.silent !== false,
    focus: chosen,
    hand: stage?.hand ?? chosen,
    timeline,
    phrases,
    plan,
    stage: first,
    phraseIndex: stage?.phraseIndex ?? 0,
    steps: stepsOfStage(timeline, phrases, stage),
    stepIndex: 0,
    matcher: null,
    feedback: null,
    held: new Set(),
    returnStep: null,
    progress: progress ?? null,
    saved: progress ? positionOf(progress, song.id, levelId, tonic) : null,
  };
}

// Shows a stage: a public song starts at its intro, a silent one goes straight to the first step.
function enterStage(s, index, steps) {
  const stage = s.plan[index];
  const next = { ...s, stage: index, hand: stage.hand, phraseIndex: stage.phraseIndex, steps: steps ?? stepsOfStage(s.timeline, s.phrases, stage), stepIndex: 0, feedback: null, matcher: null, returnStep: null };
  return s.silent ? beginStep(next, 0) : { ...next, phase: "phraseIntro" };
}

// Starts a step with the keys held right now excluded from it.
function beginStep(s, stepIndex) {
  return { ...s, phase: "yourTurn", stepIndex, feedback: null, returnStep: null, matcher: startStep(expectedOf(s.steps[stepIndex]), [...s.held]) };
}

const stay = (s) => ({ state: s, effects: [] });
// Listen plays the stage's slice for its hand (both hands when "T"); only the full-tempo stages pass an explicit BPM.
const listenEffect = (s) => {
  const u = currentStage(s);
  return { type: "listen", phraseId: u.id, startTick: u.startTick, endTick: u.endTick, hand: u.hand === "T" ? null : u.hand, ...(u.tempo === "full" ? { bpm: stageBpm(s.timeline, u) } : {}) };
};

// Lesson zero keeps its own small state; its keys and its announcements pass through unchanged.
function inZero(s, action) {
  const r = reduceZero(s.zero, action);
  const next = { ...s, zero: r.state, held: new Set(r.state.held) };
  if (!r.effects.some((e) => e.type === "finish")) return { state: next, effects: r.effects };
  return leaveZero(next, "done");
}

// Back to the first screen with lesson zero marked done or skipped (saved once for the learner, not per song).
function leaveZero(s, value) {
  return { state: { ...s, phase: "start", zero: null, feedback: null, progress: s.progress ? withLessonZero(s.progress, value) : s.progress }, effects: [{ type: "lessonZero", value }] };
}

// The last step of a stage was played: which screen comes next, and where a later visit resumes.
function finishStage(base, matched, midi) {
  const done = { ...matched, feedback: { kind: "correct", midi }, matcher: null };
  const here = base.plan[base.stage];
  const follows = base.stage + 1 < base.plan.length ? base.stage + 1 : -1;
  const to = (phase, kind, resume) => ({ state: { ...done, phase }, effects: [{ type: "announce", kind }, savePosition(base, resume)] });
  if (here.scope === "phrase") {
    if (follows !== -1 && base.plan[follows].scope === "phrase" && base.plan[follows].phraseIndex === here.phraseIndex) return to("stageComplete", "stageDone", follows);
    const after = nextPhraseStage(base);
    if (after !== -1) return to("phraseComplete", "phraseDone", after);
    const wide = firstWide(base.plan, base.stage);
    return wide !== -1 ? to("stageComplete", "stageDone", wide) : to("songComplete", "songDone", base.stage);
  }
  return follows !== -1 ? to("stageComplete", "stageDone", follows) : to("songComplete", "songDone", base.stage);
}

function onNote(s, action) {
  if (s.phase === "lessonZero") return inZero(s, action);
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
  return finishStage(base, matched, action.midi);
}

// The same stage (or the nearest for the hand) after the key or the hand changed.
function retarget(s, { phrases, timeline, plan }, hand, effects) {
  const cur = currentStage(s);
  let index = -1;
  if (hand) {
    index = findStage(plan, { hand, fromPhrase: s.phraseIndex });
    if (index === -1) index = lastStage(plan, hand, s.phraseIndex);
  } else {
    index = cur ? plan.findIndex((u) => u.scope === cur.scope && u.id === cur.id && u.hand === cur.hand && u.tempo === cur.tempo) : -1;
    if (index === -1) index = findStage(plan, { hand: s.focus, fromPhrase: s.phraseIndex });
    if (index === -1) index = lastStage(plan, s.focus, s.phraseIndex);
  }
  if (index === -1) return null;
  const moved = { ...s, timeline, phrases, plan, focus: hand ?? s.focus, silent: s.silent || timeline.silent !== false, saved: s.progress ? positionOf(s.progress, s.songId, s.levelId, s.keyTonic) : null };
  const steps = stepsOfStage(timeline, phrases, plan[index]);
  if (s.phase === "start") return { state: { ...moved, stage: index, hand: plan[index].hand, phraseIndex: plan[index].phraseIndex, steps, stepIndex: 0, matcher: null, feedback: null }, effects };
  return { state: enterStage(moved, index, steps), effects };
}

/**
 * reduce(state, action) -> { state, effects }. Actions: START, CONTINUE, LISTEN, LISTEN_DONE, MY_TURN,
 * NOTE_ON { midi }, NOTE_OFF { midi }, LISTEN_AGAIN, NEXT_PHRASE, NEXT_STAGE, REPEAT, SET_LANG { lang },
 * SET_KEY { tonic }, SET_HAND { hand }, LESSON_ZERO, ZERO_NEXT, ZERO_SKIP, LEAVE. Effects: listen, stopListen,
 * save, announce, releaseAll, lessonZero { value }.
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
      const first = findStage(s.plan, { hand: s.focus });
      return first === -1 ? stay(s) : { state: enterStage(s, first), effects: [savePosition(s, first)] };
    }
    case "CONTINUE": {
      if (s.phase !== "start") return stay(s);
      const saved = s.saved;
      const focus = HANDS.includes(saved?.hand) && handHasNotes(s.timeline, saved.hand) ? saved.hand : s.focus;
      let index = Number.isInteger(saved?.stage) && s.plan[saved.stage]?.phraseIndex === saved.phrase && (!saved.hand || s.plan[saved.stage].hand === saved.hand) ? saved.stage : -1;
      if (index === -1) {
        index = findStage(s.plan, { hand: focus, fromPhrase: Math.min(saved?.phrase ?? 0, s.phrases.length - 1) });
        if (index === -1) index = findStage(s.plan, { hand: focus });
      }
      return index === -1 ? stay(s) : { state: enterStage({ ...s, focus }, index), effects: [] };
    }
    case "LESSON_ZERO":
      return s.phase === "start" ? { state: { ...s, phase: "lessonZero", zero: initZero([...s.held]), feedback: null }, effects: [] } : stay(s);
    case "ZERO_NEXT":
      return s.phase === "lessonZero" ? inZero(s, { type: "NEXT" }) : stay(s);
    case "ZERO_SKIP":
      return s.phase === "lessonZero" ? leaveZero(s, "skipped") : stay(s);
    case "LISTEN":
      return s.phase === "phraseIntro" && !s.silent ? { state: { ...s, phase: "listening", returnStep: null }, effects: [listenEffect(s)] } : stay(s);
    case "LISTEN_AGAIN":
      return s.phase === "yourTurn" && !s.silent ? { state: { ...s, phase: "listening", returnStep: s.stepIndex, matcher: null }, effects: [listenEffect(s)] } : stay(s);
    case "LISTEN_DONE":
      return s.phase === "listening" ? { state: beginStep(s, s.returnStep ?? 0), effects: [] } : stay(s);
    case "MY_TURN":
      return s.phase === "phraseIntro" || s.phase === "listening" ? { state: beginStep(s, s.phase === "listening" ? (s.returnStep ?? 0) : 0), effects: stopping } : stay(s);
    case "NEXT_STAGE": {
      if (s.phase !== "stageComplete") return stay(s);
      const index = s.stage + 1;
      return index < s.plan.length ? { state: enterStage(s, index), effects: [savePosition(s, index)] } : { state: { ...s, phase: "songComplete" }, effects: [] };
    }
    case "NEXT_PHRASE": {
      if (s.phase !== "phraseComplete" && s.phase !== "stageComplete") return stay(s);
      let index = currentStage(s)?.scope === "phrase" ? nextPhraseStage(s) : -1;
      if (index === -1) index = firstWide(s.plan, s.stage);
      return index === -1 ? { state: { ...s, phase: "songComplete" }, effects: [] } : { state: enterStage(s, index), effects: [savePosition(s, index)] };
    }
    case "REPEAT":
      return s.phase === "phraseComplete" || s.phase === "stageComplete" || s.phase === "yourTurn" ? { state: beginStep(s, 0), effects: [] } : stay(s);
    case "SET_LANG":
      return stay(s);
    case "SET_KEY": {
      if (s.phase === "lessonZero") return stay(s);
      const allowed = action.tonic === s.originalTonic || s.timeline.learn?.transposeTo?.includes(action.tonic);
      if (!allowed || action.tonic === s.keyTonic) return stay(s);
      let built;
      try {
        built = build(s.song, s.levelId, action.tonic);
      } catch {
        return stay(s); // no valid transposition: the lesson keeps its key
      }
      const next = retarget({ ...s, keyTonic: action.tonic }, built, null, [...stopping]);
      if (!next) return stay(s);
      next.effects.push(savePosition(next.state, next.state.stage, { transpose: action.tonic === s.originalTonic ? null : action.tonic }));
      return next;
    }
    case "SET_HAND": {
      if (s.phase === "lessonZero" || !HANDS.includes(action.hand) || (action.hand === s.hand && action.hand === s.focus) || !handHasNotes(s.timeline, action.hand)) return stay(s);
      const next = retarget(s, { phrases: s.phrases, timeline: s.timeline, plan: s.plan }, action.hand, [...stopping]);
      if (!next) return stay(s);
      next.effects.push(savePosition(next.state, next.state.stage));
      return next;
    }
    case "LEAVE":
      return { state: s, effects: [{ type: "stopListen" }, { type: "releaseAll" }] };
    default:
      throw new TypeError(`Unknown lesson action: ${action?.type}`);
  }
}
