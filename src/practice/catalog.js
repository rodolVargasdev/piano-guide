// The practice exercises: what exists, how it is grouped, which choices it offers, which tempos the card suggests
// and how its steps are generated from music theory (nothing is stored as content, so nothing is copyrighted).
// Pure data and functions; the strings of every card live in src/i18n/strings.js under `ex.<id>.*`.
import { fiveFinger, majorScale } from "../theory/scales.js";
import { arpeggio, triad } from "../theory/triads.js";
import { PROGRESSIONS, progression } from "../theory/progressions.js";
import { TONICS } from "../theory/keys.js";
import { BPM_MAX, BPM_MIN } from "../core/practice.js";
import { mergeHands } from "./runner.js";

/** The groups of the list, in the order they are shown: what each group trains is named by `practice.group.<id>`. */
export const GROUPS = Object.freeze(["technique", "harmony", "ear", "routine"]);

/** The five fields every doc card has, in the order they are read. The string key of a field is `ex.<id>.<field>`. */
export const CARD_FIELDS = Object.freeze(["title", "goal", "why", "how", "good"]);

/** The string keys of the doc card of an exercise. */
export const cardKeys = (id) => CARD_FIELDS.map((field) => `ex.${id}.${field}`);

const HANDS_FIRST_R = Object.freeze(["R", "L", "T"]);
const SPEEDS = Object.freeze([50, 60, 72, 88]);
const SLOW_SPEEDS = Object.freeze([40, 50, 60, 72]);

// One step per note of a one-handed line.
const lineSteps = (notes) => notes.map((n) => ({ keys: [n] }));

// Steps of a line generated for each hand; hands together join the same positions of both lines.
function byHand(hand, make) {
  if (hand === "T") return mergeHands(make("R"), make("L"));
  return make(hand);
}

const INVERSIONS = Object.freeze([0, 1, 2, 3, 2, 1, 0]); // root, first, second, the root an octave up, and back

// Steps of a progression: every chord is one step. Both hands: the left hand root and the right hand triad.
function chordSteps(p, hand) {
  return p.chords.map((c) => ({
    label: c.symbol,
    keys: [...(hand === "R" ? [] : [c.bass]), ...(hand === "L" ? [] : c.right.notes)].sort((a, b) => a.midi - b.midi),
  }));
}

const progressionExercise = (id, name) => ({
  id,
  group: "harmony",
  kind: "run",
  keyed: true,
  hands: ["T", "R", "L"],
  choices: { hand: ["T", "R", "L"] },
  defaults: { hand: "T" },
  tempoSteps: SLOW_SPEEDS,
  generate: ({ key, hand }) => {
    const p = progression(key, PROGRESSIONS[name]);
    return p ? { steps: chordSteps(p, hand), suggested: false, name: PROGRESSIONS[name].join("-") } : null;
  },
});

