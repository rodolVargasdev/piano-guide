// The doc card of an exercise as an element: goal, why it matters, how to do it, what good looks like, the tempo
// steps and the fingering note. Plain text nodes only. Used by the card page and, folded, by the exercise page.
import { el } from "./dom.js";

// Exercises whose card says that fingering books differ: the scales and the arpeggios.
const FINGERING_NOTE = new Set(["scale-major", "arpeggios"]);

/** The doc card of one exercise as plain data: goal, why, how and what good looks like, the tempo steps and the fingering note. */
export function cardModel({ exercise, i18n }) {
  const t = i18n.t;
  return {
    id: exercise.id,
    title: t(`ex.${exercise.id}.title`),
    sections: ["goal", "why", "how", "good"].map((field) => ({ id: field, heading: t(`practice.card.${field}`), text: t(`ex.${exercise.id}.${field}`) })),
    tempos: exercise.tempoSteps.length > 0 ? t("practice.card.tempos", { steps: exercise.tempoSteps.join(", ") }) : "",
    notes: FINGERING_NOTE.has(exercise.id) ? [t("practice.standardFingering")] : [],
  };
}

/** docArticle(model) -> an <article> from the card model of ui/practice-view.js `cardModel`. */
export function docArticle(model) {
  return el(
    "article",
    { class: "panel practice-doc" },
    model.sections.map((s) => el("section", { class: `practice-field practice-${s.id}` }, el("h3", {}, s.heading), el("p", {}, s.text))),
    model.tempos ? el("p", { class: "meta practice-tempos" }, model.tempos) : null,
    model.notes.map((n) => el("p", { class: "meta practice-note" }, n)),
  );
}
