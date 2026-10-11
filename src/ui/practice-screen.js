// What the page of one exercise says and offers at each moment, as plain data (so it is testable without a DOM).
// The rule is the one of Learn: one thing at a time, plain words, only the actions that make sense now. The view
// turns this model into elements and never decides what to say.
import { renderInstruction } from "../learn/instructions.js";
import { nextStage, stepInstruction } from "../practice/runner.js";

/**
 * screenModel(state, { i18n, feedback }) ->
 *   { phase, heading, sub, progress, tempo, chip, suggested, actions: [{ id, label, primary }] }.
 * `feedback` is the transient { kind: "correct" | "wrong" | "octave" } the view holds for a moment. Action ids are
 * session actions: START, STOP, LISTEN, AGAIN, FASTER, NEXT_KEY, NEXT_STAGE.
 */
export function screenModel(state, { i18n, feedback = null }) {
  const t = i18n.t;
  const lang = i18n.lang();
  const action = (id, label, primary = false) => ({ id, label, primary });
  const base = { phase: state.phase, heading: "", sub: "", progress: "", tempo: t("practice.tempoNow", { bpm: state.bpm }), chip: null, suggested: state.suggested, actions: [] };

  if (state.phase === "ready") {
    return { ...base, heading: t(`ex.${state.exerciseId}.goal`), sub: `${t("practice.ready")} ${t("practice.hearFirst")}`, actions: [action("START", t("common.start"), true), action("LISTEN", t("common.listen"))] };
  }
  if (state.phase === "listening") {
    return { ...base, heading: t("learn.listening"), actions: [action("STOP", t("practice.stop"), true)] };
  }
  if (state.phase === "running") {
    const step = state.run.steps[state.run.index];
    const chip = feedback?.kind === "correct" ? { kind: "correct", text: t("common.correct"), detail: "" } : feedback ? { kind: "wrong", text: t("common.tryAgain"), detail: t(feedback.kind === "octave" ? "learn.octave" : "learn.useShaded") } : null;
    return {
      ...base,
      heading: step ? renderInstruction(t, stepInstruction(step), lang) : "",
      sub: step?.label ? t("practice.chord", { symbol: step.label }) : t("learn.hintKeys"),
      progress: t("learn.step", { n: state.run.index + 1, total: state.run.steps.length }),
      chip,
      actions: [action("STOP", t("practice.stop"))],
    };
  }
  // done: the result in one sentence, the tempo to try next, and what to do now
  const { clean, wrong } = state.result;
  const s = state.suggestion;
  const hand = nextStage(state.options.hand);
  const canStage = clean && hand !== null && state.exercise.choices.hand?.includes(hand);
  const suggestion = clean && s ? (s.top ? t("practice.top") : t("practice.done.suggest", { bpm: s.bpm })) : "";
  return {
    ...base,
    heading: clean ? t("practice.done.clean") : t("practice.done.unclean", { count: wrong }),
    sub: suggestion,
    progress: "",
    chip: clean ? { kind: "correct", text: t("common.correct"), detail: "" } : null,
    actions: [
      action("AGAIN", t("practice.again"), !(clean && (s && !s.top || canStage))),
      ...(clean && s && !s.top ? [action("FASTER", t("practice.faster", { bpm: s.bpm }), true)] : []),
      ...(canStage ? [action("NEXT_STAGE", t("practice.nextHand", { hand: t(`hand.${hand}.lower`) }), !(s && !s.top))] : []),
      ...(state.exercise.keyed && state.rotation.kind !== "same" ? [action("NEXT_KEY", t("practice.nextKey"))] : []),
      action("LISTEN", t("common.listen")),
    ],
  };
}

/** The one-line announcement of an effect for the polite live region ("Next key: G major"), or "" when there is none. */
export function announcement(effect, { i18n }) {
  const t = i18n.t;
  if (effect.kind === "nextKey") return t("practice.announce.nextKey", { key: t("key.major", { tonic: effect.key }) });
  if (effect.kind === "stage") return t("practice.announce.hand", { hand: t(`hand.${effect.hand}.lower`) });
  if (effect.kind === "wrong" || effect.kind === "octave") return `${t("common.tryAgain")}. ${t(effect.kind === "octave" ? "learn.octave" : "learn.useShaded")}`;
  if (effect.kind === "done") return effect.clean ? t("practice.done.clean") : "";
  return "";
}

/** The choices the card offers as segments: [{ name, values: [{ value, label }] }], in the order of the exercise. */
export function choiceModel(state, { i18n }) {
  const t = i18n.t;
  const labelOf = {
    hand: (v) => t(`hand.${v}`),
    octaves: (v) => t("practice.octaves", { count: v }),
    quality: (v) => t(`quality.${v}`),
    direction: (v) => t(`practice.direction.${v}`),
  };
  return Object.entries(state.exercise.choices)
    .filter(([, values]) => values.length > 1)
    .map(([name, values]) => ({ name, label: t(`practice.choice.${name}`), current: state.options[name], values: values.map((value) => ({ value, label: labelOf[name](value) })) }));
}
