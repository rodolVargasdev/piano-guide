// Instructions of a step as language-neutral data, rendered at display time through the translator.
// Sentence 1 names the hand, the finger and the note (or the move); sentence 2 only adds how many keys
// to press together or, after a move, the first finger to play. At most two sentences, so a language
// switch re-renders the same data without touching the lesson state. Pure, no DOM.
import { noteName } from "../core/pitch.js";

const lowest = (keys) => [...keys].sort((a, b) => a.midi - b.midi)[0];

/**
 * instructionFor(step, prevStep) -> { key, params }.
 *   key "step.one"  : params { hand, finger, pitch, count }
 *   key "step.move" : params { hand, thumb, finger, pitch, count } (the hand moves to a new position)
 *   key "step.both" : params { right: { finger, pitch }, left: { finger, pitch }, count } (hands together)
 * `finger` and `pitch` are those of the lowest key of the step. The hand moves only when the step is
 * flagged as a shift and the position really differs from the previous step's.
 */
export function instructionFor(step, prevStep = null) {
  const count = step.keys.length;
  if (step.hand === "T") {
    const of = (hand) => {
      const k = lowest(step.keys.filter((x) => x.hand === hand));
      return k ? { finger: k.finger, pitch: k.pitch } : null;
    };
    return { key: "step.both", params: { right: of("R"), left: of("L"), count } };
  }
  const base = lowest(step.keys);
  const moved = step.shift === true && prevStep !== null && prevStep.position.anchorStep !== step.position.anchorStep;
  if (moved) return { key: "step.move", params: { hand: step.hand, thumb: step.position.thumbPitch, finger: base.finger, pitch: base.pitch, count } };
  return { key: "step.one", params: { hand: step.hand, finger: base.finger, pitch: base.pitch, count } };
}

/** "E (Mi)" in English, "Mi (E)" in Spanish: the written spelling, octave left out. */
export function noteLabel(t, pitch, lang) {
  return t("note.display", { letter: noteName(pitch, "letters") ?? "", solfege: noteName(pitch, "solfege") ?? "" }, lang);
}

const fingerOn = (t, part, lang) => t("step.fingerOn", { finger: t(`finger.${part.finger}`, undefined, lang), note: noteLabel(t, part.pitch, lang) }, lang);

/** Renders an instruction with the translator `t(key, params, lang?)` (see i18n.createI18n). */
export function renderInstruction(t, instr, lang) {
  const { params } = instr;
  const sentences = [];
  if (instr.key === "step.both") {
    sentences.push(t("step.both", { right: params.right ? fingerOn(t, params.right, lang) : "", left: params.left ? fingerOn(t, params.left, lang) : "" }, lang));
    if (params.count > 2) sentences.push(t("step.together", { count: params.count }, lang));
    return sentences.join(" ");
  }
  if (instr.key === "step.move") {
    sentences.push(t("step.move", { hand: t(`hand.${params.hand}.lower`, undefined, lang), thumb: noteLabel(t, params.thumb, lang) }, lang));
  } else {
    sentences.push(t("step.one", { hand: t(`hand.${params.hand}`, undefined, lang), finger: t(`finger.${params.finger}`, undefined, lang), note: noteLabel(t, params.pitch, lang) }, lang));
  }
  if (params.count > 1) sentences.push(t("step.together", { count: params.count }, lang));
  else if (instr.key === "step.move") {
    // When the key to press is the very key the thumb moved to, "Then thumb on G" would repeat the sentence before it.
    sentences.push(params.pitch === params.thumb ? t("step.thenPress", undefined, lang) : t("step.thenPlay", { finger: t(`finger.${params.finger}`, undefined, lang), note: noteLabel(t, params.pitch, lang) }, lang));
  }
  return sentences.join(" ");
}
