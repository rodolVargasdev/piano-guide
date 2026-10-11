// Steps of a phrase: one step is the next onset group of one hand. Pure, no DOM.
import { mergeTies } from "../core/practice.js";
import { assignFingering } from "../theory/fingering.js";
import { instructionFor } from "./instructions.js";

const isPlayable = (n) => n.rest !== true && n.grace !== true && n.midi !== null && n.midi !== undefined;

/** Onset groups of one hand inside the phrase: notes of one tick, lowest first, tied continuations absorbed. */
function groupsOf(timeline, phrase, hand) {
  const notes = mergeTies(timeline.notes.filter((n) => n.hand === hand && isPlayable(n)));
  const byTick = new Map();
  for (const n of notes) {
    if (n.tick < phrase.startTick || n.tick >= phrase.endTick) continue;
    if (!byTick.has(n.tick)) byTick.set(n.tick, []);
    byTick.get(n.tick).push({ midi: n.midi, pitch: n.pitch, ...(n.finger !== undefined ? { finger: n.finger } : {}) });
  }
  return [...byTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tick, group]) => ({ tick, notes: group.sort((a, b) => a.midi - b.midi) }));
}

// Steps of both hands over one phrase: one step per tick where either hand starts a note.
function bothHands(timeline, phrase, { key }) {
  const byTick = new Map();
  for (const hand of ["R", "L"]) {
    for (const s of deriveSteps(timeline, phrase, hand, { key })) byTick.set(s.tick, { ...byTick.get(s.tick), [hand]: s });
  }
  return [...byTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tick, parts], i) => {
      const keys = [...(parts.R?.keys ?? []), ...(parts.L?.keys ?? [])].sort((a, b) => a.midi - b.midi);
      const step = { id: `${phrase.id}.${i + 1}`, tick, hand: "T", keys, position: (parts.R ?? parts.L).position, positions: { R: parts.R?.position ?? null, L: parts.L?.position ?? null }, shift: false };
      step.instruction = parts.R && parts.L ? instructionFor(step) : (parts.R ?? parts.L).instruction;
      return step;
    });
}

/**
 * deriveSteps(timeline, phrase, hand, { key }) -> [{ id, tick, hand, keys, position, shift, instruction }].
 * `keys` is [{ midi, pitch, finger, hand }], lowest first. Rests, grace notes and the continuation of a
 * tied note produce no step. A hand with no notes in the phrase yields []. A group no hand can span
 * (wider than the stretch rule allows) becomes consecutive single-note steps, lowest first, fingered
 * again as a line. `instruction` is { key, params }, rendered later through the translator.
 * Hand "T" (both hands) joins the steps of the two hands: the keys of the hands that start together are one
 * step, a step holds the keys of both hands, `positions` gives each hand its own position, and a step where
 * only one hand plays keeps that hand's own instruction.
 */
export function deriveSteps(timeline, phrase, hand, { key } = {}) {
  if (hand === "T") return bothHands(timeline, phrase, { key });
  let groups = groupsOf(timeline, phrase, hand);
  if (groups.length === 0) return [];
  let fingered = assignFingering(groups, { hand, key });
  if (fingered.some((f) => f.unplayable)) {
    groups = groups.flatMap((g, i) => (fingered[i].unplayable ? g.notes.map((n) => ({ tick: g.tick, notes: [n] })) : [g]));
    fingered = assignFingering(groups, { hand, key });
  }
  const steps = [];
  groups.forEach((g, i) => {
    const f = fingered[i];
    const step = {
      id: `${phrase.id}.${i + 1}`,
      tick: g.tick,
      hand,
      keys: g.notes.map((n, k) => ({ midi: n.midi, pitch: n.pitch, finger: f.fingers[k], hand })),
      position: f.position,
      shift: f.shift,
    };
    step.instruction = instructionFor(step, steps.at(-1) ?? null);
    steps.push(step);
  });
  return steps;
}
