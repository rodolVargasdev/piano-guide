// What lesson zero says and offers at each part, as plain data (the Learn view turns it into elements).
// Very simple words for a person who has never touched a piano: one thing to do per screen, and a skip
// that is always there until the last part. No DOM, no state of its own.
import { FINGER_STEPS, ZERO_PARTS } from "../learn/lesson-zero.js";
import { renderInstruction } from "../learn/instructions.js";

export const POSTURE_IMAGE = "assets/img/posture.svg";

/**
 * zeroModel(z, { i18n }) -> { phase: "lessonZero", heading, sub, items, image, progress, chip, actions }.
 * `items` is a list of short lines (part 4), `image` is { src, alt } or null (part 2). Action ids:
 * ZERO_NEXT and ZERO_SKIP. `chip` is { kind: "correct" | "wrong", text, detail } while feedback shows.
 */
export function zeroModel(z, { i18n }) {
  const t = i18n.t;
  const part = ZERO_PARTS[z.part];
  const action = (id, key, primary = false) => ({ id, label: t(key), primary });
  const f = z.feedback;
  const wrongDetail = z.part === 0 ? t("lz.find.hint") : t(f?.kind === "octave" ? "learn.octave" : "learn.useShaded");
  const chip = f?.kind === "correct" ? { kind: "correct", text: t("common.correct"), detail: "" } : f ? { kind: "wrong", text: t("common.tryAgain"), detail: wrongDetail } : null;
  const base = { phase: "lessonZero", heading: "", sub: "", items: [], image: null, progress: t("lz.part", { n: z.part + 1, total: ZERO_PARTS.length }), chip, actions: [], showProgressReset: false };
  if (part.id === "findC") return { ...base, heading: t("lz.find.heading"), sub: t("lz.find.sub"), actions: [action("ZERO_SKIP", "lz.skip")] };
  if (part.id === "posture") return { ...base, heading: t("lz.posture.heading"), sub: t("lz.posture.sub"), image: { src: POSTURE_IMAGE, alt: t("lz.posture.alt") }, actions: [action("ZERO_NEXT", "common.next", true), action("ZERO_SKIP", "lz.skip")] };
  if (part.id === "fingers") {
    const step = FINGER_STEPS[z.stepIndex];
    const instruction = { key: "step.one", params: { hand: step.hand, finger: step.finger, pitch: step.pitch, count: 1 } };
    return { ...base, heading: renderInstruction(t, instruction, i18n.lang()), sub: t("lz.fingers.sub"), progress: `${base.progress}. ${t("lz.fingers.progress", { n: z.stepIndex + 1, total: FINGER_STEPS.length })}`, actions: [action("ZERO_SKIP", "lz.skip")] };
  }
  return { ...base, heading: t("lz.inputs.heading"), items: [t("lz.inputs.tap"), t("lz.inputs.computer"), t("lz.inputs.piano"), t("lz.inputs.audioOnly")], actions: [action("ZERO_NEXT", "lz.done", true)] };
}
