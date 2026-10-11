// The run of one practice exercise as a pure reducer over note events: a generated sequence becomes steps for
// the same matcher Learn uses (the keys of a step count in any order, a wrong key clears the step but never moves
// the run), and the run remembers whether it stayed clean. Tempo is a pacing aid (A1): "clean at tempo T" means no
// wrong key while the metronome was at T; timing is never measured. No DOM, no audio.
import { BPM_MAX, BPM_MIN, clampBpm } from "../core/practice.js";
import { instructionFor } from "../learn/instructions.js";
import { matchEvent, startStep } from "../learn/matcher.js";

/** Scales and arpeggios are learned right hand, then left hand, then both together. */
export const STAGES = Object.freeze(["R", "L", "T"]);

/** The hand stage after `hand` ("R" then "L" then "T"), or null after the last one. */
export function nextStage(hand) {
  const at = STAGES.indexOf(hand);
  return at === -1 ? null : (STAGES[at + 1] ?? null);
}

/**
 * Joins the steps of two hands into hands-together steps: step i holds the keys of the right hand step i and of the
 * left hand step i (lowest first), so a hands-together step expects the keys of both hands. A hand that runs out
 * of steps first just stops adding keys.
 */
export function mergeHands(right, left) {
  const n = Math.max(right.length, left.length);
  return Array.from({ length: n }, (_, i) => ({ keys: [...(left[i]?.keys ?? []), ...(right[i]?.keys ?? [])].sort((a, b) => a.midi - b.midi) }));
}

const midisOf = (step) => step.keys.map((k) => k.midi);

/**
 * startRun(steps, { held }) -> run { steps, index, matcher, clean, wrong, done }. `steps` is [{ keys: [{ midi, pitch,
 * finger, hand }] }]; `held` are the keys already down when the run starts (they count only after being released).
 * An empty sequence is a run that is already done.
 */
export function startRun(steps, { held = [] } = {}) {
  return { steps, index: 0, matcher: steps.length ? startStep(midisOf(steps[0]), held) : null, clean: true, wrong: 0, done: steps.length === 0 };
}

/**
 * runReduce(run, { type: "on" | "off", midi }) -> { run, outcome }.
 * Outcomes: "progress" (an expected key of a chord), "correct" (the step is complete: the next one is already
 * active, or the run is done), "wrong" and "octave" (an unexpected key: the step stays, the accumulation is cleared and
 * the run will be recorded as not clean), "ignored" (a release, a key held from before, an auto-repeat, or any event
 * after the run is done). `finished` is true on the event that completes the last step.
 */
export function runReduce(run, event) {
  if (run.done) return { run, outcome: "ignored", finished: false };
  const { m, outcome } = matchEvent(run.matcher, event);
  if (outcome === "satisfied") {
    const index = run.index + 1;
    if (index >= run.steps.length) return { run: { ...run, matcher: m, index, done: true }, outcome: "correct", finished: true };
    // The keys still down (this chord's own, any held key) must be released before they count in the next step.
    return { run: { ...run, index, matcher: startStep(midisOf(run.steps[index]), [...m.down, ...m.held]) }, outcome: "correct", finished: false };
  }
  if (outcome === "wrong" || outcome === "octave") return { run: { ...run, matcher: m, clean: false, wrong: run.wrong + 1 }, outcome, finished: false };
  return { run: { ...run, matcher: m }, outcome, finished: false };
}

/** The instruction of a step as { key, params } for `renderInstruction`: one hand names it, two hands say both. */
export function stepInstruction(step) {
  const hands = [...new Set(step.keys.map((k) => k.hand))];
  return instructionFor({ keys: step.keys, hand: hands.length === 1 ? hands[0] : "T", shift: false, position: null });
}

/**
 * nextTempo(steps, current, clean) -> { bpm, top }: the tempo to suggest for the next run. After a clean run it is
 * the next tempo step above `current` (60 with steps 50 60 72 88 gives 72); it never goes past the last step, and
 * at or beyond the last step it stays where it is with `top: true` ("top tempo of this card"). An unclean run stays
 * at `current`. Tempos are kept inside the engine bounds of 20 to 240.
 */
export function nextTempo(steps, current, clean) {
  const list = [...steps].filter((s) => s >= BPM_MIN && s <= BPM_MAX).sort((a, b) => a - b);
  const bpm = clampBpm(current);
  if (!clean || list.length === 0) return { bpm, top: false };
  const next = list.find((s) => s > bpm);
  return next === undefined ? { bpm, top: true } : { bpm: next, top: false };
}
