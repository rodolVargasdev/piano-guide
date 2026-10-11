// What the ear drill page says and offers at each moment, as plain data (so it is testable without a DOM). One question
// at a time, the choices as big buttons with a plain line each, and only the actions that make sense now. The view turns
// this model into elements and never decides what to say.
import { ROUND, UNLOCK_AT } from "../practice/ear.js";
import { INTERVAL_GROWTH, CHORD_GROWTH } from "../theory/drills.js";

const nameKey = (kind, id) => (kind === "interval" ? `interval.${id}` : `quality.${id}`);

/**
 * earModel(state, { i18n }) -> { phase, heading, sub, progress, chip, options, actions, tag }.
 * options: [{ id, label, hint, status: "idle" | "wrong" | "right", tag }]; `tag` is the words that say what the
 * status is (shown on the button, so the status never relies on color alone). Action ids: LISTEN, NEXT, ROUND.
 */
export function earModel(state, { i18n }) {
  const t = i18n.t;
  const { kind, question, phase, round } = state;
  const name = (id) => t(nameKey(kind, id));
  const action = (id, label, primary = false) => ({ id, label, primary });
  const answered = round.answered;
  const progress = phase === "roundDone" ? "" : [t("ear.question", { n: Math.min(ROUND, phase === "asking" ? answered + 1 : answered), total: ROUND }), answered > 0 ? t("ear.score", { correct: round.correct, answered }) : ""].filter(Boolean).join(" | ");
  const base = { phase, heading: "", sub: "", progress, chip: null, options: [], actions: [] };
  const listen = action("LISTEN", t(state.heard ? "common.listenAgain" : "ear.play"), !state.heard);

  if (phase === "roundDone") {
    const room = state.grown < (kind === "interval" ? INTERVAL_GROWTH : CHORD_GROWTH).length;
    return {
      ...base,
      heading: t("ear.roundDone", { correct: round.correct, total: ROUND }),
      sub: state.newOption ? t("ear.unlocked", { name: name(state.newOption) }) : room ? t("ear.needMore") : t("ear.allUnlocked"),
      chip: round.correct >= UNLOCK_AT ? { kind: "correct", text: t("common.correct"), detail: "" } : null,
      actions: [action("ROUND", t("ear.another"), true)],
    };
  }

  const options = question.options.map((id) => {
    const right = (phase === "answered" || phase === "revealed") && id === question.answer;
    const wrong = state.picked.includes(id);
    return { id, label: name(id), hint: t(`${nameKey(kind, id)}.hint`), status: right ? "right" : wrong ? "wrong" : "idle", tag: right ? t("ear.rightTag") : wrong ? t("ear.wrongTag") : "" };
  });
  const more = round.answered >= ROUND;

  if (phase === "asking") {
    return {
      ...base,
      heading: state.heard ? t(kind === "interval" ? "ear.askInterval" : "ear.askChord") : t("ear.pressPlay"),
      sub: state.attempts > 0 ? t("ear.tryHint") : state.heard ? t("ear.orPlay") : "",
      chip: state.attempts > 0 ? { kind: "wrong", text: t("common.tryAgain"), detail: "" } : null,
      options,
      actions: [listen],
    };
  }
  // answered or revealed
  return {
    ...base,
    heading: phase === "answered" ? name(question.answer) : t("ear.revealed", { name: name(question.answer) }),
    sub: t(`${nameKey(kind, question.answer)}.hint`),
    chip: phase === "answered" ? { kind: "correct", text: t("common.correct"), detail: "" } : null,
    options,
    actions: [action("NEXT", t(more ? "ear.finish" : "ear.next"), true), { ...listen, primary: false }],
  };
}
