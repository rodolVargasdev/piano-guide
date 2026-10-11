// What the Learn screen says and offers at each moment, as plain data (so it is testable without a DOM).
// The rule for a beginner: ONE instruction at a time, in plain words, and only the actions that make
// sense now. The view turns this model into elements; it never decides what to say.
import { textOf } from "../core/text.js";
import { phraseNumber } from "../learn/lesson.js";
import { renderInstruction } from "../learn/instructions.js";

/**
 * screenModel(state, { i18n, hasSaved, showProgressReset }) ->
 *   { phase, heading, sub, progress, chip, actions: [{ id, label, primary }] }.
 * Action ids: START, CONTINUE, LISTEN, MY_TURN, LISTEN_AGAIN, REPEAT, NEXT_PHRASE. `chip` is
 * { kind: "correct" | "wrong", text, detail } while a feedback is showing. A silent (private) song never
 * gets LISTEN or LISTEN_AGAIN, and its start screen says the app does not play it.
 */
export function screenModel(s, { i18n, hasSaved = false, showProgressReset = false }) {
  const t = i18n.t;
  const lang = i18n.lang();
  const action = (id, key, primary = false) => ({ id, label: t(key), primary });
  const { n, total } = phraseNumber(s);
  const phrase = s.phrases[s.phraseIndex];
  const base = { phase: s.phase, heading: "", sub: "", progress: "", chip: null, actions: [], showProgressReset };

  if (s.phase === "start") {
    return {
      ...base,
      heading: t("learn.howTo"),
      sub: s.silent ? t("learn.silent") : "",
      actions: hasSaved ? [action("CONTINUE", "common.continue", true), action("START", "common.startOver")] : [action("START", "common.start", true)],
    };
  }
  if (s.phase === "phraseIntro") {
    const hint = phrase?.hint === undefined ? "" : textOf(phrase.hint, lang);
    return { ...base, heading: t("learn.phrase", { n, total }), sub: hint, actions: [action("LISTEN", "common.listen", true), action("MY_TURN", "common.myTurn")] };
  }
  if (s.phase === "listening") {
    return { ...base, heading: t("learn.listening"), progress: t("learn.phrase", { n, total }), actions: [action("MY_TURN", "common.myTurn", true)] };
  }
  if (s.phase === "yourTurn") {
    const step = s.steps[s.stepIndex];
    const f = s.feedback;
    const chip = f?.kind === "correct" ? { kind: "correct", text: t("common.correct"), detail: "" } : f ? { kind: "wrong", text: t("common.tryAgain"), detail: t(f.kind === "octave" ? "learn.octave" : "learn.useShaded") } : null;
    return {
      ...base,
      heading: step ? renderInstruction(t, step.instruction, lang) : "",
      sub: t("learn.hintKeys"),
      progress: `${t("learn.phrase", { n, total })} ${t("learn.step", { n: s.stepIndex + 1, total: s.steps.length })}`,
      chip,
      actions: [...(s.silent ? [] : [action("LISTEN_AGAIN", "common.listenAgain")]), action("REPEAT", "learn.repeatPhrase")],
    };
  }
  if (s.phase === "phraseComplete") {
    return { ...base, heading: t("learn.phraseDone", { n, total }), actions: [action("NEXT_PHRASE", "learn.nextPhrase", true), action("REPEAT", "learn.repeatPhrase")] };
  }
  // songComplete
  return { ...base, heading: t("learn.songDone"), actions: [action("START", "common.startOver", true)] };
}
