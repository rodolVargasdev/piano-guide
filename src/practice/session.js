// The page of one practice exercise as a pure reducer: choices (key, hand, octaves...), the tempo, the run and what
// happens after it (the tempo ramp, "Again", "Next key", the next hand stage), plus hearing the exercise first.
// `reduceSession(state, action)` returns { state, effects } and the view runs the effects (metronome, hearing the
// notes, saving the run, the spoken feedback), like the Learn lesson reducer. Tempo is a pacing aid (A1): nothing
// is timed. A language switch is not an action here: it cannot change the exercise, step, key, tempo or presses.
// No DOM, no audio, no storage.
import { BPM_MAX, BPM_MIN, clampBpm } from "../core/practice.js";
import { introOrder, keyOrder } from "../theory/keys.js";
import { exerciseById, generateExercise, keysToPractice, resolveOptions } from "./catalog.js";
import { nextStage, nextTempo, runReduce, startRun } from "./runner.js";

/** How "Next key" chooses the next key: the same key, or around the circle of fifths or of fourths, or at random. */
export const ROTATIONS = Object.freeze(["circle", "fourths", "random", "same"]);

// Seconds a step lasts when the exercise is heard: one beat at the tempo, the sound a little shorter than the beat.
export function listenPlan(steps, bpm) {
  const beat = 60 / clampBpm(bpm);
  const notes = steps.flatMap((step, i) => step.keys.map((k) => ({ midi: k.midi, at: i * beat, dur: Math.max(0.15, beat * 0.9) })));
  return { notes, beat, total: steps.length * beat };
}

// The keys "Next key" will go through, starting with the key being practiced (so the next one is at index 1).
function rotationFor(kind, key, seed) {
  if (kind === "same") return { kind, seed, keys: [key], at: 0 };
  const order = keyOrder(kind === "random" ? { kind: "random", seed, start: key, count: 60 } : { kind: "circle", direction: kind === "fourths" ? "fourths" : "fifths", start: key, count: 60 });
  return { kind, seed, keys: order, at: 0 };
}

const bestTempoOf = (progress, id, key) => progress?.exercises?.[id]?.[key]?.bestTempo ?? 0;

/**
 * The keys of an exercise in the order a learner should meet them: the keys that have no clean run yet, in the order
 * of introduction (C G D F A E B Bb Eb Ab Db F#). An order, never a lock: every key can be chosen.
 */
export function practiceOrder(progress, exerciseId) {
  const done = Object.entries(progress?.exercises?.[exerciseId] ?? {}).filter(([, e]) => e.cleanRuns > 0).map(([key]) => key);
  return keysToPractice(done, introOrder());
}

/**
 * initSession({ exerciseId, options, bpm, progress, seed, rotation }) -> state, or null for an id that is not a run
 * exercise. The tempo starts at the learner's best clean tempo for this exercise and key when there is one, else at
 * the first step of the card; `rotation` defaults to the circle of fifths. Without a key the page opens on the first key
 * with no clean run yet (C for a learner who has not practiced it), so the order of introduction is suggested.
 */
export function initSession({ exerciseId, options = {}, bpm, progress = null, seed = 1, rotation = "circle" } = {}) {
  const exercise = exerciseById(exerciseId);
  if (!exercise || exercise.kind !== "run") return null;
  const resolved = resolveOptions(exercise, { ...options, key: options.key ?? (exercise.keyed ? practiceOrder(progress, exerciseId)[0] : undefined) });
  const made = generateExercise(exerciseId, resolved);
  if (!made) return null;
  const best = bestTempoOf(progress, exerciseId, resolved.key);
  return {
    exerciseId,
    exercise,
    options: resolved,
    steps: made.steps,
    suggested: made.suggested,
    bpm: clampBpm(bpm ?? (best > 0 ? best : exercise.tempoSteps[0])),
    metronome: false,
    phase: "ready",
    run: null,
    result: null,
    suggestion: null,
    rotation: rotationFor(ROTATIONS.includes(rotation) ? rotation : "circle", resolved.key, seed),
    progress,
  };
}

const metronomeEffect = (s) => ({ type: "metronome", on: s.metronome && s.phase === "running", bpm: s.bpm });

// A fresh state with another set of options: the steps are generated again and nothing is running.
function withOptions(s, next) {
  const resolved = resolveOptions(s.exercise, next);
  const made = generateExercise(s.exerciseId, resolved);
  if (!made) return s;
  const keyChanged = resolved.key !== s.options.key;
  return {
    ...s,
    options: resolved,
    steps: made.steps,
    suggested: made.suggested,
    phase: "ready",
    run: null,
    result: null,
    suggestion: null,
    rotation: keyChanged ? rotationFor(s.rotation.kind, resolved.key, s.rotation.seed) : s.rotation,
    bpm: keyChanged && bestTempoOf(s.progress, s.exerciseId, resolved.key) > 0 ? bestTempoOf(s.progress, s.exerciseId, resolved.key) : s.bpm,
  };
}

function begin(s, held = []) {
  const next = { ...s, phase: "running", run: startRun(s.steps, { held }), result: null, suggestion: null };
  return { state: next, effects: [{ type: "stopListen" }, metronomeEffect(next), { type: "announce", kind: "start" }] };
}