/** Every exercise, in the order of the list. `kind` is "run" (play the generated keys), "ear" or "routine". */
export const EXERCISES = Object.freeze([
  {
    id: "five-finger",
    group: "technique",
    kind: "run",
    keyed: true,
    hands: HANDS_FIRST_R,
    choices: { hand: HANDS_FIRST_R, quality: ["major", "minor"], direction: ["updown", "up"] },
    defaults: { hand: "R", quality: "major", direction: "updown" },
    tempoSteps: SPEEDS,
    generate: ({ key, hand, quality, direction }) => {
      const steps = byHand(hand, (h) => lineSteps(fiveFinger(key, h, { minor: quality === "minor", direction })?.notes ?? []));
      return steps.length ? { steps, suggested: false } : null;
    },
  },
  {
    id: "scale-major",
    group: "technique",
    kind: "run",
    keyed: true,
    hands: HANDS_FIRST_R,
    choices: { hand: HANDS_FIRST_R, octaves: [1, 2], direction: ["up", "updown"] },
    defaults: { hand: "R", octaves: 1, direction: "up" },
    tempoSteps: SPEEDS,
    generate: ({ key, hand, octaves, direction }) => {
      const scales = ["R", "L"].map((h) => majorScale(key, { octaves, hand: h, direction }));
      if (scales.some((s) => s === null)) return null;
      const used = hand === "T" ? scales : scales.filter((s) => s.hand === hand);
      return { steps: byHand(hand, (h) => lineSteps(scales.find((s) => s.hand === h).notes)), suggested: used.some((s) => s.suggested) };
    },
  },
  {
    id: "triads",
    group: "harmony",
    kind: "run",
    keyed: true,
    hands: HANDS_FIRST_R,
    choices: { hand: HANDS_FIRST_R, quality: ["major", "minor"] },
    defaults: { hand: "R", quality: "major" },
    tempoSteps: SLOW_SPEEDS,
    generate: ({ key, hand, quality }) => {
      const make = (h) => INVERSIONS.map((inversion) => ({ keys: triad(key, quality, inversion, h)?.notes ?? [] }));
      const steps = byHand(hand, make);
      return steps.every((s) => s.keys.length) ? { steps, suggested: false } : null;
    },
  },
  {
    id: "arpeggios",
    group: "technique",
    kind: "run",
    keyed: true,
    hands: HANDS_FIRST_R,
    choices: { hand: HANDS_FIRST_R, octaves: [1, 2], quality: ["major", "minor"], direction: ["up", "updown"] },
    defaults: { hand: "R", octaves: 1, quality: "major", direction: "up" },
    tempoSteps: SPEEDS,
    generate: ({ key, hand, octaves, quality, direction }) => {
      const both = ["R", "L"].map((h) => arpeggio(key, quality, { octaves, hand: h, direction }));
      if (both.some((a) => a === null)) return null;
      const used = hand === "T" ? both : both.filter((a) => a.hand === hand);
      return { steps: byHand(hand, (h) => lineSteps(both.find((a) => a.hand === h).notes)), suggested: used.some((a) => a.suggested) };
    },
  },
  progressionExercise("cadence-i-iv-v-i", "I-IV-V-I"),
  progressionExercise("progression-i-vi-iv-v", "I-vi-IV-V"),
  progressionExercise("progression-i-v-vi-iv", "I-V-vi-IV"),
  { id: "ear-intervals", group: "ear", kind: "ear", keyed: false, tempoSteps: [], choices: {}, defaults: {} },
  { id: "ear-chords", group: "ear", kind: "ear", keyed: false, tempoSteps: [], choices: {}, defaults: {} },
  { id: "routine", group: "routine", kind: "routine", keyed: false, tempoSteps: [], choices: {}, defaults: {} },
]);

/** The exercise with this id, or null (the id comes from the address bar: it is only compared, never trusted). */
export function exerciseById(id) {
  return EXERCISES.find((e) => e.id === id) ?? null;
}

/** The exercises of one group, in list order. */
export const exercisesIn = (group) => EXERCISES.filter((e) => e.group === group);

/** Options with their defaults filled in; a value the exercise does not offer falls back to its default. */
export function resolveOptions(exercise, options = {}) {
  const out = { ...exercise.defaults };
  for (const [name, values] of Object.entries(exercise.choices)) if (values.includes(options[name])) out[name] = options[name];
  out.key = TONICS.includes(options.key) ? options.key : "C";
  return out;
}

/**
 * generateExercise(id, options) -> { exercise, options, steps, suggested, name? } or null (unknown id, an exercise
 * that is not a run, or a key it cannot spell). `steps` is [{ keys: [{ midi, pitch, finger, hand }], label? }].
 * `suggested` is true when a fingering in the run is one the books disagree on ("Suggested fingering").
 */
export function generateExercise(id, options = {}) {
  const exercise = exerciseById(id);
  if (!exercise || exercise.kind !== "run") return null;
  const resolved = resolveOptions(exercise, options);
  const made = exercise.generate(resolved);
  return made ? { exercise, options: resolved, ...made } : null;
}

/** True when every tempo of the card is inside the engine bounds, ascending and without repeats. */
export function tempoStepsValid(steps) {
  return steps.every((s, i) => Number.isInteger(s) && s >= BPM_MIN && s <= BPM_MAX && (i === 0 || s > steps[i - 1]));
}

/**
 * Keys not practiced yet, in the order given (the order of introduction): the first is pre-selected and the next ones are
 * marked as next. An order of introduction, never a lock: every key stays selectable.
 */
export function keysToPractice(done, order) {
  return order.filter((k) => !done.includes(k));
}

/**
 * Card fields without text: for every exercise and every one of the five fields, in English and Spanish, the string
 * key and language that is missing or empty, as "ex.<id>.<field> (<lang>)". An empty list means every card is complete.
 * A test fails with this list naming the exercise and the field (and runs the same check on a fixture that lacks one).
 */
export function missingCardFields(exercises, table) {
  const missing = [];
  for (const e of exercises) {
    for (const key of cardKeys(e.id)) {
      for (const lang of ["en", "es"]) if (typeof table[key]?.[lang] !== "string" || table[key][lang].trim() === "") missing.push(`${key} (${lang})`);
    }
  }
  return missing;
}
