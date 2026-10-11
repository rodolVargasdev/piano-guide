// Practice view: the list of exercises (#/practice) and the doc card of one exercise (#/practice/<id>).
// What each screen says is plain data (`listModel`, `cardModel`) so it is testable without a DOM; the view turns it
// into elements with text nodes only. The id in the address bar is only compared against the catalog and is never
// shown. The page follows the language selector and keeps its place when the language changes.
import { GROUPS, exerciseById, exercisesIn } from "../practice/catalog.js";
import { readPracticeProgress, summaryOf } from "../practice/progress.js";
import { el } from "./dom.js";
import { cardModel, docArticle } from "./practice-doc.js";
import { createExercisePage } from "./practice-run.js";

export { cardModel };

const safeStorage = (win) => {
  try {
    return win.localStorage;
  } catch {
    return undefined; // blocked storage: the page works for the session, with no saved progress
  }
};

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
    docArticle(model),
  );
}

/**
 * practiceView({ i18n, win, storage }) returns a router view (route, root) => { dispose() }. `route.songId` is the
 * exercise id of "#/practice/<id>" (null for the list). An id the catalog does not have shows "Exercise not found"
 * and a link back to the list. A run exercise opens its page (choices, keys to press, feedback); the other exercises
 * show their card until their own screens arrive. The exercise page repaints itself when the language changes, so this view
 * leaves it alone (a redraw would lose the step, key and tempo).
 */
export function practiceView({ i18n, win = window, storage = safeStorage(win), makeEngine } = {}) {
  const t = i18n.t;
  return (route, root) => {
    let disposed = false;
    let page = null;
    const exercise = route.songId ? exerciseById(route.songId) : null;

    function render() {
      if (route.songId && !exercise) {
        root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, t("practice.notFound")), el("a", { class: "button", href: "#/practice" }, t("practice.back"))));
      } else if (exercise?.kind === "run") {
        page = createExercisePage({ i18n, win, storage, exercise, makeEngine });
        if (page) root.replaceChildren(page.element);
        else root.replaceChildren(el("section", { class: "panel", role: "alert" }, el("h2", {}, t("practice.notFound")), el("a", { class: "button", href: "#/practice" }, t("practice.back"))));
      } else if (exercise) {
        root.replaceChildren(cardScreen(cardModel({ exercise, i18n }), { back: t("practice.back") }));
      } else {
        root.replaceChildren(listScreen(listModel({ progress: readPracticeProgress(storage), i18n })));
      }
    }

    render();
    const off = i18n.onChange(() => {
      if (!disposed && !page) render();
    });
    return {
      dispose() {
        disposed = true;
        off();
        page?.dispose();
        page = null;
      },
    };
  };
}