/**
 * reduceSession(state, action) -> { state, effects }. Actions: SET_OPTION { name, value }, SET_BPM { bpm },
 * SET_METRONOME { on }, SET_ROTATION { kind }, START { held }, STOP, AGAIN, FASTER, NEXT_KEY, NEXT_STAGE, LISTEN,
 * LISTEN_DONE, NOTE_ON { midi }, NOTE_OFF { midi }, LEAVE. Effects: metronome { on, bpm }, listen { plan },
 * stopListen, record { exerciseId, key, hand, bpm, clean }, announce { kind, ... }, releaseAll.
 */
export function reduceSession(s, action) {
  switch (action.type) {
    case "SET_OPTION": {
      if (action.name !== "key" && !(action.name in s.exercise.choices)) return { state: s, effects: [] };
      const next = withOptions(s, { ...s.options, [action.name]: action.value });
      return { state: next, effects: [{ type: "stopListen" }, metronomeEffect(next)] };
    }
    case "SET_BPM": {
      const next = { ...s, bpm: clampBpm(action.bpm), suggestion: s.phase === "done" ? s.suggestion : null };
      return { state: next, effects: [metronomeEffect(next)] };
    }
    case "SET_METRONOME": {
      const next = { ...s, metronome: action.on === true };
      return { state: next, effects: [metronomeEffect(next)] };
    }
    case "SET_ROTATION": {
      if (!ROTATIONS.includes(action.kind)) return { state: s, effects: [] };
      return { state: { ...s, rotation: rotationFor(action.kind, s.options.key, s.rotation.seed) }, effects: [] };
    }
    case "START":
    case "AGAIN":
      return begin(s, action.held ?? []);
    case "STOP": {
      const next = { ...s, phase: "ready", run: null };
      return { state: next, effects: [{ type: "stopListen" }, metronomeEffect(next)] };
    }
    case "FASTER": {
      if (!s.suggestion || s.suggestion.top) return { state: s, effects: [] };
      return begin({ ...s, bpm: s.suggestion.bpm }, action.held ?? []);
    }
    case "NEXT_KEY": {
      const { keys, at } = s.rotation;
      if (!s.exercise.keyed || s.rotation.kind === "same") return { state: s, effects: [] };
      const key = keys[Math.min(at + 1, keys.length - 1)];
      const moved = withOptions(s, { ...s.options, key });
      const next = { ...moved, rotation: { ...s.rotation, at: Math.min(at + 1, keys.length - 1) } };
      const r = begin({ ...next, bpm: s.bpm }, action.held ?? []);
      return { state: r.state, effects: [...r.effects, { type: "announce", kind: "nextKey", key }] };
    }
    case "NEXT_STAGE": {
      const hand = nextStage(s.options.hand);
      if (!hand || !s.exercise.choices.hand?.includes(hand)) return { state: s, effects: [] };
      const next = withOptions(s, { ...s.options, hand });
      const r = begin({ ...next, bpm: s.bpm }, action.held ?? []);
      return { state: r.state, effects: [...r.effects, { type: "announce", kind: "stage", hand }] };
    }
    case "LISTEN": {
      if (s.phase === "running") return { state: s, effects: [] };
      const next = { ...s, phase: "listening" };
      return { state: next, effects: [{ type: "listen", plan: listenPlan(s.steps, s.bpm) }, metronomeEffect(next)] };
    }
    case "LISTEN_DONE":
      return s.phase === "listening" ? { state: { ...s, phase: s.result ? "done" : "ready" }, effects: [] } : { state: s, effects: [] };
    case "NOTE_ON":
    case "NOTE_OFF": {
      if (s.phase !== "running") return { state: s, effects: [] };
      const stepBefore = s.run.steps[s.run.index];
      const { run, outcome, finished } = runReduce(s.run, { type: action.type === "NOTE_ON" ? "on" : "off", midi: action.midi });
      if (outcome === "ignored") return { state: { ...s, run }, effects: [] };
      if (!finished) return { state: { ...s, run }, effects: [{ type: "announce", kind: outcome, midi: action.midi, keys: stepBefore.keys.map((k) => k.midi) }] };
      const result = { clean: run.clean, wrong: run.wrong, bpm: s.bpm, key: s.options.key, hand: s.options.hand };
      const next = { ...s, run, phase: "done", result, suggestion: nextTempo(s.exercise.tempoSteps, s.bpm, run.clean) };
      return {
        state: next,
        effects: [
          { type: "announce", kind: "correct", midi: action.midi, keys: stepBefore.keys.map((k) => k.midi) },
          { type: "record", exerciseId: s.exerciseId, key: s.options.key, hand: s.options.hand, bpm: s.bpm, clean: run.clean },
          metronomeEffect(next),
          { type: "announce", kind: "done", clean: run.clean },
        ],
      };
    }
    case "LEAVE":
      return { state: { ...s, phase: "ready", run: null, metronome: false }, effects: [{ type: "stopListen" }, { type: "metronome", on: false, bpm: s.bpm }, { type: "releaseAll" }] };
    default:
      return { state: s, effects: [] };
  }
}

/** The tempos of the card as buttons: the steps, plus the current tempo when it is none of them (a suggestion or a typed value). */
export function tempoChoices(exercise, bpm) {
  const steps = exercise.tempoSteps;
  return steps.includes(bpm) || bpm < BPM_MIN || bpm > BPM_MAX ? steps : [...steps, bpm].sort((a, b) => a - b);
}
