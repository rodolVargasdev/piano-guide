// Lesson zero: the first lesson for a person who has never touched a piano. Four short parts as data plus
// a tiny pure reducer: (1) find C by the groups of 2 and 3 black keys (any C counts), (2) sitting and
// hand posture, (3) the finger numbers 1 to 5 on C D E F G, (4) how each input works. It waits for the
// learner like every step of Learn: nothing is timed. No DOM, no audio, no storage.
import { matchEvent, startStep } from "./matcher.js";

/** C3 to B4: two octaves, so there are two groups of two black keys and two of three. */
export const FIND_C_REGION = Object.freeze({ low: 48, high: 71 });
/** C4 to D5: nine white keys, the five finger keys in the middle of them. */
export const FINGER_REGION = Object.freeze({ low: 60, high: 74 });
/** The five finger steps of part 3: the right hand on C4 D4 E4 F4 G4 with its fingers 1 to 5. */
export const FINGER_STEPS = Object.freeze(
  [
    { midi: 60, pitch: "C4", finger: 1 },
    { midi: 62, pitch: "D4", finger: 2 },
    { midi: 64, pitch: "E4", finger: 3 },
    { midi: 65, pitch: "F4", finger: 4 },
    { midi: 67, pitch: "G4", finger: 5 },
  ].map((s) => Object.freeze({ ...s, hand: "R" })),
);

/** The four parts in order. `kind` says what the learner does: press a key, read, or press the keys in turn. */
export const ZERO_PARTS = Object.freeze([
  Object.freeze({ id: "findC", kind: "press" }),
  Object.freeze({ id: "posture", kind: "read" }),
  Object.freeze({ id: "fingers", kind: "steps" }),
  Object.freeze({ id: "inputs", kind: "read" }),
]);

const TWO_GROUP = new Set([1, 3]); // C# and D# lie between the white keys of a group of two
const THREE_GROUP = new Set([6, 8, 10]);
const pitchClass = (midi) => ((midi % 12) + 12) % 12;

/** The black keys of a region split by group: { two: [midi...], three: [midi...] }, lowest first. */
export function blackGroups({ low, high }) {
  const two = [];
  const three = [];
  for (let m = low; m <= high; m += 1) {
    if (TWO_GROUP.has(pitchClass(m))) two.push(m);
    else if (THREE_GROUP.has(pitchClass(m))) three.push(m);
  }
  return { two, three };
}

// The matcher of a part that waits for keys (parts 1 and 3); the keys held now never count at its start.
function stepOf(part, stepIndex, held = []) {
  if (part === 0) return startStep([60], held, { match: "pitchClass" });
  if (part === 2) return startStep([FINGER_STEPS[stepIndex].midi], held);
  return null;
}

/** initZero(held) -> state at part 0 (find C). `held` is the keys down now: they never count at a step they were already down for. */
export function initZero(held = []) {
  return { part: 0, stepIndex: 0, matcher: stepOf(0, 0, [...held]), held: new Set(held), feedback: null };
}

const begin = (z, part, stepIndex = 0) => ({ ...z, part, stepIndex, feedback: null, matcher: stepOf(part, stepIndex, [...z.held]) });

/**
 * reduceZero(z, action) -> { state, effects }. Actions: NOTE_ON { midi }, NOTE_OFF { midi }, NEXT (leaves the
 * reading parts 2 and 4; part 4 ends the lesson). Effects: `announce` { kind: "correct" | "wrong" | "octave", midi }
 * and `finish` when part 4 is left. An action that does not apply to the current part changes nothing.
 */
export function reduceZero(z, action) {
  const stay = (s) => ({ state: s, effects: [] });
  if (action.type === "NEXT") {
    if (z.part === 1) return stay(begin(z, 2));
    if (z.part === 3) return { state: z, effects: [{ type: "finish" }] };
    return stay(z);
  }
  if (action.type !== "NOTE_ON" && action.type !== "NOTE_OFF") throw new TypeError(`Unknown lesson zero action: ${action?.type}`);
  const held = new Set(z.held);
  if (action.type === "NOTE_ON") held.add(action.midi);
  else held.delete(action.midi);
  const base = { ...z, held };
  if (!base.matcher) return stay(base);
  const { m, outcome } = matchEvent(base.matcher, { type: action.type === "NOTE_ON" ? "on" : "off", midi: action.midi });
  const matched = { ...base, matcher: m };
  if (outcome === "ignored" || outcome === "progress") return stay(matched);
  if (outcome === "wrong" || outcome === "octave") return { state: { ...matched, feedback: { kind: outcome, midi: action.midi } }, effects: [{ type: "announce", kind: outcome, midi: action.midi }] };
  // satisfied: part 1 moves to the posture text, a finger step moves to the next finger, the last one to part 4
  const correct = { kind: "correct", midi: action.midi };
  const effects = [{ type: "announce", kind: "correct", midi: action.midi }];
  if (z.part === 0) return { state: { ...begin(matched, 1), feedback: correct }, effects };
  if (z.stepIndex + 1 < FINGER_STEPS.length) return { state: { ...begin(matched, 2, z.stepIndex + 1), feedback: correct }, effects };
  return { state: { ...begin(matched, 3), feedback: correct }, effects };
}

/**
 * zeroKeyboard(z) -> what the keyboard shows now: { region, hints, stepKeys, positionKeys }.
 * Part 1 outlines the groups of two black keys (the way to find C) and shades nothing; part 3 shades the
 * finger key with its number and marks the other four quietly; the reading parts show names only.
 */
export function zeroKeyboard(z) {
  if (z.part === 0) return { region: FIND_C_REGION, hints: blackGroups(FIND_C_REGION).two, stepKeys: [], positionKeys: [] };
  if (z.part === 2) {
    const current = FINGER_STEPS[z.stepIndex];
    return { region: FINGER_REGION, hints: [], stepKeys: [{ midi: current.midi, finger: current.finger, hand: "R" }], positionKeys: FINGER_STEPS.filter((s) => s !== current).map((s) => ({ midi: s.midi, finger: s.finger, hand: "R" })) };
  }
  return { region: z.part === 1 ? FIND_C_REGION : FINGER_REGION, hints: [], stepKeys: [], positionKeys: [] };
}
