// Practice view: the list of exercises (#/practice) and the doc card of one exercise (#/practice/<id>).
// What each screen says is plain data (`listModel`, `cardModel`) so it is testable without a DOM; the view turns it
// into elements with text nodes only. The id in the address bar is only compared against the catalog and is never
// shown. The page follows the language selector and keeps its place when the language changes.
import { GROUPS, exerciseById, exercisesIn } from "../practice/catalog.js";
import { readPracticeProgress, summaryOf } from "../practice/progress.js";
import { el } from "./dom.js";

const safeStorage = (win) => {
  try {
    return win.localStorage;
  } catch {
    return undefined; // blocked storage: the page works for the session, with no saved progress
  }
};

// Exercises whose card says that fingering books differ: the scales and the arpeggios.
const FINGERING_NOTE = new Set(["scale-major", "arpeggios"]);

/** The small facts shown on a list entry: best tempo, clean streak, clean runs and the last day. Empty when never practiced. */
export function summaryChips(summary, t) {
  if (summary.keys === 0) return [];
  return [
    summary.bestTempo > 0 ? t("practice.summary.best", { bpm: summary.bestTempo }) : null,
    summary.cleanStreak > 0 ? t("practice.summary.streak", { count: summary.cleanStreak }) : null,
    summary.cleanRuns > 0 ? t("practice.summary.runs", { count: summary.cleanRuns }) : null,
    summary.lastPracticed ? t("practice.summary.last", { date: summary.lastPracticed }) : null,
  ].filter(Boolean);
}

/** The list: a heading and the groups with their exercises, each with a one-line goal and its summary chips. */
export function listModel({ progress, i18n }) {
  const t = i18n.t;
  return {
    heading: t("common.practice"),
    groups: GROUPS.map((id) => ({
      id,
      title: t(`practice.group.${id}`),
      hint: t(`practice.groupHint.${id}`),
      items: exercisesIn(id).map((e) => ({ id: e.id, href: `#/practice/${e.id}`, title: t(`ex.${e.id}.title`), goal: t(`ex.${e.id}.goal`), chips: summaryChips(summaryOf(progress, e.id), t) })),
    })),
  };
}

/** The doc card of one exercise: goal, why, how and what good looks like, the tempo steps and the fingering note. */
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

function listScreen(model) {
  return el(
    "section",
    { class: "practice" },
    el("h2", {}, model.heading),
    model.groups.map((g) =>
      el(
        "section",
        { class: "practice-group", "data-group": g.id },
        el("h3", {}, g.title),
        el("p", { class: "meta" }, g.hint),
        el(
          "ul",
          { class: "cards practice-cards" },
          g.items.map((item) =>
            el(
              "li",
              { class: "card practice-item", "data-exercise": item.id },
              el("h4", { class: "practice-item-title" }, el("a", { href: item.href }, item.title)),
              el("p", { class: "meta" }, item.goal),
              item.chips.length > 0 ? el("p", { class: "chips" }, item.chips.map((c) => el("span", { class: "chip" }, c))) : null,
            ),
          ),
        ),
      ),
    ),
  );
}

function cardScreen(model, { back }) {
  return el(
    "section",
    { class: "practice practice-page", "data-exercise": model.id },
    el("div", { class: "practice-top" }, el("a", { class: "button button-secondary", href: "#/practice" }, back), el("h2", { class: "practice-title" }, model.title)),
    el(
      "article",
      { class: "panel practice-doc" },
      model.sections.map((s) => el("section", { class: `practice-field practice-${s.id}` }, el("h3", {}, s.heading), el("p", {}, s.text))),
      model.tempos ? el("p", { class: "meta practice-tempos" }, model.tempos) : null,
      model.notes.map((n) => el("p", { class: "meta practice-note" }, n)),
    ),
  );
}

/**
 * practiceView({ i18n, win, storage }) returns a router view (route, root) => { dispose() }. `route.songId` is the
 * exercise id of "#/practice/<id>" (null for the list). An id the catalog does not have shows "Exercise not found"
 * and a link back to the list.
 */
export function practiceView({ i18n, win = window, storage = safeStorage(win) } = {}) {
  const t = i18n.t;
  return (route, root) => {
    let disposed = false;
    const exercise = route.songId ? exerciseById(route.songId) : null;

    function render() {
      if (route.songId && !exercise) {
        root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, t("practice.notFound")), el("a", { class: "button", href: "#/practice" }, t("practice.back"))));
      } else if (exercise) {
        root.replaceChildren(cardScreen(cardModel({ exercise, i18n }), { back: t("practice.back") }));
      } else {
        root.replaceChildren(listScreen(listModel({ progress: readPracticeProgress(storage), i18n })));
      }
    }

    render();
    const off = i18n.onChange(() => {
      if (!disposed) render();
    });
    return {
      dispose() {
        disposed = true;
        off();
      },
    };
  };
}
